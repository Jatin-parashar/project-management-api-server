import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { LoginPasswordDto } from './dto/login-password.dto.js';
import type { RegisterPasswordDto } from './dto/register-password.dto.js';

interface PendingChallenge {
  challenge: string;
  expiresAt: number;
  pendingUser?: { id: string; name: string };
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly challenges = new Map<string, PendingChallenge>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async getPasskeyRegistrationOptions(email: string, name?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { credentials: true },
    });

    if (existingUser) {
      const options = await generateRegistrationOptions({
        rpName: this.config.getOrThrow('WEBAUTHN_RP_NAME'),
        rpID: this.config.getOrThrow('WEBAUTHN_RP_ID'),
        userName: existingUser.email,
        userID: Buffer.from(existingUser.id),
        userDisplayName: existingUser.name,
        attestationType: 'none',
        excludeCredentials: existingUser.credentials.map((c) => ({
          id: c.credentialId,
          transports: c.transports as any,
        })),
      });
      this.challenges.set(email, {
        challenge: options.challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
      });
      return options;
    }

    if (!name) {
      throw new BadRequestException(
        'name is required to register a new account',
      );
    }

    const pendingId = randomUUID();
    const options = await generateRegistrationOptions({
      rpName: this.config.getOrThrow('WEBAUTHN_RP_NAME'),
      rpID: this.config.getOrThrow('WEBAUTHN_RP_ID'),
      userName: email,
      userID: Buffer.from(pendingId),
      userDisplayName: name,
      attestationType: 'none',
    });

    this.challenges.set(email, {
      challenge: options.challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
      pendingUser: { id: pendingId, name },
    });
    return options;
  }

  async verifyPasskeyRegistration(
    email: string,
    response: RegistrationResponseJSON,
  ): Promise<TokenPair> {
    const pending = this.consumeChallenge(email);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.config.getOrThrow('WEBAUTHN_ORIGIN'),
      expectedRPID: this.config.getOrThrow('WEBAUTHN_RP_ID'),
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException(
        'Passkey registration could not be verified',
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: pending.pendingUser?.name ?? email },
    });

    await this.prisma.credential.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
      },
    });

    return this.issueTokens(user.id, user.email);
  }

  async getPasskeyLoginOptions(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credentials: true },
    });
    if (!user || user.credentials.length === 0) {
      throw new NotFoundException('No passkeys registered for this account');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.config.getOrThrow('WEBAUTHN_RP_ID'),
      allowCredentials: user.credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as any,
      })),
      userVerification: 'preferred',
    });

    this.challenges.set(email, {
      challenge: options.challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return options;
  }

  async verifyPasskeyLogin(
    email: string,
    response: AuthenticationResponseJSON,
  ): Promise<TokenPair> {
    const pending = this.consumeChallenge(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credentials: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const storedCredential = user.credentials.find(
      (c) => c.credentialId === response.id,
    );
    if (!storedCredential)
      throw new UnauthorizedException('Unrecognized passkey');

    const credentialForVerification: WebAuthnCredential = {
      id: storedCredential.credentialId,
      publicKey: new Uint8Array(storedCredential.publicKey),
      counter: storedCredential.counter,
      transports: storedCredential.transports as any,
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.config.getOrThrow('WEBAUTHN_ORIGIN'),
      expectedRPID: this.config.getOrThrow('WEBAUTHN_RP_ID'),
      credential: credentialForVerification,
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    await this.prisma.credential.update({
      where: { id: storedCredential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    return this.issueTokens(user.id, user.email);
  }

  async registerWithPassword(dto: RegisterPasswordDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new ConflictException('An account with this email already exists');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
    });

    return this.issueTokens(user.id, user.email);
  }

  async loginWithPassword(dto: LoginPasswordDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user?.passwordHash)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.email);
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revoked) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException(
        'Refresh token reuse detected — all sessions revoked',
      );
    }

    if (stored.expiresAt < new Date())
      throw new UnauthorizedException('Refresh token expired');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });
    return this.issueTokens(user.id, user.email);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  }

  private consumeChallenge(email: string): PendingChallenge {
    const entry = this.challenges.get(email);
    this.challenges.delete(email);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException(
        'Challenge expired or not found — request new options first',
      );
    }
    return entry;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
