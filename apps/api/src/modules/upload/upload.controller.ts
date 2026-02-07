import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { DocumentsService } from '../shared/documents.service';
import { ApiTags, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    tenantId: string;
    tenantSchema: string;
  };
}

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post('avatar/:entityType/:entityId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(
    @Param('entityType') entityType: 'contacts' | 'accounts',
    @Param('entityId') entityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const result = await this.uploadService.uploadAvatar(
      file,
      req.user.tenantSchema,
      entityType,
      entityId,
    );

    return {
      id: entityId,
      path: result.path,
      url: result.url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  @Post('document/:entityType/:entityId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  async uploadDocument(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Upload to storage
    const uploadResult = await this.uploadService.uploadFile(
      file,
      'documents',
      req.user.tenantSchema,
    );

    // Create document record in database
    const document = await this.documentsService.create(
    req.user.tenantSchema,
    {
        entityType,
        entityId,
        name: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: uploadResult.path,
        storageUrl: uploadResult.url,
        uploadedBy: req.user.userId,
    },
    );

    return {
      id: document.id,
      path: uploadResult.path,
      url: uploadResult.url,
      name: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }
}