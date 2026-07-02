import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AuthTokens, CurrentUser, Role } from '@neeklo/contracts';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { permissionsForRole } from './role-permissions';

export interface JwtPayload {
  sub: string;
  tid: string;
  role: Role;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid credentials' });

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid credentials' });

    const payload: JwtPayload = { sub: user.id, tid: user.tenantId, role: user.role as Role, email: user.email };
    return this.issueTokens(payload);
  }

  async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTtl,
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async currentUser(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      permissions: permissionsForRole(user.role as Role, user.permissions),
    };
  }

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
