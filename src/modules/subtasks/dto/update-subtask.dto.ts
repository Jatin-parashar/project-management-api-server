import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSubtaskDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
