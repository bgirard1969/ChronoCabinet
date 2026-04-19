import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmployeesService } from './employees.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get('roles')
  getRoles() { return this.service.getRoles(); }

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) { return this.service.remove(id, req.user.sub); }
}
