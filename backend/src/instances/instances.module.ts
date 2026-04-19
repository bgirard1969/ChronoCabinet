import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductInstance, Product, CabinetLocation, Movement, Employee, Order, Supplier } from '../common/entities';
import { InstancesService } from './instances.service';
import { InstancesController } from './instances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductInstance, Product, CabinetLocation, Movement, Employee, Order, Supplier])],
  controllers: [InstancesController],
  providers: [InstancesService],
})
export class InstancesModule {}
