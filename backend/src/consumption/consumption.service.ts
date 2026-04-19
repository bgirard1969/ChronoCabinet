import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { ProductInstance, Product, Movement, CabinetLocation, ImportHistory, Cabinet, Order, Supplier } from '../common/entities';
import { ProductStatus } from '../common/entities/instance.entity';
import { formatCellCoord } from '../common/cabinet-coord';

@Injectable()
export class ConsumptionService implements OnModuleInit {
  private readonly logger = new Logger(ConsumptionService.name);

  constructor(
    @InjectRepository(ProductInstance) private readonly instanceRepo: Repository<ProductInstance>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Movement) private readonly movementRepo: Repository<Movement>,
    @InjectRepository(CabinetLocation) private readonly locRepo: Repository<CabinetLocation>,
    @InjectRepository(ImportHistory) private readonly historyRepo: Repository<ImportHistory>,
    @InjectRepository(Cabinet) private readonly cabinetRepo: Repository<Cabinet>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async onModuleInit() {
    // Backfill facturation movements for existing INVOICED instances that lack one
    const invoiced = await this.instanceRepo.find({ where: { status: ProductStatus.INVOICED } });
    let created = 0;
    for (const inst of invoiced) {
      const existing = await this.movementRepo.findOne({
        where: { instance_id: inst.id, type: 'facturation' },
      });
      if (existing) continue;

      const ts = inst.usage_date || inst.created_at || new Date();
      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(),
        instance_id: inst.id,
        product_id: inst.product_id,
        type: 'facturation',
        quantity: 1,
        timestamp: ts,
        reason: 'Envoi GRM (historique)',
      }));
      created++;
    }
    if (created > 0) this.logger.log(`Backfill: ${created} mouvement(s) facturation cree(s) pour instances INVOICED existantes`);

    // Ensure facturation movements sort after their sibling consommation movements
    // (bump facturation.timestamp by +1s when it is <= the sibling consommation.timestamp)
    const facturations = await this.movementRepo.find({ where: { type: 'facturation' } });
    let bumped = 0;
    for (const fact of facturations) {
      if (!fact.instance_id) continue;
      const conso = await this.movementRepo.findOne({
        where: { instance_id: fact.instance_id, type: 'consommation' },
      });
      if (conso && new Date(fact.timestamp).getTime() <= new Date(conso.timestamp).getTime()) {
        fact.timestamp = new Date(new Date(conso.timestamp).getTime() + 1000);
        await this.movementRepo.save(fact);
        bumped++;
      }
    }
    if (bumped > 0) this.logger.log(`Backfill: ${bumped} mouvement(s) facturation reordonne(s) apres consommation`);
  }

  async preview(fileBuffer: Buffer) {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Map headers
    const headers = Object.keys(rows[0] || {});
    const colMap: Record<string, string> = {};
    for (const h of headers) {
      const hl = h.toLowerCase();
      if (hl.includes('mrn')) colMap.mrn = h;
      if (hl.includes('naissance')) colMap.birth_date = h;
      if (hl.includes('serie') || hl.includes('série')) colMap.serial = h;
      if (hl.includes('lot')) colMap.lot = h;
      if (hl.includes('description') || hl.includes('produit')) colMap.description = h;
      if (hl.includes('code_article') || hl.includes('code article')) colMap.code = h;
    }

    const matched = [];
    const unmatched = [];
    const manual = [];

    for (const row of rows) {
      const sn = colMap.serial ? String(row[colMap.serial]).trim() : '';
      const lot = colMap.lot ? String(row[colMap.lot]).trim() : '';
      const desc = colMap.description ? String(row[colMap.description]).trim() : '';
      const mrn = colMap.mrn ? String(row[colMap.mrn]).trim() : '';

      let instance: ProductInstance | null = null;

      // Search in PICKED or CONSUMED instances (those in Consommation module)
      if (sn) {
        instance = await this.instanceRepo.findOne({
          where: { serial_number: sn, status: ProductStatus.PICKED },
        }) || await this.instanceRepo.findOne({
          where: { serial_number: sn, status: ProductStatus.CONSUMED },
        }) || await this.instanceRepo.findOne({
          where: { serial_number: sn, status: ProductStatus.PLACED },
        });
      }
      if (!instance && lot) {
        instance = await this.instanceRepo.findOne({
          where: { lot_number: lot, status: ProductStatus.PICKED },
        }) || await this.instanceRepo.findOne({
          where: { lot_number: lot, status: ProductStatus.CONSUMED },
        }) || await this.instanceRepo.findOne({
          where: { lot_number: lot, status: ProductStatus.PLACED },
        });
      }

      const product = instance ? await this.productRepo.findOneBy({ id: instance.product_id }) : null;
      const item = { row_data: row, mrn, serial_number: sn, lot_number: lot, description: desc };

      if (instance) {
        matched.push({ ...item, instance_id: instance.id, product_description: product?.description, current_status: instance.status });
      } else if (sn || lot) {
        unmatched.push(item);
      } else {
        manual.push(item);
      }
    }

    return { matched, unmatched, manual, total: rows.length };
  }

  async confirm(data: { matched_ids: string[] }, userId: string) {
    let confirmed = 0;
    for (const instId of data.matched_ids) {
      const inst = await this.instanceRepo.findOneBy({ id: instId });
      if (!inst) continue;

      if (inst.status === ProductStatus.PLACED && inst.cabinet_location_id) {
        await this.locRepo.update(inst.cabinet_location_id, { is_empty: true, instance_id: null });
        await this.movementRepo.save(this.movementRepo.create({
          id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
          type: 'prelevement', quantity: 1, user_id: userId, timestamp: new Date(),
        }));
      }

      inst.status = ProductStatus.CONSUMED;
      await this.instanceRepo.save(inst);
      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
        type: 'consommation', quantity: 1, user_id: userId, timestamp: new Date(),
      }));
      confirmed++;
    }

    await this.historyRepo.save(this.historyRepo.create({
      id: uuidv4(), type: 'consumption', total_lines: data.matched_ids.length,
      matched: confirmed, user_id: userId,
    }));

    return { confirmed };
  }

  async getImports() {
    return this.historyRepo.find({ order: { imported_at: 'DESC' }, take: 100 });
  }

  async getPickedConsumed(statusFilter?: string) {
    const statuses = [];
    if (!statusFilter || statusFilter === 'all') {
      statuses.push(ProductStatus.PICKED, ProductStatus.CONSUMED);
    } else if (statusFilter === 'picked') {
      statuses.push(ProductStatus.PICKED);
    } else if (statusFilter === 'consumed') {
      statuses.push(ProductStatus.CONSUMED);
    }

    const instances = await this.instanceRepo.createQueryBuilder('i')
      .where('i.status IN (:...statuses)', { statuses })
      .orderBy('i.usage_date', 'DESC')
      .addOrderBy('i.created_at', 'DESC')
      .getMany();

    const result = [];
    for (const inst of instances) {
      const product = await this.productRepo.findOne({
        where: { id: inst.product_id },
        relations: ['category', 'type', 'variant', 'supplier'],
      });
      let locationName: string | null = null;
      if (inst.cabinet_location_id) {
        const loc = await this.locRepo.findOneBy({ id: inst.cabinet_location_id });
        if (loc) {
          const cab = await this.cabinetRepo.findOneBy({ id: loc.cabinet_id });
          locationName = cab ? `${cab.description} ${formatCellCoord(loc.row, loc.column)}` : formatCellCoord(loc.row, loc.column);
        }
      }
      result.push({
        id: inst.id,
        serial_number: inst.serial_number,
        lot_number: inst.lot_number,
        expiration_date: inst.expiration_date,
        usage_date: inst.usage_date,
        reception_date: inst.reception_date,
        status: inst.status,
        order_id: inst.order_id,
        product_description: product?.description || null,
        category: product?.category?.description || null,
        type: product?.type?.description || null,
        variant: product?.variant?.description || null,
        supplier: product?.supplier?.name || null,
        grm_number: product?.grm_number || null,
        location: locationName,
      });
    }
    return result;
  }

  async toggleStatus(instanceId: string, userId: string) {
    const inst = await this.instanceRepo.findOneBy({ id: instanceId });
    if (!inst) throw new NotFoundException('Instance non trouvée');

    if (inst.status === ProductStatus.PICKED) {
      inst.status = ProductStatus.CONSUMED;
      inst.usage_date = new Date();
      await this.instanceRepo.save(inst);
      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
        type: 'consommation', quantity: 1, user_id: userId, timestamp: new Date(),
      }));
      return { status: 'consumed', instance_id: inst.id };
    } else if (inst.status === ProductStatus.CONSUMED) {
      inst.status = ProductStatus.PICKED;
      await this.instanceRepo.save(inst);
      return { status: 'picked', instance_id: inst.id };
    }

    throw new BadRequestException('Statut incompatible');
  }

  async sendToGrm(data: { instance_ids: string[] }, userId: string) {
    const now = new Date();
    const dateStr = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const dateCreation = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const dateTimeField = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${dateStr.slice(0, 2)}${timeStr}`;

    const grmLines: string[] = [];
    const processedInstances: any[] = [];
    const supplierProducts: Map<string, { supplier: any; products: any[] }> = new Map();

    // Line 0 - header
    grmLines.push('0|||||||||||||||||');

    let lineNum = 1;
    for (const instId of data.instance_ids) {
      const inst = await this.instanceRepo.findOneBy({ id: instId });
      if (!inst || (inst.status !== ProductStatus.PICKED && inst.status !== ProductStatus.CONSUMED)) continue;

      const product = await this.productRepo.findOne({
        where: { id: inst.product_id },
        relations: ['supplier'],
      });
      if (!product) continue;

      const grmCode = product.grm_number || '';
      const serialNumber = inst.serial_number || '';

      // GRM line: lineNum|1.0|T008|RC|DATE|100171|675102||||SERIAL|DATETIME|0|GRM_CODE|1|||atms2||
      grmLines.push(`${lineNum}|1.0|T008|RC|${dateCreation}|100171|675102||||${serialNumber}|${dateTimeField}|0|${grmCode}|1|||atms2||`);
      lineNum++;

      // If still PICKED, mark consumed first and record consommation movement
      if (inst.status === ProductStatus.PICKED) {
        inst.status = ProductStatus.CONSUMED;
        inst.usage_date = now;
        await this.instanceRepo.save(inst);
        await this.movementRepo.save(this.movementRepo.create({
          id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
          type: 'consommation', quantity: 1, user_id: userId, timestamp: now,
          reason: 'Envoi GRM',
        }));
      }
      // Always mark as INVOICED after GRM send and record facturation movement
      // Timestamp +1s to guarantee it sorts after the consommation when both happen at the same send
      inst.status = ProductStatus.INVOICED;
      await this.instanceRepo.save(inst);

      const facturationTs = new Date(now.getTime() + 1000);
      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
        type: 'facturation', quantity: 1, user_id: userId, timestamp: facturationTs,
        reason: 'Envoi GRM',
      }));

      processedInstances.push({ instance: inst, product });

      // Group by supplier for draft orders (skip special orders)
      if (product.supplier_id && !product.is_special_order) {
        if (!supplierProducts.has(product.supplier_id)) {
          supplierProducts.set(product.supplier_id, { supplier: product.supplier, products: [] });
        }
        supplierProducts.get(product.supplier_id)!.products.push(product);
      }
    }

    // Last line - line number without data (end marker)
    grmLines.push(`${lineNum}|||||||||||||||||`);

    // Create draft orders per supplier
    const createdOrders: any[] = [];
    for (const [supplierId, { supplier, products }] of supplierProducts) {
      const order = this.orderRepo.create({
        id: uuidv4(),
        supplier_id: supplierId,
        creation_date: now,
        status: 'draft',
      });
      await this.orderRepo.save(order);

      // Create order items (ProductInstance with ORDERED status)
      for (const prod of products) {
        await this.instanceRepo.save(this.instanceRepo.create({
          id: uuidv4(),
          product_id: prod.id,
          status: ProductStatus.ORDERED,
          order_id: order.id,
        }));
      }

      createdOrders.push({
        order_id: order.id,
        supplier_name: supplier?.name || 'Inconnu',
        item_count: products.length,
      });
    }

    // Save import history
    await this.historyRepo.save(this.historyRepo.create({
      id: uuidv4(), type: 'grm_export', total_lines: data.instance_ids.length,
      matched: processedInstances.length, user_id: userId,
    }));

    const grmContent = grmLines.join('\n');
    const filename = `GRM_${dateCreation}_${timeStr}.txt`;

    return {
      grm_content: grmContent,
      filename,
      processed: processedInstances.length,
      orders_created: createdOrders,
    };
  }
}
