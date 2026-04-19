import { Controller, Get, Put, Body, UseGuards, Module } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '../common/entities';

async function ensureSettings(repo: Repository<AppSettings>): Promise<AppSettings> {
  let s = await repo.findOneBy({ id: 'default' });
  if (!s) {
    s = repo.create({ id: 'default', expiration_critical_days: 7, expiration_warning_days: 28 });
    await repo.save(s);
  }
  return s;
}

@UseGuards(AuthGuard('jwt'))
@Controller('api/settings')
export class SettingsController {
  constructor(@InjectRepository(AppSettings) private readonly repo: Repository<AppSettings>) {}

  @Get('expiration')
  async getExpiration() {
    const s = await ensureSettings(this.repo);
    return { expiration_critical_days: s.expiration_critical_days, expiration_warning_days: s.expiration_warning_days };
  }

  @Put('expiration')
  async putExpiration(@Body() body: { expiration_critical_days: number; expiration_warning_days: number }) {
    const s = await ensureSettings(this.repo);
    if (body.expiration_critical_days != null) s.expiration_critical_days = Math.max(1, Math.min(365, Number(body.expiration_critical_days)));
    if (body.expiration_warning_days != null) s.expiration_warning_days = Math.max(1, Math.min(365, Number(body.expiration_warning_days)));
    if (s.expiration_critical_days >= s.expiration_warning_days) {
      s.expiration_warning_days = s.expiration_critical_days + 1;
    }
    await this.repo.save(s);
    return { expiration_critical_days: s.expiration_critical_days, expiration_warning_days: s.expiration_warning_days };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings])],
  controllers: [SettingsController],
})
export class SettingsModule {}
