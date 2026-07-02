import { Body, Controller, Get, HttpCode, Post, UsePipes } from '@nestjs/common';
import { loginSchema, type AuthTokens, type CurrentUser as CurrentUserDto, type LoginDto } from '@neeklo/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentUserDto): CurrentUserDto {
    return user;
  }
}
