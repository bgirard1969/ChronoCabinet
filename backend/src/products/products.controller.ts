import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { parseGs1 } from './gs1-parser.util';

@UseGuards(AuthGuard('jwt'))
@Controller('api/products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get('filter-options')
  filterOptions(
    @Query('category_id') catId?: string,
    @Query('type_id') typeId?: string,
    @Query('variant_id') variantId?: string,
  ) { return this.service.filterOptions(catId, typeId, variantId); }

  @Get('by-gtin/:gtin')
  async findByGtin(@Param('gtin') gtin: string) {
    const p = await this.service.findByGtin(gtin);
    if (!p) throw new NotFoundException('Produit non trouv\u00e9');
    return p;
  }

  @Post('scan')
  async scan(@Body() body: { raw: string }) {
    const parsed = parseGs1(body?.raw || '');
    let product = null;
    if (parsed.gtin) {
      product = await this.service.findByGtin(parsed.gtin);
    }
    return { parsed, product };
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/instances')
  getInstances(@Param('id') id: string) { return this.service.getInstances(id); }

  @Post(':id/instances')
  createInstance(@Param('id') id: string, @Body() body: any) { return this.service.createInstance(id, body); }

  @Put(':id/instances/:instanceId')
  updateInstance(@Param('id') id: string, @Param('instanceId') instanceId: string, @Body() body: any) { return this.service.updateInstance(id, instanceId, body); }

  @Delete(':id/instances/:instanceId')
  removeInstance(@Param('id') id: string, @Param('instanceId') instanceId: string) { return this.service.removeInstance(id, instanceId); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
