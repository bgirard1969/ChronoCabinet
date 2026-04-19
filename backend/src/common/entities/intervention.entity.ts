import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('interventions')
export class Intervention {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ type: 'datetime' })
  planned_datetime: Date;

  @Column({ length: 10, nullable: true })
  operating_room: string;

  @Column({ length: 50, nullable: true })
  patient_file_number: string;

  @Column({ length: 10, nullable: true })
  birth_date: string;

  @Column({ length: 30, default: 'planned' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  products: InterventionProduct[];
}

@Entity('intervention_products')
export class InterventionProduct {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 36 })
  intervention_id: string;

  @Column({ length: 36, nullable: true })
  product_id: string;

  @Column({ length: 36, nullable: true })
  category_id: string;

  @Column({ length: 36, nullable: true })
  type_id: string;

  @Column({ length: 36, nullable: true })
  variant_id: string;

  @Column({ length: 36, nullable: true })
  instance_id: string;

  @Column({ length: 255, nullable: true })
  serial_number: string;

  @Column({ type: 'int', default: 1 })
  required_quantity: number;

  @Column({ type: 'int', default: 0 })
  picked_quantity: number;

  @CreateDateColumn()
  created_at: Date;
}
