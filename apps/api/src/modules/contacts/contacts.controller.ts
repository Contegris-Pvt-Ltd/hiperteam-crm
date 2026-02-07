import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto, QueryContactsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created successfully' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all contacts' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryContactsDto,
  ) {
    return this.contactsService.findAll(req.user.tenantSchema, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiResponse({ status: 200, description: 'Contact found' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contactsService.findOne(req.user.tenantSchema, id);
  }

  @Get(':id/profile-completion')
  @ApiOperation({ summary: 'Get detailed profile completion info for a contact' })
  @ApiResponse({ status: 200, description: 'Profile completion details' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getProfileCompletion(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contactsService.getProfileCompletionDetails(req.user.tenantSchema, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(req.user.tenantSchema, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contactsService.remove(req.user.tenantSchema, id);
  }
}