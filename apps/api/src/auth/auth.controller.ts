import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Role } from '@cadence/shared-types';
import type { AuthenticatedUser, AuthTokens } from '@cadence/shared-types';
import { AuthService } from './auth.service';
import {
  SignupDto,
  LoginDto,
  InviteDto,
  AcceptInviteDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { env } from '../config/env';

const REFRESH_COOKIE = 'cadence_rt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: env.jwt.refreshTtl * 1000,
      path: '/api/auth',
    });
  }

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response): Promise<AuthTokens> {
    const { tokens, refreshToken } = await this.auth.signup(dto);
    this.setRefreshCookie(res, refreshToken);
    return tokens;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthTokens> {
    const { tokens, refreshToken } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return tokens;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthTokens> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) {
      throw new UnauthorizedException('No refresh token');
    }
    const { tokens, refreshToken } = await this.auth.refresh(raw);
    this.setRefreshCookie(res, refreshToken);
    return tokens;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Public()
  @Get('verify-email')
  async verifyEmailGet(@Query() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.auth.verifyEmail(dto.token);
    return { verified: true };
  }

  @Public()
  @Post('request-password-reset')
  @HttpCode(202)
  async requestReset(@Body() dto: RequestPasswordResetDto): Promise<{ ok: true }> {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @UseGuards(RolesGuard)
  @Roles(Role.FirmAdmin)
  @Post('invite')
  @HttpCode(202)
  async invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteDto): Promise<{ ok: true }> {
    if (!user.tenantId) {
      throw new UnauthorizedException('No tenant context');
    }
    await this.auth.invite(user.tenantId, dto.email, dto.role);
    return { ok: true };
  }

  @Public()
  @Post('accept-invite')
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const { tokens, refreshToken } = await this.auth.acceptInvite(
      dto.token,
      dto.password,
      dto.firstName,
      dto.lastName,
    );
    this.setRefreshCookie(res, refreshToken);
    return tokens;
  }
}
