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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('orders')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: 'Create a new delivery order',
    description:
      'Ingests order details and queues background processing for dispatch.',
  })
  @ApiResponse({
    status: 202,
    description: 'Order successfully queued for creation.',
  })
  @ApiResponse({ status: 400, description: 'Invalid payload structure.' })
  @ApiResponse({ status: 401, description: 'Unauthorized access.' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @ApiOperation({
    summary: 'List orders with filtering and pagination',
    description:
      'Retrieves a paginated list of orders filtered by status, merchant, or date range.',
  })
  @ApiResponse({ status: 200, description: 'Paginated orders list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized access.' })
  async findAll(@Query() queryDto: OrderQueryDto) {
    return this.ordersService.findAll(queryDto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.COURIER)
  @ApiOperation({
    summary: 'Get order details by ID or tracking number',
    description:
      'Retrieves detailed order information including tracking events and current status.',
  })
  @ApiResponse({ status: 200, description: 'Order details returned.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/history')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.COURIER)
  @ApiOperation({
    summary: 'Get order audit history',
    description:
      'Retrieves state transition and location audit logs for a specific order.',
  })
  @ApiResponse({ status: 200, description: 'Audit history returned.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async getHistory(@Param('id') id: string) {
    return this.ordersService.getOrderHistory(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.COURIER, UserRole.MERCHANT)
  @ApiOperation({
    summary: 'Update order status',
    description:
      'Updates order status (e.g. IN_TRANSIT, DELIVERED, CANCELLED) with optional note.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order status successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid state transition.' })
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload Proof of Delivery (POD)',
    description:
      'Uploads signature image, delivery photo, and POD metadata for order completion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proof of Delivery uploaded successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file formats or metadata.',
  })
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
