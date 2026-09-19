import { IsEnum } from 'class-validator';
import { Role } from '../../../generated/prisma/enums.js';

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role!: Role;
}
