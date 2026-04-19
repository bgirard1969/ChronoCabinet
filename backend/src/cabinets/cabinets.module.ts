import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cabinet, CabinetLocation, ProductInstance, Product } from '../common/entities';
import { CabinetsService } from './cabinets.service';
import { CabinetsController } from './cabinets.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cabinet, CabinetLocation, ProductInstance, Product])],
  controllers: [CabinetsController],
  providers: [CabinetsService],
})
export class CabinetsModule {}
