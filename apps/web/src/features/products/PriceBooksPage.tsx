import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit, Trash2, Loader2, Tag, X,
  ChevronDown, ChevronRight, Save, DollarSign,
} from 'lucide-react';
import { productsApi } from '../../api/products.api';
import type { PriceBook, PriceBookEntry, Product } from '../../api/products.api';

export function PriceBooksPage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, PriceBookEntry[]>>({});
  const [loadingEntries, setLoadingEntries] = useState<string | null>(null);

  // Modal state
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<PriceBook | null>(null);
  const [bookForm, setBookForm] = useState({ name: '', description: '', isActive: true, validFrom: '', validTo: '' });
  const [savingBook, setSavingBook] = useState(false);

  // Add entry modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForBookId, setEntryForBookId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [entryForm, setEntryForm] = useState({ productId: '', unitPrice: 0, minQuantity: 1, maxQuantity: '' as string | number });
  const [savingEntry, setSavingEntry] = useState(false);

  const fetchPriceBooks = useCallback(async () => {
    setLoading(true);
    try {
      const books = await productsApi.getPriceBooks();
      setPriceBooks(books);
    } catch (err) {
      console.error('Failed to fetch price books:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPriceBooks();
  }, [fetchPriceBooks]);

  const toggleExpand = async (bookId: string) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null);
      return;
    }
    setExpandedBookId(bookId);

    if (!entries[bookId]) {
      setLoadingEntries(bookId);
      try {
        const bookEntries = await productsApi.getPriceBookEntries(bookId);
        setEntries(prev => ({ ...prev, [bookId]: bookEntries }));
      } catch (err) {
        console.error('Failed to fetch entries:', err);
      } finally {
        setLoadingEntries(null);
      }
    }
  };

  // Price Book CRUD
  const openBookModal = (book?: PriceBook) => {
    if (book) {
      setEditingBook(book);
      setBookForm({
        name: book.name,
        description: book.description || '',
        isActive: book.isActive,
        validFrom: book.validFrom ? book.validFrom.split('T')[0] : '',
        validTo: book.validTo ? book.validTo.split('T')[0] : '',
      });
    } else {
      setEditingBook(null);
      setBookForm({ name: '', description: '', isActive: true, validFrom: '', validTo: '' });
    }
    setShowBookModal(true);
  };

  const saveBook = async () => {
    if (!bookForm.name.trim()) return;
    setSavingBook(true);
    try {
      const data = {
        name: bookForm.name,
        description: bookForm.description || undefined,
        isActive: bookForm.isActive,
        validFrom: bookForm.validFrom || undefined,
        validTo: bookForm.validTo || undefined,
      };

      if (editingBook) {
        await productsApi.updatePriceBook(editingBook.id, data);
      } else {
        await productsApi.createPriceBook(data);
      }
      setShowBookModal(false);
      fetchPriceBooks();
    } catch (err) {
      console.error('Failed to save price book:', err);
    } finally {
      setSavingBook(false);
    }
  };

  const deleteBook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this price book?')) return;
    try {
      await productsApi.deletePriceBook(id);
      fetchPriceBooks();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'Failed to delete price book');
    }
  };

  // Price Book Entry CRUD
  const openEntryModal = async (bookId: string) => {
    setEntryForBookId(bookId);
    setEntryForm({ productId: '', unitPrice: 0, minQuantity: 1, maxQuantity: '' });
    // Fetch products for dropdown
    try {
      const res = await productsApi.getAll({ limit: 100, status: 'active' });
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
    setShowEntryModal(true);
  };

  const saveEntry = async () => {
    if (!entryForBookId || !entryForm.productId) return;
    setSavingEntry(true);
    try {
      await productsApi.createPriceBookEntry(entryForBookId, {
        productId: entryForm.productId,
        unitPrice: Number(entryForm.unitPrice),
        minQuantity: Number(entryForm.minQuantity) || 1,
        maxQuantity: entryForm.maxQuantity ? Number(entryForm.maxQuantity) : undefined,
      });
      setShowEntryModal(false);
      // Refresh entries
      const bookEntries = await productsApi.getPriceBookEntries(entryForBookId);
      setEntries(prev => ({ ...prev, [entryForBookId!]: bookEntries }));
      fetchPriceBooks(); // Refresh counts
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'Failed to add entry');
    } finally {
      setSavingEntry(false);
    }
  };

  const deleteEntry = async (bookId: string, entryId: string) => {
    if (!confirm('Remove this product from the price book?')) return;
    try {
      await productsApi.deletePriceBookEntry(entryId);
      const bookEntries = await productsApi.getPriceBookEntries(bookId);
      setEntries(prev => ({ ...prev, [bookId]: bookEntries }));
      fetchPriceBooks();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

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

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Price Books</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage pricing tiers for different customer segments</p>
          </div>
          <button
            onClick={() => openBookModal()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Price Book
          </button>
        </div>
      </div>

      {/* Price Books List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : priceBooks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-10 text-center">
          <Tag className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No price books</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">Create your first price book to manage product pricing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {priceBooks.map(book => (
            <div key={book.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              {/* Book Header */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => toggleExpand(book.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedBookId === book.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{book.name}</p>
                      {book.isStandard && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">DEFAULT</span>
                      )}
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        book.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600'
                      }`}>
                        {book.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {book.description && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{book.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{book.entryCount} products</span>
                  {!book.isStandard && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openBookModal(book)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <Edit className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => deleteBook(book.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Entries */}
              {expandedBookId === book.id && (
                <div className="border-t border-gray-100 dark:border-slate-800">
                  {loadingEntries === book.id ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {entries[book.id]?.length === 0 ? (
                        <div className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                          No products in this price book yet
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                              <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-500 uppercase">Code</th>
                              <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase">Base Price</th>
                              <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase">Book Price</th>
                              <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase">Min Qty</th>
                              <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase">Max Qty</th>
                              <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                            {entries[book.id]?.map(entry => (
                              <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                                <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{entry.productName}</td>
                                <td className="px-6 py-3 text-sm text-gray-500 font-mono">{entry.productCode || '—'}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-500">{entry.basePrice !== undefined ? formatCurrency(entry.basePrice) : '—'}</td>
                                <td className="px-6 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">{formatCurrency(entry.unitPrice)}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-500">{entry.minQuantity}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-500">{entry.maxQuantity ?? '∞'}</td>
                                <td className="px-6 py-3 text-right">
                                  <button
                                    onClick={() => deleteEntry(book.id, entry.id)}
                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-800">
                        <button
                          onClick={() => openEntryModal(book.id)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Product
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Price Book Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingBook ? 'Edit Price Book' : 'New Price Book'}
              </h3>
              <button onClick={() => setShowBookModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={bookForm.name}
                  onChange={(e) => setBookForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enterprise Pricing"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={bookForm.description}
                  onChange={(e) => setBookForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Valid From</label>
                  <input
                    type="date"
                    value={bookForm.validFrom}
                    onChange={(e) => setBookForm(prev => ({ ...prev, validFrom: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Valid To</label>
                  <input
                    type="date"
                    value={bookForm.validTo}
                    onChange={(e) => setBookForm(prev => ({ ...prev, validTo: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bookForm.isActive}
                  onChange={(e) => setBookForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">Active</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBookModal(false)}
                className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveBook}
                disabled={savingBook || !bookForm.name.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm flex items-center gap-2"
              >
                {savingBook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Product to Price Book</h3>
              <button onClick={() => setShowEntryModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Product</label>
                <select
                  value={entryForm.productId}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, productId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Unit Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entryForm.unitPrice}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Min Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={entryForm.minQuantity}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, minQuantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Max Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={entryForm.maxQuantity}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, maxQuantity: e.target.value }))}
                    placeholder="No limit"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEntryModal(false)}
                className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEntry}
                disabled={savingEntry || !entryForm.productId}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm flex items-center gap-2"
              >
                {savingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
