'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Calendar, ChevronLeft, ChevronRight, FileText, ArrowUpRight, 
  ArrowDownLeft, Filter, Download, Printer, Layers, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

export default function DayBookPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherFilter, setVoucherFilter] = useState<string>('ALL');
  const [detailedView, setDetailedView] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  const fetchDayBook = async (date: string) => {
    setLoading(true);
    try {
      const orgId = typeof window !== 'undefined' ? localStorage.getItem('activeOrgId') : null;
      const headers: Record<string, string> = {};
      if (orgId) headers['x-organization-id'] = orgId;

      const res = await fetch(`/api/v1/reports/day-book?date=${date}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load Day Book data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayBook(selectedDate);
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filteredRecords = (data?.records || []).filter((r: any) => {
    if (voucherFilter === 'ALL') return true;
    if (voucherFilter === 'INVOICE') return r.voucherType.includes('Sales Invoice');
    if (voucherFilter === 'RECEIPT') return r.voucherType.includes('Receipt');
    if (voucherFilter === 'PREPAYMENT') return r.voucherType.includes('Prepayment');
    if (voucherFilter === 'EXPENSE') return r.voucherType.includes('Payment');
    if (voucherFilter === 'BILL') return r.voucherType.includes('Purchase');
    if (voucherFilter === 'CREDIT_NOTE') return r.voucherType.includes('Credit Note');
    if (voucherFilter === 'DEBIT_NOTE') return r.voucherType.includes('Debit Note');
    if (voucherFilter === 'JOURNAL') return r.voucherType.includes('Journal');
    return true;
  });

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(selectedDate + 'T00:00:00Z'));

  const exportCSV = () => {
    if (!data?.records) return;
    const headers = ['Date', 'Voucher Type', 'Voucher No', 'Party Name', 'Debit (INR)', 'Credit (INR)', 'Status'];
    const rows = filteredRecords.map((r: any) => [
      r.date,
      `"${r.voucherType}"`,
      `"${r.voucherNo}"`,
      `"${r.partyName.replace(/"/g, '""')}"`,
      r.debitAmount.toFixed(2),
      r.creditAmount.toFixed(2),
      r.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `day-book-${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col gap-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white uppercase">Day Book</h1>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                TALLY JOURNAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily chronological audit of all vouchers, receipts, prepayments & payments.
            </p>
          </div>
        </div>

        {/* Date Selector & Action Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker Bar */}
          <div className="flex items-center bg-slate-900/80 border border-slate-700/80 rounded-2xl p-1 shadow-inner">
            <button
              onClick={handlePrevDay}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2 px-3">
              <Calendar size={16} className="text-indigo-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={() => setDetailedView(!detailedView)}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold border transition-all ${
              detailedView 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {detailedView ? <Eye size={14} /> : <EyeOff size={14} />}
            {detailedView ? 'Detailed View (F12)' : 'Condensed View'}
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xl text-xs font-bold transition-colors"
          >
            <Download size={14} />
            CSV
          </button>

          <button
            onClick={() => fetchDayBook(selectedDate)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xl transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Opening Balance */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Opening Balance</span>
            <Layers size={16} className="text-slate-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-100 font-mono">
              ₹{(data?.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Cash & Bank balance at 00:00</p>
          </div>
        </div>

        {/* Total Debits (Inflow / AR) */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Debits (Inflow)</span>
            <ArrowDownLeft size={18} className="text-emerald-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-400 font-mono">
              ₹{(data?.summary?.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Sales, Receipts & Prepayments</p>
          </div>
        </div>

        {/* Total Credits (Outflow / Expenses) */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Credits (Outflow)</span>
            <ArrowUpRight size={18} className="text-rose-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-400 font-mono">
              ₹{(data?.summary?.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Expenses, Vendor Bills & Payouts</p>
          </div>
        </div>

        {/* Closing Balance */}
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-300">
            <span className="text-xs font-bold uppercase tracking-wider">Closing Balance</span>
            <CheckCircle2 size={18} className="text-indigo-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-indigo-300 font-mono">
              ₹{(data?.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-indigo-400/70 mt-1">Estimated Net position at 23:59</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'ALL', label: 'All Vouchers' },
          { id: 'INVOICE', label: 'Sales Invoices' },
          { id: 'RECEIPT', label: 'Receipts' },
          { id: 'PREPAYMENT', label: 'Prepayments' },
          { id: 'EXPENSE', label: 'Expenses' },
          { id: 'BILL', label: 'Vendor Bills' },
          { id: 'CREDIT_NOTE', label: 'Credit Notes' },
          { id: 'DEBIT_NOTE', label: 'Debit Notes' },
          { id: 'JOURNAL', label: 'Journals' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setVoucherFilter(tab.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              voucherFilter === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-500'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:bg-slate-700/80 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Day Book Table */}
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Journal Entries for {formattedDate}
            </h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-700/50 border border-slate-600/50 px-2 py-0.5 rounded-full">
              {filteredRecords.length} Vouchers
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-900/60 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Voucher Type</th>
                <th className="px-6 py-4">Voucher No</th>
                <th className="px-6 py-4">Particulars / Party</th>
                <th className="px-6 py-4 text-right">Debit (₹)</th>
                <th className="px-6 py-4 text-right">Credit (₹)</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin inline mb-2 text-indigo-400" />
                    <p className="font-bold">Loading Day Book records...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <AlertCircle size={28} className="inline mb-2 text-slate-600" />
                    <p className="font-bold text-sm text-slate-400">No vouchers recorded on {formattedDate}</p>
                    <p className="text-xs text-slate-500 mt-1">Try selecting another date or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record: any, idx: number) => {
                  const isSales = record.voucherType.includes('Sales Invoice');
                  const isReceipt = record.voucherType.includes('Receipt');
                  const isPrepayment = record.voucherType.includes('Prepayment');
                  const isExpense = record.voucherType.includes('Payment');
                  const isBill = record.voucherType.includes('Purchase');

                  return (
                    <React.Fragment key={`${record.id}-${idx}`}>
                      <tr className={`hover:bg-slate-700/30 transition-colors ${record.isVoid ? 'opacity-40 bg-rose-950/10' : ''}`}>
                        <td className="px-6 py-4 font-mono font-medium text-slate-300 whitespace-nowrap">
                          {record.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                            isSales ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                            isReceipt ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            isPrepayment ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' :
                            isExpense ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            isBill ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            'bg-slate-700 text-slate-300 border-slate-600'
                          }`}>
                            {record.voucherType}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-white whitespace-nowrap">
                          {record.voucherNo}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-200">
                          <p title={record.partyName}>{record.partyName}</p>
                          {record.notes && !detailedView && (
                            <p className="text-[10px] text-slate-400 font-normal italic truncate max-w-xs">{record.notes}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {record.debitAmount > 0 ? `₹${record.debitAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                          {record.creditAmount > 0 ? `₹${record.creditAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {record.link ? (
                            <Link
                              href={record.link}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-700/60 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-600/60 hover:border-indigo-500 text-[10px] font-bold uppercase transition-all shadow-sm"
                            >
                              View <ArrowUpRight size={12} />
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>

                      {/* Tally Detailed View Breakdown */}
                      {detailedView && (
                        <tr className="bg-slate-900/40 border-b border-slate-700/40">
                          <td colSpan={7} className="px-8 py-3 bg-slate-900/30 text-slate-300 text-xs">
                            <div className="flex flex-col gap-2 pl-4 border-l-2 border-indigo-500/50">
                              {/* Line items if any */}
                              {record.items && record.items.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Line Items:</span>
                                  <div className="mt-1 space-y-1">
                                    {record.items.map((it: any, i: number) => (
                                      <div key={i} className="flex justify-between items-center text-[11px] font-mono bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/30">
                                        <span className="font-semibold text-slate-200">
                                          {it.description} {it.width > 0 && `(${it.width} FT x ${it.length} FT)`}
                                        </span>
                                        <span className="text-slate-400">
                                          Qty: {it.quantity} &times; ₹{it.unitPrice?.toFixed(2)} = <strong className="text-slate-200">₹{it.amount?.toFixed(2)}</strong>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Tax breakdown */}
                              {record.taxDetails && (record.taxDetails.cgst > 0 || record.taxDetails.sgst > 0 || record.taxDetails.igst > 0) && (
                                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                                  <span>GST Breakdown:</span>
                                  {record.taxDetails.cgst > 0 && <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">CGST: ₹{record.taxDetails.cgst.toFixed(2)}</span>}
                                  {record.taxDetails.sgst > 0 && <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">SGST: ₹{record.taxDetails.sgst.toFixed(2)}</span>}
                                  {record.taxDetails.igst > 0 && <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">IGST: ₹{record.taxDetails.igst.toFixed(2)}</span>}
                                </div>
                              )}

                              {/* Narration */}
                              {record.notes && (
                                <div className="text-[11px] text-slate-400 italic">
                                  <strong className="not-italic text-slate-300 font-mono uppercase text-[9px] mr-1">Memo/Notes:</strong>
                                  "{record.notes}"
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
