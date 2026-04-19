import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Intervention, InterventionProduct, ProductInstance, Product, Movement, CabinetLocation } from '../common/entities';
import { ProductCategory, ProductType, ProductVariant } from '../common/entities/reference.entities';
import { formatCellCoord } from '../common/cabinet-coord';
import { ProductStatus } from '../common/entities/instance.entity';
import { parse } from 'csv-parse/sync';

@Injectable()
export class InterventionsService {
  constructor(
    @InjectRepository(Intervention) private readonly repo: Repository<Intervention>,
    @InjectRepository(InterventionProduct) private readonly ipRepo: Repository<InterventionProduct>,
    @InjectRepository(ProductInstance) private readonly instanceRepo: Repository<ProductInstance>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Movement) private readonly movementRepo: Repository<Movement>,
    @InjectRepository(CabinetLocation) private readonly locRepo: Repository<CabinetLocation>,
    @InjectRepository(ProductCategory) private readonly catRepo: Repository<ProductCategory>,
    @InjectRepository(ProductType) private readonly typeRepo: Repository<ProductType>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  private async enrichIntervention(intv: Intervention) {
    const products = await this.ipRepo.find({ where: { intervention_id: intv.id } });
    const enriched = [];
    for (const ip of products) {
      let productDesc = null;
      let categoryDesc = null;
      let typeDesc = null;
      let variantDesc = null;
      if (ip.product_id) {
        const p = await this.productRepo.findOne({ where: { id: ip.product_id }, relations: ['category', 'type', 'variant'] });
        if (p) productDesc = { description: p.description, category: p.category, type: p.type, variant: p.variant };
      }
      // Always resolve category/type/variant names for display
      if (ip.category_id) {
        const cat = await this.catRepo.findOneBy({ id: ip.category_id });
        if (cat) categoryDesc = cat;
      }
      if (ip.type_id) {
        const tp = await this.typeRepo.findOneBy({ id: ip.type_id });
        if (tp) typeDesc = tp;
      }
      if (ip.variant_id) {
        const v = await this.variantRepo.findOneBy({ id: ip.variant_id });
        if (v) variantDesc = v;
      }
      const resolution = ip.instance_id ? 'instance' : ip.product_id ? 'product' : ip.variant_id ? 'variant' : ip.type_id ? 'type' : ip.category_id ? 'category' : 'unknown';
      enriched.push({ ...ip, product: productDesc, category: categoryDesc, type: typeDesc, variant: variantDesc, resolution });
    }
    return { ...intv, products: enriched };
  }

  async findAll(filter?: string, date?: string, date_from?: string, date_to?: string) {
    const qb = this.repo.createQueryBuilder('i').orderBy('i.planned_datetime', 'DESC');

    if (date) {
      qb.where('i.planned_datetime >= :start AND i.planned_datetime <= :end', {
        start: `${date} 00:00:00`, end: `${date} 23:59:59.999`,
      });
    } else if (date_from) {
      const to = date_to || date_from;
      qb.where('i.planned_datetime >= :start AND i.planned_datetime <= :end', {
        start: `${date_from} 00:00:00`, end: `${to} 23:59:59.999`,
      });
    } else if (filter === 'today') {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      qb.where('i.planned_datetime >= :start AND i.planned_datetime <= :end', {
        start: `${today} 00:00:00`, end: `${today} 23:59:59.999`,
      });
    } else if (filter === 'week') {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      qb.where('i.planned_datetime >= :start AND i.planned_datetime <= :end', {
        start: fmt(start) + ' 00:00:00',
        end: fmt(end) + ' 23:59:59.999',
      });
    }

    const interventions = await qb.getMany();
    // Attach product counts
    const result = [];
    for (const intv of interventions) {
      const products = await this.ipRepo.find({ where: { intervention_id: intv.id } });
      result.push({ ...intv, products });
    }
    return result;
  }

  async findOne(id: string) {
    const intv = await this.repo.findOneBy({ id });
    if (!intv) throw new NotFoundException('Intervention non trouvée');
    return this.enrichIntervention(intv);
  }

  async create(data: any) {
    const intv = this.repo.create({
      id: uuidv4(),
      planned_datetime: data.planned_datetime,
      operating_room: data.operating_room || null,
      patient_file_number: data.patient_file_number || null,
      birth_date: data.birth_date || null,
      status: 'planned',
    });
    await this.repo.save(intv);

    // Create intervention products
    if (data.products?.length) {
      for (const p of data.products) {
        const ip = this.ipRepo.create({
          id: uuidv4(),
          intervention_id: intv.id,
          product_id: p.product_id || null,
          category_id: p.category_id || null,
          type_id: p.type_id || null,
          variant_id: p.variant_id || null,
          required_quantity: p.required_quantity || 1,
        });
        await this.ipRepo.save(ip);
      }
    }
    return this.enrichIntervention(intv);
  }

  async update(id: string, data: any) {
    const intv = await this.repo.findOneBy({ id });
    if (!intv) throw new NotFoundException('Intervention non trouvée');
    if (data.planned_datetime) intv.planned_datetime = data.planned_datetime;
    if (data.operating_room !== undefined) intv.operating_room = data.operating_room;
    if (data.patient_file_number !== undefined) intv.patient_file_number = data.patient_file_number;
    if (data.birth_date !== undefined) intv.birth_date = data.birth_date;
    if (data.status) intv.status = data.status;
    await this.repo.save(intv);
    return this.enrichIntervention(intv);
  }

  async remove(id: string) {
    const intv = await this.repo.findOneBy({ id });
    if (!intv) throw new NotFoundException('Intervention non trouvée');
    await this.ipRepo.delete({ intervention_id: id });
    await this.repo.remove(intv);
    return { deleted: true };
  }

  // === Products ===
  async addProduct(interventionId: string, data: any) {
    const intv = await this.repo.findOneBy({ id: interventionId });
    if (!intv) throw new NotFoundException('Intervention non trouvée');
    const ip = this.ipRepo.create({
      id: uuidv4(),
      intervention_id: interventionId,
      product_id: data.product_id || null,
      category_id: data.category_id || null,
      type_id: data.type_id || null,
      variant_id: data.variant_id || null,
      required_quantity: data.required_quantity || 1,
    });
    await this.ipRepo.save(ip);
    return this.enrichIntervention(intv);
  }

  async updateProduct(interventionId: string, ipId: string, data: any) {
    const ip = await this.ipRepo.findOneBy({ id: ipId, intervention_id: interventionId });
    if (!ip) throw new NotFoundException('Produit non trouvé');
    Object.assign(ip, data);
    await this.ipRepo.save(ip);
    const intv = await this.repo.findOneBy({ id: interventionId });
    return this.enrichIntervention(intv);
  }

  async removeProduct(interventionId: string, ipId: string) {
    const ip = await this.ipRepo.findOneBy({ id: ipId, intervention_id: interventionId });
    if (!ip) throw new NotFoundException('Produit non trouvé');
    await this.ipRepo.remove(ip);
    return { deleted: true };
  }

  // === Pick ===
  async pick(interventionId: string, data: any, userId: string) {
    const instance = await this.instanceRepo.findOneBy({ id: data.instance_id });
    if (!instance || instance.status !== ProductStatus.PLACED) {
      throw new BadRequestException('Instance non disponible');
    }
    // Reject expired products (calendar date < today UTC). Cannot be used on patients.
    if (instance.expiration_date) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const expStr = (instance.expiration_date as any).toISOString
        ? (instance.expiration_date as any).toISOString().slice(0, 10)
        : String(instance.expiration_date).slice(0, 10);
      if (expStr < todayStr) {
        throw new BadRequestException(`Produit expir\u00e9 (${expStr}) \u2014 ne peut pas \u00eatre utilis\u00e9`);
      }
    }

    // Find matching intervention product
    const products = await this.ipRepo.find({ where: { intervention_id: interventionId } });
    let matched = products.find(p => p.product_id === instance.product_id && p.picked_quantity < p.required_quantity);
    if (!matched) {
      // Try partial match by category/type
      const product = await this.productRepo.findOneBy({ id: instance.product_id });
      if (product) {
        matched = products.find(p =>
          p.picked_quantity < p.required_quantity &&
          ((p.category_id && p.category_id === product.category_id) ||
           (p.type_id && p.type_id === product.type_id))
        );
      }
    }

    if (!matched && !data.force) {
      return { mismatch: true, message: 'Produit non conforme à l\'intervention' };
    }

    // Perform pick
    instance.status = ProductStatus.PICKED;
    instance.usage_date = new Date();
    await this.instanceRepo.save(instance);

    // Free cabinet location
    if (instance.cabinet_location_id) {
      await this.locRepo.update(instance.cabinet_location_id, { is_empty: true, instance_id: null });
    }

    // Update intervention product
    if (matched) {
      matched.picked_quantity += 1;
      await this.ipRepo.save(matched);
    }

    // Create movement
    const product = await this.productRepo.findOneBy({ id: instance.product_id });
    await this.movementRepo.save(this.movementRepo.create({
      id: uuidv4(),
      instance_id: instance.id,
      product_id: instance.product_id,
      type: 'prelevement',
      quantity: 1,
      user_id: userId,
      reason: `Prélèvement pour intervention${data.patient_file ? ' - MRN: ' + data.patient_file : ''}`,
      location_code: instance.cabinet_location_id || null,
      intervention_id: interventionId,
      timestamp: new Date(),
    }));

    return { picked: true, instance_id: instance.id };
  }

  // === FIFO suggestions ===
  async fifoSuggestions(interventionId: string) {
    const products = await this.ipRepo.find({ where: { intervention_id: interventionId } });
    const suggestions = [];

    for (const ip of products) {
      const remaining = ip.required_quantity - ip.picked_quantity;
      if (remaining <= 0) continue;

      // Build label from category/type/variant names
      const labelParts: string[] = [];
      let categoryDesc: any = null;
      let typeDesc: any = null;
      let variantDesc = null;
      if (ip.category_id) {
        categoryDesc = await this.catRepo.findOneBy({ id: ip.category_id });
        if (categoryDesc) labelParts.push(categoryDesc.description);
      }
      if (ip.type_id) {
        typeDesc = await this.typeRepo.findOneBy({ id: ip.type_id });
        if (typeDesc) labelParts.push(typeDesc.description);
      }
      if (ip.variant_id) {
        variantDesc = await this.variantRepo.findOneBy({ id: ip.variant_id });
        if (variantDesc) labelParts.push(variantDesc.description);
      }

      // Find instances: either by product_id or by matching category/type/variant
      let instances: ProductInstance[] = [];
      if (ip.product_id) {
        instances = await this.instanceRepo.find({
          where: { product_id: ip.product_id, status: ProductStatus.PLACED },
          order: { expiration_date: 'ASC', created_at: 'ASC' },
        });
      } else {
        // Find products matching category/type/variant, then find placed instances
        const qb = this.productRepo.createQueryBuilder('p');
        if (ip.category_id) qb.andWhere('p.category_id = :cid', { cid: ip.category_id });
        if (ip.type_id) qb.andWhere('p.type_id = :tid', { tid: ip.type_id });
        if (ip.variant_id) qb.andWhere('p.variant_id = :vid', { vid: ip.variant_id });
        const matchingProducts = await qb.getMany();
        if (matchingProducts.length > 0) {
          const pids = matchingProducts.map(p => p.id);
          instances = await this.instanceRepo.createQueryBuilder('i')
            .where('i.product_id IN (:...pids)', { pids })
            .andWhere('i.status = :status', { status: ProductStatus.PLACED })
            .orderBy('i.expiration_date', 'ASC', 'NULLS LAST')
            .addOrderBy('i.created_at', 'ASC')
            .getMany();
        }
      }

      // Enrich with location display. Skip expired instances (calendar date < today UTC).
      const enrichedInstances = [];
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const inst of instances) {
        if (inst.expiration_date) {
          const expStr = (inst.expiration_date as any).toISOString
            ? (inst.expiration_date as any).toISOString().slice(0, 10)
            : String(inst.expiration_date).slice(0, 10);
          if (expStr < todayStr) continue;
        }
        let locationDisplay: string | null = null;
        if (inst.cabinet_location_id) {
          const loc = await this.locRepo.findOneBy({ id: inst.cabinet_location_id });
          if (loc) {
            const cabRepo = this.locRepo.manager.getRepository('Cabinet');
            const cab: any = await cabRepo.findOneBy({ id: loc.cabinet_id });
            locationDisplay = cab ? `${cab.description} ${formatCellCoord(loc.row, loc.column)}` : formatCellCoord(loc.row, loc.column);
          }
        }
        const instProduct = await this.productRepo.findOneBy({ id: inst.product_id });
        enrichedInstances.push({
          id: inst.id, serial_number: inst.serial_number, lot_number: inst.lot_number,
          expiration_date: inst.expiration_date, location_display: locationDisplay,
          product_description: instProduct?.description || null,
        });
      }

      let productDesc = null;
      if (ip.product_id) {
        productDesc = await this.productRepo.findOne({ where: { id: ip.product_id }, relations: ['category', 'type', 'variant'] });
        if (productDesc && labelParts.length === 0) labelParts.push(productDesc.description);
      }

      // If all 3 filters set, find the matching product description
      let fullProductDescription: string | null = null;
      if (ip.category_id && ip.type_id && ip.variant_id && !ip.product_id) {
        const matchingProduct = await this.productRepo.findOne({
          where: { category_id: ip.category_id, type_id: ip.type_id, variant_id: ip.variant_id },
        });
        if (matchingProduct) fullProductDescription = matchingProduct.description;
      }
      if (productDesc) fullProductDescription = productDesc.description;

      suggestions.push({
        intervention_product: ip,
        product: productDesc,
        label: labelParts.join(' / ') || 'Produit',
        product_description: fullProductDescription,
        category: categoryDesc,
        type: typeDesc,
        variant: variantDesc,
        remaining,
        instances: enrichedInstances,
      });
    }

    return suggestions;
  }

  // === Import CSV ===
  async importCsv(fileBuffer: Buffer, filename: string) {
    let text: string;
    try {
      text = fileBuffer.toString('utf-8').replace(/^\uFEFF/, '');
    } catch {
      text = fileBuffer.toString('latin1');
    }

    const records: any[] = parse(text, {
      columns: (header: string[]) => header.map(h => h.trim().toLowerCase()),
      skip_empty_lines: true,
      delimiter: ',',
    });

    let created = 0;
    let duplicates = 0;
    const errors: string[] = [];
    const seen = new Set<string>();
    const createdLines: any[] = [];
    const duplicateLines: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const dateStr = (row.date_intervention_prevue || '').trim();
      const salle = (row.salle || '').trim();
      const mrn = (row.mrn_patient || '').trim();
      const birth = (row.date_naissance || '').trim();
      const lineInfo = { line: i + 1, date: dateStr.slice(0, 10), salle, mrn, birth_date: birth };

      if (!dateStr) { errors.push(`Ligne ${i + 1}: date_intervention_prevue manquante`); continue; }

      const key = mrn ? `${dateStr.slice(0, 10)}|${mrn}` : `${dateStr.slice(0, 10)}|${salle}|_no_mrn_`;
      if (seen.has(key)) { duplicates++; duplicateLines.push({ ...lineInfo, reason: 'Doublon dans le fichier' }); continue; }
      seen.add(key);

      // Check DB duplicates — MRN is the primary uniqueness key per date
      const dateKey = dateStr.slice(0, 10);
      let existing: Intervention | null = null;
      if (mrn) {
        existing = await this.repo.createQueryBuilder('i')
          .where('i.planned_datetime >= :start AND i.planned_datetime <= :end', {
            start: `${dateKey} 00:00:00`, end: `${dateKey} 23:59:59.999`,
          })
          .andWhere('i.patient_file_number = :mrn', { mrn })
          .getOne();
      } else {
        existing = await this.repo.createQueryBuilder('i')
          .where('i.planned_datetime >= :start AND i.planned_datetime <= :end', {
            start: `${dateKey} 00:00:00`, end: `${dateKey} 23:59:59.999`,
          })
          .andWhere('i.operating_room = :salle', { salle: salle || null })
          .andWhere('i.patient_file_number IS NULL')
          .getOne();
      }

      if (existing) { duplicates++; duplicateLines.push({ ...lineInfo, reason: 'MRN deja en base' }); continue; }

      await this.repo.save(this.repo.create({
        id: uuidv4(),
        planned_datetime: new Date(`${dateStr.slice(0, 10)}T12:00:00`),
        operating_room: salle || null,
        patient_file_number: mrn || null,
        birth_date: birth || null,
        status: 'planned',
      }));
      created++;
      createdLines.push(lineInfo);
    }

    return { created, duplicates, errors, total_lines: created + duplicates + errors.length, created_lines: createdLines, duplicate_lines: duplicateLines };
  }
}
