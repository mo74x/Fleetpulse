/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getOverview(@Query() query: AnalyticsQueryDto, @Request() req: any) {
    const effectiveQuery = this.applyMerchantScope(query, req);
    return this.analyticsService.getOverview(effectiveQuery);
  }

  @Get('couriers')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getCouriersLeaderboard(
    @Query() query: AnalyticsQueryDto,
    @Request() req: any,
  ) {
    const effectiveQuery = this.applyMerchantScope(query, req);
    return this.analyticsService.getCourierLeaderboard(effectiveQuery);
  }

  @Get('trends')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
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
