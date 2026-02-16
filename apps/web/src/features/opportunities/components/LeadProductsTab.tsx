// ============================================================
// FILE: apps/web/src/features/leads/components/LeadProductsTab.tsx
// New component: Products tab for lead edit/detail pages
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

interface LeadProductsTabProps {
  leadId: string;
  readOnly?: boolean;
}

export function LeadProductsTab({ leadId, readOnly = false }: LeadProductsTabProps) {
  const [linkedProducts, setLinkedProducts] = useState<LeadProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
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

  const handleUnlink = async (productId: string) => {
    setUnlinkingId(productId);
    try {
      await leadsApi.unlinkProduct(leadId, productId);
      setLinkedProducts(prev => prev.filter(lp => lp.product.id !== productId));
    } catch (err) {
      console.error('Failed to unlink product:', err);
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleSaveNotes = async (productId: string) => {
    setSavingNotes(true);
    try {
      await leadsApi.updateProductNotes(leadId, productId, noteText);
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

  const handleProductLinked = (product: LeadProduct) => {
    setLinkedProducts(prev => [product, ...prev]);
    setShowLinkModal(false);
  };

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
            {linkedProducts.length} product{linkedProducts.length !== 1 ? 's' : ''} linked
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Link Product
          </button>
        )}
      </div>

      {/* Products List */}
      {linkedProducts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
          <Package className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">No products linked yet</p>
          {!readOnly && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
            >
              Link a product
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {linkedProducts.map((lp) => (
            <div
              key={lp.product.id}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Product Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                    {lp.product.imageUrl ? (
                      <img src={lp.product.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/products/${lp.product.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
                      >
                        {lp.product.name}
                      </Link>
                      {lp.product.code && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                          {lp.product.code}
                        </span>
                      )}
                      <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {lp.product.basePrice > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatPrice(lp.product.basePrice, lp.product.currency)}
                        </span>
                      )}
                      {lp.product.categoryName && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {lp.product.categoryName}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        lp.product.type === 'service'
                          ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600'
                          : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                      }`}>
                        {lp.product.type}
                      </span>
                    </div>
                    {lp.product.shortDescription && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 line-clamp-1">
                        {lp.product.shortDescription}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingNotes(lp.product.id);
                        setNoteText(lp.notes || '');
                      }}
                      title="Edit notes"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUnlink(lp.product.id)}
                      disabled={unlinkingId === lp.product.id}
                      title="Unlink product"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {unlinkingId === lp.product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Notes display */}
              {lp.notes && editingNotes !== lp.product.id && (
                <div className="mt-2 ml-13 pl-3 border-l-2 border-gray-100 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-slate-400">{lp.notes}</p>
                </div>
              )}

              {/* Notes editor */}
              {editingNotes === lp.product.id && (
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
                      onClick={() => handleSaveNotes(lp.product.id)}
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

              {/* Linked meta */}
              <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                {lp.linkedBy && <span>Linked by {lp.linkedBy}</span>}
                {lp.linkedAt && (
                  <span> · {new Date(lp.linkedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Product Modal */}
      {showLinkModal && (
        <LinkProductModal
          leadId={leadId}
          existingProductIds={linkedProducts.map(lp => lp.product.id)}
          onLinked={handleProductLinked}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}


// ============================================================
// LINK PRODUCT MODAL (inline, search + select)
// ============================================================

interface LinkProductModalProps {
  leadId: string;
  existingProductIds: string[];
  onLinked: (product: LeadProduct) => void;
  onClose: () => void;
}

function LinkProductModal({ leadId, existingProductIds, onLinked, onClose }: LinkProductModalProps) {
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
      if (search.trim().length < 1) {
        if (!hasSearched) {
          // Load initial products on mount
          setSearching(true);
          try {
            const { data } = await api.get('/products?limit=20&status=active');
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
        }
        return;
      }

      setSearching(true);
      try {
        const { data } = await api.get(`/products?search=${encodeURIComponent(search)}&limit=20&status=active`);
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
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleLink = async (productId: string) => {
    setLinking(productId);
    try {
      await leadsApi.linkProduct(leadId, productId, notes || undefined);
      // Fetch the full product data for display
      const products = await leadsApi.getProducts(leadId);
      const linked = products.find(lp => lp.product.id === productId);
      if (linked) {
        onLinked(linked);
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Link Product</h3>
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
              {hasSearched ? 'No products found' : 'Start typing to search...'}
            </p>
          ) : (
            <div className="space-y-2">
              {results.map((product) => (
                <div key={product.id}>
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

                  {/* Expanded: notes + confirm */}
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
                        onClick={() => handleLink(product.id)}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}