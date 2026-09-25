import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, ArrowLeft, RefreshCw, Phone, MapPin, Calendar } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function RecycleBin({ onBackToSearch, onSelectCustomer }) {
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);
  const { addToast } = useToast();

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const data = await api.getDeletedCustomers();
      setDeletedCustomers(data || []);
    } catch (err) {
      addToast('error', err.message || 'Failed to load Recycle Bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeleted();
  }, []);

  const handleRestore = async (customer) => {
    setActionLoading(customer.customer_id);
    try {
      await api.restoreCustomer(customer.customer_id);
      addToast('success', `Restored "${customer.name}" to active customers`);
      setDeletedCustomers((prev) => prev.filter((c) => c.customer_id !== customer.customer_id));
    } catch (err) {
      addToast('error', err.message || 'Failed to restore customer');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setActionLoading(permanentDeleteTarget.customer_id);
    try {
      await api.permanentDeleteCustomer(permanentDeleteTarget.customer_id);
      addToast('success', `Permanently deleted "${permanentDeleteTarget.name}"`);
      setDeletedCustomers((prev) =>
        prev.filter((c) => c.customer_id !== permanentDeleteTarget.customer_id)
      );
      setPermanentDeleteTarget(null);
    } catch (err) {
      addToast('error', err.message || 'Failed to permanently delete customer');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <button
            onClick={onBackToSearch}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Active Ledger
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recycle Bin</h1>
              <p className="text-xs text-slate-500">
                Soft-deleted customers excluded from active search. Restore them or permanently delete.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchDeleted}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading Recycle Bin...</p>
        </div>
      ) : deletedCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Recycle Bin is empty</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No customers have been deleted. When you delete a customer from their profile, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {deletedCustomers.map((c) => {
            const hasDue = (c.total_due || 0) > 0;
            const isActing = actionLoading === c.customer_id;

            return (
              <div
                key={c.customer_id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900 truncate">{c.name}</h3>
                    {hasDue ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        ₹{Number(c.total_due).toFixed(2)} Due
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        All Clear
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {c.phone_number}
                    </span>
                    {c.village && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {c.village}
                      </span>
                    )}
                    {c.deleted_at && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Deleted {new Date(c.deleted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleRestore(c)}
                    disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => setPermanentDeleteTarget(c)}
                    disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Permanently
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {permanentDeleteTarget && (
        <Modal
          isOpen={!!permanentDeleteTarget}
          onClose={() => setPermanentDeleteTarget(null)}
          title="Delete Customer Permanently?"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Irreversible Action</p>
                <p className="text-xs text-rose-700 mt-1">
                  Permanently deleting <strong>{permanentDeleteTarget.name}</strong> will completely remove their record, along with all purchase visits, medicine line items, and payment transaction history.
                </p>
                {Number(permanentDeleteTarget.total_due || 0) > 0 && (
                  <p className="text-xs font-bold text-rose-900 mt-2">
                    ⚠️ Warning: This customer has an unpaid due of ₹{Number(permanentDeleteTarget.total_due).toFixed(2)}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPermanentDeleteTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={actionLoading === permanentDeleteTarget.customer_id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-rose-200 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
