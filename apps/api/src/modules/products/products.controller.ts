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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // ============================================================
  // PRODUCTS CRUD
  // ============================================================

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryProductsDto,
  ) {
    return this.productsService.findAll(req.user.tenantSchema, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.productsService.findOne(req.user.tenantSchema, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.productsService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // PRODUCT CATEGORIES
  // ============================================================

  @Get('categories/list')
  @ApiOperation({ summary: 'Get all product categories' })
  async getCategories(@Request() req: { user: JwtPayload }) {
    return this.productsService.getCategories(req.user.tenantSchema);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a product category' })
  async createCategory(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.productsService.createCategory(req.user.tenantSchema, dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update a product category' })
  async updateCategory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.productsService.updateCategory(req.user.tenantSchema, id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a product category' })
  async deleteCategory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.productsService.deleteCategory(req.user.tenantSchema, id);
  }

  // ============================================================
  // PRICE BOOKS
  // ============================================================

  @Get('price-books/list')
  @ApiOperation({ summary: 'Get all price books' })
  async getPriceBooks(@Request() req: { user: JwtPayload }) {
    return this.productsService.getPriceBooks(req.user.tenantSchema);
  }

  @Post('price-books')
  @ApiOperation({ summary: 'Create a price book' })
  async createPriceBook(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreatePriceBookDto,
  ) {
    return this.productsService.createPriceBook(req.user.tenantSchema, req.user.sub, dto);
  }

  @Put('price-books/:id')
  @ApiOperation({ summary: 'Update a price book' })
  async updatePriceBook(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdatePriceBookDto,
  ) {
    return this.productsService.updatePriceBook(req.user.tenantSchema, id, dto);
  }

  @Delete('price-books/:id')
  @ApiOperation({ summary: 'Delete a price book' })
  async deletePriceBook(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.productsService.deletePriceBook(req.user.tenantSchema, id);
  }

  // ============================================================
  // PRICE BOOK ENTRIES
  // ============================================================

  @Get('price-books/:priceBookId/entries')
  @ApiOperation({ summary: 'Get entries for a price book' })
  async getPriceBookEntries(
    @Request() req: { user: JwtPayload },
    @Param('priceBookId') priceBookId: string,
  ) {
    return this.productsService.getPriceBookEntries(req.user.tenantSchema, priceBookId);
  }

  @Post('price-books/:priceBookId/entries')
  @ApiOperation({ summary: 'Add a product to a price book' })
  async createPriceBookEntry(
    @Request() req: { user: JwtPayload },
    @Param('priceBookId') priceBookId: string,
    @Body() dto: CreatePriceBookEntryDto,
  ) {
    return this.productsService.createPriceBookEntry(req.user.tenantSchema, priceBookId, dto);
  }

  @Put('price-book-entries/:entryId')
  @ApiOperation({ summary: 'Update a price book entry' })
  async updatePriceBookEntry(
    @Request() req: { user: JwtPayload },
    @Param('entryId') entryId: string,
    @Body() dto: UpdatePriceBookEntryDto,
  ) {
    return this.productsService.updatePriceBookEntry(req.user.tenantSchema, entryId, dto);
  }

  @Delete('price-book-entries/:entryId')
  @ApiOperation({ summary: 'Delete a price book entry' })
  async deletePriceBookEntry(
    @Request() req: { user: JwtPayload },
    @Param('entryId') entryId: string,
  ) {
    return this.productsService.deletePriceBookEntry(req.user.tenantSchema, entryId);
  }
}
