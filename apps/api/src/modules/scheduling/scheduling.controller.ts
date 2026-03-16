// ============================================================
// FILE: apps/api/src/modules/scheduling/scheduling.controller.ts
// ============================================================
import {
  Controller, Get, Post, Put,
  Body, Param, Query, Request, UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { SchedulingService } from './scheduling.service';

interface JwtPayload {
  sub: string;
  tenantSchema: string;
  tenantSlug: string;
}

// ── Authenticated ──────────────────────────────────────────
@ApiTags('Scheduling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly svc: SchedulingService) {}

  @Get('forms')
  @RequirePermission('forms', 'view')
  @ApiOperation({ summary: 'List meeting booking forms for current user' })
  async listBookingForms(@Request() req: { user: JwtPayload }) {
    return this.svc.listBookingForms(req.user.tenantSchema, req.user.sub);
  }

  @Get('bookings')
  @RequirePermission('forms', 'view')
  @ApiOperation({ summary: 'List bookings for current user' })
  async listBookings(
    @Request() req: { user: JwtPayload },
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listBookings(req.user.tenantSchema, req.user.sub, {
      status,
      from,
      to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    });
  }

  @Get('forms/:formId/slots')
  @RequirePermission('forms', 'view')
  @ApiOperation({ summary: 'Get available slots for a date (authenticated preview)' })
  async getSlots(
    @Request() req: { user: JwtPayload },
    @Param('formId') formId: string,
    @Query('date') date: string,
  ) {
    return this.svc.getAvailableSlots(req.user.tenantSchema, formId, date);
  }

  @Get('forms/:formId/available-dates')
  @RequirePermission('forms', 'view')
  @ApiOperation({ summary: 'Get available dates for a month (authenticated preview)' })
  async getAvailableDates(
    @Request() req: { user: JwtPayload },
    @Param('formId') formId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.svc.getAvailableDates(
      req.user.tenantSchema,
      formId,
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  @Put('forms/:formId/availability')
  @RequirePermission('forms', 'edit')
  @ApiOperation({ summary: 'Save availability windows for a booking form' })
  async saveAvailability(
    @Request() req: { user: JwtPayload },
    @Param('formId') formId: string,
    @Body() body: { windows: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }> },
  ) {
    return this.svc.saveAvailability(req.user.tenantSchema, formId, body.windows);
  }

  @Get('my-availability')
  @RequirePermission('forms', 'view')
  @ApiOperation({ summary: 'Get current user personal availability' })
  async getMyAvailability(@Request() req: { user: JwtPayload }) {
    return this.svc.getUserAvailability(req.user.tenantSchema, req.user.sub);
  }

  @Put('my-availability')
  @RequirePermission('forms', 'edit')
  @ApiOperation({ summary: 'Save current user personal availability' })
  async saveMyAvailability(
    @Request() req: { user: JwtPayload },
    @Body() body: { windows: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> },
  ) {
    return this.svc.saveUserAvailability(req.user.tenantSchema, req.user.sub, body.windows);
  }

  @Get('users/:userId/availability')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: "Get another user's availability (requires users:view)" })
  async getUserAvailability(
    @Request() req: { user: JwtPayload },
    @Param('userId') userId: string,
  ) {
    return this.svc.getUserAvailability(req.user.tenantSchema, userId);
  }
}

// ── Public (no auth) ───────────────────────────────────────
@ApiTags('Scheduling Public')
@Controller('scheduling/public')
export class SchedulingPublicController {
  constructor(private readonly svc: SchedulingService) {}

  @Get(':tenantSlug/:token')
  @ApiOperation({ summary: 'Get public booking form details' })
  async getPublicForm(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
  ) {
    const { form } = await this.svc.resolvePublicBookingForm(tenantSlug, token);
    return form;
  }

  @Get(':tenantSlug/:token/dates')
  @ApiOperation({ summary: 'Get available dates for a month (public)' })
  async getPublicDates(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const { schemaName, form } = await this.svc.resolvePublicBookingForm(tenantSlug, token);
    return this.svc.getAvailableDates(
      schemaName, form.id,
      parseInt(year, 10), parseInt(month, 10),
    );
  }

  @Get(':tenantSlug/:token/slots')
  @ApiOperation({ summary: 'Get available time slots for a date (public)' })
  async getPublicSlots(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
    @Query('date') date: string,
  ) {
    const { schemaName, form } = await this.svc.resolvePublicBookingForm(tenantSlug, token);
    return this.svc.getAvailableSlots(schemaName, form.id, date);
  }

  @Post(':tenantSlug/:token/book')
  @ApiOperation({ summary: 'Create a booking (public)' })
  async createPublicBooking(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
    @Body() body: {
      startTime: string;
      timezone: string;
      inviteeName: string;
      inviteeEmail: string;
      inviteePhone?: string;
      inviteeNotes?: string;
      answers?: Record<string, any>;
    },
  ) {
    const { schemaName, form } = await this.svc.resolvePublicBookingForm(tenantSlug, token);
    return this.svc.createBooking(schemaName, form.id, body);
  }

  @Post('cancel/:cancelToken')
  @ApiOperation({ summary: 'Cancel a booking via cancel token (public)' })
  async cancelBooking(
    @Param('cancelToken') cancelToken: string,
    @Body() body: { tenantSlug: string; reason?: string },
  ) {
    const [tenant] = await this.svc['dataSource'].query(
      `SELECT schema_name FROM master.tenants WHERE slug = $1 LIMIT 1`,
      [body.tenantSlug],
    );
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.svc.cancelBookingByToken(tenant.schema_name, cancelToken, body.reason);
  }
}
