import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from './user-role.enum';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      const registerDto = {
        email: 'merchant@test.com',
        password: 'Password123!',
        name: 'Merchant Test',
        role: UserRole.MERCHANT,
      };

      const expectedResponse = {
        token: 'token-xyz',
        refreshToken: 'refresh-xyz',
        user: {
          id: '1',
          email: registerDto.email,
          name: registerDto.name,
          role: registerDto.role,
        },
      };

      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('should call authService.login and return result', async () => {
      const loginDto = {
        email: 'merchant@test.com',
        password: 'Password123!',
      };

      const expectedResponse = {
        token: 'token-xyz',
        refreshToken: 'refresh-xyz',
        user: { id: '1', email: loginDto.email },
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('refresh', () => {
    it('should call authService.refreshTokens and return rotated tokens', async () => {
      const refreshDto = { refreshToken: 'refresh-xyz' };
      const expectedResponse = {
        token: 'new-token-123',
        refreshToken: 'new-refresh-123',
      };

      mockAuthService.refreshTokens.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(refreshDto);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(refreshDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user ID', async () => {
      const mockReq = { user: { userId: 'user-123' } };
      const expectedResponse = { message: 'Logged out successfully' };

      mockAuthService.logout.mockResolvedValue(expectedResponse);

      const result = await controller.logout(mockReq);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(expectedResponse);
    });
  });
});
