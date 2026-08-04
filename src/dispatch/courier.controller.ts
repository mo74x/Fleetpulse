import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CourierService } from './courier.service';
import { UpdateCourierAvailabilityDto } from './dto/update-courier-availability.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@ApiTags('couriers')
@ApiBearerAuth()
@Controller({
  path: 'couriers',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @ApiOperation({
    summary: 'List all couriers',
    description:
      'Retrieves active courier profiles and current operational status.',
  })
  @ApiResponse({ status: 200, description: 'List of couriers returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  async findAll() {
    return this.courierService.findAll();
  }

  @Get(':id/availability')
  @Roles(UserRole.ADMIN, UserRole.COURIER, UserRole.MERCHANT)
  @ApiOperation({
    summary: 'Get courier availability profile',
    description:
      'Retrieves availability status, vehicle info, and last known location for a courier.',
  })
  @ApiResponse({
    status: 200,
    description: 'Courier availability profile returned.',
  })
  @ApiResponse({ status: 404, description: 'Courier not found.' })
  async getAvailability(@Param('id') id: string) {
    return this.courierService.getProfile(id);
  }

  @Patch(':id/availability')
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  @ApiOperation({
    summary: 'Update courier availability status',
    description: 'Toggles courier status between ACTIVE, IDLE, or OFF_DUTY.',
  })
  @ApiResponse({
    status: 200,
    description: 'Courier availability updated successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid status provided.' })
  async updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateCourierAvailabilityDto,
  ) {
    return this.courierService.updateAvailability(id, dto);
  }
}
