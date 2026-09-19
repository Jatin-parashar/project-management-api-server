import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ANY_ROLE, Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(user.userId, workspaceId, dto);
  }

  @Roles(...ANY_ROLE)
  @Get()
  list(
    @Param('workspaceId') workspaceId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.projects.listForWorkspace(
      workspaceId,
      includeArchived === 'true',
    );
  }

  @Roles(...ANY_ROLE)
  @Get(':projectId')
  getOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.getOne(workspaceId, projectId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  @Patch(':projectId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.userId, workspaceId, projectId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':projectId/archive')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.archive(user.userId, workspaceId, projectId);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':projectId/restore')
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.restore(user.userId, workspaceId, projectId);
  }
}
