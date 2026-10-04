"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { exportToExcel, printListDocument } from "@/lib/excel";

export default function PartyLedgerPage() {
  const [parties, setParties] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [dateRange, setDateRange] = useState("thisMonth");
  const [customFromDate, setCustomFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customToDate, setCustomToDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetch("/api/parties")
      .then(res => res.json())
      .then(json => {
        if (json.ok) setParties(json.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPartyId) {
      setLedgerData(null);
      return;
    }
    setLoadingLedger(true);
    fetch(`/api/reports/party-ledger?partyId=${selectedPartyId}`)
      .then(res => res.json())
      .then(json => {
        if (json.ok) setLedgerData(json.data);
      })
      .catch(console.error)
      .finally(() => setLoadingLedger(false));
  }, [selectedPartyId]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    let s = new Date(now);
    let e = new Date(now);

    if (dateRange === "today") {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
    } else if (dateRange === "yesterday") {
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      e.setDate(e.getDate() - 1);
      e.setHours(23, 59, 59, 999);
    } else if (dateRange === "thisMonth") {
      s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateRange === "all") {
      s = new Date(1970, 0, 1);
      e = new Date(2100, 0, 1);
    } else if (dateRange === "custom") {
      const f = customFromDate.split("-").map(Number);
      const t = customToDate.split("-").map(Number);
      s = new Date(f[0], f[1] - 1, f[2], 0, 0, 0, 0);
      e = new Date(t[0], t[1] - 1, t[2], 23, 59, 59, 999);
    }
    return { start: s, end: e };
  }, [dateRange, customFromDate, customToDate]);

  const { periodTransactions, periodOpening, periodClosing } = useMemo(() => {
    if (!ledgerData || !ledgerData.txs) return { periodTransactions: [], periodOpening: 0, periodClosing: 0 };
    
    let beforeDebit = 0;
    let beforeCredit = 0;
    const periodTxs: any[] = [];

    ledgerData.txs.forEach((tx: any) => {
      const d = new Date(tx.date).getTime();
      if (d < start.getTime()) {
        beforeDebit += (tx.debit || 0);
        beforeCredit += (tx.credit || 0);
      } else if (d >= start.getTime() && d <= end.getTime()) {
        periodTxs.push(tx);
      }
    });

    const isCustomer = ledgerData.party?.type === "Customer" || ledgerData.party?.type === "customer";
    
    // For customers: Nature is Debit. Open = initialOpen + Debits - Credits
    // For vendors: Nature is Credit. Open = initialOpen + Credits - Debits
    let periodOpen = 0;
    if (isCustomer) {
      periodOpen = ledgerData.opening + beforeDebit - beforeCredit;
    } else {
      periodOpen = ledgerData.opening + beforeCredit - beforeDebit;
    }
    
    let running = periodOpen;
    periodTxs.forEach((t: any) => {
      if (isCustomer) {
        running += (t.debit || 0) - (t.credit || 0);
      } else {
        running += (t.credit || 0) - (t.debit || 0);
      }
      t.periodRunning = running;
    });

    return { 
      periodTransactions: periodTxs, 
      periodOpening: periodOpen,
      periodClosing: running
    };
  }, [ledgerData, start, end]);

  const fmt = (n: number) => Math.abs(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const isCustomer = ledgerData?.party?.type?.toLowerCase() === "customer";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Party Ledger</h1>
          <p className="text-sm text-slate-500 font-medium">Detailed statement of accounts for Customer or Vendor</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Party</label>
          <select 
            value={selectedPartyId}
            onChange={e => setSelectedPartyId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Choose Customer or Vendor --</option>
            {parties.map(p => (
              <option key={p._id || p.id} value={p._id || p.id}>
                {p.companyName || p.name} ({p.type})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Period</label>
          <select 
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisMonth">This Month</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        {dateRange === "custom" && (
          <>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From</label>
              <input 
                type="date"
                value={customFromDate}
                onChange={e => setCustomFromDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To</label>
              <input 
                type="date"
                value={customToDate}
                onChange={e => setCustomToDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
              />
            </div>
          </>
        )}
      </div>

      {!selectedPartyId ? (
        <div className="py-20 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
          Please select a party to view their ledger.
        </div>
      ) : loadingLedger ? (
        <div className="py-20 text-center text-slate-400 text-sm font-bold animate-pulse">Loading Ledger Data...</div>
      ) : ledgerData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-850">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Period Opening Balance</h3>
              <p className={`text-3xl font-black ${periodOpening > 0 ? (isCustomer ? 'text-rose-600' : 'text-emerald-600') : periodOpening < 0 ? (isCustomer ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-900 dark:text-white'}`}>
                PKR {fmt(periodOpening)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                {periodOpening > 0 ? 'Receivable (Dr)' : periodOpening < 0 ? 'Payable (Cr)' : 'Settled'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-850">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Period Closing Balance</h3>
              <p className={`text-3xl font-black ${periodClosing > 0 ? (isCustomer ? 'text-rose-600' : 'text-emerald-600') : periodClosing < 0 ? (isCustomer ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-900 dark:text-white'}`}>
                PKR {fmt(periodClosing)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                {periodClosing > 0 ? 'Receivable (Dr)' : periodClosing < 0 ? 'Payable (Cr)' : 'Settled'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-black uppercase tracking-wider">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Voucher #</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Debit (+)</th>
                    <th className="px-4 py-3 text-right">Credit (-)</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300">
                  {periodTransactions.length > 0 ? (
                    periodTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-blue-600 whitespace-nowrap">{tx.voucherNo}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{tx.type}</td>
                        <td className="px-4 py-3 text-slate-500 font-sans font-medium min-w-[200px]">{tx.description}</td>
                        <td className="px-4 py-3 text-right text-rose-600 whitespace-nowrap">{tx.debit > 0 ? `PKR ${fmt(tx.debit)}` : "-"}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 whitespace-nowrap">{tx.credit > 0 ? `PKR ${fmt(tx.credit)}` : "-"}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-black whitespace-nowrap">PKR {fmt(tx.periodRunning)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                        No transactions in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
