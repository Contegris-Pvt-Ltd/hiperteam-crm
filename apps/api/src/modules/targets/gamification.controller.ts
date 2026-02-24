// ============================================================
// FILE: apps/api/src/modules/targets/gamification.controller.ts
// ============================================================

import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequirePermission } from '../../common/guards/permissions.guard';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // ============================================================
  // BADGES (Admin CRUD)
  // ============================================================

  @Get('badges')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'List all badge definitions' })
  getBadges(@Request() req: { user: JwtPayload }) {
    return this.gamificationService.getBadges(req.user.tenantSchema);
  }

  @Post('badges')
  @RequirePermission('gamification', 'create')
  @ApiOperation({ summary: 'Create a custom badge' })
  createBadge(@Request() req: { user: JwtPayload }, @Body() dto: any) {
    return this.gamificationService.createBadge(req.user.tenantSchema, dto);
  }

  @Put('badges/:id')
  @RequirePermission('gamification', 'edit')
  @ApiOperation({ summary: 'Update a badge' })
  updateBadge(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.gamificationService.updateBadge(req.user.tenantSchema, id, dto);
  }

  @Delete('badges/:id')
  @RequirePermission('gamification', 'delete')
  @ApiOperation({ summary: 'Delete a badge (system badges get deactivated)' })
  deleteBadge(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.gamificationService.deleteBadge(req.user.tenantSchema, id);
  }

  // ============================================================
  // MY GAMIFICATION DATA
  // ============================================================

  @Get('my-badges')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'My earned badges' })
  getMyBadges(@Request() req: { user: JwtPayload }) {
    return this.gamificationService.getUserBadges(req.user.tenantSchema, req.user.sub);
  }

  @Get('my-streaks')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'My current streaks' })
  getMyStreaks(@Request() req: { user: JwtPayload }) {
    return this.gamificationService.getUserStreaks(req.user.tenantSchema, req.user.sub);
  }

  // ============================================================
  // LEADERBOARD & FEED
  // ============================================================

  @Get('leaderboard')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'Points leaderboard' })
  getLeaderboard(
    @Request() req: { user: JwtPayload },
    @Query('period') period?: string,
  ) {
    return this.gamificationService.getLeaderboard(req.user.tenantSchema, period);
  }

  @Get('achievements')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'Achievement feed' })
  getAchievements(
    @Request() req: { user: JwtPayload },
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getAchievementFeed(
      req.user.tenantSchema,
      userId || undefined,
      limit ? parseInt(limit) : 20,
    );
  }

  // ============================================================
  // USER BADGES (for viewing another user's profile)
  // ============================================================

  @Get('users/:userId/badges')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'Get badges for a specific user' })
  getUserBadges(
    @Request() req: { user: JwtPayload },
    @Param('userId') userId: string,
  ) {
    return this.gamificationService.getUserBadges(req.user.tenantSchema, userId);
  }

  @Get('users/:userId/streaks')
  @RequirePermission('gamification', 'view')
  @ApiOperation({ summary: 'Get streaks for a specific user' })
  getUserStreaks(
    @Request() req: { user: JwtPayload },
    @Param('userId') userId: string,
  ) {
    return this.gamificationService.getUserStreaks(req.user.tenantSchema, userId);
  }
}