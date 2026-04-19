import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { ProductInstance, Product, CabinetLocation, Movement, Employee, Order, Supplier } from '../common/entities';
import { ProductStatus } from '../common/entities/instance.entity';
import { formatCellCoord } from '../common/cabinet-coord';

@Injectable()
export class InstancesService {
  constructor(
    @InjectRepository(ProductInstance) private readonly repo: Repository<ProductInstance>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(CabinetLocation) private readonly locRepo: Repository<CabinetLocation>,
    @InjectRepository(Movement) private readonly movementRepo: Repository<Movement>,
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async findAll(filters: { status?: number; product_id?: string; order_id?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.product_id) where.product_id = filters.product_id;
    if (filters.order_id) where.order_id = filters.order_id;
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  async pendingPlacement() {
    return this.repo.find({ where: { status: ProductStatus.RECEIVED }, order: { created_at: 'ASC' } });
  }

  async consumption() {
    return this.repo.find({
      where: [{ status: ProductStatus.PICKED }, { status: ProductStatus.CONSUMED }],
      order: { created_at: 'DESC' },
    });
  }

  async availableStock(category_id?: string, type_id?: string, variant_id?: string) {
    const qb = this.productRepo.createQueryBuilder('p');
    if (category_id) qb.andWhere('p.category_id = :category_id', { category_id });
    if (type_id) qb.andWhere('p.type_id = :type_id', { type_id });
    if (variant_id) qb.andWhere('p.variant_id = :variant_id', { variant_id });
    const products = await qb.getMany();

    const result = [];
    for (const p of products) {
      const instances = await this.repo.find({
        where: { product_id: p.id, status: ProductStatus.PLACED },
        order: { expiration_date: 'ASC' },
      });
      if (instances.length === 0) continue;
      result.push({
        product_id: p.id,
        description: p.description,
        quantity: instances.length,
        instances: instances.map(i => ({ id: i.id, serial_number: i.serial_number, lot_number: i.lot_number, expiration_date: i.expiration_date })),
      });
    }
    return result;
  }

  async fifoSuggestion(category_id?: string, type_id?: string, variant_id?: string, skip = 0) {
    const qb = this.productRepo.createQueryBuilder('p');
    if (category_id) qb.andWhere('p.category_id = :category_id', { category_id });
    if (type_id) qb.andWhere('p.type_id = :type_id', { type_id });
    if (variant_id) qb.andWhere('p.variant_id = :variant_id', { variant_id });
    const products = await qb.getMany();

    if (!products.length) return { suggestion: null, total_available: 0 };

    const productIds = products.map(p => p.id);
    // Calendar today in UTC (format YYYY-MM-DD). An instance expiring TODAY is still valid.
    const todayStr = new Date().toISOString().slice(0, 10);
    const allInstances = await this.repo.createQueryBuilder('i')
      .where('i.product_id IN (:...productIds)', { productIds })
      .andWhere('i.status = :status', { status: ProductStatus.PLACED })
      .orderBy('i.expiration_date', 'ASC', 'NULLS LAST')
      .addOrderBy('i.created_at', 'ASC')
      .getMany();
    // Exclude expired instances: only remove those with expiration_date strictly BEFORE today.
    const instances = allInstances.filter(i => {
      if (!i.expiration_date) return true;
      const expStr = (i.expiration_date as any).toISOString
        ? (i.expiration_date as any).toISOString().slice(0, 10)
        : String(i.expiration_date).slice(0, 10);
      return expStr >= todayStr;
    });

    if (!instances.length) return { suggestion: null, total_available: 0 };
    if (skip >= instances.length) return { suggestion: null, total_available: instances.length };

    const inst = instances[skip];
    const product = await this.productRepo.findOne({ where: { id: inst.product_id }, relations: ['category', 'type', 'variant'] });

    let locationName: string | null = null;
    if (inst.cabinet_location_id) {
      const loc = await this.locRepo.findOneBy({ id: inst.cabinet_location_id });
      if (loc) {
        const cabRepo = this.locRepo.manager.getRepository('Cabinet');
        const cab: any = await cabRepo.findOneBy({ id: loc.cabinet_id });
        locationName = cab ? `${cab.description} ${formatCellCoord(loc.row, loc.column)}` : formatCellCoord(loc.row, loc.column);
      }
    }

    return {
      suggestion: {
        id: inst.id,
        serial_number: inst.serial_number,
        lot_number: inst.lot_number,
        expiration_date: inst.expiration_date,
        product_description: product?.description,
        category: product?.category?.description,
        type: product?.type?.description,
        variant: product?.variant?.description,
        location: locationName,
      },
      total_available: instances.length,
      current_index: skip,
    };
  }

  async consume(id: string, userId?: string) {
    const inst = await this.repo.findOneBy({ id });
    if (!inst || inst.status !== ProductStatus.PICKED) throw new BadRequestException('Instance non prélevée');
    inst.status = ProductStatus.CONSUMED;
    await this.repo.save(inst);
    await this.movementRepo.save(this.movementRepo.create({
      id: uuidv4(), instance_id: id, product_id: inst.product_id,
      type: 'consommation', quantity: 1, user_id: userId, timestamp: new Date(),
    }));
    return inst;
  }

  async pickLibre(data: { instance_id: string; patient_file?: string }, userId?: string) {
    const inst = await this.repo.findOneBy({ id: data.instance_id });
    if (!inst || inst.status !== ProductStatus.PLACED) throw new BadRequestException('Instance non disponible');
    // Reject expired products (calendar date < today UTC). Cannot be used on patients.
    if (inst.expiration_date) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const expStr = (inst.expiration_date as any).toISOString
        ? (inst.expiration_date as any).toISOString().slice(0, 10)
        : String(inst.expiration_date).slice(0, 10);
      if (expStr < todayStr) {
        throw new BadRequestException(`Produit expir\u00e9 (${expStr}) \u2014 ne peut pas \u00eatre utilis\u00e9`);
      }
    }
    inst.status = ProductStatus.PICKED;
    inst.usage_date = new Date();
    await this.repo.save(inst);

    if (inst.cabinet_location_id) {
      await this.locRepo.update(inst.cabinet_location_id, { is_empty: true, instance_id: null });
    }

    await this.movementRepo.save(this.movementRepo.create({
      id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
      type: 'prelevement', quantity: 1, user_id: userId,
      reason: `Prélèvement libre${data.patient_file ? ' — MRN: ' + data.patient_file : ''}`,
      location_code: inst.cabinet_location_id, timestamp: new Date(),
    }));
    return inst;
  }

  async scan(serial_number: string, lot_number?: string) {
    let inst: ProductInstance | null = null;
    if (serial_number) {
      // Prefer active instances (RECEIVED > PICKED > PLACED). Fallback to any match.
      inst = await this.repo.findOne({ where: { serial_number, status: ProductStatus.RECEIVED } })
        || await this.repo.findOne({ where: { serial_number, status: ProductStatus.PICKED } })
        || await this.repo.findOne({ where: { serial_number, status: ProductStatus.PLACED } })
        || await this.repo.findOneBy({ serial_number });
    }
    if (!inst && lot_number) {
      // Fallback: find first available instance by lot (RECEIVED > PICKED > PLACED)
      inst = await this.repo.findOne({ where: { lot_number, status: ProductStatus.RECEIVED } })
        || await this.repo.findOne({ where: { lot_number, status: ProductStatus.PICKED } })
        || await this.repo.findOne({ where: { lot_number, status: ProductStatus.PLACED } });
    }
    if (!inst) return { action: 'unknown', message: 'N\u00b0 s\u00e9rie ou lot inconnu' };
    const product = await this.productRepo.findOneBy({ id: inst.product_id });

    switch (inst.status) {
      case ProductStatus.RECEIVED:
        // Product from an order, ready to be placed
        const suggestedLoc = await this.findAvailableLocation(inst.product_id);
        return { action: 'place', instance: inst, product, suggested_location: suggestedLoc };
      case ProductStatus.PICKED:
        // Product picked but not used, return to stock
        const returnLoc = await this.findAvailableLocation(inst.product_id);
        return { action: 'return_to_stock', instance: inst, product, suggested_location: returnLoc };
      case ProductStatus.PLACED:
        return { action: 'already_placed', instance: inst, product };
      default:
        return { action: 'unavailable', instance: inst, product, message: `Statut: ${inst.status}` };
    }
  }

  async findAvailableLocation(productId: string): Promise<any> {
    // Check if product is special order
    const product = await this.productRepo.findOneBy({ id: productId });
    const isSpecialOrder = product?.is_special_order || false;

    let loc: any = null;

    if (isSpecialOrder) {
      // Special order: find any empty location reserved for special orders
      loc = await this.locRepo.findOne({
        where: { is_special_order_reserved: true, is_empty: true },
        order: { row: 'ASC', column: 'ASC' },
      });
    } else {
      // 1. Priority: empty location designated for this product
      loc = await this.locRepo.findOne({
        where: { product_id: productId, is_empty: true, is_special_order_reserved: false },
        order: { row: 'ASC', column: 'ASC' },
      });
      if (!loc) {
        // 2. Fallback A: any empty location in a cabinet whose name contains this product's
        //    category description (so a Gastroscope doesn't end up in the Endoscope cabinet).
        const product = await this.productRepo.findOne({ where: { id: productId }, relations: ['category'] });
        const categoryKey = product?.category?.description?.toLowerCase();
        if (categoryKey) {
          const cabRepo = this.locRepo.manager.getRepository('Cabinet');
          const cabs: any[] = await cabRepo.find();
          const matchingCabIds = cabs.filter(c => (c.description || '').toLowerCase().includes(categoryKey)).map(c => c.id);
          if (matchingCabIds.length) {
            loc = await this.locRepo.createQueryBuilder('l')
              .where('l.cabinet_id IN (:...ids)', { ids: matchingCabIds })
              .andWhere('l.product_id IS NULL')
              .andWhere('l.is_empty = :empty', { empty: true })
              .andWhere('l.is_special_order_reserved = :sp', { sp: false })
              .orderBy('l.row', 'ASC')
              .addOrderBy('l.column', 'ASC')
              .getOne();
          }
        }
      }
      if (!loc) {
        // 3. Last fallback: any empty location with no designated product and not special order
        loc = await this.locRepo.findOne({
          where: { product_id: null as any, is_empty: true, is_special_order_reserved: false },
          order: { row: 'ASC', column: 'ASC' },
        });
      }
    }

    if (!loc) return null;
    const cab = await this.locRepo.manager.getRepository('Cabinet').findOneBy({ id: loc.cabinet_id }) as any;
    return { ...loc, cabinet_name: cab?.description || null };
  }

  async autoPlace(instanceId: string, userId?: string) {
    const inst = await this.repo.findOneBy({ id: instanceId });
    if (!inst) throw new NotFoundException('Instance non trouv\u00e9e');
    if (inst.status !== ProductStatus.RECEIVED && inst.status !== ProductStatus.PICKED) {
      throw new BadRequestException('Instance non pla\u00e7able');
    }

    const loc = await this.findAvailableLocation(inst.product_id);
    if (!loc) throw new BadRequestException('Aucun emplacement disponible pour ce produit');

    inst.status = ProductStatus.PLACED;
    inst.cabinet_location_id = loc.id;
    await this.repo.save(inst);

    loc.is_empty = false;
    loc.instance_id = inst.id;
    await this.locRepo.save(loc);

    await this.movementRepo.save(this.movementRepo.create({
      id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
      type: 'placement', quantity: 1, user_id: userId,
      location_code: loc.id, timestamp: new Date(),
    }));

    const product = await this.productRepo.findOneBy({ id: inst.product_id });
    return { instance: inst, location: loc, product };
  }

  async place(data: { instance_id: string; cabinet_location_id: string }, userId?: string) {
    const inst = await this.repo.findOneBy({ id: data.instance_id });
    if (!inst || (inst.status !== ProductStatus.RECEIVED && inst.status !== ProductStatus.PICKED)) {
      throw new BadRequestException('Instance non plaçable');
    }
    inst.status = ProductStatus.PLACED;
    inst.cabinet_location_id = data.cabinet_location_id;
    await this.repo.save(inst);

    await this.locRepo.update(data.cabinet_location_id, { is_empty: false, instance_id: inst.id });

    await this.movementRepo.save(this.movementRepo.create({
      id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
      type: 'placement', quantity: 1, user_id: userId,
      location_code: data.cabinet_location_id, timestamp: new Date(),
    }));
    return inst;
  }

  async returnToStock(data: { instance_id: string; cabinet_location_id: string }, userId?: string) {
    return this.place(data, userId);
  }

  async verifyAdminPin(data: { pin?: string; card_id?: string }) {
    const employees = await this.employeeRepo.find();
    for (const emp of employees) {
      if (!['administrateur', 'gestionnaire'].includes(emp.role)) continue;
      if (data.pin && emp.pin_hash && await bcrypt.compare(data.pin, emp.pin_hash)) {
        return { valid: true, employee: { id: emp.id, first_name: emp.first_name, last_name: emp.last_name } };
      }
      if (data.card_id && emp.card_id === data.card_id) {
        return { valid: true, employee: { id: emp.id, first_name: emp.first_name, last_name: emp.last_name } };
      }
    }
    throw new BadRequestException('NIP ou carte invalide');
  }

  async exportGrm(userId?: string) {
    const consumed = await this.repo.find({ where: { status: ProductStatus.CONSUMED } });
    if (consumed.length === 0) return { grm_content: '', grm_lines_count: 0, invoiced_count: 0, orders_created: [] };

    const lines: string[] = [];
    const bySupplier: Record<string, { supplier_id: string; supplier_name: string; product_ids: string[] }> = {};

    for (const inst of consumed) {
      const product = await this.productRepo.findOne({ where: { id: inst.product_id }, relations: ['supplier'] });
      if (!product) continue;

      lines.push(`1|1.0|T008|RC|${product.grm_number || ''}|${inst.serial_number || ''}|${inst.lot_number || ''}|${inst.expiration_date?.toISOString().slice(0, 10) || ''}`);

      inst.status = ProductStatus.INVOICED;
      await this.repo.save(inst);

      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
        type: 'facturation', quantity: 1, user_id: userId, timestamp: new Date(),
      }));

      if (product.supplier_id) {
        if (!bySupplier[product.supplier_id]) {
          bySupplier[product.supplier_id] = { supplier_id: product.supplier_id, supplier_name: product.supplier?.name || '', product_ids: [] };
        }
        bySupplier[product.supplier_id].product_ids.push(product.id);
      }
    }

    // Create replacement orders
    const ordersCreated = [];
    for (const key of Object.keys(bySupplier)) {
      const s = bySupplier[key];
      const order = this.orderRepo.create({
        id: uuidv4(), supplier_id: s.supplier_id, creation_date: new Date(), order_date: new Date(), status: 'sent',
      });
      await this.orderRepo.save(order);
      for (const pid of s.product_ids) {
        await this.repo.save(this.repo.create({
          id: uuidv4(), product_id: pid, status: ProductStatus.ORDERED, order_id: order.id,
        }));
      }
      ordersCreated.push({ order_id: order.id, supplier_name: s.supplier_name, total_items: s.product_ids.length });
    }

    return {
      grm_content: lines.join('\n'),
      grm_lines_count: lines.length,
      invoiced_count: consumed.length,
      orders_created: ordersCreated,
    };
  }
}
