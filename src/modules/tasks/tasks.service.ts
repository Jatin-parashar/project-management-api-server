import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TaskStatus } from '../../generated/prisma/enums.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, projectId: string, dto: CreateTaskDto) {
    const position = await this.prisma.task.count({
      where: { projectId, status: TaskStatus.TODO },
    });

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        projectId,
        createdById: userId,
        position,
      },
    });

    this.events.emit('task.created', { projectId, actorId: userId, task });
    return task;
  }

  listForProject(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });
  }

  async getOne(projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(
    userId: string,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.getOne(projectId, taskId);
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        // dto.dueDate is one of three distinct states: omitted (leave
        // untouched), explicit null (clear it), or an ISO string (set it) —
        // a `dto.dueDate ? ... : undefined` ternary would collapse null and
        // omitted into the same "untouched" behavior, since null is falsy.
        dueDate:
          dto.dueDate === undefined
            ? undefined
            : dto.dueDate === null
              ? null
              : new Date(dto.dueDate),
      },
    });

    this.events.emit('task.updated', { projectId, actorId: userId, task });
    return task;
  }

  async updateStatus(
    userId: string,
    projectId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const existing = await this.getOne(projectId, taskId);

    const position =
      dto.position ??
      (await this.prisma.task.count({
        where: { projectId, status: dto.status },
      }));

    const task = await this.prisma.task.update({
      where: { id: existing.id },
      data: { status: dto.status, position },
    });

    this.events.emit('task.moved', { projectId, actorId: userId, task });
    return task;
  }

  async remove(userId: string, projectId: string, taskId: string) {
    await this.getOne(projectId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
    this.events.emit('task.deleted', { projectId, actorId: userId, taskId });
  }
}
