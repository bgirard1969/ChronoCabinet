import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order, ProductInstance, Product, Supplier, Movement } from '../common/entities';
import { ProductStatus } from '../common/entities/instance.entity';
import { normalizeExpirationDate } from '../common/date-utils';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @InjectRepository(ProductInstance) private readonly instanceRepo: Repository<ProductInstance>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Movement) private readonly movementRepo: Repository<Movement>,
  ) {}

  async findAll() {
    const orders = await this.repo.find({ order: { creation_date: 'DESC' } });
    const result = [];
    for (const o of orders) {
      const supplier = await this.supplierRepo.findOneBy({ id: o.supplier_id });
      const items = await this.instanceRepo.countBy({ order_id: o.id });
      const received = await this.instanceRepo.countBy({ order_id: o.id, status: ProductStatus.RECEIVED });
      result.push({ ...o, supplier, total_items: items, received_items: received });
    }
    return result;
  }

  async findOne(id: string) {
    const o = await this.repo.findOneBy({ id });
    if (!o) throw new NotFoundException('Commande non trouvée');
    const supplier = await this.supplierRepo.findOneBy({ id: o.supplier_id });
    const instances = await this.instanceRepo.find({ where: { order_id: id } });
    const items = [];
    for (const inst of instances) {
      const product = await this.productRepo.findOneBy({ id: inst.product_id });
      items.push({ ...inst, product });
    }
    return { ...o, supplier, items };
  }

  async create(data: any) {
    const now = new Date();
    const order = this.repo.create({
      id: uuidv4(),
      supplier_id: data.supplier_id,
      order_number: data.order_number || null,
      creation_date: now,
      order_date: now,
      status: 'sent', // Skip draft - created as already sent, ready to receive via scan
    });
    await this.repo.save(order);

    // Create instances only if items provided (backward compat)
    if (data.items?.length) {
      for (const item of data.items) {
        for (let i = 0; i < (item.quantity || 1); i++) {
          await this.instanceRepo.save(this.instanceRepo.create({
            id: uuidv4(), product_id: item.product_id, status: ProductStatus.ORDERED, order_id: order.id,
          }));
        }
      }
    }
    return this.findOne(order.id);
  }

  /**
   * Scan-receive: given a raw GS1 scan, find product by GTIN, create a new RECEIVED instance
   * attached to the order, with serial/lot/expiration extracted from the scan.
   */
  async scanReceive(orderId: string, data: { gtin: string; serial_number?: string; lot_number?: string; expiration_date?: string }, userId?: string) {
    const order = await this.repo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Commande non trouv\u00e9e');
    if (!['sent', 'partially_received'].includes(order.status)) {
      throw new BadRequestException('Commande non recevable');
    }
    if (!data.gtin) throw new BadRequestException('GTIN requis');

    const product = await this.productRepo.findOneBy({ gtin: data.gtin });
    if (!product) throw new NotFoundException('Produit inconnu (GTIN)');

    // Unique SN check across all instances
    if (data.serial_number) {
      const dup = await this.instanceRepo.findOneBy({ serial_number: data.serial_number });
      if (dup) throw new BadRequestException(`N\u00b0 s\u00e9rie ${data.serial_number} d\u00e9j\u00e0 utilis\u00e9`);
    }

    const instance = this.instanceRepo.create({
      id: uuidv4(),
      product_id: product.id,
      serial_number: data.serial_number || null,
      lot_number: data.lot_number || null,
      expiration_date: normalizeExpirationDate(data.expiration_date),
      status: ProductStatus.ORDERED, // Stays ORDERED until order finalized
      order_id: orderId,
    });
    await this.instanceRepo.save(instance);

    return this.findOne(orderId);
  }

  /**
   * Manually add an item to an open order: pick product via UI + enter serial/lot/exp.
   * Stays in ORDERED state until finalize.
   */
  async manualAdd(orderId: string, data: { product_id: string; serial_number?: string; lot_number?: string; expiration_date?: string }) {
    const order = await this.repo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Commande non trouv\u00e9e');
    if (!['sent', 'partially_received'].includes(order.status)) {
      throw new BadRequestException('Commande non modifiable');
    }
    const product = await this.productRepo.findOneBy({ id: data.product_id });
    if (!product) throw new NotFoundException('Produit inconnu');

    if (data.serial_number) {
      const dup = await this.instanceRepo.findOneBy({ serial_number: data.serial_number });
      if (dup) throw new BadRequestException(`N\u00b0 s\u00e9rie ${data.serial_number} d\u00e9j\u00e0 utilis\u00e9`);
    }

    const instance = this.instanceRepo.create({
      id: uuidv4(),
      product_id: product.id,
      serial_number: data.serial_number || null,
      lot_number: data.lot_number || null,
      expiration_date: normalizeExpirationDate(data.expiration_date),
      status: ProductStatus.ORDERED,
      order_id: orderId,
    });
    await this.instanceRepo.save(instance);
    return this.findOne(orderId);
  }

  /**
   * Manually finalize order: mark all ORDERED items as RECEIVED, generate reception movements.
   */
  async finalize(orderId: string, userId?: string) {
    const order = await this.repo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Commande non trouv\u00e9e');
    if (!['sent', 'partially_received'].includes(order.status)) {
      throw new BadRequestException('Commande d\u00e9j\u00e0 finalis\u00e9e');
    }

    // Move all ORDERED instances to RECEIVED + movement record
    const ordered = await this.instanceRepo.find({ where: { order_id: orderId, status: ProductStatus.ORDERED } });
    const now = new Date();
    for (const inst of ordered) {
      inst.status = ProductStatus.RECEIVED;
      inst.reception_date = now;
      await this.instanceRepo.save(inst);
      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(), instance_id: inst.id, product_id: inst.product_id,
        type: 'reception', quantity: 1, reason: 'R\u00e9ception de commande', order_id: orderId,
        user_id: userId, timestamp: now,
      }));
    }

    order.status = 'received';
    await this.repo.save(order);
    return this.findOne(orderId);
  }

  async send(id: string) {
    const o = await this.repo.findOneBy({ id });
    if (!o) throw new NotFoundException('Commande non trouvée');
    if (o.status !== 'draft') throw new BadRequestException('Commande déjà envoyée');
    o.status = 'sent';
    o.order_date = new Date();
    return this.repo.save(o);
  }

  async receive(id: string, data: any) {
    const o = await this.repo.findOneBy({ id });
    if (!o || !['sent', 'partially_received'].includes(o.status)) {
      throw new BadRequestException('Commande non recevable');
    }

    for (const item of data.items || []) {
      const instance = await this.instanceRepo.findOneBy({ id: item.instance_id });
      if (!instance || instance.order_id !== id) continue;
      if (!item.serial_number) throw new BadRequestException('N° de série requis');

      // Check unique SN
      const existing = await this.instanceRepo.findOneBy({ serial_number: item.serial_number });
      if (existing && existing.id !== instance.id) throw new BadRequestException(`N° série ${item.serial_number} déjà utilisé`);

      instance.serial_number = item.serial_number;
      instance.lot_number = item.lot_number || null;
      instance.expiration_date = normalizeExpirationDate(item.expiration_date);
      instance.reception_date = new Date();
      instance.status = ProductStatus.RECEIVED;
      await this.instanceRepo.save(instance);

      await this.movementRepo.save(this.movementRepo.create({
        id: uuidv4(), instance_id: instance.id, product_id: instance.product_id,
        type: 'reception', quantity: 1, reason: 'Réception de commande', order_id: id, timestamp: new Date(),
      }));
    }

    // Update order status
    const allInstances = await this.instanceRepo.find({ where: { order_id: id } });
    const allReceived = allInstances.every(i => i.status >= ProductStatus.RECEIVED);
    const someReceived = allInstances.some(i => i.status >= ProductStatus.RECEIVED);
    o.status = allReceived ? 'received' : someReceived ? 'partially_received' : o.status;
    await this.repo.save(o);

    return this.findOne(id);
  }

  async addItems(id: string, data: any) {
    const o = await this.repo.findOneBy({ id });
    if (!o || o.status !== 'draft') throw new BadRequestException('Modification impossible');
    for (const item of data.items || []) {
      for (let i = 0; i < (item.quantity || 1); i++) {
        await this.instanceRepo.save(this.instanceRepo.create({
          id: uuidv4(), product_id: item.product_id, status: ProductStatus.ORDERED, order_id: id,
        }));
      }
    }
    return this.findOne(id);
  }

  async removeItem(orderId: string, instanceId: string) {
    const o = await this.repo.findOneBy({ id: orderId });
    if (!o || ['received', 'cancelled'].includes(o.status)) throw new BadRequestException('Modification impossible');
    const inst = await this.instanceRepo.findOneBy({ id: instanceId, order_id: orderId });
    if (!inst) throw new NotFoundException('Instance non trouvée');
    if (inst.status !== ProductStatus.ORDERED) throw new BadRequestException('Seules les instances commandées peuvent être retirées');
    await this.instanceRepo.remove(inst);
    return this.findOne(orderId);
  }

  async remove(id: string) {
    const o = await this.repo.findOneBy({ id });
    if (!o) throw new NotFoundException('Commande non trouvée');
    if (o.status !== 'draft') throw new BadRequestException('Seul un brouillon peut être supprimé');
    const deleted = await this.instanceRepo.delete({ order_id: id, status: ProductStatus.ORDERED });
    await this.repo.remove(o);
    return { deleted: true, instances_deleted: deleted.affected };
  }

  async cancel(id: string) {
    const o = await this.repo.findOneBy({ id });
    if (!o) throw new NotFoundException('Commande non trouvée');
    if (['received', 'cancelled'].includes(o.status)) {
      throw new BadRequestException('Impossible d\'annuler cette commande');
    }
    // Delete ordered (not yet received) instances
    const deleted = await this.instanceRepo.delete({ order_id: id, status: ProductStatus.ORDERED });
    o.status = 'cancelled';
    await this.repo.save(o);
    return { message: 'Commande annulée', instances_deleted: deleted.affected };
  }
}
