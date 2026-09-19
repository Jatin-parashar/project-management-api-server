import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../../generated/prisma/enums.js';

export const MODERATOR_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveWorkspaceIdForProject(
    projectId: string,
  ): Promise<string | undefined> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId;
  }

  async getMemberRole(
    userId: string,
    workspaceId: string,
  ): Promise<Role | undefined> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });
    return membership?.role;
  }

  async isModerator(userId: string, workspaceId: string): Promise<boolean> {
    const role = await this.getMemberRole(userId, workspaceId);
    return !!role && MODERATOR_ROLES.includes(role);
  }

  async isModeratorForProject(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const workspaceId = await this.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return false;
    return this.isModerator(userId, workspaceId);
  }

  async isMemberOfProject(userId: string, projectId: string): Promise<boolean> {
    const workspaceId = await this.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return false;
    const role = await this.getMemberRole(userId, workspaceId);
    return !!role;
  }
}
