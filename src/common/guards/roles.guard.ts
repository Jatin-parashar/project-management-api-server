import {
  ForbiddenException,
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceAccessService } from '../../core/workspace-access/workspace-access.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspaceAccess: WorkspaceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    const workspaceId = await this.resolveWorkspaceId(request);

    if (!user || !workspaceId) {
      throw new ForbiddenException('Workspace context required for this route');
    }

    const role = await this.workspaceAccess.getMemberRole(
      user.userId,
      workspaceId,
    );

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have the required role for this workspace',
      );
    }

    return true;
  }

  private async resolveWorkspaceId(request: any): Promise<string | undefined> {
    const direct = request.params?.workspaceId ?? request.body?.workspaceId;
    if (direct) return direct;

    const projectId = request.params?.projectId;
    if (projectId)
      return this.workspaceAccess.resolveWorkspaceIdForProject(projectId);

    return undefined;
  }
}
