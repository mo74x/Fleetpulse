/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('api/v1/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  private extractMerchantId(req: any): string {
    return (
      req.user?.merchantId ||
      req.user?.userId ||
      req.user?.sub ||
      'merchant_default'
    );
  }

  @Post()
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async create(@Request() req: any, @Body() createDto: CreateWebhookDto) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.createSubscription(merchantId, createDto);
  }

  @Get()
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async findAll(@Request() req: any) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.findAllByMerchant(merchantId);
  }

  @Get('deliveries')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getDeliveries(@Request() req: any, @Query('limit') limit?: number) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.getDeliveryLogsForMerchant(
      merchantId,
      limit ? Number(limit) : 50,
    );
  }

  @Get(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async findOne(@Request() req: any, @Param('id') id: string) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.findOne(id, merchantId);
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookDto,
  ) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.updateSubscription(id, merchantId, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: any, @Param('id') id: string) {
    const merchantId = this.extractMerchantId(req);
    await this.webhooksService.deleteSubscription(id, merchantId);
  }

  @Post(':id/test')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async sendTestPing(@Request() req: any, @Param('id') id: string) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.sendTestPing(id, merchantId);
  }

  @Get(':id/logs')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getLogs(
    @Request() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.getDeliveryLogsForSubscription(
      id,
      merchantId,
      limit ? Number(limit) : 50,
    );
  }
}
