import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Product, ProductInstance, ProductCategory, ProductType, ProductVariant, Supplier, CabinetLocation } from '../common/entities';
import { ProductStatus } from '../common/entities/instance.entity';
import { normalizeExpirationDate } from '../common/date-utils';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
    @InjectRepository(ProductInstance) private readonly instanceRepo: Repository<ProductInstance>,
    @InjectRepository(ProductCategory) private readonly catRepo: Repository<ProductCategory>,
    @InjectRepository(ProductType) private readonly typeRepo: Repository<ProductType>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(CabinetLocation) private readonly locRepo: Repository<CabinetLocation>,
  ) {}

  /**
   * Real-time stock = count of instances in RECEIVED or PLACED status.
   * Called in findAll/findOne so UI always shows an accurate number.
   */
  private async computeStock(productId: string): Promise<number> {
    return this.instanceRepo.count({
      where: [
        { product_id: productId, status: ProductStatus.RECEIVED },
        { product_id: productId, status: ProductStatus.PLACED },
      ],
    });
  }

  async findAll() {
    const products = await this.repo.find({
      relations: ['supplier', 'category', 'type', 'variant'],
      order: { description: 'ASC' },
    });
    // Compute real-time stock for each product (RECEIVED + PLACED only)
    return Promise.all(products.map(async (p) => ({
      ...p,
      quantity_in_stock: await this.computeStock(p.id),
    })));
  }

  async filterOptions(category_id?: string, type_id?: string, variant_id?: string) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.supplier', 'supplier')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.type', 'type')
      .leftJoinAndSelect('p.variant', 'variant');

    if (category_id) qb.andWhere('p.category_id = :category_id', { category_id });
    if (type_id) qb.andWhere('p.type_id = :type_id', { type_id });
    if (variant_id) qb.andWhere('p.variant_id = :variant_id', { variant_id });

    const products = await qb.getMany();

    // Get instances for each product
    const result = [];
    for (const p of products) {
      const instances = await this.instanceRepo.find({
        where: { product_id: p.id, status: ProductStatus.PLACED },
        take: 5,
      });
      result.push({
        product_id: p.id,
        description: p.description,
        category: p.category,
        type: p.type,
        variant: p.variant,
        quantity: instances.length,
        instances: instances.map(i => ({
          id: i.id,
          serial_number: i.serial_number,
          lot_number: i.lot_number,
          expiration_date: i.expiration_date,
        })),
      });
    }

    const categories = await this.catRepo.find({ order: { description: 'ASC' } });
    const types = await this.typeRepo.find({ order: { description: 'ASC' } });
    const variants = await this.variantRepo.find({ order: { description: 'ASC' } });

    return {
      filter_options: { categories, types, variants },
      products: result,
    };
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id }, relations: ['supplier', 'category', 'type', 'variant'] });
    if (!p) throw new NotFoundException('Produit non trouvé');
    return { ...p, quantity_in_stock: await this.computeStock(p.id) };
  }

  async findByGtin(gtin: string) {
    if (!gtin) return null;
    const p = await this.repo.findOne({ where: { gtin }, relations: ['supplier', 'category', 'type', 'variant'] });
    if (!p) return null;
    return { ...p, quantity_in_stock: await this.computeStock(p.id) };
  }

  async getInstances(id: string) {
    // Only show instances that count in stock: RECEIVED (2) + PLACED (3)
    // Hide ORDERED (1), PICKED (4), CONSUMED (5), INVOICED (6) so instance count matches displayed stock
    const instances = await this.instanceRepo.find({
      where: { product_id: id },
      order: { created_at: 'DESC' },
    });
    const filtered = instances.filter(i => i.status === ProductStatus.RECEIVED || i.status === ProductStatus.PLACED);
    const result = [];
    for (const inst of filtered) {
      let location = null;
      if (inst.cabinet_location_id) {
        location = await this.locRepo.findOneBy({ id: inst.cabinet_location_id });
      }
      result.push({ ...inst, location });
    }
    return result;
  }

  async createInstance(productId: string, data: any) {
    const p = await this.repo.findOneBy({ id: productId });
    if (!p) throw new NotFoundException('Produit non trouvé');
    const inst = this.instanceRepo.create({
      id: uuidv4(),
      product_id: productId,
      serial_number: data.serial_number || null,
      lot_number: data.lot_number || null,
      expiration_date: normalizeExpirationDate(data.expiration_date),
      status: data.status || ProductStatus.RECEIVED,
    });
    await this.instanceRepo.save(inst);
    return inst;
  }

  async updateInstance(productId: string, instanceId: string, data: any) {
    const inst = await this.instanceRepo.findOneBy({ id: instanceId, product_id: productId });
    if (!inst) throw new NotFoundException('Instance non trouv\u00e9e');
    // Reject if the new serial number already exists on a different instance (any status, including consumed).
    if (data.serial_number !== undefined && data.serial_number && data.serial_number !== inst.serial_number) {
      const dup = await this.instanceRepo.findOneBy({ serial_number: data.serial_number });
      if (dup && dup.id !== instanceId) {
        throw new BadRequestException(`N\u00b0 s\u00e9rie ${data.serial_number} d\u00e9j\u00e0 utilis\u00e9`);
      }
      inst.serial_number = data.serial_number;
    } else if (data.serial_number === null || data.serial_number === '') {
      inst.serial_number = null;
    }
    if (data.lot_number !== undefined) inst.lot_number = data.lot_number;
    if (data.expiration_date !== undefined) inst.expiration_date = normalizeExpirationDate(data.expiration_date);
    if (data.status !== undefined) inst.status = data.status;
    return this.instanceRepo.save(inst);
  }

  async removeInstance(productId: string, instanceId: string) {
    const inst = await this.instanceRepo.findOneBy({ id: instanceId, product_id: productId });
    if (!inst) throw new NotFoundException('Instance non trouvée');
    await this.instanceRepo.remove(inst);
    return { deleted: true };
  }

  async create(data: any) {
    const product = this.repo.create({ id: uuidv4(), ...data });
    return this.repo.save(product);
  }

  async update(id: string, data: any) {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produit non trouvé');
    Object.assign(p, data);
    return this.repo.save(p);
  }

  async remove(id: string) {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Produit non trouvé');
    const count = await this.instanceRepo.countBy({ product_id: id });
    if (count > 0) throw new BadRequestException('Produit a des instances');
    await this.repo.remove(p);
    return { deleted: true };
  }
}
