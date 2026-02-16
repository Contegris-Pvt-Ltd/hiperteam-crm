// ============================================================
// FILE: apps/web/src/features/leads/components/LeadProductsTab.tsx
// Dual-mode: "local" for new leads, "connected" for existing leads
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Search, Package, Trash2, Loader2,
  StickyNote, DollarSign, Tag, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { leadsApi } from '../../../api/leads.api';
import type { LeadProduct } from '../../../api/leads.api';
import { api } from '../../../api/contacts.api';

interface Product {
  id: string;
  name: string;
  code: string | null;
  shortDescription: string | null;
  type: string;
  basePrice: number;
  currency: string;
  status: string;
  imageUrl: string | null;
  categoryName: string | null;
}

// Local product item (for new leads — no link ID yet)
interface LocalProduct {
  product: Product;
  notes: string;
}

interface LeadProductsTabProps {
  /** If provided, operates in "connected" mode (API calls for existing lead) */
  leadId?: string;
  readOnly?: boolean;
  /** For new leads: currently selected product IDs (controlled by parent) */
  selectedProductIds?: string[];
  /** For new leads: callback when selection changes */
  onProductIdsChange?: (ids: string[]) => void;
}

export function LeadProductsTab({
  leadId,
  readOnly = false,
  selectedProductIds,
  onProductIdsChange,
}: LeadProductsTabProps) {
  const isLocalMode = !leadId; // new lead = no ID yet

  // Connected mode state (existing lead)
  const [linkedProducts, setLinkedProducts] = useState<LeadProduct[]>([]);
  const [loading, setLoading] = useState(!!leadId);

  // Local mode state (new lead)
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);

  // Shared state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // ── Connected mode: load from API ──
  const loadProducts = useCallback(async () => {
    if (!leadId) return;
    try {
      const data = await leadsApi.getProducts(leadId);
      setLinkedProducts(data);
    } catch (err) {
      console.error('Failed to load lead products:', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) loadProducts();
  }, [leadId, loadProducts]);

  // ── Unlink ──
  const handleUnlink = async (productId: string) => {
    if (isLocalMode) {
      setLocalProducts(prev => prev.filter(lp => lp.product.id !== productId));
      onProductIdsChange?.(
        (selectedProductIds || []).filter(id => id !== productId)
      );
      return;
    }

    setUnlinkingId(productId);
    try {
      await leadsApi.unlinkProduct(leadId!, productId);
      setLinkedProducts(prev => prev.filter(lp => lp.product.id !== productId));
    } catch (err) {
      console.error('Failed to unlink product:', err);
    } finally {
      setUnlinkingId(null);
    }
  };

  // ── Save notes ──
  const handleSaveNotes = async (productId: string) => {
    if (isLocalMode) {
      setLocalProducts(prev =>
        prev.map(lp =>
          lp.product.id === productId ? { ...lp, notes: noteText } : lp
        )
      );
      setEditingNotes(null);
      return;
    }

    setSavingNotes(true);
    try {
      await leadsApi.updateProductNotes(leadId!, productId, noteText);
      setLinkedProducts(prev =>
        prev.map(lp =>
          lp.product.id === productId ? { ...lp, notes: noteText } : lp
        )
      );
      setEditingNotes(null);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  // ── Product linked callback ──
  const handleProductLinked = (product: Product) => {
    if (isLocalMode) {
      setLocalProducts(prev => [...prev, { product, notes: '' }]);
      onProductIdsChange?.([...(selectedProductIds || []), product.id]);
      setShowLinkModal(false);
      return;
    }

    // Connected mode: re-fetch from API to get full LeadProduct data
    loadProducts();
    setShowLinkModal(false);
  };

  const handleProductLinkedFromApi = (leadProduct: LeadProduct) => {
    setLinkedProducts(prev => [leadProduct, ...prev]);
    setShowLinkModal(false);
  };

  // ── Build unified display list ──
  const displayItems: {
    productId: string;
    product: {
      id: string; name: string; code: string | null; shortDescription: string | null;
      type: string; basePrice: number; currency: string; status: string;
      imageUrl: string | null; categoryName: string | null;
    };
    notes: string | null;
    linkedAt: string | null;
    linkedBy: string | null;
  }[] = isLocalMode
    ? localProducts.map(lp => ({
        productId: lp.product.id,
        product: lp.product,
        notes: lp.notes || null,
        linkedAt: null,
        linkedBy: null,
      }))
    : linkedProducts.map(lp => ({
        productId: lp.product.id,
        product: lp.product,
        notes: lp.notes,
        linkedAt: lp.linkedAt,
        linkedBy: lp.linkedBy,
      }));

  const existingProductIds = displayItems.map(d => d.productId);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Interested Products
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {displayItems.length} product{displayItems.length !== 1 ? 's' : ''} {isLocalMode ? 'selected' : 'linked'}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isLocalMode ? 'Add Product' : 'Link Product'}
          </button>
        )}
      </div>

      {/* Products List */}
      {displayItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
          <Package className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">No products {isLocalMode ? 'selected' : 'linked'} yet</p>
          {!readOnly && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
            >
              {isLocalMode ? 'Add a product' : 'Link a product'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <div
              key={item.productId}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Product Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {leadId ? (
                        <Link
                          to={`/products/${item.product.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
                        >
                          {item.product.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {item.product.name}
                        </span>
                      )}
                      {item.product.code && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                          {item.product.code}
                        </span>
                      )}
                      {leadId && <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {item.product.basePrice > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatPrice(item.product.basePrice, item.product.currency)}
                        </span>
                      )}
                      {item.product.categoryName && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {item.product.categoryName}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        item.product.type === 'service'
                          ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600'
                          : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                      }`}>
                        {item.product.type}
                      </span>
                    </div>
                    {item.product.shortDescription && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 line-clamp-1">
                        {item.product.shortDescription}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    {!isLocalMode && (
                      <button
                        onClick={() => {
                          setEditingNotes(item.productId);
                          setNoteText(item.notes || '');
                        }}
                        title="Edit notes"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleUnlink(item.productId)}
                      disabled={unlinkingId === item.productId}
                      title={isLocalMode ? 'Remove product' : 'Unlink product'}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {unlinkingId === item.productId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Notes display (connected mode only) */}
              {!isLocalMode && item.notes && editingNotes !== item.productId && (
                <div className="mt-2 ml-13 pl-3 border-l-2 border-gray-100 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-slate-400">{item.notes}</p>
                </div>
              )}

              {/* Notes editor (connected mode only) */}
              {!isLocalMode && editingNotes === item.productId && (
                <div className="mt-3 ml-13">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add notes about this product interest..."
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleSaveNotes(item.productId)}
                      disabled={savingNotes}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingNotes ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingNotes(null)}
                      className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Linked meta (connected mode only) */}
              {!isLocalMode && (item.linkedBy || item.linkedAt) && (
                <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                  {item.linkedBy && <span>Linked by {item.linkedBy}</span>}
                  {item.linkedAt && (
                    <span> · {new Date(item.linkedAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link Product Modal */}
      {showLinkModal && (
        <LinkProductModal
          leadId={leadId}
          isLocalMode={isLocalMode}
          existingProductIds={existingProductIds}
          onLinkedLocal={(product) => handleProductLinked(product)}
          onLinkedApi={(lp) => handleProductLinkedFromApi(lp)}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}


// ============================================================
// LINK PRODUCT MODAL
// ============================================================

interface LinkProductModalProps {
  leadId?: string;
  isLocalMode: boolean;
  existingProductIds: string[];
  onLinkedLocal: (product: Product) => void;
  onLinkedApi: (product: LeadProduct) => void;
  onClose: () => void;
}

function LinkProductModal({ leadId, isLocalMode, existingProductIds, onLinkedLocal, onLinkedApi, onClose }: LinkProductModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Search products
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length < 1 && hasSearched) return;

      setSearching(true);
      try {
        const params = search.trim() ? `search=${encodeURIComponent(search)}&` : '';
        const { data } = await api.get(`/products?${params}limit=20&status=active`);
        const products = data.data || data;
        setResults(
          (Array.isArray(products) ? products : []).filter(
            (p: Product) => !existingProductIds.includes(p.id)
          )
        );
      } catch (err) {
        console.error('Failed to search products:', err);
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, search.trim().length < 1 ? 0 : 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleLink = async (product: Product) => {
    if (isLocalMode) {
      // Local mode — just pass the product back, no API call
      onLinkedLocal(product);
      return;
    }

    // Connected mode — call API
    setLinking(product.id);
    try {
      await leadsApi.linkProduct(leadId!, product.id, notes || undefined);
      const products = await leadsApi.getProducts(leadId!);
      const linked = products.find(lp => lp.product.id === product.id);
      if (linked) {
        onLinkedApi(linked);
      }
    } catch (err) {
      console.error('Failed to link product:', err);
    } finally {
      setLinking(null);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isLocalMode ? 'Add Product' : 'Link Product'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or code..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">
              {hasSearched ? 'No products found' : 'Loading products...'}
            </p>
          ) : (
            <div className="space-y-2">
              {results.map((product) => (
                <div key={product.id}>
                  {isLocalMode ? (
                    // Local mode: single click to add
                    <button
                      onClick={() => handleLink(product)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent transition-all"
                    >
                      <div className="w-9 h-9 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {product.name}
                          </span>
                          {product.code && (
                            <span className="text-xs text-gray-400 font-mono">{product.code}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                          {product.basePrice > 0 && (
                            <span>{formatPrice(product.basePrice, product.currency)}</span>
                          )}
                          <span className="capitalize">{product.type}</span>
                          {product.categoryName && <span>· {product.categoryName}</span>}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  ) : (
                    // Connected mode: expand for notes + confirm
                    <>
                      <button
                        onClick={() => setSelectedId(selectedId === product.id ? null : product.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                          selectedId === product.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent'
                        }`}
                      >
                        <div className="w-9 h-9 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {product.name}
                            </span>
                            {product.code && (
                              <span className="text-xs text-gray-400 font-mono">{product.code}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                            {product.basePrice > 0 && (
                              <span>{formatPrice(product.basePrice, product.currency)}</span>
                            )}
                            <span className="capitalize">{product.type}</span>
                            {product.categoryName && <span>· {product.categoryName}</span>}
                          </div>
                        </div>
                        {linking === product.id && (
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                        )}
                      </button>

                      {selectedId === product.id && (
                        <div className="ml-12 mt-2 mb-2 space-y-2">
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Add notes (optional)..."
                            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={() => handleLink(product)}
                            disabled={linking === product.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {linking === product.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            Link Product
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}