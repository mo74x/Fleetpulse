/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with merchant, courier, or admin roles.',
  })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or email already registered.',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates credentials and returns access and refresh JWT tokens.',
  })
  @ApiResponse({ status: 200, description: 'Successfully authenticated.' })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.',
  })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token.',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({
    summary: 'User logout',
    description: 'Revokes active refresh tokens for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Successfully logged out.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  async logout(@Req() req: any) {
    const userId = req.user?.userId;
    return this.authService.logout(userId);
  }
}
