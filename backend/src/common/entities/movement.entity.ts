import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('movements')
export class Movement {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 36, nullable: true })
  instance_id: string;

  @Column({ length: 36, nullable: true })
  product_id: string;

  @Column({ length: 50 })
  type: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ length: 36, nullable: true })
  user_id: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ length: 100, nullable: true })
  location_code: string;

  @Column({ length: 36, nullable: true })
  intervention_id: string;

  @Column({ length: 36, nullable: true })
  order_id: string;

  @Column({ type: 'datetime' })
  timestamp: Date;

  @CreateDateColumn()
  created_at: Date;
}
