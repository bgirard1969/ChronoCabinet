import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 36 })
  supplier_id: string;

  @Column({ type: 'datetime' })
  creation_date: Date;

  @Column({ type: 'datetime', nullable: true })
  order_date: Date;

  @Column({ length: 50, nullable: true })
  grm_number: string;

  @Column({ length: 50, nullable: true })
  order_number: string;

  @Column({ length: 30, default: 'draft' })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
