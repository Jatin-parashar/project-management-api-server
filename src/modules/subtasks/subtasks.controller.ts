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
import { SubtasksService } from './subtasks.service.js';
import { CreateSubtaskDto } from './dto/create-subtask.dto.js';
import { UpdateSubtaskDto } from './dto/update-subtask.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ANY_ROLE, Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('subtasks')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks/:taskId/subtasks')
@Roles(...ANY_ROLE)
export class SubtasksController {
  constructor(private readonly subtasks: SubtasksService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.subtasks.create(user.userId, projectId, taskId, dto);
  }

  @Get()
  list(@Param('projectId') projectId: string, @Param('taskId') taskId: string) {
    return this.subtasks.listForTask(projectId, taskId);
  }

  @Patch(':subtaskId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.subtasks.update(user.userId, projectId, taskId, subtaskId, dto);
  }

  @Delete(':subtaskId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.subtasks.remove(user.userId, projectId, taskId, subtaskId);
  }
}
