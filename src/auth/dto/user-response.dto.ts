/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../user-role.enum';

export class UserResponseDto {
  @ApiProperty({ description: 'User unique ID' })
  @Expose()
  @Transform(({ obj }) => (obj?._id ? obj._id.toString() : obj?.id || ''))
  id: string;

  @ApiProperty({ description: 'User email address' })
  @Expose()
  email: string;

  @ApiProperty({ description: 'User full name' })
  @Expose()
  name: string;

  @ApiProperty({ enum: UserRole, description: 'Assigned user role' })
  @Expose()
  role: UserRole;

  @ApiProperty({ description: 'Account creation timestamp', required: false })
  @Expose()
  createdAt?: Date;

  @ApiProperty({ description: 'Account update timestamp', required: false })
  @Expose()
  updatedAt?: Date;

  @Exclude()
  passwordHash?: string;

  @Exclude()
  refreshTokenHash?: string | null;

  @Exclude()
  __v?: number;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
