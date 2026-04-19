import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './common/entities/employee.entity';
import { Supplier, ProductCategory, ProductType, ProductVariant } from './common/entities/reference.entities';
import { Product } from './common/entities/product.entity';
import { ProductInstance } from './common/entities/instance.entity';
import { Cabinet, CabinetLocation } from './common/entities/cabinet.entity';
import { Order } from './common/entities/order.entity';
import { Intervention, InterventionProduct } from './common/entities/intervention.entity';
import { Movement } from './common/entities/movement.entity';
import { ImportHistory } from './common/entities/import-history.entity';
import { AppSettings } from './common/entities/settings.entity';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CabinetsModule } from './cabinets/cabinets.module';
import { InstancesModule } from './instances/instances.module';
import { OrdersModule } from './orders/orders.module';
import { InterventionsModule } from './interventions/interventions.module';
import { MovementsModule } from './movements/movements.module';
import { ConsumptionModule } from './consumption/consumption.module';
import { SettingsModule } from './settings/settings.module';
import { HardwareController } from './hardware/hardware.controller';
import { AppController } from './app.controller';

const ALL_ENTITIES = [
  Employee, Supplier, ProductCategory, ProductType, ProductVariant,
  Product, ProductInstance, Cabinet, CabinetLocation, Order,
  Intervention, InterventionProduct, Movement, ImportHistory, AppSettings,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): any => {
        const dbType = config.get('DB_TYPE', 'better-sqlite3');
        if (dbType === 'mssql') {
          return {
            type: 'mssql' as const,
            host: config.get('DB_HOST'),
            port: +config.get('DB_PORT', '1433'),
            username: config.get('DB_USERNAME'),
            password: config.get('DB_PASSWORD'),
            database: config.get('DB_DATABASE'),
            entities: ALL_ENTITIES,
            synchronize: config.get('NODE_ENV') !== 'production',
            options: { encrypt: true, trustServerCertificate: true },
          };
        }
        return {
          type: 'better-sqlite3' as const,
          database: config.get('DB_DATABASE', 'chrono_dmi.sqlite'),
          entities: ALL_ENTITIES,
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    EmployeesModule,
    SuppliersModule,
    CategoriesModule,
    ProductsModule,
    CabinetsModule,
    InstancesModule,
    OrdersModule,
    InterventionsModule,
    MovementsModule,
    ConsumptionModule,
    SettingsModule,
  ],
  controllers: [AppController, HardwareController],
})
export class AppModule {}
