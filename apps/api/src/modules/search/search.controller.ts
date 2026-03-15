import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async globalSearch(
    @Request() req: { user: JwtPayload },
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.globalSearch(
      req.user.tenantSchema,
      query,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
