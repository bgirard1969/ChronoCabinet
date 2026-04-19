import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; first_name: string; last_name: string; role: string; pin?: string; card_id?: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('login-pin')
  loginPin(@Body() body: { pin: string }) {
    return this.authService.loginPin(body.pin);
  }

  @Post('login-card')
  loginCard(@Body() body: { card_id: string }) {
    return this.authService.loginCard(body.card_id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }
}
