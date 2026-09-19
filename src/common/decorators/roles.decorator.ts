import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const ANY_ROLE = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.MEMBER,
  Role.GUEST,
];
