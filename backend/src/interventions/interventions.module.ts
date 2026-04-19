import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Intervention, InterventionProduct, ProductInstance, Product, Movement, CabinetLocation, ProductCategory, ProductType, ProductVariant } from '../common/entities';
import { InterventionsService } from './interventions.service';
import { InterventionsController } from './interventions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Intervention, InterventionProduct, ProductInstance, Product, Movement, CabinetLocation, ProductCategory, ProductType, ProductVariant])],
  controllers: [InterventionsController],
  providers: [InterventionsService],
})
export class InterventionsModule {}
