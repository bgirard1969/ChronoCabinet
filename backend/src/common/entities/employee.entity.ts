import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ length: 50 })
  first_name: string;

  @Column({ length: 50 })
  last_name: string;

  @Column({ length: 30 })
  role: string;

  @Column({ type: 'text' })
  password_hash: string;

  @Column({ type: 'text', nullable: true })
  pin_hash: string;

  @Column({ length: 100, nullable: true, unique: true })
  card_id: string;

  @CreateDateColumn()
  created_at: Date;
}
