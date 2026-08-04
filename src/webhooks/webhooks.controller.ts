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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookSubscriptionResponseDto } from './dto/webhook-subscription-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller({
  path: 'webhooks',
  version: '1',
})
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
  @ApiOperation({
    summary: 'Register webhook endpoint',
    description:
      'Registers a new webhook subscription URL to receive event notifications.',
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook subscription created.',
    type: WebhookSubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid URL or event list.' })
  async create(@Request() req: any, @Body() createDto: CreateWebhookDto) {
    const merchantId = this.extractMerchantId(req);
    const sub = await this.webhooksService.createSubscription(
      merchantId,
      createDto,
    );
    return plainToInstance(
      WebhookSubscriptionResponseDto,
      sub.toObject ? sub.toObject() : sub,
      { excludeExtraneousValues: true },
    );
  }

  @Get()
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List active webhook subscriptions',
    description:
      'Retrieves all active webhook subscriptions registered by the merchant.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of subscriptions returned.',
    type: [WebhookSubscriptionResponseDto],
  })
  async findAll(@Request() req: any) {
    const merchantId = this.extractMerchantId(req);
    const subs = await this.webhooksService.findAllByMerchant(merchantId);
    return subs.map((sub) =>
      plainToInstance(
        WebhookSubscriptionResponseDto,
        sub.toObject ? sub.toObject() : sub,
        { excludeExtraneousValues: true },
      ),
    );
  }

  @Get('deliveries')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List webhook delivery logs for merchant',
    description:
      'Retrieves recent delivery attempts and responses across all registered endpoints.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of logs to fetch',
  })
  @ApiResponse({ status: 200, description: 'Delivery logs returned.' })
  async getDeliveries(@Request() req: any, @Query('limit') limit?: number) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.getDeliveryLogsForMerchant(
      merchantId,
      limit ? Number(limit) : 50,
    );
  }

  @Get(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get webhook subscription details',
    description: 'Retrieves a single webhook subscription configuration by ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook details returned.',
    type: WebhookSubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found.' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const merchantId = this.extractMerchantId(req);
    const sub = await this.webhooksService.findOne(id, merchantId);
    return plainToInstance(
      WebhookSubscriptionResponseDto,
      sub.toObject ? sub.toObject() : sub,
      { excludeExtraneousValues: true },
    );
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update webhook subscription',
    description:
      'Updates target URL, subscribed events, secret, or active state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook updated successfully.',
    type: WebhookSubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found.' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookDto,
  ) {
    const merchantId = this.extractMerchantId(req);
    const sub = await this.webhooksService.updateSubscription(
      id,
      merchantId,
      updateDto,
    );
    return plainToInstance(
      WebhookSubscriptionResponseDto,
      sub.toObject ? sub.toObject() : sub,
      { excludeExtraneousValues: true },
    );
  }

  @Delete(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete webhook subscription',
    description: 'Removes a webhook subscription permanently.',
  })
  @ApiResponse({ status: 204, description: 'Webhook subscription deleted.' })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found.' })
  async remove(@Request() req: any, @Param('id') id: string) {
    const merchantId = this.extractMerchantId(req);
    await this.webhooksService.deleteSubscription(id, merchantId);
  }

  @Post(':id/test')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Send test ping to webhook URL',
    description:
      'Dispatches a test ping payload to verify target endpoint reachability and signature validation.',
  })
  @ApiResponse({ status: 200, description: 'Test ping dispatch attempted.' })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found.' })
  async sendTestPing(@Request() req: any, @Param('id') id: string) {
    const merchantId = this.extractMerchantId(req);
    return this.webhooksService.sendTestPing(id, merchantId);
  }

  @Get(':id/logs')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get delivery logs for specific webhook',
    description:
      'Retrieves historic delivery logs and response codes for a specific subscription.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of logs to fetch',
  })
  @ApiResponse({ status: 200, description: 'Specific webhook logs returned.' })
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
