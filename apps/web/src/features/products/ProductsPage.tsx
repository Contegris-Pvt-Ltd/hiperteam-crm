import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, Package, MoreVertical,
  ChevronLeft, ChevronRight, Loader2, Trash2, Edit, Eye,
  Tag, Box, RefreshCw, X, FolderTree, Pencil,
  AlertCircle,
} from 'lucide-react';
import { productsApi } from '../../api/products.api';
import type { Product, ProductsQuery, ProductCategory } from '../../api/products.api';

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  product: { label: 'Product', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  service: { label: 'Service', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  subscription: { label: 'Subscription', className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  bundle: { label: 'Bundle', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400' },
  discontinued: { label: 'Discontinued', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
};

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [query, setQuery] = useState<ProductsQuery>({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'DESC',
  });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Categories panel state
  const [showCategories, setShowCategories] = useState(false);
  const [catError, setCatError] = useState('');
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '', parentId: '' });
  const [catSaving, setCatSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.getAll(query);
      setProducts(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await productsApi.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = () => {
    setQuery(prev => ({ ...prev, search: searchInput || undefined, page: 1 }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await productsApi.delete(id);
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  // ============================================================
  // CATEGORY PANEL HANDLERS
  // ============================================================
  const closeCategoryPanel = () => {
    setShowCategories(false);
    setShowCatForm(false);
    setEditingCat(null);
    setCatError('');
  };

  const openCatCreate = () => {
    setEditingCat(null);
    setCatForm({ name: '', description: '', parentId: '' });
    setShowCatForm(true);
    setCatError('');
  };

  const openCatEdit = (cat: ProductCategory) => {
    setEditingCat(cat);
    setCatForm({
      name: cat.name,
      description: cat.description || '',
      parentId: cat.parentId || '',
    });
    setShowCatForm(true);
    setCatError('');
  };

  const cancelCatForm = () => {
    setShowCatForm(false);
    setEditingCat(null);
    setCatError('');
  };

  const handleCatSave = async () => {
    if (!catForm.name.trim()) {
      setCatError('Category name is required');
      return;
    }
    setCatSaving(true);
    setCatError('');
    try {
      const payload = {
        name: catForm.name.trim(),
        description: catForm.description.trim() || undefined,
        parentId: catForm.parentId || undefined,
      };

      if (editingCat) {
        await productsApi.updateCategory(editingCat.id, payload);
      } else {
        await productsApi.createCategory(payload);
      }
      await fetchCategories();
      setShowCatForm(false);
      setEditingCat(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setCatError(error.response?.data?.message || 'Failed to save category');
    } finally {
      setCatSaving(false);
    }
  };

  const handleCatDelete = async (cat: ProductCategory) => {
    if (cat.productCount > 0) {
      setCatError(`Cannot delete "${cat.name}" — it has ${cat.productCount} product(s). Reassign them first.`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    setCatError('');
    try {
      await productsApi.deleteCategory(cat.id);
      await fetchCategories();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setCatError(error.response?.data?.message || 'Failed to delete category');
    }
  };

  // Build hierarchical display
  const topLevelCats = categories.filter(c => !c.parentId);
  const childCats = (parentId: string) => categories.filter(c => c.parentId === parentId);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products & Services</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {total} {total === 1 ? 'product' : 'products'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowCategories(true); setCatError(''); }}
            className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <FolderTree className="w-4 h-4" />
            Categories
          </button>
          <Link
            to="/products/price-books"
            className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Price Books
          </Link>
          <Link
            to="/products/new"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search products by name or code..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 border rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              showFilters
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter Row */}
        {showFilters && (
          <div className="px-4 pb-4 flex flex-wrap gap-3 border-t border-gray-100 dark:border-slate-800 pt-3">
            <select
              value={query.type || ''}
              onChange={(e) => setQuery(prev => ({ ...prev, type: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
            >
              <option value="">All Types</option>
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="subscription">Subscription</option>
              <option value="bundle">Bundle</option>
            </select>

            <select
              value={query.status || ''}
              onChange={(e) => setQuery(prev => ({ ...prev, status: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
            </select>

            <select
              value={query.categoryId || ''}
              onChange={(e) => setQuery(prev => ({ ...prev, categoryId: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.parentName ? `${cat.parentName} → ` : ''}{cat.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setQuery({ page: 1, limit: 20, sortBy: 'created_at', sortOrder: 'DESC' });
                setSearchInput('');
              }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="w-12 h-12 text-gray-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No products yet</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Start by adding your first product or service</p>
            <Link
              to="/products/new"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Code</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Price</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {products.map((product) => {
                    const typeBadge = TYPE_BADGES[product.type] || TYPE_BADGES.product;
                    const statusBadge = STATUS_BADGES[product.status] || STATUS_BADGES.active;

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                <Box className="w-5 h-5 text-white" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                              {product.shortDescription && (
                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[250px]">{product.shortDescription}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 dark:text-slate-400 font-mono">{product.code || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${typeBadge.className}`}>
                            {typeBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 dark:text-slate-400">{product.categoryName || '—'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(product.basePrice, product.currency)}
                          </span>
                          {product.unit !== 'each' && (
                            <span className="text-xs text-gray-500 dark:text-slate-400">/{product.unit}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === product.id ? null : product.id);
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-500" />
                            </button>
                            {openMenuId === product.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-10 py-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}`); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                                >
                                  <Eye className="w-4 h-4" /> View
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}/edit`); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                                >
                                  <Edit className="w-4 h-4" /> Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleDelete(product.id); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Page {query.page} of {totalPages} ({total} results)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuery(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                    disabled={(query.page || 1) <= 1}
                    className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setQuery(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                    disabled={(query.page || 1) >= totalPages}
                    className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* CATEGORIES SLIDE-OUT PANEL                                   */}
      {/* ============================================================ */}
      {showCategories && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeCategoryPanel} />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-600 to-purple-600">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <FolderTree className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Product Categories</h2>
                  <p className="text-violet-200 text-xs">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</p>
                </div>
              </div>
              <button onClick={closeCategoryPanel} className="text-white/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error */}
            {catError && (
              <div className="mx-6 mt-4 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{catError}</span>
              </div>
            )}

            {/* Add Button */}
            {!showCatForm && (
              <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-800">
                <button
                  onClick={openCatCreate}
                  className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>
            )}

            {/* Inline Form */}
            {showCatForm && (
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 space-y-3 bg-gray-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    {editingCat ? 'Edit Category' : 'New Category'}
                  </h3>
                  <button onClick={cancelCatForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={(e) => setCatForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Software, Hardware"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Parent Category</label>
                  <select
                    value={catForm.parentId}
                    onChange={(e) => setCatForm(prev => ({ ...prev, parentId: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  >
                    <option value="">— None (top level) —</option>
                    {categories
                      .filter(c => !editingCat || c.id !== editingCat.id)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.parentName ? `${cat.parentName} → ` : ''}{cat.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={catForm.description}
                    onChange={(e) => setCatForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCatSave}
                    disabled={catSaving}
                    className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {catSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingCat ? 'Save Changes' : 'Create'}
                  </button>
                  <button
                    onClick={cancelCatForm}
                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Category List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {categories.length === 0 ? (
                <div className="text-center py-12">
                  <FolderTree className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">No categories yet</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Create your first category to organize products</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {topLevelCats.map(cat => (
                    <div key={cat.id}>
                      {/* Parent Category */}
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 group transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderTree className="w-4 h-4 text-violet-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cat.name}</p>
                            {cat.description && (
                              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{cat.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <span className="text-xs text-gray-400 dark:text-slate-500 mr-1">{cat.productCount}</span>
                          <button
                            onClick={() => openCatEdit(cat)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleCatDelete(cat)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>

                      {/* Child Categories */}
                      {childCats(cat.id).map(child => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between px-3 py-2 ml-6 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 group transition-colors border-l-2 border-gray-200 dark:border-slate-700"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderTree className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-700 dark:text-slate-300 truncate">{child.name}</p>
                              {child.description && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{child.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <span className="text-xs text-gray-400 dark:text-slate-500 mr-1">{child.productCount}</span>
                            <button
                              onClick={() => openCatEdit(child)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                            </button>
                            <button
                              onClick={() => handleCatDelete(child)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}