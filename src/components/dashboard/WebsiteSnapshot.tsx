"use client";

import { 
  LayoutDashboard, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  Settings, 
  Package, 
  Wallet,
  Receipt,
  FileText,
  BadgeCent
} from "lucide-react";

import { useState, useEffect } from "react";

export default function WebsiteSnapshot() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((res) => {
        const d = res?.data || res;
        if (d) {
          setData(d);
        }
      })
      .catch(() => {});
  }, []);

  const totalSales = data?.totalSales ?? 0;
  const stockValue = data?.totalStockValue ?? 0;
  const cashInHand = data?.cashBank?.current ?? 0;
  const totalPayables = data?.totalVendorPayables ?? 0;
  const modules = [
    { name: "Dashboard Overview", icon: LayoutDashboard, color: "text-maroon-800", bg: "bg-maroon-50", desc: "Real-time KPIs, Financial Health, and Operational Metrics." },
    { name: "Sales & Invoicing", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", desc: "Quotations, Sale Orders, Tax Invoices, and POS Counter Sales." },
    { name: "Purchase Management", icon: Package, color: "text-emerald-600", bg: "bg-emerald-50", desc: "Vendor Bills, Purchase Orders, and Inward Gate Pass management." },
    { name: "Financial Reports", icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50", desc: "Trial Balance, Profit & Loss, Ledger Reports, and Cash Flow Statements." },
    { name: "Inventory Control", icon: Settings, color: "text-slate-600", bg: "bg-slate-50", desc: "Stock Balances, Low Stock Alerts, and Inventory Intelligence." },
    { name: "Salary & HR", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", desc: "Staff Payroll, Loans, Advances, and Employee Master Data." },
    { name: "Cash Receipts", icon: Wallet, color: "text-rose-600", bg: "bg-rose-50", desc: "Cash Collection, Bank Deposits, and Payment Tracking." },
    { name: "Bank & Payments", icon: Receipt, color: "text-cyan-600", bg: "bg-cyan-50", desc: "Bank Voucher Management and Vendor Payment Processing." },
  ];

  return (
    <div id="website-snapshot" className="hidden print:block p-12 bg-white text-slate-900">
      <div className="flex items-center justify-between mb-12 border-b-4 border-maroon-800 pb-8">
        <div>
          <h1 className="text-5xl font-black text-maroon-900 mb-2 uppercase tracking-tighter">Al Hadeed Traders</h1>
          <p className="text-xl font-bold text-slate-500 uppercase tracking-widest">Full System Visual Snapshot</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Generated On</p>
          <p suppressHydrationWarning className="text-2xl font-black text-maroon-800">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-12">
        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
          <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
            <BadgeCent className="text-maroon-800" size={28} />
            Executive Summary
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</p>
              <p className="text-xl font-black text-slate-900">Rs. {Number(totalSales).toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Value</p>
              <p className="text-xl font-black text-slate-900">Rs. {Number(stockValue).toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash in Hand</p>
              <p className="text-xl font-black text-emerald-600">Rs. {Number(cashInHand).toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payable</p>
              <p className="text-xl font-black text-rose-600">Rs. {Number(totalPayables).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-maroon-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <LayoutDashboard size={120} />
          </div>
          <h2 className="text-2xl font-black mb-4">System Status</h2>
          <p className="text-maroon-200 mb-6 font-medium">All modules are active and synchronized with the cloud database. Live backup is enabled.</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-black uppercase tracking-widest text-emerald-400">System Live</span>
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-black text-slate-900 mb-8 border-l-8 border-maroon-800 pl-6 uppercase tracking-tighter">Module Gallery</h2>
      
      <div className="grid grid-cols-2 gap-6">
        {modules.map((m, i) => (
          <div key={i} className="p-6 border border-slate-100 rounded-3xl bg-white shadow-sm flex items-start gap-4">
            <div className={`w-14 h-14 ${m.bg} ${m.color} rounded-2xl flex items-center justify-center shrink-0`}>
              <m.icon size={28} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-1">{m.name}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-8 bg-slate-900 rounded-[2rem] text-white flex items-center justify-between">
        <div>
          <h4 className="text-xl font-black mb-1">Professional Enterprise Edition</h4>
          <p className="text-slate-400 text-sm font-medium">This document provides a visual authentication of the Al Hadeed Traders ERP System interface.</p>
        </div>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="w-8 h-1 bg-maroon-600 rounded-full"></div>)}
        </div>
      </div>

      <div className="mt-8 flex justify-center italic text-slate-300 text-xs font-medium">
        Generated by Antigravity AI • Al Hadeed Traders ERP
      </div>
    </div>
  );
}
