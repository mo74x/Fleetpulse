import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { AssignDispatchDto } from './dto/assign-dispatch.dto';

@Controller('api/v1/dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('assign')
  @HttpCode(HttpStatus.OK)
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
