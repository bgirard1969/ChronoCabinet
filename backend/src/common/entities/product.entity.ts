import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Supplier, ProductCategory, ProductType, ProductVariant } from './reference.entities';
import { ProductInstance } from './instance.entity';

@Entity('products')
export class Product {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 80 })
  description: string;

  @Column({ length: 36, nullable: true })
  supplier_id: string;

  @Column({ length: 36, nullable: true })
  category_id: string;

  @Column({ length: 36, nullable: true })
  type_id: string;

  @Column({ length: 36, nullable: true })
  variant_id: string;

  @Column({ length: 50, nullable: true })
  grm_number: string;

  @Column({ length: 80, nullable: true })
  supplier_catalog_number: string;

  @Column({ type: 'int', default: 0 })
  quantity_in_stock: number;

  @Column({ type: 'boolean', default: false })
  is_special_order: boolean;

  @Column({ length: 14, nullable: true })
  gtin: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Supplier, (s) => s.products, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => ProductCategory, (c) => c.products, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory;

  @ManyToOne(() => ProductType, (t) => t.products, { nullable: true })
  @JoinColumn({ name: 'type_id' })
  type: ProductType;

  @ManyToOne(() => ProductVariant, (v) => v.products, { nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @OneToMany(() => ProductInstance, (i) => i.product)
  instances: ProductInstance[];
}
