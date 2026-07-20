"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Printer, Search, RefreshCw, Filter, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ReceivablesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cashReceipts, setCashReceipts] = useState<any[]>([]);
  const [bankReceipts, setBankReceipts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "monthly" | "yearly" | "overall">("overall");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesman, setSelectedSalesman] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const todayDate = new Date();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [partiesRes, salesRes, cashRes, bankRes, empRes, regRes] = await Promise.all([
        fetch("/api/parties"),
        fetch("/api/sales"),
        fetch("/api/cash-receipts"),
        fetch("/api/bank-receipts"),
        fetch("/api/employees"),
        fetch("/api/regions")
      ]);

      const [partiesJson, salesJson, cashJson, bankJson, empJson, regJson] = await Promise.all([
        partiesRes.json(),
        salesRes.json(),
        cashRes.json(),
        bankRes.json(),
        empRes.json(),
        regRes.json()
      ]);

      if (partiesJson.ok) setCustomers(partiesJson.data.filter((p: any) => p.type === "Customer"));
      if (salesJson.ok) setInvoices(salesJson.data);
      if (cashJson.ok) setCashReceipts(cashJson.data);
      if (bankJson.ok) setBankReceipts(bankJson.data);
      if (empJson.ok) setEmployees(empJson.data);
      if (regJson.ok) setRegions(regJson.data);

    } catch (e) {
      console.error("Error loading receivables data:", e);
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
  const getPeriodReceivables = (start: Date, end: Date) => {
    let opening = 0;
    let sales = 0;
    let receipts = 0;

    customers.forEach(cust => {
      // initial opening balance in DB is debit if positive
      const initialOpening = Number(cust.openingBalance) || 0;
      let beforeSales = 0;
      let beforeReceipts = 0;
      let periodSales = 0;
      let periodReceipts = 0;

      // Invoices
      invoices.forEach(inv => {
        if (inv.partyId?._id === cust._id || inv.partyId === cust._id) {
          const invDate = new Date(inv.date || inv.createdAt);
          const isSale = ["sale", "non_tax_sale", "pos", "challan"].includes(inv.type);
          const isReturn = ["sale_return", "non_tax_sale_return"].includes(inv.type);

          if (invDate.getTime() < start.getTime()) {
            if (isSale) beforeSales += inv.totalAmount || 0;
            if (isReturn) beforeReceipts += inv.totalAmount || 0;
          } else if (invDate.getTime() <= end.getTime()) {
            if (isSale) periodSales += inv.totalAmount || 0;
            if (isReturn) periodReceipts += inv.totalAmount || 0;
          }
        }
      });

      // Cash Receipts
      cashReceipts.forEach(cr => {
        if ((cr.partyId?._id === cust._id || cr.partyId === cust._id || cr.party === cust._id) && cr.status !== "Cancelled") {
          const crDate = new Date(cr.date || cr.createdAt);
          if (crDate.getTime() < start.getTime()) {
            beforeReceipts += cr.amount || 0;
          } else if (crDate.getTime() <= end.getTime()) {
            periodReceipts += cr.amount || 0;
          }
        }
      });

      // Bank Receipts
      bankReceipts.forEach(br => {
        if ((br.partyId?._id === cust._id || br.partyId === cust._id || br.party === cust._id) && br.status !== "Cancelled") {
          const brDate = new Date(br.date || br.createdAt);
          if (brDate.getTime() < start.getTime()) {
            beforeReceipts += br.amount || 0;
          } else if (brDate.getTime() <= end.getTime()) {
            periodReceipts += br.amount || 0;
          }
        }
      });

      opening += (initialOpening + beforeSales - beforeReceipts);
      sales += periodSales;
      receipts += periodReceipts;
    });

    return { opening, sales, receipts, current: opening + sales - receipts };
  };

  // Top summary widgets
  const summaries = useMemo(() => {
    const daily = getPeriodReceivables(new Date(todayDate.setHours(0,0,0,0)), new Date(todayDate.setHours(23,59,59,999)));
    const monthly = getPeriodReceivables(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1), new Date(todayDate.getFullYear(), todayDate.getMonth()+1, 0, 23,59,59));
    const yearly = getPeriodReceivables(new Date(todayDate.getFullYear(), 0, 1), new Date(todayDate.getFullYear(), 11, 31, 23,59,59));
    const overall = getPeriodReceivables(new Date(0), new Date("2100-01-01"));
    return { daily, monthly, yearly, overall };
  }, [customers, invoices, cashReceipts, bankReceipts]);

  // Compute detailed Customer Receivables Table Rows
  const rows = useMemo(() => {
    const now = new Date();
    
    return customers.map(cust => {
      // initial opening balance in DB is debit if positive
      const initialOpening = Number(cust.openingBalance) || 0;
      let beforeSales = 0;
      let beforeReceipts = 0;
      let periodSales = 0;
      let periodReceipts = 0;

      // Track invoices and salesman links
      let hasSalesmanMatch = false;
      const unpaidInvoices: any[] = [];

      invoices.forEach(inv => {
        if (inv.partyId?._id === cust._id || inv.partyId === cust._id) {
          const invDate = new Date(inv.date || inv.createdAt);
          const isSale = ["sale", "non_tax_sale", "pos", "challan"].includes(inv.type);
          const isReturn = ["sale_return", "non_tax_sale_return"].includes(inv.type);

          if (isSale) {
            // Check salesman filter
            if (selectedSalesman && (inv.employeeId?._id === selectedSalesman || inv.employeeId === selectedSalesman)) {
              hasSalesmanMatch = true;
            }
            
            // Check outstanding balance for aging
            const outstanding = (inv.totalAmount || 0) - (inv.amountReceived || 0);
            if (outstanding > 0) {
              unpaidInvoices.push({ date: invDate, amount: outstanding });
            }
          }

          if (invDate.getTime() < dateRange.start.getTime()) {
            if (isSale) beforeSales += inv.totalAmount || 0;
            if (isReturn) beforeReceipts += inv.totalAmount || 0;
          } else if (invDate.getTime() <= dateRange.end.getTime()) {
            if (isSale) periodSales += inv.totalAmount || 0;
            if (isReturn) periodReceipts += inv.totalAmount || 0;
          }
        }
      });

      // Cash Receipts
      cashReceipts.forEach(cr => {
        if ((cr.partyId?._id === cust._id || cr.partyId === cust._id || cr.party === cust._id) && cr.status !== "Cancelled") {
          const crDate = new Date(cr.date || cr.createdAt);
          if (crDate.getTime() < dateRange.start.getTime()) {
            beforeReceipts += cr.amount || 0;
          } else if (crDate.getTime() <= dateRange.end.getTime()) {
            periodReceipts += cr.amount || 0;
          }
        }
      });

      // Bank Receipts
      bankReceipts.forEach(br => {
        if ((br.partyId?._id === cust._id || br.partyId === cust._id || br.party === cust._id) && br.status !== "Cancelled") {
          const brDate = new Date(br.date || br.createdAt);
          if (brDate.getTime() < dateRange.start.getTime()) {
            beforeReceipts += br.amount || 0;
          } else if (brDate.getTime() <= dateRange.end.getTime()) {
            periodReceipts += br.amount || 0;
          }
        }
      });

      const opening = initialOpening + beforeSales - beforeReceipts;
      const sales = periodSales;
      const receipts = periodReceipts;
      const current = opening + sales - receipts;

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

      // Add customer opening balance to 90+ days if positive (receivable)
      if (opening > 0 && unpaidInvoices.length === 0) {
        bucket90Plus += opening;
      }

      let ageStr = "Current";
      if (maxDays > 90) ageStr = "90+ Days";
      else if (maxDays > 60) ageStr = "61-90 Days";
      else if (maxDays > 30) ageStr = "31-60 Days";
      else if (maxDays > 0) ageStr = "1-30 Days";

      return {
        _id: cust._id,
        name: cust.companyName || cust.name,
        region: cust.region || "",
        status: cust.status || "Active",
        hasSalesmanMatch,
        opening,
        sales,
        receipts,
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
  }, [customers, invoices, cashReceipts, bankReceipts, dateRange, selectedSalesman]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      // 1. Search Query
      const q = searchQuery.toLowerCase();
      if (q && !r.name.toLowerCase().includes(q)) return false;

      // 2. Customer Select Filter
      if (selectedCustomer && r._id !== selectedCustomer) return false;

      // 3. Region Filter
      if (selectedRegion && r.region !== selectedRegion) return false;

      // 4. Salesman Filter
      if (selectedSalesman && !r.hasSalesmanMatch) return false;

      return true;
    });
  }, [rows, searchQuery, selectedCustomer, selectedRegion, selectedSalesman]);

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
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Customer Receivable Analysis</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time outstanding customer balances & aging report</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today Receivables", value: summaries.daily.current, text: "text-emerald-600 border-emerald-500" },
          { label: "Monthly Receivables", value: summaries.monthly.current, text: "text-blue-600 border-blue-500" },
          { label: "Yearly Receivables", value: summaries.yearly.current, text: "text-orange-650 border-orange-500" },
          { label: "Overall Receivables", value: summaries.overall.current, text: "text-maroon-800 border-maroon-500" }
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
          <Filter size={16} className="text-maroon-800" />
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

          {/* Customer filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</label>
            <select 
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
            >
              <option value="">-- All Customers --</option>
              {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
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

          {/* Salesman filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salesman</label>
            <select 
              value={selectedSalesman}
              onChange={e => setSelectedSalesman(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
            >
              <option value="">-- All Salesmen --</option>
              {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
            </select>
          </div>

          {/* Search bar */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search Customer</label>
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
            <p className="text-xs font-black uppercase tracking-widest">Compiling receivables ledger...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                  <th className="px-4 py-3.5">Customer Name</th>
                  <th className="px-4 py-3.5 text-right">Opening Balance</th>
                  <th className="px-4 py-3.5 text-right">Sales (Debits)</th>
                  <th className="px-4 py-3.5 text-right">Receipts (Credits)</th>
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-305">
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3.5 text-blue-650 font-extrabold">
                        <Link href={`/maintain/customer-balances?customerId=${row._id}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right">PKR {fmt(Math.abs(row.opening))}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600">+PKR {fmt(row.sales)}</td>
                      <td className="px-4 py-3.5 text-right text-rose-600">-PKR {fmt(row.receipts)}</td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">
                        <Link href={`/maintain/customer-balances?customerId=${row._id}&tab=outstanding`} className="hover:underline text-maroon-800 dark:text-maroon-400">
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
                      No customers match this filter criteria
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
