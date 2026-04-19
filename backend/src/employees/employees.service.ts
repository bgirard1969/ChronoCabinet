import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { Employee } from '../common/entities';

@Injectable()
export class EmployeesService {
  constructor(@InjectRepository(Employee) private readonly repo: Repository<Employee>) {}

  private safe(e: Employee) {
    const { password_hash, pin_hash, ...rest } = e;
    return rest;
  }

  async findAll() {
    return (await this.repo.find({ order: { last_name: 'ASC' } })).map(e => this.safe(e));
  }

  getRoles() {
    return ['administrateur', 'gestionnaire', 'technicien', 'clinicien', 'lecture'];
  }

  async findOne(id: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('Employé non trouvé');
    return this.safe(e);
  }

  async create(data: any) {
    const employee = this.repo.create({
      id: uuidv4(),
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      password_hash: await bcrypt.hash(data.password, 10),
      pin_hash: data.pin ? await bcrypt.hash(data.pin, 10) : null,
      card_id: data.card_id || null,
    });
    await this.repo.save(employee);
    return this.safe(employee);
  }

  async update(id: string, data: any) {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException('Employé non trouvé');
    if (data.first_name) employee.first_name = data.first_name;
    if (data.last_name) employee.last_name = data.last_name;
    if (data.email) employee.email = data.email;
    if (data.role) employee.role = data.role;
    if (data.password) employee.password_hash = await bcrypt.hash(data.password, 10);
    if (data.pin) employee.pin_hash = await bcrypt.hash(data.pin, 10);
    if (data.card_id !== undefined) employee.card_id = data.card_id || null;
    await this.repo.save(employee);
    return this.safe(employee);
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('Auto-suppression interdite');
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('Employé non trouvé');
    await this.repo.remove(e);
    return { deleted: true };
  }
}
