import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { CreateSubtaskDto } from './dto/create-subtask.dto.js';
import { UpdateSubtaskDto } from './dto/update-subtask.dto.js';

@Injectable()
export class SubtasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    projectId: string,
    taskId: string,
    dto: CreateSubtaskDto,
  ) {
    await this.tasks.getOne(projectId, taskId);

    const position = await this.prisma.subtask.count({ where: { taskId } });

    const subtask = await this.prisma.subtask.create({
      data: { title: dto.title, taskId, position },
    });

    this.events.emit('subtask.created', {
      projectId,
      taskId,
      actorId: userId,
      subtask,
    });
    return subtask;
  }

  async listForTask(projectId: string, taskId: string) {
    await this.tasks.getOne(projectId, taskId);

    return this.prisma.subtask.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
    });
  }

  async update(
    userId: string,
    projectId: string,
    taskId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ) {
    await this.getOwnedSubtask(projectId, taskId, subtaskId);

    const subtask = await this.prisma.subtask.update({
      where: { id: subtaskId },
      data: dto,
    });

    this.events.emit('subtask.updated', {
      projectId,
      taskId,
      actorId: userId,
      subtask,
    });
    return subtask;
  }

  async remove(
    userId: string,
    projectId: string,
    taskId: string,
    subtaskId: string,
  ) {
    await this.getOwnedSubtask(projectId, taskId, subtaskId);
    await this.prisma.subtask.delete({ where: { id: subtaskId } });
    this.events.emit('subtask.deleted', {
      projectId,
      taskId,
      actorId: userId,
      subtaskId,
    });
  }

  private async getOwnedSubtask(
    projectId: string,
    taskId: string,
    subtaskId: string,
  ) {
    await this.tasks.getOne(projectId, taskId);
    const subtask = await this.prisma.subtask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!subtask) throw new NotFoundException('Subtask not found');
    return subtask;
  }
}
