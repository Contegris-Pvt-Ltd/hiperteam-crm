import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucket: string;
  private cdnUrl: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('DO_SPACES_BUCKET') || 'hiperteam';
    this.cdnUrl = this.configService.get('DO_SPACES_CDN_URL') || 
      `https://${this.bucket}.ams3.digitaloceanspaces.com`;

    this.s3Client = new S3Client({
      endpoint: this.configService.get('DO_SPACES_ENDPOINT') || 'https://ams3.digitaloceanspaces.com',
      region: 'ams3',
      credentials: {
        accessKeyId: this.configService.get('DO_SPACES_KEY') || '',
        secretAccessKey: this.configService.get('DO_SPACES_SECRET') || '',
      },
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

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    return {
      path,
      url: `${this.cdnUrl}/${path}`,
    };
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

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    return {
      path,
      url: `${this.cdnUrl}/${path}`,
    };
  }

  async deleteFile(path: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}