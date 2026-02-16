// ============================================================
// FILE: apps/api/src/modules/opportunities/dto/update-opportunity.dto.ts
// ============================================================
import { PartialType } from '@nestjs/swagger';
import { CreateOpportunityDto } from './create-opportunity.dto';

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}