import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CategoriesService } from './categories.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  // Categories
  @Get('product-categories')
  findAllCategories() { return this.service.findAllCategories(); }
  @Post('product-categories')
  createCategory(@Body() body: any) { return this.service.createCategory(body); }
  @Put('product-categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: any) { return this.service.updateCategory(id, body); }
  @Delete('product-categories/:id')
  removeCategory(@Param('id') id: string) { return this.service.removeCategory(id); }

  // Types (Modèles)
  @Get('product-types')
  findAllTypes() { return this.service.findAllTypes(); }
  @Post('product-types')
  createType(@Body() body: any) { return this.service.createType(body); }
  @Put('product-types/:id')
  updateType(@Param('id') id: string, @Body() body: any) { return this.service.updateType(id, body); }
  @Delete('product-types/:id')
  removeType(@Param('id') id: string) { return this.service.removeType(id); }

  // Variants
  @Get('product-variants')
  findAllVariants() { return this.service.findAllVariants(); }
  @Post('product-variants')
  createVariant(@Body() body: any) { return this.service.createVariant(body); }
  @Put('product-variants/:id')
  updateVariant(@Param('id') id: string, @Body() body: any) { return this.service.updateVariant(id, body); }
  @Delete('product-variants/:id')
  removeVariant(@Param('id') id: string) { return this.service.removeVariant(id); }
}
