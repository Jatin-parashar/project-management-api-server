import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service.js';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  listForWorkspace(workspaceId: string, limit: number) {
    return this.prisma.activityLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
