"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Printer, Search, RefreshCw, Filter } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PayablesPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cashPayments, setCashPayments] = useState<any[]>([]);
  const [bankPayments, setBankPayments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "monthly" | "yearly" | "overall">("overall");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const todayDate = new Date();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [partiesRes, purchasesRes, cashRes, bankRes, empRes, regRes] = await Promise.all([
        fetch("/api/parties"),
        fetch("/api/invoices?type=purchase"), // Wait, fetch purchase invoices
        fetch("/api/cash-payments"),
        fetch("/api/bank-payments"),
        fetch("/api/employees"),
        fetch("/api/regions")
      ]);

      const [partiesJson, purchasesJson, cashJson, bankJson, empJson, regJson] = await Promise.all([
        partiesRes.json(),
        purchasesRes.json(),
        cashRes.json(),
        bankRes.json(),
        empRes.json(),
        regRes.json()
      ]);

      if (partiesJson.ok) setVendors(partiesJson.data.filter((p: any) => p.type === "Vendor"));
      
      // We will also fetch purchase returns if they exist, or we can filter from all invoices
      // Wait, let's load all invoices of type purchase, non_tax_purchase, import_purchase, purchase_return, non_tax_purchase_return
      const allInvoicesRes = await fetch("/api/invoices");
      const allInvoicesJson = await allInvoicesRes.json();
      if (allInvoicesJson.ok) {
        setInvoices(allInvoicesJson.data.filter((i: any) => 
          ["purchase", "non_tax_purchase", "import_purchase", "purchase_return", "non_tax_purchase_return"].includes(i.type)
        ));
      }

      if (cashJson.ok) setCashPayments(cashJson.data);
      if (bankJson.ok) setBankPayments(bankJson.data);
      if (empJson.ok) setEmployees(empJson.data);
      if (regJson.ok) setRegions(regJson.data);

    } catch (e) {
      console.error("Error loading payables data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Define Date range for filters
  const dateRange = useMemo(() => {
    let start = new Date(0);
    let end = new Date("2100-01-01");

    if (selectedPeriod === "daily") {
      start = new Date(todayDate); start.setHours(0,0,0,0);
      end = new Date(todayDate); end.setHours(23,59,59,999);
    } else if (selectedPeriod === "monthly") {
      start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1, 0,0,0,0);
      end = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0, 23,59,59,999);
    } else if (selectedPeriod === "yearly") {
      start = new Date(todayDate.getFullYear(), 0, 1, 0,0,0,0);
      end = new Date(todayDate.getFullYear(), 11, 31, 23,59,59,999);
    }

    return { start, end };
  }, [selectedPeriod]);

  // Compute Period Metrics helper
  const getPeriodPayables = (start: Date, end: Date) => {
    let opening = 0;
    let purchases = 0;
    let payments = 0;

    vendors.forEach(vend => {
      const initialOpening = Number(vend.openingBalance) || 0;
      let beforePurchases = 0;
      let beforePayments = 0;
      let periodPurchases = 0;
      let periodPayments = 0;

      // Invoices
      invoices.forEach(inv => {
        if (inv.partyId?._id === vend._id || inv.partyId === vend._id) {
          const invDate = new Date(inv.date || inv.createdAt);
          const isPurchase = ["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type);
          const isReturn = ["purchase_return", "non_tax_purchase_return"].includes(inv.type);

          if (invDate.getTime() < start.getTime()) {
            if (isPurchase) beforePurchases += inv.totalAmount || 0;
            if (isReturn) beforePayments += inv.totalAmount || 0;
          } else if (invDate.getTime() <= end.getTime()) {
            if (isPurchase) periodPurchases += inv.totalAmount || 0;
            if (isReturn) periodPayments += inv.totalAmount || 0;
          }
        }
      });

      // Cash Payments
      cashPayments.forEach(cp => {
        const match = cp.partyId?._id === vend._id || cp.partyId === vend._id || cp.vendor === vend._id || cp.vendor === vend.name;
        if (match && cp.status !== "Cancelled") {
          const cpDate = new Date(cp.date || cp.createdAt);
          if (cpDate.getTime() < start.getTime()) {
            beforePayments += cp.amount || 0;
          } else if (cpDate.getTime() <= end.getTime()) {
            periodPayments += cp.amount || 0;
          }
        }
      });

      // Bank Payments
      bankPayments.forEach(bp => {
        const match = bp.vendor === vend._id || bp.vendor === vend.name;
        if (match && bp.status !== "Cancelled") {
          const bpDate = new Date(bp.date || bp.createdAt);
          if (bpDate.getTime() < start.getTime()) {
            beforePayments += bp.amount || 0;
          } else if (bpDate.getTime() <= end.getTime()) {
            periodPayments += bp.amount || 0;
          }
        }
      });

      opening += (initialOpening + beforePurchases - beforePayments);
      purchases += periodPurchases;
      payments += periodPayments;
    });

    return { opening, purchases, payments, current: opening + purchases - payments };
  };

  // Top summary widgets
  const summaries = useMemo(() => {
    const daily = getPeriodPayables(new Date(todayDate.setHours(0,0,0,0)), new Date(todayDate.setHours(23,59,59,999)));
    const monthly = getPeriodPayables(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1), new Date(todayDate.getFullYear(), todayDate.getMonth()+1, 0, 23,59,59));
    const yearly = getPeriodPayables(new Date(todayDate.getFullYear(), 0, 1), new Date(todayDate.getFullYear(), 11, 31, 23,59,59));
    const overall = getPeriodPayables(new Date(0), new Date("2100-01-01"));
    return { daily, monthly, yearly, overall };
  }, [vendors, invoices, cashPayments, bankPayments]);

  // Compute detailed Vendor Payables Table Rows
  const rows = useMemo(() => {
    const now = new Date();
    
    return vendors.map(vend => {
      const initialOpening = Number(vend.openingBalance) || 0;
      let beforePurchases = 0;
      let beforePayments = 0;
      let periodPurchases = 0;
      let periodPayments = 0;

      let hasBuyerMatch = false;
      const unpaidInvoices: any[] = [];

      invoices.forEach(inv => {
        if (inv.partyId?._id === vend._id || inv.partyId === vend._id) {
          const invDate = new Date(inv.date || inv.createdAt);
          const isPurchase = ["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type);
          const isReturn = ["purchase_return", "non_tax_purchase_return"].includes(inv.type);

          if (isPurchase) {
            // Check buyer filter
            if (selectedBuyer && (inv.employeeId?._id === selectedBuyer || inv.employeeId === selectedBuyer)) {
              hasBuyerMatch = true;
            }
            
            // Check outstanding balance for aging
            const outstanding = (inv.totalAmount || 0) - (inv.amountReceived || 0);
            if (outstanding > 0) {
              unpaidInvoices.push({ date: invDate, amount: outstanding });
            }
          }

          if (invDate.getTime() < dateRange.start.getTime()) {
            if (isPurchase) beforePurchases += inv.totalAmount || 0;
            if (isReturn) beforePayments += inv.totalAmount || 0;
          } else if (invDate.getTime() <= dateRange.end.getTime()) {
            if (isPurchase) periodPurchases += inv.totalAmount || 0;
            if (isReturn) periodPayments += inv.totalAmount || 0;
          }
        }
      });

      // Cash Payments
      cashPayments.forEach(cp => {
        const match = cp.partyId?._id === vend._id || cp.partyId === vend._id || cp.vendor === vend._id || cp.vendor === vend.name;
        if (match && cp.status !== "Cancelled") {
          const cpDate = new Date(cp.date || cp.createdAt);
          if (cpDate.getTime() < dateRange.start.getTime()) {
            beforePayments += cp.amount || 0;
          } else if (cpDate.getTime() <= dateRange.end.getTime()) {
            periodPayments += cp.amount || 0;
          }
        }
      });

      // Bank Payments
      bankPayments.forEach(bp => {
        const match = bp.vendor === vend._id || bp.vendor === vend.name;
        if (match && bp.status !== "Cancelled") {
          const bpDate = new Date(bp.date || bp.createdAt);
          if (bpDate.getTime() < dateRange.start.getTime()) {
            beforePayments += bp.amount || 0;
          } else if (bpDate.getTime() <= dateRange.end.getTime()) {
            periodPayments += bp.amount || 0;
          }
        }
      });

      const opening = initialOpening + beforePurchases - beforePayments;
      const purchases = periodPurchases;
      const payments = periodPayments;
      const current = opening + purchases - payments;

      // Calculate Aging Buckets
      let currentBucket = 0;
      let bucket1_30 = 0;
      let bucket31_60 = 0;
      let bucket61_90 = 0;
      let bucket90Plus = 0;
      let maxDays = 0;

      unpaidInvoices.forEach(inv => {
        const daysOut = Math.floor((now.getTime() - inv.date.getTime()) / (1000 * 3600 * 24));
        if (daysOut > maxDays) maxDays = daysOut;

        if (daysOut <= 0) currentBucket += inv.amount;
        else if (daysOut <= 30) bucket1_30 += inv.amount;
        else if (daysOut <= 60) bucket31_60 += inv.amount;
        else if (daysOut <= 90) bucket61_90 += inv.amount;
        else bucket90Plus += inv.amount;
      });

      // Add vendor opening balance to 90+ days if positive (receivable/payable depending on balance nature)
      if (opening > 0 && unpaidInvoices.length === 0) {
        bucket90Plus += opening;
      }

      let ageStr = "Current";
      if (maxDays > 90) ageStr = "90+ Days";
      else if (maxDays > 60) ageStr = "61-90 Days";
      else if (maxDays > 30) ageStr = "31-60 Days";
      else if (maxDays > 0) ageStr = "1-30 Days";

      return {
        _id: vend._id,
        name: vend.companyName || vend.name,
        region: vend.region || "",
        status: vend.status || "Active",
        hasBuyerMatch,
        opening,
        purchases,
        payments,
        current,
        age: ageStr,
        maxDays,
        agingBreakdown: {
          current: currentBucket,
          b1_30: bucket1_30,
          b31_60: bucket31_60,
          b61_90: bucket61_90,
          b90Plus: bucket90Plus
        }
      };
    });
  }, [vendors, invoices, cashPayments, bankPayments, dateRange, selectedBuyer]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const q = searchQuery.toLowerCase();
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (selectedVendor && r._id !== selectedVendor) return false;
      if (selectedRegion && r.region !== selectedRegion) return false;
      if (selectedBuyer && !r.hasBuyerMatch) return false;
      return true;
    });
  }, [rows, searchQuery, selectedVendor, selectedRegion, selectedBuyer]);

  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-24 font-sans">
      {/* Back Header */}
      <div className="flex justify-between items-center no-print">
        <Link 
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-700 dark:text-white rounded-xl text-sm font-black transition-all"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-2.5 bg-maroon-800 hover:bg-maroon-900 text-white rounded-xl text-sm font-black shadow-xl shadow-maroon-900/20 transition-all"
        >
          <Printer size={18} />
          Print Report
        </button>
      </div>

      {/* Main Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Vendor Payable Analysis</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time outstanding vendor payables & aging report</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today Payables", value: summaries.daily.current, text: "text-emerald-600 border-emerald-500" },
          { label: "Monthly Payables", value: summaries.monthly.current, text: "text-blue-600 border-blue-500" },
          { label: "Yearly Payables", value: summaries.yearly.current, text: "text-orange-650 border-orange-500" },
          { label: "Overall Payables", value: summaries.overall.current, text: "text-maroon-800 border-maroon-500" }
        ].map((card, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm border-l-4 ${card.text.split(" ")[1]}`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">PKR {fmt(card.value)}</h3>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 no-print">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className="text-maroon-850"><polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'/></svg>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filter Options</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Period Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Filter</label>
            <select 
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
            >
              <option value="overall">Overall (All-time)</option>
              <option value="daily">Daily (Today)</option>
              <option value="monthly">Monthly (This Month)</option>
              <option value="yearly">Yearly (This Year)</option>
            </select>
          </div>

          {/* Vendor filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</label>
            <select 
              value={selectedVendor}
              onChange={e => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
            >
              <option value="">-- All Vendors --</option>
              {vendors.map(v => <option key={v._id} value={v._id}>{v.companyName || v.name}</option>)}
            </select>
          </div>

          {/* Region filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Region</label>
            <select 
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
            >
              <option value="">-- All Regions --</option>
              {regions.map((reg, idx) => <option key={idx} value={reg.name || reg}>{reg.name || reg}</option>)}
            </select>
          </div>

          {/* Buyer filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyer</label>
            <select 
              value={selectedBuyer}
              onChange={e => setSelectedBuyer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
            >
              <option value="">-- All Buyers --</option>
              {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
            </select>
          </div>

          {/* Search bar */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search Vendor</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm min-h-[350px]">
        {loading ? (
          <div className="py-24 text-center text-slate-400">
            <RefreshCw size={36} className="animate-spin text-maroon-850 mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Compiling payables ledger...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                  <th className="px-4 py-3.5">Vendor Name</th>
                  <th className="px-4 py-3.5 text-right">Opening Balance</th>
                  <th className="px-4 py-3.5 text-right">Purchases (Credits)</th>
                  <th className="px-4 py-3.5 text-right">Payments (Debits)</th>
                  <th className="px-4 py-3.5 text-right">Current Balance</th>
                  <th className="px-4 py-3.5 text-right">Current</th>
                  <th className="px-4 py-3.5 text-right">1-30 Days</th>
                  <th className="px-4 py-3.5 text-right">31-60 Days</th>
                  <th className="px-4 py-3.5 text-right">61-90 Days</th>
                  <th className="px-4 py-3.5 text-right">90+ Days</th>
                  <th className="px-4 py-3.5 text-center">Age</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300">
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3.5 text-blue-650 font-extrabold">
                        <Link href={`/maintain/vendors?vendorId=${row._id}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right">PKR {fmt(Math.abs(row.opening))}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600">+PKR {fmt(row.purchases)}</td>
                      <td className="px-4 py-3.5 text-right text-rose-600">-PKR {fmt(row.payments)}</td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">
                        <Link href={`/maintain/vendors?vendorId=${row._id}&tab=outstanding`} className="hover:underline text-maroon-800 dark:text-maroon-400">
                          PKR {fmt(row.current)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-500">PKR {fmt(row.agingBreakdown.current)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-500">PKR {fmt(row.agingBreakdown.b1_30)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-500">PKR {fmt(row.agingBreakdown.b31_60)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-500">PKR {fmt(row.agingBreakdown.b61_90)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-500 font-extrabold">PKR {fmt(row.agingBreakdown.b90Plus)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                          row.maxDays > 60 ? "bg-red-50 text-red-600" : row.maxDays > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                        }`}>
                          {row.age}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          row.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-400 font-bold italic uppercase tracking-wider">
                      No vendors match this filter criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
