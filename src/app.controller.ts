import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'System health check',
    description:
      'Returns a greeting string indicating the application is running.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is active and healthy.',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
