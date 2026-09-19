import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type {
  Attachment,
  Comment,
  Subtask,
  Task,
} from '../../generated/prisma/client.js';
import { WorkspaceAccessService } from '../../core/workspace-access/workspace-access.service.js';

interface TaskEvent {
  projectId: string;
  task: Task;
}

interface TaskDeletedEvent {
  projectId: string;
  taskId: string;
}

interface CommentEvent {
  projectId: string;
  taskId: string;
  comment: Comment;
}

interface CommentDeletedEvent {
  projectId: string;
  taskId: string;
  commentId: string;
}

interface SubtaskEvent {
  projectId: string;
  taskId: string;
  subtask: Subtask;
}

interface SubtaskDeletedEvent {
  projectId: string;
  taskId: string;
  subtaskId: string;
}

interface AttachmentEvent {
  projectId: string;
  taskId: string;
  attachment: Attachment;
}

interface AttachmentDeletedEvent {
  projectId: string;
  taskId: string;
  attachmentId: string;
}

const projectRoom = (projectId: string) => `project:${projectId}`;

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('project:join')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    const userId = client.data.userId as string;
    const isMember = await this.workspaceAccess.isMemberOfProject(
      userId,
      projectId,
    );
    if (!isMember) {
      this.logger.warn(
        `Client ${client.id} (user ${userId}) denied join to project ${projectId}: not a workspace member`,
      );
      return;
    }
    client.join(projectRoom(projectId));
  }

  @SubscribeMessage('project:leave')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    client.leave(projectRoom(projectId));
  }

  @OnEvent('task.created')
  onTaskCreated({ projectId, task }: TaskEvent) {
    this.server.to(projectRoom(projectId)).emit('task:created', task);
  }

  @OnEvent('task.updated')
  onTaskUpdated({ projectId, task }: TaskEvent) {
    this.server.to(projectRoom(projectId)).emit('task:updated', task);
  }

  @OnEvent('task.moved')
  onTaskMoved({ projectId, task }: TaskEvent) {
    this.server.to(projectRoom(projectId)).emit('task:moved', task);
  }

  @OnEvent('task.deleted')
  onTaskDeleted({ projectId, taskId }: TaskDeletedEvent) {
    this.server.to(projectRoom(projectId)).emit('task:deleted', { taskId });
  }

  @OnEvent('comment.created')
  onCommentCreated({ projectId, taskId, comment }: CommentEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('comment:created', { taskId, comment });
  }

  @OnEvent('comment.updated')
  onCommentUpdated({ projectId, taskId, comment }: CommentEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('comment:updated', { taskId, comment });
  }

  @OnEvent('comment.deleted')
  onCommentDeleted({ projectId, taskId, commentId }: CommentDeletedEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('comment:deleted', { taskId, commentId });
  }

  @OnEvent('subtask.created')
  onSubtaskCreated({ projectId, taskId, subtask }: SubtaskEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('subtask:created', { taskId, subtask });
  }

  @OnEvent('subtask.updated')
  onSubtaskUpdated({ projectId, taskId, subtask }: SubtaskEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('subtask:updated', { taskId, subtask });
  }

  @OnEvent('subtask.deleted')
  onSubtaskDeleted({ projectId, taskId, subtaskId }: SubtaskDeletedEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('subtask:deleted', { taskId, subtaskId });
  }

  @OnEvent('attachment.created')
  onAttachmentCreated({ projectId, taskId, attachment }: AttachmentEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('attachment:created', { taskId, attachment });
  }

  @OnEvent('attachment.deleted')
  onAttachmentDeleted({
    projectId,
    taskId,
    attachmentId,
  }: AttachmentDeletedEvent) {
    this.server
      .to(projectRoom(projectId))
      .emit('attachment:deleted', { taskId, attachmentId });
  }
}
