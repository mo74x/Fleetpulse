/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { User, UserDocument } from './user.schema';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    @Optional() private configService?: ConfigService,
  ) {}

  private async generateAndSaveTokens(
    userId: string,
    email: string,
    role: string,
    userDoc?: UserDocument,
  ) {
    const accessExpiration =
      this.configService?.get<string>('JWT_EXPIRATION') || '15m';
    const refreshExpiration =
      this.configService?.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    const refreshSecret =
      this.configService?.get<string>('JWT_REFRESH_SECRET') ||
      this.configService?.get<string>('JWT_SECRET');

    const accessPayload = { sub: userId, email, role };
    const refreshPayload = { sub: userId, type: 'refresh' };

    const token = this.jwtService.sign(accessPayload, {
      expiresIn: accessExpiration as any,
    });

    const refreshToken = this.jwtService.sign(
      refreshPayload,
      refreshSecret
        ? { secret: refreshSecret, expiresIn: refreshExpiration as any }
        : { expiresIn: refreshExpiration as any },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    if (userDoc) {
      userDoc.refreshTokenHash = refreshTokenHash;
      await userDoc.save();
    } else {
      await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash });
    }

    return { token, refreshToken };
  }

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.toLowerCase().trim();
    const existingUser = await this.userModel.findOne({ email });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = new this.userModel({
      email,
      passwordHash,
      name: registerDto.name,
      role: registerDto.role,
    });

    const savedUser = await user.save();
    const { token, refreshToken } = await this.generateAndSaveTokens(
      savedUser._id.toString(),
      savedUser.email,
      savedUser.role,
      savedUser,
    );

    return {
      token,
      refreshToken,
      user: plainToInstance(
        UserResponseDto,
        savedUser.toObject ? savedUser.toObject() : savedUser,
        { excludeExtraneousValues: true },
      ),
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { token, refreshToken } = await this.generateAndSaveTokens(
      user._id.toString(),
      user.email,
      user.role,
      user,
    );

    return {
      token,
      refreshToken,
      user: plainToInstance(
        UserResponseDto,
        user.toObject ? user.toObject() : user,
        { excludeExtraneousValues: true },
      ),
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const refreshSecret =
      this.configService?.get<string>('JWT_REFRESH_SECRET') ||
      this.configService?.get<string>('JWT_SECRET');

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(
        refreshTokenDto.refreshToken,
        refreshSecret ? { secret: refreshSecret } : undefined,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload || payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    const isMatching = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      user.refreshTokenHash,
    );
    if (!isMatching) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    const { token, refreshToken } = await this.generateAndSaveTokens(
      user._id.toString(),
      user.email,
      user.role,
      user,
    );

    return {
      token,
      refreshToken,
    };
  }

  async logout(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
    return { message: 'Logged out successfully' };
  }
}
