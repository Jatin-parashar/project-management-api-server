import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { WorkspaceAccessService } from '../../core/workspace-access/workspace-access.service.js';
import {
  CloudinaryService,
  resourceTypeForMimeType,
} from '../../core/cloudinary/cloudinary.service.js';
import type { CloudinaryResourceType } from '../../core/cloudinary/cloudinary.service.js';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly cloudinary: CloudinaryService,
    private readonly events: EventEmitter2,
  ) {}

  async upload(
    userId: string,
    projectId: string,
    taskId: string,
    file: Express.Multer.File,
  ) {
    await this.tasks.getOne(projectId, taskId);

    const resourceType = resourceTypeForMimeType(file.mimetype);
    const result = await this.cloudinary.upload(
      file.buffer,
      `tasks/${taskId}`,
      resourceType,
      [`task:${taskId}`, `project:${projectId}`],
    );

    const attachment = await this.prisma.attachment.create({
      data: {
        taskId,
        uploadedById: userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: result.secure_url,
        publicId: result.public_id,
        resourceType,
      },
    });

    this.events.emit('attachment.created', {
      projectId,
      taskId,
      actorId: userId,
      attachment,
    });
    return attachment;
  }

  async listForTask(projectId: string, taskId: string) {
    await this.tasks.getOne(projectId, taskId);

    return this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(
    userId: string,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ) {
    await this.tasks.getOne(projectId, taskId);

    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploadedById !== userId) {
      const isModerator = await this.workspaceAccess.isModeratorForProject(
        userId,
        projectId,
      );
      if (!isModerator) {
        throw new ForbiddenException(
          'Only the uploader or a workspace moderator can delete this attachment',
        );
      }
    }

    await this.cloudinary.destroy(
      attachment.publicId,
      attachment.resourceType as CloudinaryResourceType,
    );
    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    this.events.emit('attachment.deleted', {
      projectId,
      taskId,
      actorId: userId,
      attachmentId,
    });
  }
}
