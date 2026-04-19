import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductInstance, Product, Movement, CabinetLocation, ImportHistory, Cabinet, Order, Supplier } from '../common/entities';
import { ConsumptionService } from './consumption.service';
import { ConsumptionController } from './consumption.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductInstance, Product, Movement, CabinetLocation, ImportHistory, Cabinet, Order, Supplier])],
  controllers: [ConsumptionController],
  providers: [ConsumptionService],
})
export class ConsumptionModule {}
