import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AccountImportService } from './account-import.service';
import { Response } from 'express';

@ApiTags('Account Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('account-import')
export class AccountImportController {
  constructor(private readonly importService: AccountImportService) {}

  // ============================================================
  // FILE UPLOAD & PARSE
  // ============================================================
  @Post('upload')
  @RequirePermission('accounts', 'import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only .xlsx and .xls files are allowed for account import'), false);
      }
    },
  }))
  async uploadAndParse(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.importService.uploadAndParse(file, req.user.tenantSchema, req.user.sub);
  }

  // ============================================================
  // START IMPORT
  // ============================================================
  @Post('start')
  @RequirePermission('accounts', 'import')
  async startImport(@Body() dto: any, @Req() req: any) {
    return this.importService.startImport(req.user.tenantSchema, req.user.sub, dto);
  }

  // ============================================================
  // JOB MANAGEMENT
  // ============================================================
  @Get('field-options')
  @RequirePermission('accounts', 'import')
  async getFieldOptions(@Request() req: { user: JwtPayload }) {
    return this.importService.getFieldOptions(req.user.tenantSchema);
  }

  @Get('template')
  @RequirePermission('accounts', 'import')
  async downloadTemplate(@Res() res: Response) {
    const { buffer, fileName } = await this.importService.downloadTemplate();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  // ── Templates ──────────────────────────────────────────────
  @Get('templates')
  @RequirePermission('accounts', 'import')
  async getTemplates(@Req() req: any) {
    return this.importService.getTemplates(req.user.tenantSchema);
  }

  @Post('templates')
  @RequirePermission('accounts', 'import')
  async saveTemplate(@Req() req: any, @Body() body: any) {
    return this.importService.saveTemplate(req.user.tenantSchema, req.user.sub, body);
  }

  @Post('templates/:id')
  @RequirePermission('accounts', 'import')
  async updateTemplate(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.importService.updateTemplate(req.user.tenantSchema, id, body);
  }

  @Post('templates/:id/delete')
  @RequirePermission('accounts', 'import')
  async deleteTemplate(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.deleteTemplate(req.user.tenantSchema, id);
  }

  // ── Jobs ──────────────────────────────────────────────────
  @Get('jobs')
  @RequirePermission('accounts', 'view')
  async getJobs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.importService.getJobs(
      req.user.tenantSchema,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('jobs/:id')
  @RequirePermission('accounts', 'view')
  async getJobDetail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.importService.getJobDetail(req.user.tenantSchema, id);
  }

  @Post('jobs/:id/cancel')
  @RequirePermission('accounts', 'import')
  async cancelJob(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.importService.cancelJob(req.user.tenantSchema, id, req.user.sub);
  }

  @Get('jobs/:id/failed-file')
  @RequirePermission('accounts', 'import')
  async downloadFailedFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.importService.generateFailedFile(req.user.tenantSchema, id);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
