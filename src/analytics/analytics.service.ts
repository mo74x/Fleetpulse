/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { RedisService } from '../dispatch/redis/redis.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly CACHE_TTL_SECONDS = 60;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly redisService: RedisService,
  ) {}

  async getOverview(query: AnalyticsQueryDto) {
    const { merchantId, startDate, endDate, refresh } = query;
    const cacheKey = `analytics:overview:${merchantId || 'all'}:${startDate || 'min'}:${endDate || 'max'}`;

    if (refresh !== 'true') {
      const cached = await this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    const matchFilter: Record<string, any> = {};
    if (merchantId) {
      matchFilter.merchantId = merchantId;
    }
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }

    const pipeline: any[] = [
      { $match: matchFilter },
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      { $eq: ['$status', 'DELIVERED'] },
                      '$packageDetails.codAmountValue',
                      0,
                    ],
                  },
                },
                deliveredCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
                },
                failedCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
                },
                pendingCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
                },
                inTransitCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'IN_TRANSIT'] }, 1, 0] },
                },
                avgDeliveryTimeMinutes: {
                  $avg: {
                    $cond: [
                      { $eq: ['$status', 'DELIVERED'] },
                      {
                        $divide: [
                          { $subtract: ['$updatedAt', '$createdAt'] },
                          60000,
                        ],
                      },
                      null,
                    ],
                  },
                },
              },
            },
          ],
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    const result = await this.orderModel.aggregate(pipeline).exec();
    const metricsRaw = result[0]?.metrics[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      deliveredCount: 0,
      failedCount: 0,
      pendingCount: 0,
      inTransitCount: 0,
      avgDeliveryTimeMinutes: 0,
    };

    const statusBreakdownMap: Record<string, number> = {};
    if (result[0]?.statusBreakdown) {
      result[0].statusBreakdown.forEach(
        (item: { _id: string; count: number }) => {
          statusBreakdownMap[item._id] = item.count;
        },
      );
    }

    const response = {
      totalOrders: metricsRaw.totalOrders || 0,
      totalRevenue: Math.round((metricsRaw.totalRevenue || 0) * 100) / 100,
      avgDeliveryTimeMinutes:
        Math.round((metricsRaw.avgDeliveryTimeMinutes || 0) * 10) / 10,
      statusCounts: {
        PENDING: metricsRaw.pendingCount || 0,
        IN_TRANSIT: metricsRaw.inTransitCount || 0,
        DELIVERED: metricsRaw.deliveredCount || 0,
        FAILED: metricsRaw.failedCount || 0,
      },
      statusBreakdown: statusBreakdownMap,
    };

    await this.setCachedData(cacheKey, response);
    return response;
  }

  async getCourierLeaderboard(query: AnalyticsQueryDto) {
    const { merchantId, limit = 10, refresh } = query;
    const cacheKey = `analytics:couriers:${merchantId || 'all'}:${limit}`;

    if (refresh !== 'true') {
      const cached = await this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    const matchFilter: Record<string, any> = {
      courierId: { $ne: null, $exists: true },
    };
    if (merchantId) {
      matchFilter.merchantId = merchantId;
    }

    const pipeline: any[] = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$courierId',
          totalAssigned: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'DELIVERED'] },
                '$packageDetails.codAmountValue',
                0,
              ],
            },
          },
          avgDeliveryTimeMinutes: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'DELIVERED'] },
                {
                  $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 60000],
                },
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          courierId: '$_id',
          _id: 0,
          totalAssigned: 1,
          deliveredCount: 1,
          failedCount: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          successRatePercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      '$deliveredCount',
                      {
                        $cond: [
                          { $eq: ['$totalAssigned', 0] },
                          1,
                          '$totalAssigned',
                        ],
                      },
                    ],
                  },
                  100,
                ],
              },
              1,
            ],
          },
          avgDeliveryTimeMinutes: {
            $round: [{ $ifNull: ['$avgDeliveryTimeMinutes', 0] }, 1],
          },
        },
      },
      { $sort: { deliveredCount: -1, successRatePercentage: -1 } },
      { $limit: Number(limit) },
    ];

    const leaderboard = await this.orderModel.aggregate(pipeline).exec();

    await this.setCachedData(cacheKey, leaderboard);
    return leaderboard;
  }

  async getTrends(query: AnalyticsQueryDto) {
    const { merchantId, groupBy = 'day', startDate, endDate, refresh } = query;
    const cacheKey = `analytics:trends:${merchantId || 'all'}:${groupBy}:${startDate || 'min'}:${endDate || 'max'}`;

    if (refresh !== 'true') {
      const cached = await this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    const matchFilter: Record<string, any> = {};
    if (merchantId) {
      matchFilter.merchantId = merchantId;
    }
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }

    const dateFormat = groupBy === 'week' ? '%G-W%V' : '%Y-%m-%d';

    const pipeline: any[] = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
            },
          },
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
          },
          failedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'DELIVERED'] },
                '$packageDetails.codAmountValue',
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          period: '$_id',
          _id: 0,
          totalOrders: 1,
          deliveredOrders: 1,
          failedOrders: 1,
          revenue: { $round: ['$revenue', 2] },
        },
      },
      { $sort: { period: 1 } },
    ];

    const trends = await this.orderModel.aggregate(pipeline).exec();

    await this.setCachedData(cacheKey, trends);
    return trends;
  }

  private async getCachedData(key: string): Promise<any | null> {
    try {
      if (this.redisService?.client) {
        const raw = await this.redisService.client.get(key);
        if (raw) {
          this.logger.log(`[AnalyticsService] Redis Cache HIT for key: ${key}`);
          return JSON.parse(raw);
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `[AnalyticsService] Failed to read from Redis cache: ${err.message}`,
      );
    }
    return null;
  }

  private async setCachedData(key: string, data: any): Promise<void> {
    try {
      if (this.redisService?.client) {
        await this.redisService.client.set(key, JSON.stringify(data), {
          EX: this.CACHE_TTL_SECONDS,
        });
        this.logger.log(`[AnalyticsService] Redis Cache SET for key: ${key}`);
      }
    } catch (err: any) {
      this.logger.warn(
        `[AnalyticsService] Failed to write to Redis cache: ${err.message}`,
      );
    }
  }
}
