import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { Cabinet, CabinetLocation, ProductInstance, Product } from '../common/entities';

function colLabel(c: number): string {
  let n = c;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

@Injectable()
export class CabinetsService {
  constructor(
    @InjectRepository(Cabinet) private readonly repo: Repository<Cabinet>,
    @InjectRepository(CabinetLocation) private readonly locRepo: Repository<CabinetLocation>,
    @InjectRepository(ProductInstance) private readonly instanceRepo: Repository<ProductInstance>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async findAll() {
    const cabinets = await this.repo.find({ order: { description: 'ASC' } });
    const result = [];
    for (const c of cabinets) {
      const locs = await this.locRepo.countBy({ cabinet_id: c.id });
      const occupied = await this.locRepo.countBy({ cabinet_id: c.id, is_empty: false });
      result.push({ ...c, total_locations: locs, occupied_locations: occupied });
    }
    return result;
  }

  async findOne(id: string) {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException('Cabinet non trouvé');
    return c;
  }

  async create(data: any) {
    const cabinet = this.repo.create({ id: uuidv4(), description: data.description, rows: data.rows, columns: data.columns });
    await this.repo.save(cabinet);

    // Generate locations
    for (let r = 1; r <= data.rows; r++) {
      for (let c = 1; c <= data.columns; c++) {
        await this.locRepo.save(this.locRepo.create({
          id: uuidv4(), cabinet_id: cabinet.id, row: r, column: c, is_empty: true,
        }));
      }
    }
    return cabinet;
  }

  async update(id: string, data: any) {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException('Cabinet non trouvé');

    const oldRows = c.rows;
    const oldCols = c.columns;
    const newRows = data.rows ?? oldRows;
    const newCols = data.columns ?? oldCols;

    // Update description
    if (data.description !== undefined) c.description = data.description;

    // Resize matrix if needed
    if (newRows !== oldRows || newCols !== oldCols) {
      // Check: can't remove rows/cols that have occupied locations
      if (newRows < oldRows || newCols < oldCols) {
        const occupiedOutside = await this.locRepo.createQueryBuilder('l')
          .where('l.cabinet_id = :id', { id })
          .andWhere('l.is_empty = :empty', { empty: false })
          .andWhere('(l.row > :newRows OR l.col > :newCols)', { newRows, newCols })
          .getCount();
        if (occupiedOutside > 0) {
          throw new BadRequestException(`Impossible de r\u00e9duire : ${occupiedOutside} emplacement(s) occup\u00e9(s) seraient supprim\u00e9(s)`);
        }
      }

      // Remove locations outside new bounds
      if (newRows < oldRows) {
        await this.locRepo.createQueryBuilder().delete()
          .where('cabinet_id = :id', { id }).andWhere('row > :newRows', { newRows }).execute();
      }
      if (newCols < oldCols) {
        await this.locRepo.createQueryBuilder().delete()
          .where('cabinet_id = :id', { id }).andWhere('col > :newCols', { newCols }).execute();
      }

      // Add new locations for expanded rows/cols
      for (let r = 1; r <= newRows; r++) {
        for (let col = 1; col <= newCols; col++) {
          if (r > oldRows || col > oldCols) {
            const exists = await this.locRepo.findOneBy({ cabinet_id: id, row: r, column: col });
            if (!exists) {
              await this.locRepo.save(this.locRepo.create({
                id: uuidv4(), cabinet_id: id, row: r, column: col, is_empty: true,
              }));
            }
          }
        }
      }

      c.rows = newRows;
      c.columns = newCols;
    }

    return this.repo.save(c);
  }

  async remove(id: string) {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException('Cabinet non trouvé');
    const occupied = await this.locRepo.countBy({ cabinet_id: id, is_empty: false });
    if (occupied > 0) throw new BadRequestException('Cabinet contient des produits');
    await this.locRepo.delete({ cabinet_id: id });
    await this.repo.remove(c);
    return { deleted: true };
  }

  async getLocations(id: string) {
    const locs = await this.locRepo.find({ where: { cabinet_id: id }, order: { row: 'ASC', column: 'ASC' } });
    const result = [];
    for (const loc of locs) {
      let instance = null;
      let product = null;
      if (loc.instance_id) {
        instance = await this.instanceRepo.findOneBy({ id: loc.instance_id });
        if (instance) product = await this.productRepo.findOneBy({ id: instance.product_id });
      }
      let designatedProduct = null;
      if (loc.product_id) {
        designatedProduct = await this.productRepo.findOneBy({ id: loc.product_id });
      }
      result.push({
        id: loc.id, cabinet_id: loc.cabinet_id, row: loc.row, column: loc.column,
        is_empty: loc.is_empty, product_id: loc.product_id, instance_id: loc.instance_id,
        is_special_order_reserved: loc.is_special_order_reserved || false,
        serial_number: instance?.serial_number || null,
        lot_number: instance?.lot_number || null,
        expiration_date: instance?.expiration_date || null,
        product_description: product?.description || null,
        designated_product: designatedProduct ? { id: designatedProduct.id, description: designatedProduct.description } : null,
      });
    }
    return result;
  }

  async updateLocation(cabinetId: string, locId: string, data: any) {
    const loc = await this.locRepo.findOneBy({ id: locId, cabinet_id: cabinetId });
    if (!loc) throw new NotFoundException('Emplacement non trouvé');
    if (data.product_id !== undefined) loc.product_id = data.product_id;
    if (data.is_special_order_reserved !== undefined) loc.is_special_order_reserved = data.is_special_order_reserved;
    return this.locRepo.save(loc);
  }

  /**
   * Export all cabinets with their occupied locations as an Excel file.
   * Columns: Casier, Position (ex: A1), Code produit (grm_number), Description, N° Série / Lot, Expiration
   */
  async exportExcel(): Promise<Buffer> {
    const cabinets = await this.repo.find({ order: { description: 'ASC' } });
    const rows: any[] = [];

    for (const cab of cabinets) {
      const locs = await this.locRepo.find({ where: { cabinet_id: cab.id }, order: { row: 'ASC', column: 'ASC' } });
      for (const loc of locs) {
        if (loc.product_id) {
          // Find the most recent instance at this location
          const instance = await this.instanceRepo.findOne({
            where: { cabinet_location_id: loc.id },
            order: { created_at: 'DESC' },
          });
          if (!instance) continue;
          const product = await this.productRepo.findOneBy({ id: instance.product_id });
          rows.push({
            'Casier': cab.description,
            'Position': colLabel(loc.column) + loc.row,
            'Code produit': product?.grm_number || '',
            'Description': product?.description || '',
            'N° Série': instance.serial_number || '',
            'N° Lot': instance.lot_number || '',
            'Expiration': instance.expiration_date ? new Date(instance.expiration_date).toISOString().slice(0, 10) : '',
          });
        }
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Casiers');
    // Column widths
    (ws as any)['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    ];
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
