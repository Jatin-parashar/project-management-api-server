import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { WorkspaceAccessService } from '../../core/workspace-access/workspace-access.service.js';
import type {
  Attachment,
  Comment,
  Prisma,
  Project,
  Subtask,
  Task,
  Workspace,
  WorkspaceMember,
} from '../../generated/prisma/client.js';
import type { Role } from '../../generated/prisma/enums.js';

@Injectable()
export class ActivityLogListener {
  private readonly logger = new Logger(ActivityLogListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @OnEvent('workspace.created')
  onWorkspaceCreated({
    workspaceId,
    actorId,
    workspace,
  }: {
    workspaceId: string;
    actorId: string;
    workspace: Workspace;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'workspace.created',
      'Workspace',
      workspace.id,
      {
        name: workspace.name,
      },
    );
  }

  @OnEvent('workspace.member_added')
  onMemberAdded({
    workspaceId,
    actorId,
    member,
  }: {
    workspaceId: string;
    actorId: string;
    member: WorkspaceMember;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'workspace.member_added',
      'WorkspaceMember',
      member.id,
      {
        userId: member.userId,
        role: member.role,
      },
    );
  }

  @OnEvent('workspace.member_role_updated')
  onMemberRoleUpdated({
    workspaceId,
    actorId,
    targetUserId,
    role,
  }: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    role: Role;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'workspace.member_role_updated',
      'WorkspaceMember',
      targetUserId,
      {
        role,
      },
    );
  }

  @OnEvent('workspace.member_removed')
  onMemberRemoved({
    workspaceId,
    actorId,
    targetUserId,
  }: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'workspace.member_removed',
      'WorkspaceMember',
      targetUserId,
      {},
    );
  }

  @OnEvent('project.created')
  onProjectCreated({
    workspaceId,
    actorId,
    project,
  }: {
    workspaceId: string;
    actorId: string;
    project: Project;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'project.created',
      'Project',
      project.id,
      { name: project.name },
    );
  }

  @OnEvent('project.updated')
  onProjectUpdated({
    workspaceId,
    actorId,
    project,
  }: {
    workspaceId: string;
    actorId: string;
    project: Project;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'project.updated',
      'Project',
      project.id,
      { name: project.name },
    );
  }

  @OnEvent('project.archived')
  onProjectArchived({
    workspaceId,
    actorId,
    project,
  }: {
    workspaceId: string;
    actorId: string;
    project: Project;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'project.archived',
      'Project',
      project.id,
      { name: project.name },
    );
  }

  @OnEvent('project.restored')
  onProjectRestored({
    workspaceId,
    actorId,
    project,
  }: {
    workspaceId: string;
    actorId: string;
    project: Project;
  }) {
    return this.write(
      workspaceId,
      actorId,
      'project.restored',
      'Project',
      project.id,
      { name: project.name },
    );
  }

  @OnEvent('task.created')
  async onTaskCreated({
    projectId,
    actorId,
    task,
  }: {
    projectId: string;
    actorId: string;
    task: Task;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(workspaceId, actorId, 'task.created', 'Task', task.id, {
      title: task.title,
    });
  }

  @OnEvent('task.updated')
  async onTaskUpdated({
    projectId,
    actorId,
    task,
  }: {
    projectId: string;
    actorId: string;
    task: Task;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(workspaceId, actorId, 'task.updated', 'Task', task.id, {
      title: task.title,
    });
  }

  @OnEvent('task.moved')
  async onTaskMoved({
    projectId,
    actorId,
    task,
  }: {
    projectId: string;
    actorId: string;
    task: Task;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(workspaceId, actorId, 'task.moved', 'Task', task.id, {
      title: task.title,
      status: task.status,
    });
  }

  @OnEvent('task.deleted')
  async onTaskDeleted({
    projectId,
    actorId,
    taskId,
  }: {
    projectId: string;
    actorId: string;
    taskId: string;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(workspaceId, actorId, 'task.deleted', 'Task', taskId, {});
  }

  @OnEvent('comment.created')
  async onCommentCreated({
    projectId,
    taskId,
    actorId,
    comment,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    comment: Comment;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'comment.created',
      'Comment',
      comment.id,
      { taskId },
    );
  }

  @OnEvent('comment.updated')
  async onCommentUpdated({
    projectId,
    taskId,
    actorId,
    comment,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    comment: Comment;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'comment.updated',
      'Comment',
      comment.id,
      { taskId },
    );
  }

  @OnEvent('comment.deleted')
  async onCommentDeleted({
    projectId,
    taskId,
    actorId,
    commentId,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    commentId: string;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'comment.deleted',
      'Comment',
      commentId,
      { taskId },
    );
  }

  @OnEvent('subtask.created')
  async onSubtaskCreated({
    projectId,
    taskId,
    actorId,
    subtask,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    subtask: Subtask;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'subtask.created',
      'Subtask',
      subtask.id,
      {
        taskId,
        title: subtask.title,
      },
    );
  }

  @OnEvent('subtask.updated')
  async onSubtaskUpdated({
    projectId,
    taskId,
    actorId,
    subtask,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    subtask: Subtask;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'subtask.updated',
      'Subtask',
      subtask.id,
      {
        taskId,
        completed: subtask.completed,
      },
    );
  }

  @OnEvent('subtask.deleted')
  async onSubtaskDeleted({
    projectId,
    taskId,
    actorId,
    subtaskId,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    subtaskId: string;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'subtask.deleted',
      'Subtask',
      subtaskId,
      { taskId },
    );
  }

  @OnEvent('attachment.created')
  async onAttachmentCreated({
    projectId,
    taskId,
    actorId,
    attachment,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    attachment: Attachment;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'attachment.created',
      'Attachment',
      attachment.id,
      {
        taskId,
        fileName: attachment.fileName,
      },
    );
  }

  @OnEvent('attachment.deleted')
  async onAttachmentDeleted({
    projectId,
    taskId,
    actorId,
    attachmentId,
  }: {
    projectId: string;
    taskId: string;
    actorId: string;
    attachmentId: string;
  }) {
    const workspaceId =
      await this.workspaceAccess.resolveWorkspaceIdForProject(projectId);
    if (!workspaceId) return;
    return this.write(
      workspaceId,
      actorId,
      'attachment.deleted',
      'Attachment',
      attachmentId,
      { taskId },
    );
  }

  private async write(
    workspaceId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: {
          workspaceId,
          actorId,
          action,
          entityType,
          entityId,
          metadata: metadata as Prisma.InputJsonObject,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write activity log for ${action}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
