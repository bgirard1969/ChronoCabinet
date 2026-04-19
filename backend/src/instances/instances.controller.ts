import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InstancesService } from './instances.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/instances')
export class InstancesController {
  constructor(private readonly service: InstancesService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('product_id') pid?: string, @Query('order_id') oid?: string) {
    return this.service.findAll({ status: status ? +status : undefined, product_id: pid, order_id: oid });
  }

  @Get('pending-placement')
  pendingPlacement() { return this.service.pendingPlacement(); }

  @Get('consumption')
  consumption() { return this.service.consumption(); }

  @Get('available-stock')
  availableStock(@Query('category_id') c?: string, @Query('type_id') t?: string, @Query('variant_id') v?: string) {
    return this.service.availableStock(c, t, v);
  }

  @Get('fifo-suggestion')
  fifoSuggestion(
    @Query('category_id') c?: string, @Query('type_id') t?: string, @Query('variant_id') v?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.fifoSuggestion(c, t, v, skip ? +skip : 0);
  }

  @Put(':id/consume')
  consume(@Param('id') id: string, @Request() req: any) { return this.service.consume(id, req.user.sub); }

  @Post('pick-libre')
  pickLibre(@Body() body: any, @Request() req: any) { return this.service.pickLibre(body, req.user.sub); }

  @Post('scan')
  scan(@Body() body: { serial_number?: string; lot_number?: string }) { return this.service.scan(body.serial_number || '', body.lot_number); }

  @Post(':id/auto-place')
  autoPlace(@Param('id') id: string, @Request() req: any) { return this.service.autoPlace(id, req.user.sub); }

  @Post('place')
  place(@Body() body: any, @Request() req: any) { return this.service.place(body, req.user.sub); }

  @Post('return-to-stock')
  returnToStock(@Body() body: any, @Request() req: any) { return this.service.returnToStock(body, req.user.sub); }

  @Post('verify-admin-pin')
  verifyAdminPin(@Body() body: any) { return this.service.verifyAdminPin(body); }

  @Post('export-grm')
  exportGrm(@Request() req: any) { return this.service.exportGrm(req.user.sub); }
}
