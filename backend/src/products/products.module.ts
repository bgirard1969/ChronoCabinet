import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, ProductInstance, ProductCategory, ProductType, ProductVariant, Supplier, CabinetLocation } from '../common/entities';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductInstance, ProductCategory, ProductType, ProductVariant, Supplier, CabinetLocation])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
