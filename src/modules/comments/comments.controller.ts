import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ANY_ROLE, Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks/:taskId/comments')
@Roles(...ANY_ROLE)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.userId, projectId, taskId, dto);
  }

  @Get()
  list(@Param('projectId') projectId: string, @Param('taskId') taskId: string) {
    return this.comments.listForTask(projectId, taskId);
  }

  @Patch(':commentId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(user.userId, projectId, taskId, commentId, dto);
  }

  @Delete(':commentId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.remove(user.userId, projectId, taskId, commentId);
  }
}
