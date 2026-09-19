import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service.js';
import { ANY_ROLE, Roles } from '../../common/decorators/roles.decorator.js';

@ApiTags('activity-log')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/activity')
@Roles(...ANY_ROLE)
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Get()
  list(
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    const safeLimit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), 200)
      : 50;
    return this.activityLog.listForWorkspace(workspaceId, safeLimit);
  }
}
