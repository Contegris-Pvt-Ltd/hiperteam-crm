import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { LeadImportService } from './lead-import.service';
import { StartImportDto } from './dto/start-import.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { Response } from 'express';

@ApiTags('Lead Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('lead-import')
export class LeadImportController {
  constructor(private readonly importService: LeadImportService) {}

  // ============================================================
  // FILE UPLOAD & PARSE
  // ============================================================
  @Post('upload')
  @RequirePermission('leads', 'import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv',
      ];
      if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only .xlsx, .xls, and .csv files are allowed'), false);
      }
    },
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.importService.uploadAndParse(file, req.user.tenantSchema, req.user.sub);
  }

  // ============================================================
  // START IMPORT
  // ============================================================
  @Post('start')
  @RequirePermission('leads', 'import')
  async startImport(@Body() dto: StartImportDto, @Req() req: any) {
    return this.importService.startImport(dto, req.user.tenantSchema, req.user.sub);
  }

  // ============================================================
  // JOB MANAGEMENT
  // ============================================================
  @Get('jobs')
  @RequirePermission('leads', 'view')
  async getJobs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.importService.getJobs(
      req.user.tenantSchema,
      req.user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('jobs/:id')
  @RequirePermission('leads', 'view')
  async getJobDetail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.importService.getJobDetail(req.user.tenantSchema, id);
  }

  @Post('jobs/:id/cancel')
  @RequirePermission('leads', 'import')
  async cancelJob(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.importService.cancelJob(req.user.tenantSchema, id);
  }

  @Get('jobs/:id/failed-file')
  @RequirePermission('leads', 'import')
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

  // ============================================================
  // TEMPLATES
  // ============================================================
  @Get('templates')
  @RequirePermission('leads', 'import')
  async getTemplates(@Req() req: any) {
    return this.importService.getTemplates(req.user.tenantSchema);
  }

  @Post('templates')
  @RequirePermission('leads', 'import')
  async saveTemplate(@Body() dto: SaveTemplateDto, @Req() req: any) {
    return this.importService.saveTemplate(dto, req.user.tenantSchema, req.user.sub);
  }

  @Put('templates/:id')
  @RequirePermission('leads', 'import')
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveTemplateDto,
    @Req() req: any,
  ) {
    return this.importService.updateTemplate(req.user.tenantSchema, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermission('leads', 'import')
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.importService.deleteTemplate(req.user.tenantSchema, id);
  }
}
