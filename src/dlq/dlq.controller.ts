import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DlqService } from './dlq.service';
import { DlqQueryDto } from './dto/dlq-query.dto';

@ApiTags('dlq')
@Controller('dlq')
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get()
  @ApiOperation({ summary: 'List all failed jobs in Dead Letter Queue' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of dead letter jobs',
  })
  async getFailedJobs(@Query() query: DlqQueryDto) {
    return this.dlqService.getFailedJobs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific dead letter job' })
  @ApiResponse({ status: 200, description: 'Dead letter job details' })
  @ApiResponse({ status: 404, description: 'Dead letter job not found' })
  async getJobById(@Param('id') id: string) {
    return this.dlqService.getJobById(id);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-queue a dead letter job back to its original queue',
  })
  @ApiResponse({ status: 200, description: 'Job successfully re-queued' })
  @ApiResponse({ status: 404, description: 'Dead letter job not found' })
  async retryJob(@Param('id') id: string) {
    return this.dlqService.retryJob(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a job from Dead Letter Queue' })
  @ApiResponse({ status: 200, description: 'Job successfully removed' })
  @ApiResponse({ status: 404, description: 'Dead letter job not found' })
  async removeJob(@Param('id') id: string) {
    return this.dlqService.removeJob(id);
  }

  @Delete()
  @ApiOperation({ summary: 'Purge all jobs from Dead Letter Queue' })
  @ApiResponse({ status: 200, description: 'DLQ purged successfully' })
  async purgeDlq() {
    return this.dlqService.purgeDlq();
  }
}
