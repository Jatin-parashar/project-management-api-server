import { Module } from '@nestjs/common';
import { ActivityLogController } from './activity-log.controller.js';
import { ActivityLogService } from './activity-log.service.js';
import { ActivityLogListener } from './activity-log.listener.js';

@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService, ActivityLogListener],
})
export class ActivityLogModule {}
