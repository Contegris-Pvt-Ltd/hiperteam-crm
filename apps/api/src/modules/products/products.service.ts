import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateProductDto,
  UpdateProductDto,
  QueryProductsDto,
  CreatePriceBookDto,
  UpdatePriceBookDto,
  CreatePriceBookEntryDto,
  UpdatePriceBookEntryDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from './dto';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';

@Injectable()
export class ProductsService {
  private readonly trackedFields = [
    'name', 'code', 'shortDescription', 'description', 'type',
    'categoryId', 'unit', 'basePrice', 'cost', 'currency',
    'taxCategory', 'status', 'imageUrl', 'externalUrl', 'customFields', 'ownerId',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private activityService: ActivityService,
  ) {}

  // ============================================================
  // PRODUCTS CRUD
  // ============================================================

  async create(schemaName: string, userId: string, dto: CreateProductDto) {
    // Check for duplicate code
    if (dto.code) {
      const [existing] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".products WHERE code = $1 AND deleted_at IS NULL`,
        [dto.code],
      );
      if (existing) {
        throw new BadRequestException(`Product code "${dto.code}" already exists`);
      }
    }

    const [product] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".products
       (name, code, short_description, description, type, category_id, unit,
        base_price, cost, currency, tax_category, status, image_url, external_url,
        custom_fields, owner_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        dto.name,
        dto.code || null,
        dto.shortDescription || null,
        dto.description || null,
        dto.type || 'product',
        dto.categoryId || null,
        dto.unit || 'each',
        dto.basePrice ?? 0,
        dto.cost ?? null,
        dto.currency || 'USD',
        dto.taxCategory || null,
        dto.status || 'active',
        dto.imageUrl || null,
        dto.externalUrl || null,
        dto.customFields || {},
        dto.ownerId || userId,
        userId,
      ],
    );

    const formatted = this.formatProduct(product);

    // Auto-add to Standard price book
    const [standardBook] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".price_books WHERE is_standard = true LIMIT 1`,
    );
    if (standardBook && dto.basePrice > 0) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".price_book_entries (price_book_id, product_id, unit_price)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [standardBook.id, product.id, dto.basePrice],
      );
    }

    await this.activityService.create(schemaName, {
      entityType: 'products',
      entityId: product.id,
      activityType: 'created',
      title: 'Product created',
      description: `Product "${dto.name}" was created`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'products',
      entityId: product.id,
      action: 'create',
      changes: {},
      newValues: formatted,
      performedBy: userId,
    });

    return formatted;
  }

  async findAll(schemaName: string, query: QueryProductsDto) {
    const { search, type, status, categoryId, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = query;

    const conditions: string[] = ['p.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.code ILIKE $${paramIndex} OR p.short_description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      conditions.push(`p.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (status) {
      conditions.push(`p.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (categoryId) {
      conditions.push(`p.category_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sort column
    const allowedSortColumns: Record<string, string> = {
      name: 'p.name',
      code: 'p.code',
      type: 'p.type',
      base_price: 'p.base_price',
      basePrice: 'p.base_price',
      status: 'p.status',
      created_at: 'p.created_at',
      createdAt: 'p.created_at',
      updated_at: 'p.updated_at',
    };
    const sortColumn = allowedSortColumns[sortBy] || 'p.created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // Count total
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".products p WHERE ${whereClause}`,
      params,
    );

    // Fetch data
    const products = await this.dataSource.query(
      `SELECT p.*,
              c.name as category_name,
              u.first_name as owner_first_name,
              u.last_name as owner_last_name
       FROM "${schemaName}".products p
       LEFT JOIN "${schemaName}".product_categories c ON p.category_id = c.id
       LEFT JOIN "${schemaName}".users u ON p.owner_id = u.id
       WHERE ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data: products.map((p: Record<string, unknown>) => this.formatProduct(p)),
      meta: {
        total: parseInt(count, 10),
        page,
        limit,
        totalPages: Math.ceil(parseInt(count, 10) / limit),
      },
    };
  }

  async findOne(schemaName: string, id: string) {
    const [product] = await this.dataSource.query(
      `SELECT p.*,
              c.name as category_name,
              u.first_name as owner_first_name,
              u.last_name as owner_last_name
       FROM "${schemaName}".products p
       LEFT JOIN "${schemaName}".product_categories c ON p.category_id = c.id
       LEFT JOIN "${schemaName}".users u ON p.owner_id = u.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id],
    );

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const formatted = this.formatProduct(product);

    // Get price book entries for this product
    const priceEntries = await this.dataSource.query(
      `SELECT pbe.*, pb.name as price_book_name, pb.is_standard
       FROM "${schemaName}".price_book_entries pbe
       JOIN "${schemaName}".price_books pb ON pbe.price_book_id = pb.id
       WHERE pbe.product_id = $1
       ORDER BY pb.is_standard DESC, pb.name ASC, pbe.min_quantity ASC`,
      [id],
    );

    // Get bundle info if this is a bundle product
    let bundle = null;
    if (formatted.type === 'bundle') {
      const [bundleRow] = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".product_bundles WHERE product_id = $1`,
        [id],
      );
      if (bundleRow) {
        const bundleItems = await this.dataSource.query(
          `SELECT bi.*, p.name as product_name, p.code as product_code, p.base_price
           FROM "${schemaName}".bundle_items bi
           JOIN "${schemaName}".products p ON bi.product_id = p.id
           WHERE bi.bundle_id = $1
           ORDER BY bi.display_order ASC`,
          [bundleRow.id],
        );
        bundle = {
          id: bundleRow.id,
          bundleType: bundleRow.bundle_type,
          minItems: bundleRow.min_items,
          maxItems: bundleRow.max_items,
          discountType: bundleRow.discount_type,
          discountValue: parseFloat(bundleRow.discount_value),
          items: bundleItems.map((bi: Record<string, unknown>) => ({
            id: bi.id,
            productId: bi.product_id,
            productName: bi.product_name,
            productCode: bi.product_code,
            basePrice: parseFloat(bi.base_price as string),
            quantity: bi.quantity,
            isOptional: bi.is_optional,
            overridePrice: bi.override_price ? parseFloat(bi.override_price as string) : null,
            displayOrder: bi.display_order,
          })),
        };
      }
    }

    return {
      ...formatted,
      priceBookEntries: priceEntries.map((e: Record<string, unknown>) => ({
        id: e.id,
        priceBookId: e.price_book_id,
        priceBookName: e.price_book_name,
        isStandard: e.is_standard,
        unitPrice: parseFloat(e.unit_price as string),
        minQuantity: e.min_quantity,
        maxQuantity: e.max_quantity,
        isActive: e.is_active,
        validFrom: e.valid_from,
        validTo: e.valid_to,
      })),
      bundle,
    };
  }

  async update(schemaName: string, id: string, userId: string, dto: UpdateProductDto) {
    const existing = await this.findOne(schemaName, id);

    // Check duplicate code
    if (dto.code && dto.code !== existing.code) {
      const [dup] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".products WHERE code = $1 AND id != $2 AND deleted_at IS NULL`,
        [dto.code, id],
      );
      if (dup) {
        throw new BadRequestException(`Product code "${dto.code}" already exists`);
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      shortDescription: 'short_description',
      description: 'description',
      type: 'type',
      categoryId: 'category_id',
      unit: 'unit',
      basePrice: 'base_price',
      cost: 'cost',
      currency: 'currency',
      taxCategory: 'tax_category',
      status: 'status',
      imageUrl: 'image_url',
      externalUrl: 'external_url',
      customFields: 'custom_fields',
      ownerId: 'owner_id',
    };

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const [product] = await this.dataSource.query(
      `UPDATE "${schemaName}".products
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const formatted = this.formatProduct(product);

    const changes = this.auditService.calculateChanges(existing, formatted, this.trackedFields);

    if (Object.keys(changes).length > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'products',
        entityId: id,
        activityType: 'updated',
        title: 'Product updated',
        description: `Updated: ${Object.keys(changes).join(', ')}`,
        metadata: { changedFields: Object.keys(changes) },
        performedBy: userId,
      });

      await this.auditService.log(schemaName, {
        entityType: 'products',
        entityId: id,
        action: 'update',
        changes,
        previousValues: existing,
        newValues: formatted,
        performedBy: userId,
      });
    }

    return formatted;
  }

  async remove(schemaName: string, id: string, userId: string) {
    const existing = await this.findOne(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".products SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );

    await this.activityService.create(schemaName, {
      entityType: 'products',
      entityId: id,
      activityType: 'deleted',
      title: 'Product deleted',
      description: `Product "${existing.name}" was deleted`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'products',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: existing,
      performedBy: userId,
    });

    return { message: 'Product deleted successfully' };
  }

  // ============================================================
  // PRODUCT CATEGORIES
  // ============================================================

  async getCategories(schemaName: string) {
    const categories = await this.dataSource.query(
      `SELECT c.*,
              p.name as parent_name,
              (SELECT COUNT(*) FROM "${schemaName}".products pr WHERE pr.category_id = c.id AND pr.deleted_at IS NULL) as product_count
       FROM "${schemaName}".product_categories c
       LEFT JOIN "${schemaName}".product_categories p ON c.parent_id = p.id
       WHERE c.is_active = true
       ORDER BY c.display_order ASC, c.name ASC`,
    );

    return categories.map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parent_id,
      parentName: c.parent_name,
      displayOrder: c.display_order,
      isActive: c.is_active,
      productCount: parseInt(c.product_count as string, 10),
      createdAt: c.created_at,
    }));
  }

  async createCategory(schemaName: string, dto: CreateProductCategoryDto) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".product_categories WHERE slug = $1`,
      [slug],
    );
    if (existing) {
      throw new BadRequestException(`Category slug "${slug}" already exists`);
    }

    const [category] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".product_categories (name, slug, description, parent_id, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dto.name, slug, dto.description || null, dto.parentId || null, dto.displayOrder ?? 0],
    );

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parent_id,
      displayOrder: category.display_order,
      isActive: category.is_active,
      createdAt: category.created_at,
    };
  }

  async updateCategory(schemaName: string, id: string, dto: UpdateProductCategoryDto) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(dto.name);
      paramIndex++;
      // Also update slug
      const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      updates.push(`slug = $${paramIndex}`);
      params.push(slug);
      paramIndex++;
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(dto.description);
      paramIndex++;
    }
    if (dto.parentId !== undefined) {
      // Prevent self-referencing
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      updates.push(`parent_id = $${paramIndex}`);
      params.push(dto.parentId || null);
      paramIndex++;
    }
    if (dto.displayOrder !== undefined) {
      updates.push(`display_order = $${paramIndex}`);
      params.push(dto.displayOrder);
      paramIndex++;
    }

    if (updates.length === 0) {
      const [cat] = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".product_categories WHERE id = $1`, [id],
      );
      return cat;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const [category] = await this.dataSource.query(
      `UPDATE "${schemaName}".product_categories
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
    );

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parent_id,
      displayOrder: category.display_order,
      isActive: category.is_active,
    };
  }

  async deleteCategory(schemaName: string, id: string) {
    // Check for products using this category
    const [productCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".products WHERE category_id = $1 AND deleted_at IS NULL`,
      [id],
    );

    if (parseInt(productCount.count, 10) > 0) {
      throw new BadRequestException('Cannot delete category with associated products. Reassign products first.');
    }

    // Check for child categories
    const [childCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".product_categories WHERE parent_id = $1`,
      [id],
    );

    if (parseInt(childCount.count, 10) > 0) {
      throw new BadRequestException('Cannot delete category with sub-categories. Remove sub-categories first.');
    }

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".product_categories WHERE id = $1`,
      [id],
    );

    return { message: 'Category deleted successfully' };
  }

  // ============================================================
  // PRICE BOOKS
  // ============================================================

  async getPriceBooks(schemaName: string) {
    const books = await this.dataSource.query(
      `SELECT pb.*,
              (SELECT COUNT(*) FROM "${schemaName}".price_book_entries pbe WHERE pbe.price_book_id = pb.id) as entry_count,
              u.first_name as created_by_first_name,
              u.last_name as created_by_last_name
       FROM "${schemaName}".price_books pb
       LEFT JOIN "${schemaName}".users u ON pb.created_by = u.id
       ORDER BY pb.is_standard DESC, pb.name ASC`,
    );

    return books.map((b: Record<string, unknown>) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      isStandard: b.is_standard,
      isActive: b.is_active,
      validFrom: b.valid_from,
      validTo: b.valid_to,
      entryCount: parseInt(b.entry_count as string, 10),
      createdBy: b.created_by_first_name
        ? { id: b.created_by, firstName: b.created_by_first_name, lastName: b.created_by_last_name }
        : null,
      createdAt: b.created_at,
    }));
  }

  async createPriceBook(schemaName: string, userId: string, dto: CreatePriceBookDto) {
    const [book] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".price_books (name, description, is_active, valid_from, valid_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.name,
        dto.description || null,
        dto.isActive !== false,
        dto.validFrom || null,
        dto.validTo || null,
        userId,
      ],
    );

    return {
      id: book.id,
      name: book.name,
      description: book.description,
      isStandard: book.is_standard,
      isActive: book.is_active,
      validFrom: book.valid_from,
      validTo: book.valid_to,
      createdAt: book.created_at,
    };
  }

  async updatePriceBook(schemaName: string, id: string, dto: UpdatePriceBookDto) {
    // Prevent editing standard book's name
    const [existing] = await this.dataSource.query(
      `SELECT is_standard FROM "${schemaName}".price_books WHERE id = $1`,
      [id],
    );
    if (!existing) throw new NotFoundException('Price book not found');

    if (existing.is_standard && dto.name) {
      throw new BadRequestException('Cannot rename the Standard price book');
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) { updates.push(`name = $${paramIndex}`); params.push(dto.name); paramIndex++; }
    if (dto.description !== undefined) { updates.push(`description = $${paramIndex}`); params.push(dto.description); paramIndex++; }
    if (dto.isActive !== undefined) { updates.push(`is_active = $${paramIndex}`); params.push(dto.isActive); paramIndex++; }
    if (dto.validFrom !== undefined) { updates.push(`valid_from = $${paramIndex}`); params.push(dto.validFrom); paramIndex++; }
    if (dto.validTo !== undefined) { updates.push(`valid_to = $${paramIndex}`); params.push(dto.validTo); paramIndex++; }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const [book] = await this.dataSource.query(
      `UPDATE "${schemaName}".price_books SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    return {
      id: book.id,
      name: book.name,
      description: book.description,
      isStandard: book.is_standard,
      isActive: book.is_active,
      validFrom: book.valid_from,
      validTo: book.valid_to,
    };
  }

  async deletePriceBook(schemaName: string, id: string) {
    const [existing] = await this.dataSource.query(
      `SELECT is_standard FROM "${schemaName}".price_books WHERE id = $1`,
      [id],
    );
    if (!existing) throw new NotFoundException('Price book not found');
    if (existing.is_standard) {
      throw new BadRequestException('Cannot delete the Standard price book');
    }

    await this.dataSource.query(`DELETE FROM "${schemaName}".price_books WHERE id = $1`, [id]);
    return { message: 'Price book deleted successfully' };
  }

  // ============================================================
  // PRICE BOOK ENTRIES
  // ============================================================

  async getPriceBookEntries(schemaName: string, priceBookId: string) {
    const entries = await this.dataSource.query(
      `SELECT pbe.*, p.name as product_name, p.code as product_code, p.type as product_type, p.base_price
       FROM "${schemaName}".price_book_entries pbe
       JOIN "${schemaName}".products p ON pbe.product_id = p.id
       WHERE pbe.price_book_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.name ASC, pbe.min_quantity ASC`,
      [priceBookId],
    );

    return entries.map((e: Record<string, unknown>) => ({
      id: e.id,
      priceBookId: e.price_book_id,
      productId: e.product_id,
      productName: e.product_name,
      productCode: e.product_code,
      productType: e.product_type,
      basePrice: parseFloat(e.base_price as string),
      unitPrice: parseFloat(e.unit_price as string),
      minQuantity: e.min_quantity,
      maxQuantity: e.max_quantity,
      isActive: e.is_active,
      validFrom: e.valid_from,
      validTo: e.valid_to,
    }));
  }

  async createPriceBookEntry(schemaName: string, priceBookId: string, dto: CreatePriceBookEntryDto) {
    // Validate product exists
    const [product] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".products WHERE id = $1 AND deleted_at IS NULL`,
      [dto.productId],
    );
    if (!product) throw new NotFoundException('Product not found');

    const [entry] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".price_book_entries
       (price_book_id, product_id, unit_price, min_quantity, max_quantity, is_active, valid_from, valid_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        priceBookId,
        dto.productId,
        dto.unitPrice,
        dto.minQuantity || 1,
        dto.maxQuantity || null,
        dto.isActive !== false,
        dto.validFrom || null,
        dto.validTo || null,
      ],
    );

    return {
      id: entry.id,
      priceBookId: entry.price_book_id,
      productId: entry.product_id,
      unitPrice: parseFloat(entry.unit_price),
      minQuantity: entry.min_quantity,
      maxQuantity: entry.max_quantity,
      isActive: entry.is_active,
      validFrom: entry.valid_from,
      validTo: entry.valid_to,
    };
  }

  async updatePriceBookEntry(schemaName: string, entryId: string, dto: UpdatePriceBookEntryDto) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.unitPrice !== undefined) { updates.push(`unit_price = $${paramIndex}`); params.push(dto.unitPrice); paramIndex++; }
    if (dto.minQuantity !== undefined) { updates.push(`min_quantity = $${paramIndex}`); params.push(dto.minQuantity); paramIndex++; }
    if (dto.maxQuantity !== undefined) { updates.push(`max_quantity = $${paramIndex}`); params.push(dto.maxQuantity); paramIndex++; }
    if (dto.isActive !== undefined) { updates.push(`is_active = $${paramIndex}`); params.push(dto.isActive); paramIndex++; }
    if (dto.validFrom !== undefined) { updates.push(`valid_from = $${paramIndex}`); params.push(dto.validFrom); paramIndex++; }
    if (dto.validTo !== undefined) { updates.push(`valid_to = $${paramIndex}`); params.push(dto.validTo); paramIndex++; }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    params.push(entryId);

    const [entry] = await this.dataSource.query(
      `UPDATE "${schemaName}".price_book_entries SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (!entry) throw new NotFoundException('Price book entry not found');

    return {
      id: entry.id,
      priceBookId: entry.price_book_id,
      productId: entry.product_id,
      unitPrice: parseFloat(entry.unit_price),
      minQuantity: entry.min_quantity,
      maxQuantity: entry.max_quantity,
      isActive: entry.is_active,
    };
  }

  async deletePriceBookEntry(schemaName: string, entryId: string) {
    const result = await this.dataSource.query(
      `DELETE FROM "${schemaName}".price_book_entries WHERE id = $1 RETURNING id`,
      [entryId],
    );
    if (result.length === 0) throw new NotFoundException('Price book entry not found');
    return { message: 'Price book entry deleted successfully' };
  }

  // ============================================================
  // FORMAT HELPER
  // ============================================================

  private formatProduct(product: Record<string, unknown>): Record<string, unknown> {
    return {
      id: product.id,
      name: product.name,
      code: product.code,
      shortDescription: product.short_description,
      description: product.description,
      type: product.type,
      categoryId: product.category_id,
      categoryName: product.category_name || null,
      unit: product.unit,
      basePrice: product.base_price ? parseFloat(product.base_price as string) : 0,
      cost: product.cost ? parseFloat(product.cost as string) : null,
      currency: product.currency,
      taxCategory: product.tax_category,
      status: product.status,
      imageUrl: product.image_url,
      externalUrl: product.external_url,
      customFields: product.custom_fields,
      ownerId: product.owner_id,
      owner: product.owner_first_name
        ? { id: product.owner_id, firstName: product.owner_first_name, lastName: product.owner_last_name }
        : null,
      createdBy: product.created_by,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }
}
