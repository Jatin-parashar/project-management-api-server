import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TaskStatus } from '../../../generated/prisma/enums.js';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;
}
