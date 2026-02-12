import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Search, Package,
  AlertCircle, Layers, X,
} from 'lucide-react';
import { productsApi } from '../../api/products.api';
import type {
  CreateProductData, ProductCategory, ProductType, ProductStatus,
  Product, BundleDetail,
} from '../../api/products.api';

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'bundle', label: 'Bundle' },
];

const PRODUCT_UNITS = [
  { value: 'each', label: 'Each' },
  { value: 'hour', label: 'Hour' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'user', label: 'User' },
  { value: 'license', label: 'License' },
  { value: 'flat', label: 'Flat Fee' },
  { value: 'project', label: 'Project' },
];

const PRODUCT_STATUSES: { value: ProductStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'Discontinued' },
];

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const [formData, setFormData] = useState<CreateProductData>({
    name: '',
    code: '',
    shortDescription: '',
    description: '',
    type: 'product',
    categoryId: '',
    unit: 'each',
    basePrice: 0,
    cost: undefined,
    currency: 'USD',
    taxCategory: '',
    status: 'active',
    imageUrl: '',
    externalUrl: '',
  });

  // Bundle state (only used when editing an existing bundle-type product)
  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [bundleConfig, setBundleConfig] = useState({
    bundleType: 'fixed' as 'fixed' | 'flexible',
    minItems: 0,
    maxItems: undefined as number | undefined,
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
  });
  const [bundleSaving, setBundleSaving] = useState(false);
  const [bundleError, setBundleError] = useState('');

  // Product search for adding bundle items
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);

  useEffect(() => {
    productsApi.getCategories().then(setCategories).catch(console.error);

    if (!isNew) {
      productsApi.getOne(id!)
        .then((product) => {
          setFormData({
            name: product.name,
            code: product.code || '',
            shortDescription: product.shortDescription || '',
            description: product.description || '',
            type: product.type,
            categoryId: product.categoryId || '',
            unit: product.unit || 'each',
            basePrice: product.basePrice,
            cost: product.cost ?? undefined,
            currency: product.currency || 'USD',
            taxCategory: product.taxCategory || '',
            status: product.status,
            imageUrl: product.imageUrl || '',
            externalUrl: product.externalUrl || '',
          });
          // Load bundle data if this is a bundle product
          if (product.bundle) {
            setBundle(product.bundle);
            setBundleConfig({
              bundleType: product.bundle.bundleType,
              minItems: product.bundle.minItems,
              maxItems: product.bundle.maxItems ?? undefined,
              discountType: product.bundle.discountType,
              discountValue: product.bundle.discountValue,
            });
          }
        })
        .catch((err) => setError(err.response?.data?.message || 'Failed to load product'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const handleChange = (field: keyof CreateProductData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        categoryId: formData.categoryId || undefined,
        code: formData.code || undefined,
        cost: formData.cost !== undefined && formData.cost !== null ? Number(formData.cost) : undefined,
        basePrice: Number(formData.basePrice),
      };

      if (isNew) {
        const created = await productsApi.create(dataToSave);
        navigate(`/products/${created.id}`);
      } else {
        await productsApi.update(id!, dataToSave);
        navigate(`/products/${id}`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // BUNDLE HANDLERS
  // ============================================================
  const handleSaveBundleConfig = async () => {
    if (!id) return;
    setBundleSaving(true);
    setBundleError('');
    try {
      const result = await productsApi.configureBundle(id, {
        bundleType: bundleConfig.bundleType,
        minItems: bundleConfig.minItems,
        maxItems: bundleConfig.maxItems,
        discountType: bundleConfig.discountType,
        discountValue: bundleConfig.discountValue,
      });
      setBundle(result);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setBundleError(error.response?.data?.message || 'Failed to save bundle config');
    } finally {
      setBundleSaving(false);
    }
  };

  const handleSearchProducts = useCallback(async () => {
    if (!itemSearch.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await productsApi.searchProducts(itemSearch, id);
      // Filter out products already in the bundle and the bundle itself
      const existingIds = new Set(bundle?.items.map(i => i.productId) || []);
      setSearchResults(results.filter(p => p.id !== id && !existingIds.has(p.id)));
    } catch (err) {
      console.error('Product search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [itemSearch, id, bundle]);

  const handleAddItem = async (productId: string) => {
    if (!id) return;
    setBundleError('');
    try {
      const result = await productsApi.addBundleItem(id, { productId });
      setBundle(result);
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
      setBundle(result);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setBundleError(error.response?.data?.message || 'Failed to update item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return;
    setBundleError('');
    try {
      const result = await productsApi.removeBundleItem(id, itemId);
      setBundle(result);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setBundleError(error.response?.data?.message || 'Failed to remove item');
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isBundle = formData.type === 'bundle';
  const isExistingBundle = !isNew && isBundle;

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={isNew ? '/products' : `/products/${id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNew ? 'Back to Products' : 'Back to Product'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isNew ? 'New Product' : 'Edit Product'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
          {/* Basic Information */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter product name"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Product Code / SKU
                </label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  placeholder="e.g., CRM-LIC-001"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  {PRODUCT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Category</label>
                <select
                  value={formData.categoryId || ''}
                  onChange={(e) => handleChange('categoryId', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="">No Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parentName ? `${cat.parentName} → ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  {PRODUCT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Short Description</label>
                <input
                  type="text"
                  value={formData.shortDescription || ''}
                  onChange={(e) => handleChange('shortDescription', e.target.value)}
                  placeholder="Brief description for lists and quotes"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  maxLength={500}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Full Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Detailed product description..."
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Pricing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Base Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => handleChange('basePrice', parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Unit</label>
                <select
                  value={formData.unit || 'each'}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  {PRODUCT_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Cost (Internal)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost ?? ''}
                    onChange={(e) => handleChange('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="For margin calculation"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Currency</label>
                <select
                  value={formData.currency || 'USD'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (₨)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tax Category</label>
                <input
                  type="text"
                  value={formData.taxCategory || ''}
                  onChange={(e) => handleChange('taxCategory', e.target.value)}
                  placeholder="e.g., standard, zero-rated"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Links & Media
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Product Image URL</label>
                <input
                  type="url"
                  value={formData.imageUrl || ''}
                  onChange={(e) => handleChange('imageUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">External URL</label>
                <input
                  type="url"
                  value={formData.externalUrl || ''}
                  onChange={(e) => handleChange('externalUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BUNDLE CONFIGURATION (only for existing bundle-type products)*/}
        {/* ============================================================ */}
        {isExistingBundle && (
          <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800/50 divide-y divide-gray-100 dark:divide-slate-800">
            {/* Bundle Settings */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Bundle Configuration
                </h3>
              </div>

              {bundleError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{bundleError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Bundle Type</label>
                  <select
                    value={bundleConfig.bundleType}
                    onChange={(e) => setBundleConfig(prev => ({ ...prev, bundleType: e.target.value as 'fixed' | 'flexible' }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="fixed">Fixed (all items required)</option>
                    <option value="flexible">Flexible (pick & choose)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Discount Type</label>
                  <select
                    value={bundleConfig.discountType}
                    onChange={(e) => setBundleConfig(prev => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Discount Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {bundleConfig.discountType === 'percentage' ? '%' : '$'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bundleConfig.discountValue}
                      onChange={(e) => setBundleConfig(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {bundleConfig.bundleType === 'flexible' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Min Items</label>
                      <input
                        type="number"
                        min="0"
                        value={bundleConfig.minItems}
                        onChange={(e) => setBundleConfig(prev => ({ ...prev, minItems: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Max Items</label>
                      <input
                        type="number"
                        min="0"
                        value={bundleConfig.maxItems ?? ''}
                        onChange={(e) => setBundleConfig(prev => ({ ...prev, maxItems: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="No limit"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveBundleConfig}
                  disabled={bundleSaving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {bundleSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {bundle ? 'Update Bundle Settings' : 'Initialize Bundle'}
                </button>
              </div>
            </div>

            {/* Bundle Items */}
            {bundle && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    Bundle Items ({bundle.items.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => { setShowItemPicker(true); setItemSearch(''); setSearchResults([]); }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Product
                  </button>
                </div>

                {/* Product Search Picker */}
                {showItemPicker && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-slate-300">Search Products to Add</h5>
                      <button type="button" onClick={() => setShowItemPicker(false)} className="text-gray-400 hover:text-gray-600">
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
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchProducts(); } }}
                          placeholder="Search by name or code..."
                          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
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
                              type="button"
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
                {bundle.items.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">No items in this bundle yet</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Click "Add Product" to add items</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800">
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase w-20">Qty</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-28">Override $</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase w-20">Optional</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-24">Base Price</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                        {bundle.items.map(item => (
                          <tr key={item.id} className="group">
                            <td className="px-3 py-2.5">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.productName}</p>
                              {item.productCode && (
                                <p className="text-xs text-gray-400 font-mono">{item.productCode}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 text-center border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.overridePrice ?? ''}
                                onChange={(e) => handleUpdateItem(item.id, 'overridePrice', e.target.value ? parseFloat(e.target.value) : 0)}
                                placeholder="—"
                                className="w-24 px-2 py-1 text-right border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={item.isOptional}
                                onChange={(e) => handleUpdateItem(item.id, 'isOptional', e.target.checked)}
                                className="rounded border-gray-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm text-gray-500 dark:text-slate-400">
                              {formatCurrency(item.basePrice, formData.currency || 'USD')}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
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
                  </div>
                )}
              </div>
            )}

            {/* Info: Initialize bundle first */}
            {!bundle && (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Click "Initialize Bundle" above to start adding items to this bundle.
                </p>
              </div>
            )}

            {/* New product notice */}
            {isNew && isBundle && (
              <div className="p-6">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Tip:</strong> Save this product first, then you can configure the bundle items by editing it.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* New bundle notice (shown when type is bundle and creating new) */}
        {isNew && isBundle && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Save this bundle product first. After creation, you'll be able to configure bundle settings and add products to it.</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Link
            to={isNew ? '/products' : `/products/${id}`}
            className="px-6 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create Product' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}