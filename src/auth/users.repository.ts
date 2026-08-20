import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOne(criteria: Partial<User>): Promise<User | null> {
    return this.usersRepository.findOne({ where: criteria });
  }

  async create(dto: AuthCredentialsDto): Promise<void> {
    const { username, password } = dto;

    const hash = await argon2.hash(password);

    const user = this.usersRepository.create({ username, password: hash });

    try {
      await this.usersRepository.save(user);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === '23505'
      ) {
        throw new ConflictException('Username already exists');
      }

      throw new InternalServerErrorException();
    }
  }
}
