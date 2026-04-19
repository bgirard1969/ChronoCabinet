import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Product } from './product.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 8, nullable: true })
  supplier_number: string;

  @Column({ length: 100, nullable: true })
  contact_name: string;

  @Column({ length: 50, nullable: true })
  contact_phone: string;

  @Column({ length: 100, nullable: true })
  contact_email: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Product, (p) => p.supplier)
  products: Product[];
}

@Entity('product_categories')
export class ProductCategory {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 50 })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Product, (p) => p.category)
  products: Product[];
}

@Entity('product_types')
export class ProductType {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 50 })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Product, (p) => p.type)
  products: Product[];
}

@Entity('product_variants')
export class ProductVariant {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 50 })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Product, (p) => p.variant)
  products: Product[];
}
