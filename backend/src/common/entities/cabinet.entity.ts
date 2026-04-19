import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('cabinets')
export class Cabinet {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 50 })
  description: string;

  @Column({ type: 'int' })
  columns: number;

  @Column({ type: 'int' })
  rows: number;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => CabinetLocation, (l) => l.cabinet)
  locations: CabinetLocation[];
}

@Entity('cabinet_locations')
export class CabinetLocation {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 36 })
  cabinet_id: string;

  @Column({ length: 36, nullable: true })
  product_id: string;

  @Column({ type: 'int' })
  row: number;

  @Column({ type: 'int', name: 'col' })
  column: number;

  @Column({ type: 'boolean', default: true })
  is_empty: boolean;

  @Column({ type: 'boolean', default: false })
  is_special_order_reserved: boolean;

  @Column({ length: 36, nullable: true })
  instance_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Cabinet, (c) => c.locations)
  @JoinColumn({ name: 'cabinet_id' })
  cabinet: Cabinet;
}
