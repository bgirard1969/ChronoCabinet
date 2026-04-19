import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConsumptionService } from './consumption.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/consumption')
export class ConsumptionController {
  constructor(private readonly service: ConsumptionService) {}

  @Get('instances')
  getInstances(@Query('status') status?: string) {
    return this.service.getPickedConsumed(status);
  }

  @Put('instances/:id/toggle')
  toggleStatus(@Param('id') id: string, @Request() req: any) {
    return this.service.toggleStatus(id, req.user.sub);
  }

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.service.preview(file.buffer);
  }

  @Post('import/confirm')
  confirm(@Body() body: any, @Request() req: any) {
    return this.service.confirm(body, req.user.sub);
  }

  @Get('imports')
  getImports() { return this.service.getImports(); }

  @Post('send-to-grm')
  sendToGrm(@Body() body: any, @Request() req: any) {
    return this.service.sendToGrm(body, req.user.sub);
  }
}
