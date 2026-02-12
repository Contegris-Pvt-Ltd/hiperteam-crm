import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Loader2, Box, DollarSign,
  Tag, ExternalLink, Package, Layers, Plus, Search, X,
  AlertCircle,
} from 'lucide-react';
import { productsApi } from '../../api/products.api';
import type { Product, BundleDetail } from '../../api/products.api';

const TYPE_LABELS: Record<string, string> = {
  product: 'Product',
  service: 'Service',
  subscription: 'Subscription',
  bundle: 'Bundle',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  inactive: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400',
  discontinued: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

type TabType = 'details' | 'pricing' | 'bundle';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Bundle inline editing state
  const [bundleError, setBundleError] = useState('');
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!id) return;
    productsApi.getOne(id)
      .then(setProduct)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load product'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await productsApi.delete(id!);
      navigate('/products');
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  // ============================================================
  // BUNDLE QUICK-EDIT HANDLERS
  // ============================================================
  const updateBundleInProduct = (newBundle: BundleDetail) => {
    setProduct(prev => prev ? { ...prev, bundle: newBundle } : prev);
  };

  const handleSearchProducts = useCallback(async () => {
    if (!itemSearch.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await productsApi.searchProducts(itemSearch, id);
      const existingIds = new Set(product?.bundle?.items.map(i => i.productId) || []);
      setSearchResults(results.filter(p => p.id !== id && !existingIds.has(p.id)));
    } catch (err) {
      console.error('Product search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [itemSearch, id, product?.bundle]);

  const handleAddItem = async (productId: string) => {
    if (!id) return;
    setBundleError('');
    try {
      const result = await productsApi.addBundleItem(id, { productId });
      updateBundleInProduct(result);
      setSearchResults(prev => prev.filter(p => p.id !== productId));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setBundleError(error.response?.data?.message || 'Failed to add item');
    }
  };

  const handleUpdateItem = async (itemId: string, field: string, value: unknown) => {
    if (!id) return;
    setBundleError('');
    try {
      const result = await productsApi.updateBundleItem(id, itemId, { [field]: value });
      updateBundleInProduct(result);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setBundleError(error.response?.data?.message || 'Failed to update item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id || !confirm('Remove this item from the bundle?')) return;
    setBundleError('');
    try {
      const result = await productsApi.removeBundleItem(id, itemId);
      updateBundleInProduct(result);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setBundleError(error.response?.data?.message || 'Failed to remove item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error || 'Product not found'}</p>
        <Link to="/products" className="text-blue-600 hover:underline">Back to Products</Link>
      </div>
    );
  }

  const margin = product.cost != null && product.basePrice > 0
    ? (((product.basePrice - product.cost) / product.basePrice) * 100).toFixed(1)
    : null;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'pricing', label: 'Price Books' },
    ...(product.type === 'bundle' ? [{ id: 'bundle' as TabType, label: 'Bundle Items' }] : []),
  ];

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Box className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
              {product.code && (
                <p className="text-sm text-gray-500 dark:text-slate-400 font-mono mt-0.5">SKU: {product.code}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[product.status]}`}>
                  {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {TYPE_LABELS[product.type]}
                </span>
                {product.categoryName && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                    {product.categoryName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 border border-red-200 dark:border-red-800 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <Link
              to={`/products/${id}/edit`}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Price Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Base Price</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(product.basePrice, product.currency)}
            {product.unit !== 'each' && <span className="text-sm font-normal text-gray-500">/{product.unit}</span>}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Cost</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {product.cost != null ? formatCurrency(product.cost, product.currency) : '—'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Margin</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{margin ? `${margin}%` : '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="border-b border-gray-100 dark:border-slate-800 px-6">
          <nav className="flex gap-6 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {product.shortDescription && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Short Description</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{product.shortDescription}</p>
                </div>
              )}
              {product.description && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Full Description</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Unit</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{product.unit}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Currency</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{product.currency}</p>
                </div>
                {product.taxCategory && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tax Category</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{product.taxCategory}</p>
                  </div>
                )}
                {product.owner && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Owner</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{product.owner.firstName} {product.owner.lastName}</p>
                  </div>
                )}
              </div>

              {product.externalUrl && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">External URL</label>
                  <a href={product.externalUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    {product.externalUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Price Books Tab */}
          {activeTab === 'pricing' && (
            <div>
              {!product.priceBookEntries || product.priceBookEntries.length === 0 ? (
                <div className="text-center py-10">
                  <Tag className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">No price book entries yet</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Add this product to price books from the <Link to="/products/price-books" className="text-blue-600 hover:underline">Price Books</Link> page
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price Book</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Min Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Max Qty</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                    {product.priceBookEntries.map(entry => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {entry.priceBookName}
                          {entry.isStandard && (
                            <span className="ml-2 text-xs text-gray-400">(Standard)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(entry.unitPrice, product.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-400">{entry.minQuantity}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-400">{entry.maxQuantity ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            entry.isActive
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600'
                          }`}>
                            {entry.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Bundle Tab — EDITABLE */}
          {activeTab === 'bundle' && (
            <div>
              {/* Bundle Error */}
              {bundleError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{bundleError}</span>
                </div>
              )}

              {/* Bundle Config Summary + Add Button */}
              {product.bundle && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-sm text-gray-500 dark:text-slate-400">
                        Bundle Type: <strong className="text-gray-900 dark:text-white capitalize">{product.bundle.bundleType}</strong>
                      </span>
                      {product.bundle.discountValue > 0 && (
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          Discount: <strong className="text-emerald-600">
                            {product.bundle.discountType === 'percentage'
                              ? `${product.bundle.discountValue}%`
                              : formatCurrency(product.bundle.discountValue, product.currency)
                            }
                          </strong>
                        </span>
                      )}
                      <span className="text-sm text-gray-500 dark:text-slate-400">
                        Items: <strong className="text-gray-900 dark:text-white">{product.bundle.items.length}</strong>
                      </span>
                    </div>
                    <button
                      onClick={() => { setShowItemPicker(true); setItemSearch(''); setSearchResults([]); }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Product
                    </button>
                  </div>

                  {/* Quick Add Search */}
                  {showItemPicker && (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-slate-300">Search Products to Add</h5>
                        <button onClick={() => setShowItemPicker(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSearchProducts(); }}
                            placeholder="Search by name or code..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={handleSearchProducts}
                          disabled={searching}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-sm font-medium"
                        >
                          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                        </button>
                      </div>
                      {searchResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {searchResults.map(p => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                  {p.code && <span className="font-mono">{p.code} · </span>}
                                  {formatCurrency(p.basePrice, p.currency)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleAddItem(p.id)}
                                className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 flex-shrink-0"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.length === 0 && itemSearch && !searching && (
                        <p className="text-xs text-gray-400 text-center py-3">No products found</p>
                      )}
                    </div>
                  )}

                  {/* Items Table */}
                  {product.bundle.items.length === 0 ? (
                    <div className="text-center py-10">
                      <Package className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">No items in this bundle yet</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Click "Add Product" to add items</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800">
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">Qty</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Optional</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                        {product.bundle.items.map(item => (
                          <tr key={item.id} className="group">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.productName}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 font-mono">{item.productCode || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 text-center border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                              {formatCurrency(item.overridePrice ?? item.basePrice, product.currency)}
                              {item.overridePrice != null && (
                                <span className="block text-xs text-gray-400 line-through">
                                  {formatCurrency(item.basePrice, product.currency)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.isOptional}
                                onChange={(e) => handleUpdateItem(item.id, 'isOptional', e.target.checked)}
                                className="rounded border-gray-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove from bundle"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* No bundle config yet */}
              {!product.bundle && (
                <div className="text-center py-10">
                  <Layers className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">Bundle not configured yet</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Go to <Link to={`/products/${id}/edit`} className="text-blue-600 hover:underline">Edit</Link> to initialize the bundle and add items
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}