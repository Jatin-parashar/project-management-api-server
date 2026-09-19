import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { CloudinaryModule } from '../../core/cloudinary/cloudinary.module.js';
import { TasksModule } from '../tasks/tasks.module.js';

@Module({
  imports: [CloudinaryModule, TasksModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
