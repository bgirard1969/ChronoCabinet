import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { CabinetsService } from './cabinets.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/cabinets')
export class CabinetsController {
  constructor(private readonly service: CabinetsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get('export')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cabinets.xlsx"`);
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Get(':id/locations')
  getLocations(@Param('id') id: string) { return this.service.getLocations(id); }

  @Put(':id/locations/:locId')
  updateLocation(@Param('id') id: string, @Param('locId') locId: string, @Body() body: any) {
    return this.service.updateLocation(id, locId, body);
  }
}
