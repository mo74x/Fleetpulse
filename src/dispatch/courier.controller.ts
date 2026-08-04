import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { CourierService } from './courier.service';
import { UpdateCourierAvailabilityDto } from './dto/update-courier-availability.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('api/v1/couriers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async findAll() {
    return this.courierService.findAll();
  }

  @Get(':id/availability')
  @Roles(UserRole.ADMIN, UserRole.COURIER, UserRole.MERCHANT)
  async getAvailability(@Param('id') id: string) {
    return this.courierService.getProfile(id);
  }

  @Patch(':id/availability')
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateCourierAvailabilityDto,
  ) {
    return this.courierService.updateAvailability(id, dto);
  }
}
