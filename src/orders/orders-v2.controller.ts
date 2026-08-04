import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller({
  path: 'orders',
  version: '2',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersV2Controller {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async findAllV2(@Query() queryDto: OrderQueryDto) {
    const v1Results = await this.ordersService.findAll(queryDto);
    return {
      version: 'v2',
      apiVersion: '2.0',
      meta: {
        totalItems: Array.isArray(v1Results) ? v1Results.length : 0,
        retrievedAt: new Date().toISOString(),
      },
      data: v1Results,
    };
  }
}
