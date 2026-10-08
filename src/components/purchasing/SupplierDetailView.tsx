import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  DollarSign,
  FileText,
  Boxes,
  CreditCard,
  Plus,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import {
  Supplier,
  PurchaseOrder,
  SupplierPayment,
  PurchasingTrendPoint
} from '../../types/purchasing';
import { PurchasingTrendChart } from './PurchasingTrendChart';

interface Props {
  supplier: Supplier;
  allPOs: PurchaseOrder[];
  allPayments: SupplierPayment[];
  onBack: () => void;
  onEditSupplier: (supplier: Supplier) => void;
  onCreatePO: (supplierId: string) => void;
  onSelectPO: (po: PurchaseOrder) => void;
  currencySymbol?: string;
}

export const SupplierDetailView: React.FC<Props> = ({
  supplier,
  allPOs,
  allPayments,
  onBack,
  onEditSupplier,
  onCreatePO,
  onSelectPO,
  currencySymbol = '$'
}) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'payments' | 'trends'>('pos');

  const supplierPOs = allPOs.filter(p => p.supplierId === supplier.id && p.status !== 'Cancelled');
  const supplierPayments = allPayments.filter(p => p.supplierId === supplier.id);

  const totalPurchases = supplierPOs.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalPaid = supplierPOs.reduce((acc, p) => acc + p.paidAmount, 0);
  const totalOutstanding = supplierPOs.reduce((acc, p) => acc + p.outstandingAmount, 0);
  const totalItemsPurchased = supplierPOs.reduce((acc, p) => acc + p.totalQuantity, 0);
  const avgPurchaseValue = supplierPOs.length > 0 ? totalPurchases / supplierPOs.length : 0;

  // Build trend points for this supplier
  const dateMap = new Map<string, PurchasingTrendPoint>();
  supplierPOs.forEach(po => {
    const d = po.poDate;
    if (!dateMap.has(d)) {
      dateMap.set(d, {
        date: d,
        formattedDate: d.slice(5),
        purchaseValue: 0,
        purchaseOrders: 0,
        quantityPurchased: 0,
        amountPaid: 0,
        outstandingAmount: 0
      });
    }
    const entry = dateMap.get(d)!;
    entry.purchaseValue += po.totalAmount;
    entry.purchaseOrders += 1;
    entry.quantityPurchased += po.totalQuantity;
    entry.amountPaid += po.paidAmount;
    entry.outstandingAmount += po.outstandingAmount;
  });
  const trendData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div id="supplier-detail-view" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to All Suppliers</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditSupplier(supplier)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-lg transition-colors"
          >
            <Edit2 size={13} />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={() => onCreatePO(supplier.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950 rounded-lg shadow transition-colors"
          >
            <Plus size={14} />
            <span>Create PO for Supplier</span>
          </button>
        </div>
      </div>

      {/* Supplier Profile Header Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-zinc-800 text-white shrink-0">
              <Building2 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-white tracking-tight">{supplier.name}</h1>
                <span className="px-2.5 py-0.5 text-xs rounded-full font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {supplier.code}
                </span>
                <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                  supplier.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {supplier.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">{supplier.notes || 'Strategic vendor partner'}</p>

              {/* Contact meta pills */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Globe size={13} className="text-zinc-500" />
                  <span>{supplier.country}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail size={13} className="text-zinc-500" />
                  <a href={`mailto:${supplier.email}`} className="hover:text-zinc-200">{supplier.email}</a>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={13} className="text-zinc-500" />
                  <span>{supplier.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <CreditCard size={13} className="text-zinc-500" />
                  <span>Terms: {supplier.paymentTerms}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Total Purchases</div>
          <div className="text-base font-bold text-white">
            {currencySymbol}{totalPurchases.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Total Paid</div>
          <div className="text-base font-bold text-emerald-400">
            {currencySymbol}{totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Outstanding Balance</div>
          <div className="text-base font-bold text-rose-400">
            {currencySymbol}{totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Total POs</div>
          <div className="text-base font-bold text-white">{supplierPOs.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Units Purchased</div>
          <div className="text-base font-bold text-cyan-400">{totalItemsPurchased.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-zinc-400 mb-1">Avg PO Value</div>
          <div className="text-base font-bold text-zinc-200">
            {currencySymbol}{avgPurchaseValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Purchase Orders | Payments | Trend Chart */}
      <div className="border-b border-zinc-800 flex items-center gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('pos')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'pos'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Purchase Orders ({supplierPOs.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'payments'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Payment History ({supplierPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'trends'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Spend Analytics
        </button>
      </div>

      {/* Tab 1: POs Table */}
      {activeTab === 'pos' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/70 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-center">Units</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Receiving</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {supplierPOs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                      No purchase orders recorded for this supplier yet.
                    </td>
                  </tr>
                ) : (
                  supplierPOs.map(po => (
                    <tr key={po.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-white">{po.poNumber}</td>
                      <td className="px-4 py-3 text-zinc-400">{po.poDate}</td>
                      <td className="px-4 py-3 text-center text-zinc-300">{po.items.length}</td>
                      <td className="px-4 py-3 text-center text-zinc-300">{po.totalQuantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {currencySymbol}{po.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        {currencySymbol}{po.paidAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-400 font-medium">
                        {currencySymbol}{po.outstandingAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          po.receivingStatus === 'Received'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : po.receivingStatus === 'Partially Received'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {po.receivingStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onSelectPO(po)}
                          className="px-2.5 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payment History Table */}
      {activeTab === 'payments' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/70 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Reference / Cheque</th>
                  <th className="px-4 py-3">Recorded By</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {supplierPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      No payment transactions recorded for this supplier yet.
                    </td>
                  </tr>
                ) : (
                  supplierPayments.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-zinc-300">{p.paymentDate}</td>
                      <td className="px-4 py-3 font-mono font-medium text-white">{p.poNumber}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                        {currencySymbol}{p.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{p.paymentMethod}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{p.referenceNumber || '—'}</td>
                      <td className="px-4 py-3 text-zinc-400">{p.recordedBy}</td>
                      <td className="px-4 py-3 text-zinc-500">{p.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Trends */}
      {activeTab === 'trends' && (
        <PurchasingTrendChart data={trendData} currencySymbol={currencySymbol} />
      )}
    </div>
  );
};
