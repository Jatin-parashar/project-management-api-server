import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { WorkspaceAccessService } from '../../core/workspace-access/workspace-access.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    projectId: string,
    taskId: string,
    dto: CreateCommentDto,
  ) {
    await this.tasks.getOne(projectId, taskId);

    const comment = await this.prisma.comment.create({
      data: { content: dto.content, taskId, authorId: userId },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    this.events.emit('comment.created', {
      projectId,
      taskId,
      actorId: userId,
      comment,
    });
    return comment;
  }

  async listForTask(projectId: string, taskId: string) {
    await this.tasks.getOne(projectId, taskId);

    return this.prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async update(
    userId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.getOwnedComment(projectId, taskId, commentId);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    this.events.emit('comment.updated', {
      projectId,
      taskId,
      actorId: userId,
      comment: updated,
    });
    return updated;
  }

  async remove(
    userId: string,
    projectId: string,
    taskId: string,
    commentId: string,
  ) {
    const comment = await this.getOwnedComment(projectId, taskId, commentId);

    if (comment.authorId !== userId) {
      const isModerator = await this.workspaceAccess.isModeratorForProject(
        userId,
        projectId,
      );
      if (!isModerator) {
        throw new ForbiddenException(
          'Only the author or a workspace moderator can delete this comment',
        );
      }
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    this.events.emit('comment.deleted', {
      projectId,
      taskId,
      actorId: userId,
      commentId,
    });
  }

  private async getOwnedComment(
    projectId: string,
    taskId: string,
    commentId: string,
  ) {
    await this.tasks.getOne(projectId, taskId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}
