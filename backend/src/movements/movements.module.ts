import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movement, Product, Employee, ProductInstance, CabinetLocation, Cabinet } from '../common/entities';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Movement, Product, Employee, ProductInstance, CabinetLocation, Cabinet])],
  controllers: [MovementsController],
  providers: [MovementsService],
})
export class MovementsModule {}
