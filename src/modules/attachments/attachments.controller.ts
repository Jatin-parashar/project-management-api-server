import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service.js';
import { SafeExtensionValidator } from './safe-extension.validator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ANY_ROLE, Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPE_REGEX =
  /^(image\/(jpeg|png|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.ms-excel|vnd\.ms-powerpoint|zip)|text\/plain)$/;

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks/:taskId/attachments')
@Roles(...ANY_ROLE)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
          new FileTypeValidator({
            fileType: ALLOWED_MIME_TYPE_REGEX,
            fallbackToMimetype: true,
            overrideMimeType: true,
          }),
          new SafeExtensionValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.attachments.upload(user.userId, projectId, taskId, file);
  }

  @Get()
  list(@Param('projectId') projectId: string, @Param('taskId') taskId: string) {
    return this.attachments.listForTask(projectId, taskId);
  }

  @Delete(':attachmentId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.remove(
      user.userId,
      projectId,
      taskId,
      attachmentId,
    );
  }
}
