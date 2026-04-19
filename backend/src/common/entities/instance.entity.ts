import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

// ProductStatus enum: 1=ORDERED, 2=RECEIVED, 3=PLACED, 4=PICKED, 5=CONSUMED, 6=INVOICED
export enum ProductStatus {
  ORDERED = 1,
  RECEIVED = 2,
  PLACED = 3,
  PICKED = 4,
  CONSUMED = 5,
  INVOICED = 6,
}

@Entity('product_instances')
export class ProductInstance {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 36 })
  product_id: string;

  @Column({ length: 36, nullable: true })
  cabinet_location_id: string;

  @Column({ length: 255, nullable: true })
  serial_number: string;

  @Column({ length: 100, nullable: true })
  lot_number: string;

  @Column({ type: 'datetime', nullable: true })
  expiration_date: Date;

  @Column({ type: 'datetime', nullable: true })
  usage_date: Date;

  @Column({ type: 'datetime', nullable: true })
  reception_date: Date;

  @Column({ type: 'int', default: ProductStatus.ORDERED })
  status: number;

  @Column({ length: 36, nullable: true })
  order_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Product, (p) => p.instances, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
