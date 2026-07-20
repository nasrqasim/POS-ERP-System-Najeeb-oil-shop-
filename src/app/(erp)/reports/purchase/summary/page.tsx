"use client";

import React, { useState, useEffect } from "react";
import ERPReportLayout from "@/components/erp/reports/ERPReportLayout";
import { Download, Printer, RotateCcw, ShoppingBag, RotateCcw as RotateLeft, TrendingUp, Percent, Scissors, Calculator, FileSpreadsheet } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

import { useMemo } from "react";

export default function PurchaseSummaryReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fromDate, setFromDate] = useState("2026-06-10");
  const [toDate, setToDate] = useState("2026-07-16");

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/purchases');
        const json = await res.json();
        if (json.ok && json.data) {
          const transformed = json.data.map((p: any) => ({
            id: p._id,
            date: new Date(p.date).toLocaleDateString(),
            rawDate: new Date(p.date),
            docNo: p.invoiceNo || p.docNo || "N/A",
            badge: p.type === 'purchase_return' ? 'PR' : p.type === 'purchase_order' ? 'PO' : 'PI',
            vendorInv: p.reference || "-",
            vendor: p.partyId?.name || p.partyId?.companyName || "-",
            job: p.jobId?.name || "-",
            emp: p.employeeId?.name || "-",
            gross: p.subTotal || 0,
            discount: p.discountAmount || 0,
            gst: p.taxAmount || 0,
            wht: p.whtAmount || 0,
            net: p.totalAmount || 0,
            status: p.status || "Posted",
            statusColor: "text-emerald-600 bg-emerald-50",
            badgeColor: p.type === 'purchase_return' ? "text-rose-600 bg-rose-50 border-rose-200" : "text-blue-600 bg-blue-50 border-blue-200"
          }));
          setData(transformed);
        }
      } catch (error) {
        console.error("Error fetching purchase summary:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (!d.rawDate) return true;
      const dDate = new Date(d.rawDate);
      if (fromDate) {
        const start = new Date(fromDate);
        if (dDate < start) return false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (dDate > end) return false;
      }
      return true;
    });
  }, [data, fromDate, toDate]);

  const totalPurchases = filteredData.filter(d => d.badge !== 'PR').reduce((acc, curr) => acc + curr.net, 0);
  const totalReturns = filteredData.filter(d => d.badge === 'PR').reduce((acc, curr) => acc + curr.net, 0);
  const totalGst = filteredData.reduce((acc, curr) => acc + curr.gst, 0);
  const totalWht = filteredData.reduce((acc, curr) => acc + curr.wht, 0);

  const stats = [
    { title: "TOTAL PURCHASES", value: `Rs. ${totalPurchases.toLocaleString()}`, subtitle: `${filteredData.filter(d => d.badge !== 'PR').length} invoices`, icon: ShoppingBag, iconColor: "text-rose-600", iconBg: "bg-rose-50" },
    { title: "TOTAL RETURNS", value: `Rs. ${totalReturns.toLocaleString()}`, subtitle: `${filteredData.filter(d => d.badge === 'PR').length} returns`, icon: RotateLeft, iconColor: "text-amber-600", iconBg: "bg-amber-50" },
    { title: "NET PURCHASES", value: `Rs. ${(totalPurchases - totalReturns).toLocaleString()}`, subtitle: "PI - PR", icon: TrendingUp, iconColor: "text-emerald-600", iconBg: "bg-emerald-50", valueColor: "text-emerald-600" },
    { title: "TOTAL GST", value: `Rs. ${totalGst.toLocaleString()}`, subtitle: "Input tax", icon: Percent, iconColor: "text-blue-600", iconBg: "bg-blue-50" },
    { title: "TOTAL WHT DEDUCTED", value: `Rs. ${totalWht.toLocaleString()}`, subtitle: "Withholding tax", icon: Scissors, iconColor: "text-purple-600", iconBg: "bg-purple-50" },
    { title: "AVG PURCHASE VALUE", value: `Rs. ${filteredData.length > 0 ? (totalPurchases / filteredData.length).toFixed(0) : 0}`, subtitle: "Per invoice", icon: Calculator, iconColor: "text-slate-600 dark:text-slate-300", iconBg: "bg-slate-50 dark:bg-slate-800/50" },
  ];

  const Filters = (
    <div className="flex flex-col md:flex-row justify-between items-end gap-4 w-full">
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3 w-full">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Financial Year</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>Financial Year 2025-26...</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date From</label>
          <input type="date" className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date To</label>
          <input type="date" className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Vendors</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Job / Project</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Jobs</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Employees</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tax Filter</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>Both (Tax + Non-Tax)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Group By</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>Monthly</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 flex items-center justify-center">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );


  const lineData = Object.entries(data.reduce((acc: any, curr) => {
    const month = curr.date.split('/').slice(1).join('/'); // Simple month grouping
    if (!acc[month]) acc[month] = { name: month, purchases: 0, returns: 0 };
    if (curr.badge === 'PR') acc[month].returns += curr.net;
    else acc[month].purchases += curr.net;
    return acc;
  }, {})).map(([_, v]) => v);

  const barData = Object.entries(data.reduce((acc: any, curr) => {
    if (!acc[curr.vendor]) acc[curr.vendor] = { name: curr.vendor, value: 0 };
    acc[curr.vendor].value += curr.net;
    return acc;
  }, {})).map(([_, v]) => v).sort((a: any, b: any) => b.value - a.value).slice(0, 10);

  const pieData = barData.map((d: any, idx) => ({
    name: d.name,
    value: d.value,
    color: ['#881337', '#be123c', '#e11d48', '#fb7185', '#fda4af'][idx % 5]
  }));

  return (
    <ERPReportLayout
      title="Purchase Summary"
      description="Reports / Purchase Reports / Purchase Summary"
      stats={stats}
      filters={Filters}
      actions={[
        { label: "Print Summary", onClick: printPage, icon: Printer },
        { label: "Export Excel", onClick: () => exportToExcel(data, "PurchaseSummary.xlsx"), icon: FileSpreadsheet },
      ]}
    >
      <div className="space-y-6">
        <div className="px-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Purchase Transactions</h3>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-bold">{data.length} records</span>
          </div>
          <table className="w-full text-left border-collapse border-b border-slate-200 dark:border-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Doc #</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor Invoice</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Job</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Gross Amount</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Discount</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">GST</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">WHT</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Net Amount</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/50 transition-colors">
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{row.date}</td>
                  <td className="px-4 py-3 text-[11px] font-bold text-maroon-800 cursor-pointer hover:underline flex items-center gap-1.5">
                    {row.docNo}
                    <span className={`px-1 py-0.5 text-[8px] font-black border rounded ${row.badgeColor}`}>{row.badge}</span>
                  </td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{row.vendorInv}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{row.vendor}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{row.job}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{row.emp}</td>
                  <td className="px-4 py-3 text-[11px] font-black text-slate-800 dark:text-slate-100 text-right">{row.gross.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right">{row.discount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right">{row.gst.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right">{row.wht.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] font-black text-slate-800 dark:text-slate-100 text-right">{row.net.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${row.statusColor}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-800/50 font-black">
                <td colSpan={6} className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-slate-800 dark:text-slate-100">TOTAL ({data.length} records)</td>
                <td className="px-4 py-3 text-[11px] text-right">{data.reduce((s, r) => s + r.gross, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px] text-right">{data.reduce((s, r) => s + r.discount, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px] text-right">{data.reduce((s, r) => s + r.gst, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px] text-right">{data.reduce((s, r) => s + r.wht, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px] text-right">{data.reduce((s, r) => s + r.net, 0).toLocaleString()}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:col-span-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-6">Purchase Trend (Monthly)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 10}} />
                  <YAxis tick={{fontSize: 10}} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#881337" strokeWidth={2} dot={{ fill: '#881337', r: 4 }} />
                  <Line type="monotone" dataKey="returns" name="Returns" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-6">Top 10 Vendors by Purchase Amount</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{fontSize: 10}} />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={60} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#881337" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-6">Purchase Distribution by Vendor</h3>
            <div className="h-64 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </ERPReportLayout>
  );
}
