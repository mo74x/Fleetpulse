/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from './user-role.enum';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserInstance = {
    _id: 'user-123',
    email: 'test@merchant.com',
    name: 'Test Merchant',
    role: UserRole.MERCHANT,
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

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
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
    it('should register a new user successfully and return JWT token', async () => {
      MockUserModel.findOne.mockResolvedValue(null);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashedPassword'));

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
    it('should authenticate user and return token when credentials are valid', async () => {
      const existingUser = {
        _id: 'user-123',
        email: 'test@merchant.com',
        passwordHash: 'hashedPassword',
        name: 'Test Merchant',
        role: UserRole.MERCHANT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      MockUserModel.findOne.mockResolvedValue(existingUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));

      const loginDto = {
        email: 'test@merchant.com',
        password: 'Password123!',
      };

      const result = await service.login(loginDto);

      expect(result.token).toBe('mock-jwt-token');
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
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      const loginDto = {
        email: 'test@merchant.com',
        password: 'WrongPassword!',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
