import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, ProductInstance, Product, Supplier, Movement } from '../common/entities';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, ProductInstance, Product, Supplier, Movement])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
