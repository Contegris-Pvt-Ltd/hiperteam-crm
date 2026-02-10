/**
 * MODULE LAYOUT SETTINGS
 * 
 * Admin explicitly enables/disables custom layouts for each module and view.
 * This is stored in a settings table, not auto-detected.
 * 
 * Flow:
 * 1. Admin goes to Settings → Module Layouts
 * 2. Admin enables "Use Custom Layout" for contacts → detail
 * 3. Admin selects which layout to use
 * 4. All users see that layout
 */

// ==================== BACKEND ENTITY ====================

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('module_layout_settings')
export class ModuleLayoutSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column()
  module: string; // 'contacts', 'accounts', 'leads', 'opportunities'

  @Column()
  layoutType: string; // 'detail', 'edit', 'create'

  @Column({ default: false })
  useCustomLayout: boolean; // TRUE = use custom, FALSE = use default

  @Column('uuid', { nullable: true })
  layoutId: string | null; // Which layout to use (if useCustomLayout = true)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}