import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('import_history')
export class ImportHistory {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ length: 50 })
  type: string;

  @Column({ length: 255, nullable: true })
  filename: string;

  @Column({ type: 'int', default: 0 })
  total_lines: number;

  @Column({ type: 'int', default: 0 })
  matched: number;

  @Column({ type: 'int', default: 0 })
  unmatched: number;

  @Column({ type: 'int', default: 0 })
  errors_count: number;

  @Column({ length: 36, nullable: true })
  user_id: string;

  @CreateDateColumn()
  imported_at: Date;
}
