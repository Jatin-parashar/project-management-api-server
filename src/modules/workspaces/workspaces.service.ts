import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        ownerId: userId,
        members: {
          create: { userId, role: Role.OWNER },
        },
      },
      include: { members: true },
    });

    this.events.emit('workspace.created', {
      workspaceId: workspace.id,
      actorId: userId,
      workspace,
    });
    return workspace;
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
    return memberships.map((m) => ({ ...m.workspace, myRole: m.role }));
  }

  async getOne(userId: string, workspaceId: string) {
    await this.assertMember(userId, workspaceId);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async addMember(actorId: string, workspaceId: string, dto: AddMemberDto) {
    if (dto.role === Role.OWNER) {
      throw new BadRequestException(
        'Cannot assign OWNER role — ownership is set at workspace creation',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new NotFoundException('No user with that email exists');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (existing)
      throw new ConflictException('User is already a member of this workspace');

    const member = await this.prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId, role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    this.events.emit('workspace.member_added', {
      workspaceId,
      actorId,
      member,
    });
    return member;
  }

  async updateMemberRole(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (!membership)
      throw new NotFoundException(
        'That user is not a member of this workspace',
      );
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException('Cannot change the workspace owner’s role');
    }
    if (dto.role === Role.OWNER) {
      throw new BadRequestException(
        'Cannot promote a member to OWNER — ownership transfer is not supported yet',
      );
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role: dto.role },
    });

    this.events.emit('workspace.member_role_updated', {
      workspaceId,
      actorId,
      targetUserId,
      role: dto.role,
    });
    return updated;
  }

  async removeMember(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (!membership)
      throw new NotFoundException(
        'That user is not a member of this workspace',
      );
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    await this.prisma.workspaceMember.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    this.events.emit('workspace.member_removed', {
      workspaceId,
      actorId,
      targetUserId,
    });
  }

  private async assertMember(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Workspace not found');
  }
}
