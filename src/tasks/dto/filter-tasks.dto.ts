import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '../task.entity';

export class FilterTasksDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
