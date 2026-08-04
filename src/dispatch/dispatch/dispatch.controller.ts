import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { AssignDispatchDto } from './dto/assign-dispatch.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { UserRole } from '../../auth/user-role.enum';

@Controller({
  path: 'dispatch',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async assignCourier(@Body() dto: AssignDispatchDto) {
    return this.dispatchService.assignOrder(
      dto.orderId,
      dto.courierId,
      dto.latitude,
      dto.longitude,
      dto.radiusKm,
    );
  }
}
