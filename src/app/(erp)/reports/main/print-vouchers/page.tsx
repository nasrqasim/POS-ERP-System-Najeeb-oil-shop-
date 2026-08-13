"use client";

import { useState, useEffect } from "react";
import ERPReportLayout from "@/components/erp/reports/ERPReportLayout";
import { Search, Download, FileText, ArrowDownLeft, ArrowUpRight, DollarSign, Eye, Printer, FileSpreadsheet } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";


export default function VouchersReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetching from multiple sources to show "vouchers"
        const [cp, cr, bp, br] = await Promise.all([
          fetch('/api/cash-payments').then(r => r.json()),
          fetch('/api/cash-receipts').then(r => r.json()),
          fetch('/api/bank-payments').then(r => r.json()),
          fetch('/api/bank-receipts').then(r => r.json()),
        ]);
        
        const combined = [
          ...(cp.data || []).map((v: any) => ({ ...v, type: v.type || "Cash Payment", isPayment: true })),
          ...(cr.data || []).map((v: any) => ({ ...v, type: v.type || "Cash Receipt", isReceipt: true })),
          ...(bp.data || []).map((v: any) => ({ ...v, type: v.type || "Bank Payment", isPayment: true })),
          ...(br.data || []).map((v: any) => ({ ...v, type: v.type || "Bank Receipt", isReceipt: true })),
        ].map(v => ({
          id: v._id,
          date: new Date(v.date || v.createdAt).toLocaleDateString(),
          docNo: v.voucherNo || v.docNo || "N/A",
          type: v.type,
          isPayment: Boolean(v.isPayment || (v.type && v.type.toLowerCase().includes("payment"))),
          isReceipt: Boolean(v.isReceipt || (v.type && v.type.toLowerCase().includes("receipt"))),
          party: v.partyId?.name || v.partyName || v.vendor || v.customer || "-",
          employee: v.employeeId?.name || "-",
          rawAmount: Number(v.amount) || 0,
          amount: `Rs. ${(Number(v.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          status: v.status || "Posted"
        }));

        if (combined.length > 0) setData(combined);
      } catch (error) {
        console.error("Error fetching vouchers:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalAmount = data.reduce((acc, curr) => acc + (curr.rawAmount || 0), 0);
  const totalPayments = data.filter(v => v.isPayment).reduce((acc, curr) => acc + (curr.rawAmount || 0), 0);
  const totalReceipts = data.filter(v => v.isReceipt).reduce((acc, curr) => acc + (curr.rawAmount || 0), 0);

  const stats = [
    { title: "Total Vouchers", value: data.length.toString(), icon: FileText, iconColor: "text-rose-600", iconBg: "bg-rose-50" },
    { title: "Total Payments", value: `Rs. ${totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: ArrowUpRight, iconColor: "text-rose-600", iconBg: "bg-rose-50", valueColor: "text-rose-600" },
    { title: "Total Receipts", value: `Rs. ${totalReceipts.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: ArrowDownLeft, iconColor: "text-blue-600", iconBg: "bg-blue-50", valueColor: "text-blue-600" },
    { title: "Net Amount", value: `Rs. ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
  ];

  const Filters = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Financial Year</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>Financial Year 2025-26 (Active)</option>
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">From Date</label>
          <input type="date" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">To Date</label>
          <input type="date" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Voucher Type</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Voucher Types</option>
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Status</option>
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tax Filter</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>Both (Tax + Non-Tax)</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input type="text" placeholder="Search by doc number, party name, remarks..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800/10 font-medium transition-all" />
        </div>
        <button onClick={() => exportToExcel(data, "Vouchers.csv")} className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5 shrink-0">
          <Download size={14} /> CSV
        </button>
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Posted': return 'bg-emerald-50 text-emerald-600';
      case 'Completed': return 'bg-emerald-50 text-emerald-600';
      case 'Received': return 'bg-blue-50 text-blue-600';
      case 'Paid': return 'bg-emerald-50 text-emerald-600';
      case 'Draft': return 'bg-amber-50 text-amber-600';
      default: return 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Cash Payment': return 'bg-rose-50 text-rose-600';
      case 'Purchase Order': return 'bg-blue-50 text-blue-600';
      case 'Journal Voucher': return 'bg-fuchsia-50 text-fuchsia-600';
      case 'Purchase Return': return 'bg-purple-50 text-purple-600';
      case 'Goods Receipt Note': return 'bg-indigo-50 text-indigo-600';
      case 'Purchase Invoice': return 'bg-blue-50 text-blue-600';
      case 'Non-Tax Purchase Invoice': return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
      case 'Opening Balance': return 'bg-pink-50 text-pink-600';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    }
  };

  return (
    <ERPReportLayout
      title="Vouchers"
      description="List and batch print financial vouchers with status tracking."
      stats={stats}
      filters={Filters}
      actions={[
        { label: "Print All", onClick: printPage, icon: Printer },
        { label: "Export Excel", onClick: () => exportToExcel(data, "Vouchers.xlsx"), icon: FileSpreadsheet },
      ]}
    >
      <div className="p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-4 py-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-300 text-maroon-800 focus:ring-maroon-800" /></th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Doc #</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Type</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Party</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Amount</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Status</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-4 text-center"><input type="checkbox" className="rounded border-slate-300 text-maroon-800 focus:ring-maroon-800" /></td>
                <td className="px-4 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">{row.date}</td>
                <td className="px-4 py-4 text-xs font-bold text-blue-600 cursor-pointer hover:underline">{row.docNo} <ArrowUpRight className="inline" size={10}/></td>
                <td className="px-4 py-4 text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTypeColor(row.type)}`}>{row.type}</span>
                </td>
                <td className="px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-200">{row.party}</td>
                <td className="px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-200">{row.employee}</td>
                <td className="px-4 py-4 text-xs font-black text-slate-800 dark:text-slate-100 text-right">{row.amount}</td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${getStatusColor(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors border border-slate-200 dark:border-slate-800">
                      <Eye size={14} />
                    </button>
                    <button className="p-1.5 text-white bg-maroon-800 hover:bg-maroon-900 rounded-md transition-colors">
                      <Printer size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ERPReportLayout>
  );
}
