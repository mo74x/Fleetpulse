import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CourierService } from './courier.service';
import { UpdateCourierAvailabilityDto } from './dto/update-courier-availability.dto';
import { CourierProfileResponseDto } from './dto/courier-profile-response.dto';
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
  @ApiResponse({
    status: 200,
    description: 'List of couriers returned.',
    type: [CourierProfileResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  async findAll() {
    const rawCouriers = await this.courierService.findAll();
    return rawCouriers.map((courier) =>
      plainToInstance(
        CourierProfileResponseDto,
        courier.toObject ? courier.toObject() : courier,
        { excludeExtraneousValues: true },
      ),
    );
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
    type: CourierProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Courier not found.' })
  async getAvailability(@Param('id') id: string) {
    const courier = await this.courierService.getProfile(id);
    return plainToInstance(
      CourierProfileResponseDto,
      courier.toObject ? courier.toObject() : courier,
      { excludeExtraneousValues: true },
    );
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
    type: CourierProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid status provided.' })
  async updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateCourierAvailabilityDto,
  ) {
    const courier = await this.courierService.updateAvailability(id, dto);
    return plainToInstance(
      CourierProfileResponseDto,
      courier.toObject ? courier.toObject() : courier,
      { excludeExtraneousValues: true },
    );
  }
}
