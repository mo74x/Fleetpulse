/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UploadPodDto } from './dto/upload-pod.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller({
  path: 'orders',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // 202 status code
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async findAll(@Query() queryDto: OrderQueryDto) {
    return this.ordersService.findAll(queryDto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.COURIER)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/history')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.COURIER)
  async getHistory(@Param('id') id: string) {
    return this.ordersService.getOrderHistory(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.COURIER, UserRole.MERCHANT)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto);
  }

  @Post(':id/pod')
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'signature', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
    ]),
  )
  async uploadPod(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      signature?: Express.Multer.File[];
      photo?: Express.Multer.File[];
    },
    @Body() uploadPodDto: UploadPodDto,
    @Req() req: any,
  ) {
    const courierId = req.user?.userId;
    return this.ordersService.uploadProofOfDelivery(
      id,
      files,
      uploadPodDto,
      courierId,
    );
  }
}
