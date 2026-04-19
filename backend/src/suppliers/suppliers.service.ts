import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Supplier, Product } from '../common/entities';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private readonly repo: Repository<Supplier>,
  ) {}

  findAll() { return this.repo.find({ order: { name: 'ASC' } }); }

  async findOne(id: string) {
    const s = await this.repo.findOneBy({ id });
    if (!s) throw new NotFoundException('Fournisseur non trouvé');
    return s;
  }

  async create(data: any) {
    const supplier = this.repo.create({ id: uuidv4(), ...data });
    return this.repo.save(supplier);
  }

  async update(id: string, data: any) {
    const s = await this.repo.findOneBy({ id });
    if (!s) throw new NotFoundException('Fournisseur non trouvé');
    Object.assign(s, data);
    return this.repo.save(s);
  }

  async remove(id: string) {
    const s = await this.repo.findOneBy({ id });
    if (!s) throw new NotFoundException('Fournisseur non trouvé');
    // Check if used by products
    const count = await this.repo.manager.count(Product, { where: { supplier_id: id } });
    if (count > 0) throw new BadRequestException('Fournisseur utilisé par des produits');
    await this.repo.remove(s);
    return { deleted: true };
  }
}
