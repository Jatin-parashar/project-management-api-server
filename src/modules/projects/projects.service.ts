import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        workspaceId,
        createdById: userId,
      },
    });

    this.events.emit('project.created', {
      workspaceId,
      actorId: userId,
      project,
    });
    return project;
  }

  listForWorkspace(workspaceId: string, includeArchived: boolean) {
    return this.prisma.project.findMany({
      where: {
        workspaceId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(
    userId: string,
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    await this.getOne(workspaceId, projectId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: dto,
    });

    this.events.emit('project.updated', {
      workspaceId,
      actorId: userId,
      project,
    });
    return project;
  }

  async archive(userId: string, workspaceId: string, projectId: string) {
    await this.getOne(workspaceId, projectId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    });

    this.events.emit('project.archived', {
      workspaceId,
      actorId: userId,
      project,
    });
    return project;
  }

  async restore(userId: string, workspaceId: string, projectId: string) {
    await this.getOne(workspaceId, projectId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: null },
    });

    this.events.emit('project.restored', {
      workspaceId,
      actorId: userId,
      project,
    });
    return project;
  }
}
