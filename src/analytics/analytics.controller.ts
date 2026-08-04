/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller({
  path: 'analytics',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get high-level operational analytics overview',
    description:
      'Returns total orders, delivery success rates, revenue, and active courier stats.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics overview data returned.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized access.' })
  async getOverview(@Query() query: AnalyticsQueryDto, @Request() req: any) {
    const effectiveQuery = this.applyMerchantScope(query, req);
    return this.analyticsService.getOverview(effectiveQuery);
  }

  @Get('couriers')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get courier performance leaderboard',
    description:
      'Returns top couriers ranked by completed deliveries and average ratings.',
  })
  @ApiResponse({ status: 200, description: 'Courier leaderboard returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized access.' })
  async getCouriersLeaderboard(
    @Query() query: AnalyticsQueryDto,
    @Request() req: any,
  ) {
    const effectiveQuery = this.applyMerchantScope(query, req);
    return this.analyticsService.getCourierLeaderboard(effectiveQuery);
  }

  @Get('trends')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get time-series delivery trends',
    description:
      'Returns delivery volume trends grouped by day, week, or month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Time-series trends data returned.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized access.' })
  async getTrends(@Query() query: AnalyticsQueryDto, @Request() req: any) {
    const effectiveQuery = this.applyMerchantScope(query, req);
    return this.analyticsService.getTrends(effectiveQuery);
  }

  private applyMerchantScope(query: AnalyticsQueryDto, req: any) {
    const user = req?.user;
    if (user && user.role === UserRole.MERCHANT && user.userId) {
      return {
        ...query,
        merchantId: query.merchantId || user.userId,
      };
    }
    return query;
  }
}
