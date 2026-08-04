/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface UploadFileOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly endpoint?: string;
  private readonly publicStorageUrl?: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'S3_SECRET_ACCESS_KEY',
    );
    this.endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true' ||
      !!this.endpoint;
    this.bucketName =
      this.configService.get<string>('S3_BUCKET') || 'fleetpulse-pod';
    this.publicStorageUrl =
      this.configService.get<string>('PUBLIC_STORAGE_URL');

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint: this.endpoint || undefined,
        forcePathStyle,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(
        `StorageService initialized with S3/MinIO endpoint: ${this.endpoint || 'AWS S3'}`,
      );
    } else {
      this.logger.warn(
        'S3 credentials not fully configured. StorageService will fallback to local disk storage.',
      );
    }
  }

  /**
   * Upload a buffer to S3/MinIO (or fallback to local file system)
   */
  async uploadFile(
    buffer: Buffer,
    options: UploadFileOptions = {},
  ): Promise<string> {
    const folder = options.folder || 'pod';
    const extension = this.getExtensionFromContentType(options.contentType);
    const filename = options.filename || `${randomUUID()}${extension}`;
    const key = `${folder}/${filename}`;
    const contentType = options.contentType || 'image/png';

    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        });

        await this.s3Client.send(command);

        if (this.publicStorageUrl) {
          return `${this.publicStorageUrl.replace(/\/$/, '')}/${key}`;
        }
        if (this.endpoint) {
          return `${this.endpoint.replace(/\/$/, '')}/${this.bucketName}/${key}`;
        }
        return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      } catch (error) {
        this.logger.error(
          `S3 upload failed for key ${key}: ${error.message}. Falling back to local storage.`,
        );
      }
    }

    // Fallback: save to local disk
    return this.saveToLocalDisk(buffer, folder, filename);
  }

  /**
   * Upload a Base64 string (e.g. from canvas signature capture)
   */
  async uploadBase64(
    base64Data: string,
    options: UploadFileOptions = {},
  ): Promise<string> {
    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    let buffer: Buffer;
    let contentType = options.contentType || 'image/png';

    if (matches && matches.length === 3) {
      contentType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      // Direct base64 string without data URI scheme header
      const cleaned = base64Data.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleaned, 'base64');
    }

    return this.uploadFile(buffer, {
      ...options,
      contentType,
    });
  }

  private saveToLocalDisk(
    buffer: Buffer,
    folder: string,
    filename: string,
  ): string {
    const uploadDir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    const relativePath = `/uploads/${folder}/${filename}`;
    this.logger.log(`Saved file locally to ${filePath}`);
    return relativePath;
  }

  private getExtensionFromContentType(contentType?: string): string {
    if (!contentType) return '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg'))
      return '.jpg';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('pdf')) return '.pdf';
    return '.png';
  }
}
