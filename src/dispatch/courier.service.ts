import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CourierProfile,
  CourierProfileDocument,
} from './schemas/courier-profile.schema';
import { UpdateCourierAvailabilityDto } from './dto/update-courier-availability.dto';

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);

  constructor(
    @InjectModel(CourierProfile.name)
    private courierProfileModel: Model<CourierProfileDocument>,
  ) {}

  async getOrCreateProfile(courierId: string): Promise<CourierProfileDocument> {
    let profile = await this.courierProfileModel.findOne({ courierId }).exec();
    if (!profile) {
      profile = await this.courierProfileModel.create({
        courierId,
        name: `Courier-${courierId.substring(0, 6)}`,
        isAvailable: true,
        maxConcurrentOrders: 3,
        activeOrdersCount: 0,
        shiftStart: '00:00',
        shiftEnd: '23:59',
      });
    }
    return profile;
  }

  async getProfile(courierId: string): Promise<CourierProfileDocument> {
    return this.getOrCreateProfile(courierId);
  }

  async findAll(): Promise<CourierProfileDocument[]> {
    return this.courierProfileModel.find().exec();
  }

  async updateAvailability(
    courierId: string,
    updateDto: UpdateCourierAvailabilityDto,
  ): Promise<CourierProfileDocument> {
    const profile = await this.getOrCreateProfile(courierId);

    if (updateDto.isAvailable !== undefined) {
      profile.isAvailable = updateDto.isAvailable;
    }
    if (updateDto.maxConcurrentOrders !== undefined) {
      profile.maxConcurrentOrders = updateDto.maxConcurrentOrders;
    }
    if (updateDto.shiftStart !== undefined) {
      profile.shiftStart = updateDto.shiftStart;
    }
    if (updateDto.shiftEnd !== undefined) {
      profile.shiftEnd = updateDto.shiftEnd;
    }
    if (updateDto.name !== undefined) {
      profile.name = updateDto.name;
    }
    if (updateDto.phone !== undefined) {
      profile.phone = updateDto.phone;
    }

    return profile.save();
  }

  async isCourierEligibleForAssignment(courierId: string): Promise<boolean> {
    const profile = await this.getOrCreateProfile(courierId);

    if (!profile.isAvailable) {
      this.logger.log(`Courier ${courierId} skipped: isAvailable is false`);
      return false;
    }

    if (profile.activeOrdersCount >= profile.maxConcurrentOrders) {
      this.logger.log(
        `Courier ${courierId} skipped: active orders (${profile.activeOrdersCount}) >= max limit (${profile.maxConcurrentOrders})`,
      );
      return false;
    }

    if (!this.isWithinShift(profile.shiftStart, profile.shiftEnd)) {
      this.logger.log(
        `Courier ${courierId} skipped: outside shift window (${profile.shiftStart} - ${profile.shiftEnd})`,
      );
      return false;
    }

    return true;
  }

  async incrementActiveOrders(
    courierId: string,
  ): Promise<CourierProfileDocument> {
    const profile = await this.getOrCreateProfile(courierId);
    profile.activeOrdersCount += 1;

    // Auto-toggle availability off when max limit reached
    if (profile.activeOrdersCount >= profile.maxConcurrentOrders) {
      profile.isAvailable = false;
      this.logger.log(
        `[Auto-Toggle] Courier ${courierId} reached max capacity (${profile.maxConcurrentOrders}). Availability toggled OFF.`,
      );
    }

    return profile.save();
  }

  async decrementActiveOrders(
    courierId: string,
  ): Promise<CourierProfileDocument> {
    const profile = await this.getOrCreateProfile(courierId);
    profile.activeOrdersCount = Math.max(0, profile.activeOrdersCount - 1);

    // Auto-toggle availability back on when below max capacity
    if (
      profile.activeOrdersCount < profile.maxConcurrentOrders &&
      !profile.isAvailable
    ) {
      profile.isAvailable = true;
      this.logger.log(
        `[Auto-Toggle] Courier ${courierId} active orders dropped below max (${profile.activeOrdersCount}/${profile.maxConcurrentOrders}). Availability toggled ON.`,
      );
    }

    return profile.save();
  }

  public isWithinShift(
    shiftStart: string,
    shiftEnd: string,
    now: Date = new Date(),
  ): boolean {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = shiftStart.split(':').map(Number);
    const startMinutes = startH * 60 + startM;

    const [endH, endM] = shiftEnd.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Shift spans past midnight (e.g. 22:00 to 06:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }
}
