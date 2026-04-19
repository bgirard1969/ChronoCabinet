import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('api/hardware')
export class HardwareController {
  @Post('cabinets/:id/unlock')
  unlock(@Param('id') id: string) { return { message: `Cabinet ${id} déverrouillé (stub)` }; }

  @Post('cabinets/:id/lock')
  lock(@Param('id') id: string) { return { message: `Cabinet ${id} verrouillé (stub)` }; }

  @Post('locations/:id/led')
  led(@Param('id') id: string, @Body() body: any) { return { message: `LED ${id} ${body.on ? 'ON' : 'OFF'} (stub)` }; }

  @Get('locations/:id/presence')
  presence(@Param('id') id: string) { return { location_id: id, has_product: true, message: 'Stub' }; }

  @Post('emergency')
  emergency() { return { message: 'Urgence activée — tous cabinets déverrouillés (stub)' }; }
}
