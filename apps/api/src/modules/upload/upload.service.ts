import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucket: string;
  private cdnUrl: string;

  constructor(private configService: ConfigService) {
    // Use your existing env variable names
    this.bucket = this.configService.get('S3_BUCKET') || 'hiperteam';
    const region = this.configService.get('S3_REGION') || 'ams3';
    
    // API endpoint (without bucket name)
    const apiEndpoint = `https://${region}.digitaloceanspaces.com`;
    
    // CDN URL (with bucket name)
    this.cdnUrl = this.configService.get('S3_ENDPOINT') || 
      `https://${this.bucket}.${region}.digitaloceanspaces.com`;

    const accessKeyId = this.configService.get('S3_ACCESS_KEY') || '';
    const secretAccessKey = this.configService.get('S3_SECRET_KEY') || '';

    this.logger.log(`Initializing S3 client - Bucket: ${this.bucket}, Endpoint: ${apiEndpoint}, CDN: ${this.cdnUrl}`);
    
    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('S3/DO Spaces credentials not configured!');
    }

    this.s3Client = new S3Client({
      endpoint: apiEndpoint,
      region: 'us-east-1', // Required by AWS SDK even for DO Spaces
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: false,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    tenantSlug: string,
  ): Promise<{ path: string; url: string }> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const path = `${tenantSlug}/${folder}/${fileName}`;

    this.logger.log(`Uploading file to: ${path}, size: ${file.size}, type: ${file.mimetype}`);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const url = `${this.cdnUrl}/${path}`;
      this.logger.log(`Upload successful: ${url}`);

      return { path, url };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async uploadAvatar(
    file: Express.Multer.File,
    tenantSlug: string,
    entityType: 'contacts' | 'accounts',
    entityId: string,
  ): Promise<{ path: string; url: string }> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${entityId}.${fileExtension}`;
    const path = `${tenantSlug}/${entityType}/avatars/${fileName}`;

    this.logger.log(`Uploading avatar to: ${path}, size: ${file.size}, type: ${file.mimetype}`);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const url = `${this.cdnUrl}/${path}`;
      this.logger.log(`Avatar upload successful: ${url}`);

      return { path, url };
    } catch (error) {
      this.logger.error(`Avatar upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: path,
        }),
      );
      this.logger.log(`File deleted: ${path}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}