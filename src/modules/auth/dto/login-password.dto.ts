import { IsEmail, IsString } from 'class-validator';

export class LoginPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
