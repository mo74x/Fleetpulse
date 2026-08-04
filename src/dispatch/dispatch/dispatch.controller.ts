import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { AssignDispatchDto } from './dto/assign-dispatch.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { UserRole } from '../../auth/user-role.enum';

@ApiTags('dispatch')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: 'Assign order to courier',
    description:
      'Dispatches an unassigned order to an available courier based on proximity and radius.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order successfully assigned to courier.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid dispatch parameters or courier unavailable.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
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
