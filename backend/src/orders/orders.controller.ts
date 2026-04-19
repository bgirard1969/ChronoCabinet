import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id/send')
  send(@Param('id') id: string) { return this.service.send(id); }

  @Put(':id/receive')
  receive(@Param('id') id: string, @Body() body: any) { return this.service.receive(id, body); }

  @Post(':id/scan-receive')
  scanReceive(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.scanReceive(id, body, req.user?.sub);
  }

  @Post(':id/manual-add')
  manualAdd(@Param('id') id: string, @Body() body: any) { return this.service.manualAdd(id, body); }

  @Post(':id/finalize')
  finalize(@Param('id') id: string, @Request() req: any) { return this.service.finalize(id, req.user?.sub); }

  @Post(':id/items')
  addItems(@Param('id') id: string, @Body() body: any) { return this.service.addItems(id, body); }

  @Delete(':id/items/:instanceId')
  removeItem(@Param('id') id: string, @Param('instanceId') instanceId: string) { return this.service.removeItem(id, instanceId); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) { return this.service.cancel(id); }
}
