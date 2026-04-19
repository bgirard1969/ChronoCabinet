import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from '../common/entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly jwtService: JwtService,
  ) {}

  private safeEmployee(e: Employee) {
    const { password_hash, pin_hash, ...safe } = e;
    return safe;
  }

  async register(data: {
    email: string; password: string; first_name: string; last_name: string;
    role: string; pin?: string; card_id?: string;
  }) {
    const existing = await this.employeeRepo.findOneBy({ email: data.email });
    if (existing) throw new UnauthorizedException('Email déjà utilisé');

    const employee = this.employeeRepo.create({
      id: uuidv4(),
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      password_hash: await bcrypt.hash(data.password, 10),
      pin_hash: data.pin ? await bcrypt.hash(data.pin, 10) : null,
      card_id: data.card_id || null,
    });
    await this.employeeRepo.save(employee);

    const token = this.jwtService.sign({ sub: employee.id, email: employee.email });
    return { access_token: token, token_type: 'bearer', user: this.safeEmployee(employee) };
  }

  async login(email: string, password: string) {
    const employee = await this.employeeRepo.findOneBy({ email });
    if (!employee) throw new UnauthorizedException('Identifiants invalides');

    const valid = await bcrypt.compare(password, employee.password_hash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');

    const token = this.jwtService.sign({ sub: employee.id, email: employee.email });
    return { access_token: token, token_type: 'bearer', user: this.safeEmployee(employee) };
  }

  async loginPin(pin: string) {
    const employees = await this.employeeRepo.find();
    for (const emp of employees) {
      if (emp.pin_hash && await bcrypt.compare(pin, emp.pin_hash)) {
        const token = this.jwtService.sign({ sub: emp.id, email: emp.email });
        return { access_token: token, token_type: 'bearer', user: this.safeEmployee(emp) };
      }
    }
    throw new UnauthorizedException('NIP invalide');
  }

  async loginCard(card_id: string) {
    const employee = await this.employeeRepo.findOneBy({ card_id });
    if (!employee) throw new UnauthorizedException('Carte non reconnue');

    const token = this.jwtService.sign({ sub: employee.id, email: employee.email });
    return { access_token: token, token_type: 'bearer', user: this.safeEmployee(employee) };
  }

  async getMe(userId: string) {
    const employee = await this.employeeRepo.findOneBy({ id: userId });
    if (!employee) throw new UnauthorizedException('Utilisateur non trouvé');
    return this.safeEmployee(employee);
  }
}
