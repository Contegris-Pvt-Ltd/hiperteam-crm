import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { productsApi } from '../../api/products.api';
import type { CreateProductData, ProductCategory, ProductType, ProductStatus } from '../../api/products.api';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

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
