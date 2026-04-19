import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Global app settings. Single row with id='default'.
 */
@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ type: 'int', default: 7 })
  expiration_critical_days: number;

  @Column({ type: 'int', default: 28 })
  expiration_warning_days: number;

  @UpdateDateColumn()
  updated_at: Date;
}
