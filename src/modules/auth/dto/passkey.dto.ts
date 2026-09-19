import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

export class PasskeyOptionsDto {
  @IsEmail()
  email!: string;
}

export class PasskeyRegisterOptionsDto extends PasskeyOptionsDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class PasskeyVerifyDto {
  @IsEmail()
  email!: string;

  @IsObject()
  response!: Record<string, unknown>;
}
