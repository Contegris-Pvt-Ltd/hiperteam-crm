import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ============================================================
// TYPES
// ============================================================

export type ProductType = 'product' | 'service' | 'subscription' | 'bundle';
export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export interface Product {
  id: string;
  name: string;
  code: string | null;
  shortDescription: string | null;
  description: string | null;
  type: ProductType;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  basePrice: number;
  cost: number | null;
  currency: string;
  taxCategory: string | null;
  status: ProductStatus;
  imageUrl: string | null;
  externalUrl: string | null;
  customFields: Record<string, unknown>;
  ownerId: string | null;
  owner: { id: string; firstName: string; lastName: string } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Populated on detail view
  priceBookEntries?: PriceBookEntry[];
  bundle?: BundleDetail | null;
}

export interface ProductsResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProductsQuery {
  search?: string;
  type?: string;
  status?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateProductData {
  name: string;
  code?: string;
  shortDescription?: string;
  description?: string;
  type: ProductType;
  categoryId?: string;
  unit?: string;
  basePrice: number;
  cost?: number;
  currency?: string;
  taxCategory?: string;
  status?: ProductStatus;
  imageUrl?: string;
  externalUrl?: string;
  customFields?: Record<string, unknown>;
  ownerId?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export interface PriceBook {
  id: string;
  name: string;
  description: string | null;
  isStandard: boolean;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  entryCount: number;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface PriceBookEntry {
  id: string;
  priceBookId: string;
  priceBookName?: string;
  isStandard?: boolean;
  productId: string;
  productName?: string;
  productCode?: string;
  productType?: string;
  basePrice?: number;
  unitPrice: number;
  minQuantity: number;
  maxQuantity: number | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface BundleDetail {
  id: string;
  bundleType: 'fixed' | 'flexible';
  minItems: number;
  maxItems: number | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  items: BundleItem[];
}

export interface BundleItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  basePrice: number;
  quantity: number;
  isOptional: boolean;
  overridePrice: number | null;
  displayOrder: number;
}

// ============================================================
// API METHODS
// ============================================================

export const productsApi = {
  // Products CRUD
  getAll: async (query: ProductsQuery = {}): Promise<ProductsResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const { data } = await api.get(`/products?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Product> => {
    const { data } = await api.get(`/products/${id}`);
    return data;
  },

  create: async (product: CreateProductData): Promise<Product> => {
    const { data } = await api.post('/products', product);
    return data;
  },

  update: async (id: string, product: Partial<CreateProductData>): Promise<Product> => {
    const { data } = await api.put(`/products/${id}`, product);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },

  // Categories
  getCategories: async (): Promise<ProductCategory[]> => {
    const { data } = await api.get('/products/categories/list');
    return data;
  },

  createCategory: async (category: { name: string; description?: string; parentId?: string; displayOrder?: number }): Promise<ProductCategory> => {
    const { data } = await api.post('/products/categories', category);
    return data;
  },

  updateCategory: async (id: string, category: { name?: string; description?: string; parentId?: string; displayOrder?: number }): Promise<ProductCategory> => {
    const { data } = await api.put(`/products/categories/${id}`, category);
    return data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/products/categories/${id}`);
  },

  // Price Books
  getPriceBooks: async (): Promise<PriceBook[]> => {
    const { data } = await api.get('/products/price-books/list');
    return data;
  },

  createPriceBook: async (book: { name: string; description?: string; isActive?: boolean; validFrom?: string; validTo?: string }): Promise<PriceBook> => {
    const { data } = await api.post('/products/price-books', book);
    return data;
  },

  updatePriceBook: async (id: string, book: { name?: string; description?: string; isActive?: boolean; validFrom?: string; validTo?: string }): Promise<PriceBook> => {
    const { data } = await api.put(`/products/price-books/${id}`, book);
    return data;
  },

  deletePriceBook: async (id: string): Promise<void> => {
    await api.delete(`/products/price-books/${id}`);
  },

  // Price Book Entries
  getPriceBookEntries: async (priceBookId: string): Promise<PriceBookEntry[]> => {
    const { data } = await api.get(`/products/price-books/${priceBookId}/entries`);
    return data;
  },

  createPriceBookEntry: async (priceBookId: string, entry: { productId: string; unitPrice: number; minQuantity?: number; maxQuantity?: number; isActive?: boolean; validFrom?: string; validTo?: string }): Promise<PriceBookEntry> => {
    const { data } = await api.post(`/products/price-books/${priceBookId}/entries`, entry);
    return data;
  },

  updatePriceBookEntry: async (entryId: string, entry: { unitPrice?: number; minQuantity?: number; maxQuantity?: number; isActive?: boolean; validFrom?: string; validTo?: string }): Promise<PriceBookEntry> => {
    const { data } = await api.put(`/products/price-book-entries/${entryId}`, entry);
    return data;
  },

  deletePriceBookEntry: async (entryId: string): Promise<void> => {
    await api.delete(`/products/price-book-entries/${entryId}`);
  },
};
