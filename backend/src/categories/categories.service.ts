import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ProductCategory, ProductType, ProductVariant, Product } from '../common/entities';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ProductCategory) private readonly catRepo: Repository<ProductCategory>,
    @InjectRepository(ProductType) private readonly typeRepo: Repository<ProductType>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  // === Categories ===
  findAllCategories() { return this.catRepo.find({ order: { description: 'ASC' } }); }
  async createCategory(data: any) { return this.catRepo.save(this.catRepo.create({ id: uuidv4(), ...data })); }
  async updateCategory(id: string, data: any) {
    const c = await this.catRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Catégorie non trouvée');
    Object.assign(c, data);
    return this.catRepo.save(c);
  }
  async removeCategory(id: string) {
    const c = await this.catRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Catégorie non trouvée');
    if (await this.productRepo.countBy({ category_id: id })) throw new BadRequestException('Catégorie utilisée');
    await this.catRepo.remove(c);
    return { deleted: true };
  }

  // === Types ===
  findAllTypes() { return this.typeRepo.find({ order: { description: 'ASC' } }); }
  async createType(data: any) { return this.typeRepo.save(this.typeRepo.create({ id: uuidv4(), ...data })); }
  async updateType(id: string, data: any) {
    const t = await this.typeRepo.findOneBy({ id });
    if (!t) throw new NotFoundException('Modèle non trouvé');
    Object.assign(t, data);
    return this.typeRepo.save(t);
  }
  async removeType(id: string) {
    const t = await this.typeRepo.findOneBy({ id });
    if (!t) throw new NotFoundException('Modèle non trouvé');
    if (await this.productRepo.countBy({ type_id: id })) throw new BadRequestException('Modèle utilisé');
    await this.typeRepo.remove(t);
    return { deleted: true };
  }

  // === Variants ===
  findAllVariants() { return this.variantRepo.find({ order: { description: 'ASC' } }); }
  async createVariant(data: any) { return this.variantRepo.save(this.variantRepo.create({ id: uuidv4(), ...data })); }
  async updateVariant(id: string, data: any) {
    const v = await this.variantRepo.findOneBy({ id });
    if (!v) throw new NotFoundException('Variante non trouvée');
    Object.assign(v, data);
    return this.variantRepo.save(v);
  }
  async removeVariant(id: string) {
    const v = await this.variantRepo.findOneBy({ id });
    if (!v) throw new NotFoundException('Variante non trouvée');
    if (await this.productRepo.countBy({ variant_id: id })) throw new BadRequestException('Variante utilisée');
    await this.variantRepo.remove(v);
    return { deleted: true };
  }
}
