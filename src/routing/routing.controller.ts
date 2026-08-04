/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { RoutingEngineService } from './routing-engine.service';
import { EtaService } from './eta.service';
import { CalculateEtaDto } from './dto/calculate-eta.dto';
import { OptimizeRouteDto } from './dto/optimize-route.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { OrdersService } from '../orders/orders.service';

@Controller({
  path: 'routing',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutingController {
  constructor(
    private readonly routingEngine: RoutingEngineService,
    private readonly etaService: EtaService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('eta')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.COURIER)
  async calculateEta(@Body() dto: CalculateEtaDto) {
    const result = await this.routingEngine.calculateDistanceAndDuration(
      dto.origin,
      dto.destination,
    );

    if (dto.trackingNumber) {
      return this.etaService.calculateOrderEta(
        dto.trackingNumber,
        dto.origin,
        dto.destination,
      );
    }

    const now = new Date();
    return {
      distanceKm: result.distanceKm,
      etaMinutes: result.durationMinutes,
      estimatedArrival: new Date(
        now.getTime() + result.durationMinutes * 60 * 1000,
      ),
    };
  }

  @Post('optimize')
  @Roles(UserRole.ADMIN, UserRole.COURIER, UserRole.MERCHANT)
  async optimizeRoute(@Body() dto: OptimizeRouteDto) {
    return this.routingEngine.optimizeMultiStopRoute(dto.origin, dto.waypoints);
  }

  @Get('courier/:courierId/route')
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async getCourierOptimizedRoute(
    @Param('courierId') courierId: string,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    const origin = {
      lat: lat ? Number(lat) : 30.0444, // Default Cairo/Metropolitan coordinates
      lng: lng ? Number(lng) : 31.2357,
    };

    const ordersResult = await this.ordersService.findAll({
      courierId,
      limit: 50,
    });

    const activeOrders = (ordersResult.data || []).filter(
      (order: any) =>
        order.status === 'ASSIGNED' || order.status === 'IN_TRANSIT',
    );

    if (activeOrders.length === 0) {
      return {
        message: 'No active orders assigned for route optimization',
        origin,
        orderedWaypoints: [],
        legs: [],
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
      };
    }

    const waypoints = activeOrders.map((order: any) => {
      const coords = order.recipient?.address?.location?.coordinates;
      const lat =
        coords?.[1] ?? order.deliveryAddress?.lat ?? origin.lat + 0.02;
      const lng =
        coords?.[0] ?? order.deliveryAddress?.lng ?? origin.lng + 0.02;
      const address = order.recipient?.address
        ? `${order.recipient.address.district || ''}, ${order.recipient.address.city || ''}`.trim()
        : order.deliveryAddress?.street ||
          order.deliveryAddress?.city ||
          `Delivery #${order.trackingNumber}`;

      return {
        id: order.trackingNumber,
        location: { lat, lng },
        address,
        details: {
          recipientName: order.recipient?.name,
          recipientPhone: order.recipient?.phone,
          status: order.status,
        },
      };
    });

    return this.routingEngine.optimizeMultiStopRoute(origin, waypoints);
  }

  @Get('orders/:trackingNumber/eta')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.COURIER)
  async getOrderEta(@Param('trackingNumber') trackingNumber: string) {
    const cachedEta = await this.etaService.getCachedEta(trackingNumber);
    if (cachedEta) return cachedEta;

    const order = await this.ordersService.findOne(trackingNumber);
    if (!order) {
      throw new NotFoundException(`Order '${trackingNumber}' not found`);
    }

    // Default estimate if location is missing
    const defaultOrigin = { lat: 30.0444, lng: 31.2357 };
    const coords = order.recipient?.address?.location?.coordinates;
    const dest = {
      lat: coords?.[1] ?? (order as any).deliveryAddress?.lat ?? 30.06,
      lng: coords?.[0] ?? (order as any).deliveryAddress?.lng ?? 31.25,
    };

    return this.etaService.calculateOrderEta(
      order.trackingNumber,
      defaultOrigin,
      dest,
      order.courierId,
    );
  }
}
