/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from './user-role.enum';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUserInstance = {
    _id: 'user-123',
    email: 'test@merchant.com',
    name: 'Test Merchant',
    role: UserRole.MERCHANT,
    refreshTokenHash: 'hashedRefreshToken',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
  };

  function MockUserModel(dto: any) {
    this.email = dto.email;
    this.passwordHash = dto.passwordHash;
    this.name = dto.name;
    this.role = dto.role;
    this._id = mockUserInstance._id;
    this.createdAt = mockUserInstance.createdAt;
    this.updatedAt = mockUserInstance.updatedAt;
    this.save = mockUserInstance.save.mockResolvedValue(this);
  }

  MockUserModel.findOne = jest.fn();
  MockUserModel.findById = jest.fn();
  MockUserModel.findByIdAndUpdate = jest.fn();

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken('User'),
          useValue: MockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully and return access and refresh tokens', async () => {
      MockUserModel.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const registerDto = {
        email: 'TEST@merchant.com',
        password: 'Password123!',
        name: 'Test Merchant',
        role: UserRole.MERCHANT,
      };

      const result = await service.register(registerDto);

      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@merchant.com',
      });
      expect(result.token).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@merchant.com');
      expect(result.user.name).toBe('Test Merchant');
    });

    it('should throw ConflictException if user with email already exists', async () => {
      MockUserModel.findOne.mockResolvedValue({ email: 'test@merchant.com' });

      const registerDto = {
        email: 'test@merchant.com',
        password: 'Password123!',
        name: 'Test Merchant',
        role: UserRole.MERCHANT,
      };

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens when credentials are valid', async () => {
      const existingUser = {
        ...mockUserInstance,
        passwordHash: 'hashedPassword',
        save: jest.fn().mockResolvedValue(mockUserInstance),
      };
      MockUserModel.findOne.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedRefreshToken');

      const loginDto = {
        email: 'test@merchant.com',
        password: 'Password123!',
      };

      const result = await service.login(loginDto);

      expect(result.token).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@merchant.com');
    });

    it('should throw UnauthorizedException if email is not found', async () => {
      MockUserModel.findOne.mockResolvedValue(null);

      const loginDto = {
        email: 'nonexistent@merchant.com',
        password: 'Password123!',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const existingUser = {
        email: 'test@merchant.com',
        passwordHash: 'hashedPassword',
      };
      MockUserModel.findOne.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const loginDto = {
        email: 'test@merchant.com',
        password: 'WrongPassword!',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully when refresh token is valid and matches hash', async () => {
      const validPayload = { sub: 'user-123', type: 'refresh' };
      mockJwtService.verifyAsync.mockResolvedValue(validPayload);

      const existingUser = {
        ...mockUserInstance,
        save: jest.fn().mockResolvedValue(mockUserInstance),
      };
      MockUserModel.findById.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('rotatedHash');

      const result = await service.refreshTokens({
        refreshToken: 'valid-refresh-token',
      });

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        undefined,
      );
      expect(result.token).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.refreshTokens({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token payload is invalid', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ type: 'access' });

      await expect(
        service.refreshTokens({ refreshToken: 'wrong-type-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if stored refresh token hash does not match', async () => {
      const validPayload = { sub: 'user-123', type: 'refresh' };
      mockJwtService.verifyAsync.mockResolvedValue(validPayload);
      MockUserModel.findById.mockResolvedValue(mockUserInstance);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear user refreshTokenHash on logout', async () => {
      MockUserModel.findByIdAndUpdate.mockResolvedValue(mockUserInstance);

      const result = await service.logout('user-123');

      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith('user-123', {
        refreshTokenHash: null,
      });
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
