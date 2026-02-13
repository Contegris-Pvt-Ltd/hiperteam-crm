// ============================================================
// FILE: apps/api/src/modules/leads/dto/update-lead.dto.ts
// ============================================================
import { PartialType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
