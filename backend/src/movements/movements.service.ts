import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movement, Product, Employee, ProductInstance, CabinetLocation, Cabinet } from '../common/entities';
import { formatCellCoord } from '../common/cabinet-coord';

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(Movement) private readonly repo: Repository<Movement>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(ProductInstance) private readonly instanceRepo: Repository<ProductInstance>,
    @InjectRepository(CabinetLocation) private readonly locRepo: Repository<CabinetLocation>,
    @InjectRepository(Cabinet) private readonly cabinetRepo: Repository<Cabinet>,
  ) {}

  private async resolveLocation(locationCode: string | null): Promise<string | null> {
    if (!locationCode) return null;
    // If it looks like a UUID, resolve to cabinet location
    if (locationCode.length === 36 && locationCode.includes('-')) {
      const loc = await this.locRepo.findOneBy({ id: locationCode });
      if (loc) {
        const cabinet = await this.cabinetRepo.findOneBy({ id: loc.cabinet_id });
        return cabinet ? `${cabinet.description} ${formatCellCoord(loc.row, loc.column)}` : formatCellCoord(loc.row, loc.column);
      }
    }
    return locationCode;
  }

  async findAll(filters: { date_from?: string; date_to?: string; type?: string; serial_number?: string; lot_number?: string }) {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.timestamp', 'DESC').addOrderBy('m.created_at', 'DESC');

    if (filters.date_from) {
      qb.andWhere('m.timestamp >= :from', { from: `${filters.date_from} 00:00:00` });
    }
    if (filters.date_to) {
      qb.andWhere('m.timestamp <= :to', { to: `${filters.date_to} 23:59:59.999` });
    }
    if (filters.type) {
      qb.andWhere('m.type = :type', { type: filters.type });
    }

    const movements = await qb.getMany();

    // Enrich
    const result = [];
    for (const m of movements) {
      const product = m.product_id ? await this.productRepo.findOneBy({ id: m.product_id }) : null;
      const user = m.user_id ? await this.employeeRepo.findOneBy({ id: m.user_id }) : null;
      const instance = m.instance_id ? await this.instanceRepo.findOneBy({ id: m.instance_id }) : null;
      const locationDisplay = await this.resolveLocation(m.location_code);

      // Filter by serial/lot after enrichment
      if (filters.serial_number && (!instance?.serial_number || !instance.serial_number.includes(filters.serial_number))) continue;
      if (filters.lot_number && (!instance?.lot_number || !instance.lot_number.includes(filters.lot_number))) continue;

      result.push({
        ...m,
        product_description: product?.description || null,
        user_name: user ? `${user.first_name} ${user.last_name}` : null,
        serial_number: instance?.serial_number || null,
        lot_number: instance?.lot_number || null,
        location_display: locationDisplay,
      });
    }
    return result;
  }

  async exportData(filters: any) {
    return this.findAll(filters);
  }
}
