// ============================================================
// FILE: apps/web/src/features/opportunities/components/LineItemsPanel.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Package, Loader2, Pencil, Check, X } from 'lucide-react';
import { opportunitiesApi } from '../../../api/opportunities.api';
import type { OpportunityLineItem } from '../../../api/opportunities.api';

interface LineItemsPanelProps {
  opportunityId: string;
  lineItems: OpportunityLineItem[];
  onRefresh: () => void;
  canEdit: boolean;
}

const FREQUENCY_LABELS: Record<string, { label: string; className: string }> = {
  one_time: { label: 'One-time', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  monthly: { label: 'Monthly', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  annually: { label: 'Annual', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
};

export function LineItemsPanel({ opportunityId, lineItems, onRefresh, canEdit }: LineItemsPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ quantity: number; unitPrice: number; discount: number; discountType: 'percentage' | 'fixed' }>({ quantity: 1, unitPrice: 0, discount: 0, discountType: 'percentage' });
  const [saving, setSaving] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);

  // Search products
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/products?search=${encodeURIComponent(productSearch)}&limit=8&status=active`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } },
        );
        const data = await response.json();
        setProductResults(data.data || []);
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleAddProduct = async (product: any) => {
    setAddingProduct(true);
    try {
      await opportunitiesApi.addLineItem(opportunityId, {
        productId: product.id,
        quantity: 1,
        unitPrice: product.basePrice || 0,
        discount: 0,
        discountType: 'percentage',
      });
      setShowAddModal(false);
      setProductSearch('');
      setProductResults([]);
      onRefresh();
    } catch (err) {
      console.error('Failed to add line item:', err);
    } finally {
      setAddingProduct(false);
    }
  };

  const handleStartEdit = (item: OpportunityLineItem) => {
    setEditingId(item.id);
    setEditValues({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      discountType: item.discountType,
    });
  };

  const handleSaveEdit = async (lineItemId: string) => {
    setSaving(true);
    try {
      await opportunitiesApi.updateLineItem(opportunityId, lineItemId, editValues);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update line item:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (lineItemId: string) => {
    try {
      await opportunitiesApi.removeLineItem(opportunityId, lineItemId);
      onRefresh();
    } catch (err) {
      console.error('Failed to remove line item:', err);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  // ── Separate totals ──
  const oneTimeTotal = lineItems
    .filter(i => (i.billingFrequency || 'one_time') === 'one_time')
    .reduce((sum, i) => sum + i.totalPrice, 0);
  const mrr = lineItems
    .filter(i => i.billingFrequency === 'monthly')
    .reduce((sum, i) => sum + i.totalPrice, 0);
  const annualRecurring = lineItems
    .filter(i => i.billingFrequency === 'annually')
    .reduce((sum, i) => sum + i.totalPrice, 0);
  const acv = oneTimeTotal + (mrr * 12) + annualRecurring;
  const totalAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Package size={16} />
          Products / Line Items ({lineItems.length})
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Add Product
          </button>
        )}
      </div>

      {lineItems.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No products added yet</p>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase w-20">Freq.</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-16">Qty</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-24">Price</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-20">Disc.</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-24">Total</th>
                {canEdit && <th className="w-16"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lineItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  {/* Product */}
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName || item.description}</p>
                    {item.productCode && <p className="text-xs text-gray-400">{item.productCode}</p>}
                  </td>

                  {/* Billing Frequency */}
                  <td className="px-3 py-2 text-center">
                    {(() => {
                      const freq = FREQUENCY_LABELS[item.billingFrequency || 'one_time'] || FREQUENCY_LABELS.one_time;
                      return (
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${freq.className}`}>
                          {freq.label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Quantity */}
                  <td className="px-3 py-2 text-right">
                    {editingId === item.id ? (
                      <input type="number" min={1} value={editValues.quantity}
                        onChange={(e) => setEditValues(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        className="w-14 text-right border rounded px-1 py-0.5 text-sm dark:bg-slate-800 dark:border-gray-700"
                      />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">{item.quantity}</span>
                    )}
                  </td>

                  {/* Unit Price */}
                  <td className="px-3 py-2 text-right">
                    {editingId === item.id ? (
                      <input type="number" min={0} step={0.01} value={editValues.unitPrice}
                        onChange={(e) => setEditValues(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                        className="w-20 text-right border rounded px-1 py-0.5 text-sm dark:bg-slate-800 dark:border-gray-700"
                      />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">{formatCurrency(item.unitPrice)}</span>
                    )}
                  </td>

                  {/* Discount */}
                  <td className="px-3 py-2 text-right">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input type="number" min={0} value={editValues.discount}
                          onChange={(e) => setEditValues(prev => ({ ...prev, discount: Number(e.target.value) }))}
                          className="w-14 text-right border rounded px-1 py-0.5 text-sm dark:bg-slate-800 dark:border-gray-700"
                        />
                        <select value={editValues.discountType}
                          onChange={(e) => setEditValues(prev => ({ ...prev, discountType: e.target.value as any }))}
                          className="text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-gray-700"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">$</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-gray-500">
                        {item.discount > 0 ? `${item.discount}${item.discountType === 'percentage' ? '%' : '$'}` : '—'}
                      </span>
                    )}
                  </td>

                  {/* Total */}
                  <td className={`px-3 py-2 text-right font-medium ${
                    item.totalPrice < 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {formatCurrency(item.totalPrice)}
                  </td>

                  {/* Actions */}
                  {canEdit && (
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {editingId === item.id ? (
                          <>
                            <button onClick={() => handleSaveEdit(item.id)} disabled={saving}
                              className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleStartEdit(item)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleRemove(item.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-slate-800">
              {mrr > 0 && (
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">Monthly Recurring (MRR)</td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(mrr)}/mo</td>
                  {canEdit && <td></td>}
                </tr>
              )}
              {annualRecurring > 0 && (
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">Annual Recurring</td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(annualRecurring)}/yr</td>
                  {canEdit && <td></td>}
                </tr>
              )}
              {oneTimeTotal > 0 && (mrr > 0 || annualRecurring > 0) && (
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">One-time</td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(oneTimeTotal)}</td>
                  {canEdit && <td></td>}
                </tr>
              )}
              {(mrr > 0 || annualRecurring > 0) && (
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">Annual Contract Value (ACV)</td>
                  <td className="px-3 py-1.5 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(acv)}</td>
                  {canEdit && <td></td>}
                </tr>
              )}
              <tr className="border-t border-gray-300 dark:border-gray-600">
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Total</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</td>
                {canEdit && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add Product</h3>
              <button onClick={() => { setShowAddModal(false); setProductSearch(''); setProductResults([]); }} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name or code..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-slate-800"
                  autoFocus
                />
              </div>

              {searchLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                </div>
              )}

              {productResults.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {productResults.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddProduct(p)}
                      disabled={addingProduct}
                      className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.code || p.type}</p>
                      </div>
                      <span className="text-sm font-medium text-emerald-600">
                        {formatCurrency(p.basePrice || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {productSearch.length >= 2 && !searchLoading && productResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No products found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}