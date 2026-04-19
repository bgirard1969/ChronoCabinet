import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { InterventionsService } from './interventions.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/interventions')
export class InterventionsController {
  constructor(private readonly service: InterventionsService) {}

  @Get()
  findAll(
    @Query('filter') filter?: string,
    @Query('date') date?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.service.findAll(filter, date, dateFrom, dateTo);
  }

  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.service.importCsv(file.buffer, file.originalname);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/products')
  addProduct(@Param('id') id: string, @Body() body: any) { return this.service.addProduct(id, body); }

  @Put(':id/products/:ipId')
  updateProduct(@Param('id') id: string, @Param('ipId') ipId: string, @Body() body: any) {
    return this.service.updateProduct(id, ipId, body);
  }

  @Delete(':id/products/:ipId')
  removeProduct(@Param('id') id: string, @Param('ipId') ipId: string) {
    return this.service.removeProduct(id, ipId);
  }

  @Post(':id/pick')
  pick(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.pick(id, body, req.user.sub);
  }

  @Get(':id/fifo-suggestions')
  fifoSuggestions(@Param('id') id: string) { return this.service.fifoSuggestions(id); }
}
