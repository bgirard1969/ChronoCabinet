import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from './common/entities/employee.entity';
import { Supplier, ProductCategory, ProductType, ProductVariant } from './common/entities/reference.entities';
import { Product } from './common/entities/product.entity';
import { ProductInstance } from './common/entities/instance.entity';
import { Cabinet, CabinetLocation } from './common/entities/cabinet.entity';
import { Order } from './common/entities/order.entity';
import { Intervention, InterventionProduct } from './common/entities/intervention.entity';
import { Movement } from './common/entities/movement.entity';
import { ImportHistory } from './common/entities/import-history.entity';

async function seed() {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DB_DATABASE || 'chrono_dmi.sqlite',
    entities: [Employee, Supplier, ProductCategory, ProductType, ProductVariant, Product, ProductInstance, Cabinet, CabinetLocation, Order, Intervention, InterventionProduct, Movement, ImportHistory],
    synchronize: true,
  });
  await ds.initialize();

  const empRepo = ds.getRepository(Employee);

  const existing = await empRepo.findOneBy({ email: 'benoit.girard@atmshealth.com' });
  if (!existing) {
    const emp = empRepo.create({
      id: uuidv4(),
      email: 'benoit.girard@atmshealth.com',
      first_name: 'Benoit',
      last_name: 'Girard',
      role: 'administrateur',
      password_hash: await bcrypt.hash('Salut123', 10),
      pin_hash: await bcrypt.hash('1234', 10),
    });
    await empRepo.save(emp);
    console.log('Admin seeded: benoit.girard@atmshealth.com / Salut123 (PIN: 1234)');
  } else {
    console.log('Admin already exists');
  }

  const clinicien = await empRepo.findOneBy({ email: 'clinicien@atmshealth.com' });
  if (!clinicien) {
    const cli = empRepo.create({
      id: uuidv4(),
      email: 'clinicien@atmshealth.com',
      first_name: 'Clinicien',
      last_name: 'Test',
      role: 'clinicien',
      password_hash: await bcrypt.hash('Clinicien123', 10),
    });
    await empRepo.save(cli);
    console.log('Clinicien seeded');
  }

  await ds.destroy();
  console.log('Seed complete');
}

seed().catch(console.error);
