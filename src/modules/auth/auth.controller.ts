import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { LoginPasswordDto } from './dto/login-password.dto.js';
import {
  PasskeyOptionsDto,
  PasskeyRegisterOptionsDto,
  PasskeyVerifyDto,
} from './dto/passkey.dto.js';
import { RegisterPasswordDto } from './dto/register-password.dto.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register/passkey/options')
  getPasskeyRegistrationOptions(@Body() dto: PasskeyRegisterOptionsDto) {
    return this.auth.getPasskeyRegistrationOptions(dto.email, dto.name);
  }

  @Public()
  @Post('register/passkey/verify')
  async verifyPasskeyRegistration(
    @Body() dto: PasskeyVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.verifyPasskeyRegistration(
      dto.email,
      dto.response as any,
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('login/passkey/options')
  getPasskeyLoginOptions(@Body() dto: PasskeyOptionsDto) {
    return this.auth.getPasskeyLoginOptions(dto.email);
  }

  @Public()
  @Post('login/passkey/verify')
  async verifyPasskeyLogin(
    @Body() dto: PasskeyVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.verifyPasskeyLogin(
      dto.email,
      dto.response as any,
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('register/password')
  async registerWithPassword(
    @Body() dto: RegisterPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.registerWithPassword(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('login/password')
  async loginWithPassword(
    @Body() dto: LoginPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.loginWithPassword(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('No refresh token provided');

    const tokens = await this.auth.refreshTokens(raw);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await this.auth.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: REFRESH_COOKIE_PATH,
    });
  }
}
