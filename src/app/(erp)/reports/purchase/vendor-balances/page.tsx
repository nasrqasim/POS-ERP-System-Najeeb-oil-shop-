"use client";

import React, { useState, useEffect } from "react";
import ERPReportLayout from "@/components/erp/reports/ERPReportLayout";
import { Download, Printer, Play, Users, DollarSign, ArrowDownLeft, ArrowUpRight, Search, FileSpreadsheet } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";
import VendorProfileHistory from "@/components/erp/maintain/VendorProfileHistory";

function formatBalance(val: number) {
  if (val < 0) return { text: `-Rs. ${Math.abs(val).toLocaleString()}`, label: "(Debit)", color: "text-rose-600" };
  if (val > 0) return { text: `+Rs. ${val.toLocaleString()}`, label: "(Credit)", color: "text-emerald-600" };
  return { text: "Rs. 0", label: "", color: "text-slate-500" };
}

export default function VendorBalancesReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rawParties, setRawParties] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cashReceipts, setCashReceipts] = useState<any[]>([]);
  const [bankReceipts, setBankReceipts] = useState<any[]>([]);
  const [cashPayments, setCashPayments] = useState<any[]>([]);
  const [bankPayments, setBankPayments] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setFromDate("2025-01-01");
    setToDate(`${year}-${month}-${day}`);
  }, []);

  useEffect(() => {
    async function fetchShop() {
      try {
        const res = await fetch("/api/shop-profile");
        const json = await res.json();
        if (json.ok) setShopProfile(json.data);
      } catch (err) {
        console.error("Error fetching shop profile:", err);
      }
    }
    fetchShop();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [partiesRes, invoicesRes, cashReceiptsRes, bankReceiptsRes, cashPaymentsRes, bankPaymentsRes] = await Promise.all([
          fetch('/api/parties?type=vendor'),
          fetch('/api/invoices'),
          fetch('/api/cash-receipts'),
          fetch('/api/bank-receipts'),
          fetch('/api/cash-payments'),
          fetch('/api/bank-payments')
        ]);

        const [partiesJson, invoicesJson, cashReceiptsJson, bankReceiptsJson, cashPaymentsJson, bankPaymentsJson] = await Promise.all([
          partiesRes.json(),
          invoicesRes.json(),
          cashReceiptsRes.json(),
          bankReceiptsRes.json(),
          cashPaymentsRes.json(),
          bankPaymentsRes.json()
        ]);

        const partiesList = partiesJson.ok ? partiesJson.data : (Array.isArray(partiesJson) ? partiesJson : []);
        const invoicesList = invoicesJson.ok ? invoicesJson.data : (Array.isArray(invoicesJson) ? invoicesJson : []);
        const cashReceiptsList = cashReceiptsJson.ok ? cashReceiptsJson.data : (Array.isArray(cashReceiptsJson) ? cashReceiptsJson : []);
        const bankReceiptsList = bankReceiptsJson.ok ? bankReceiptsJson.data : (Array.isArray(bankReceiptsJson) ? bankReceiptsJson : []);
        const cashPaymentsList = cashPaymentsJson.ok ? cashPaymentsJson.data : (Array.isArray(cashPaymentsJson) ? cashPaymentsJson : []);
        const bankPaymentsList = bankPaymentsJson.ok ? bankPaymentsJson.data : (Array.isArray(bankPaymentsJson) ? bankPaymentsJson : []);

        setRawParties(partiesList);
        setInvoices(invoicesList);
        setCashReceipts(cashReceiptsList);
        setBankReceipts(bankReceiptsList);
        setCashPayments(cashPaymentsList);
        setBankPayments(bankPaymentsList);
      } catch (error) {
        console.error("Error fetching vendor balances:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (rawParties.length === 0) return;

    const startRange = fromDate ? new Date(fromDate) : new Date("2000-01-01");
    const endRange = toDate ? new Date(toDate) : new Date("2100-01-01");
    endRange.setHours(23, 59, 59, 999);

    const result = rawParties.map((p: any) => {
      const partyId = p._id;
      const initialOpening = Number(p.openingBalance) || 0;

      // Filter transactions for this vendor
      const pInvoices = invoices.filter((inv: any) => inv.partyId?._id === partyId || inv.partyId === partyId);
      const pCashReceipts = cashReceipts.filter((r: any) => r.partyId?._id === partyId || r.partyId === partyId);
      const pBankReceipts = bankReceipts.filter((r: any) => r.partyId?._id === partyId || r.partyId === partyId || r.party === partyId);
      const pCashPayments = cashPayments.filter((py: any) => py.partyId?._id === partyId || py.partyId === partyId || py.vendor === partyId);
      const pBankPayments = bankPayments.filter((py: any) => py.vendor === partyId);

      // Collect all transactions into a single list
      const txs: any[] = [];

      pInvoices.forEach((s: any) => {
        const isReturn = s.type === "purchase_return" || s.type === "non_tax_purchase_return";
        if (["purchase", "non_tax_purchase", "import_purchase", "purchase_return", "non_tax_purchase_return"].includes(s.type)) {
          const totalAmt = Number(s.totalAmount) || 0;
          let paidAtCreation = 0;
          if (!isReturn) {
            const invNo = s.invoiceNo || "";
            const linkedCashAmt = invNo ? pCashPayments
              .filter((py: any) => py.reference === invNo || (py.narration && py.narration.toLowerCase().includes(invNo.toLowerCase())))
              .reduce((sum: number, py: any) => sum + (Number(py.amount) || 0), 0) : 0;
            const linkedBankAmt = invNo ? pBankPayments
              .filter((py: any) => py.instrumentNo === invNo || (py.instrumentNo && py.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
              .reduce((sum: number, py: any) => sum + (Number(py.amount) || 0), 0) : 0;

            const rawPaid = (Number(s.amountReceived) > 0 ? Number(s.amountReceived) : 0) ||
                            (Number(s.amountPaid) > 0 ? Number(s.amountPaid) : 0) ||
                            ((s.paymentMethod === "Cash" || s.paymentMethod === "Bank" || s.status === "paid" || s.balance === 0) ? totalAmt : 0);

            paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
          }
          txs.push({
            date: new Date(s.date || s.createdAt),
            debit: isReturn ? totalAmt : paidAtCreation,
            credit: isReturn ? 0 : totalAmt
          });
        }
      });

      pCashPayments.forEach((py: any) => {
        txs.push({
          date: new Date(py.date || py.createdAt),
          debit: py.amount || 0,
          credit: 0
        });
      });

      pBankPayments.forEach((py: any) => {
        txs.push({
          date: new Date(py.date || py.createdAt),
          debit: py.amount || 0,
          credit: 0
        });
      });

      pCashReceipts.forEach((r: any) => {
        txs.push({
          date: new Date(r.date || r.createdAt),
          debit: 0,
          credit: r.amount || 0
        });
      });

      pBankReceipts.forEach((r: any) => {
        txs.push({
          date: new Date(r.date || r.createdAt),
          debit: 0,
          credit: r.amount || 0
        });
      });

      // Calculate Opening Balance (before startRange)
      let opening = initialOpening;
      txs.forEach((t) => {
        if (t.date.getTime() < startRange.getTime()) {
          opening += t.credit - t.debit;
        }
      });

      // Calculate Debit and Credit during the selected date range
      let debit = 0;
      let credit = 0;
      txs.forEach((t) => {
        if (t.date.getTime() >= startRange.getTime() && t.date.getTime() <= endRange.getTime()) {
          debit += t.debit;
          credit += t.credit;
        }
      });

      // Closing Balance
      const closing = opening + credit - debit;

      return {
        id: partyId,
        vendor: p.name || p.companyName || "Unknown Vendor",
        type: p.vendorType || "Supplier",
        city: p.city || "-",
        opening,
        debit,
        credit,
        closing,
        rawParty: p
      };
    });

    setData(result);
    setFilteredData(result);
  }, [rawParties, invoices, cashReceipts, bankReceipts, cashPayments, bankPayments, fromDate, toDate]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredData(data);
      return;
    }
    setFilteredData(
      data.filter((r) =>
        String(r.vendor || "").toLowerCase().includes(q) ||
        String(r.city || "").toLowerCase().includes(q) ||
        String(r.type || "").toLowerCase().includes(q)
      )
    );
  }, [searchQuery, data]);

  const totalDebit = filteredData.reduce((s, r) => s + r.debit, 0);
  const totalCredit = filteredData.reduce((s, r) => s + r.credit, 0);
  const totalClosing = filteredData.reduce((s, r) => s + r.closing, 0);

  const closingFmt = formatBalance(totalClosing);

  const stats = [
    { title: "Vendors with Balance", value: filteredData.length.toString(), icon: Users, iconColor: "text-rose-600", iconBg: "bg-rose-50" },
    { title: "Total Payable", value: closingFmt.text, icon: DollarSign, iconColor: "text-rose-600", iconBg: "bg-rose-50", valueColor: closingFmt.color },
    { title: "Total Debit", value: `Rs. ${totalDebit.toLocaleString()}`, icon: ArrowDownLeft, iconColor: "text-emerald-600", iconBg: "bg-emerald-50", valueColor: "text-emerald-600" },
    { title: "Total Credit", value: `Rs. ${totalCredit.toLocaleString()}`, icon: ArrowUpRight, iconColor: "text-blue-600", iconBg: "bg-blue-50", valueColor: "text-blue-600" },
  ];

  const Filters = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Financial Year</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>Financial Year 2025-26 (Active)</option>
          </select>
        </div>
        <div className="space-y-1 lg:col-span-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1 lg:col-span-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Vendors</option>
          </select>
        </div>
        
        {/* Next Row of Filters */}
        <div className="space-y-1 lg:col-span-2 lg:col-start-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor Type</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Types</option>
          </select>
        </div>
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">City</label>
          <select className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Cities</option>
          </select>
        </div>
        <div className="space-y-1 lg:col-span-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Min Balance</label>
          <input type="number" placeholder="0" className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1 lg:col-span-3 flex flex-col justify-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search vendor name..." className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-maroon-800/10 font-medium transition-all" />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 mt-4">
        <button className="px-3 py-2 bg-maroon-800 text-white rounded-lg text-[10px] font-bold hover:bg-maroon-900 flex items-center justify-center gap-1.5 shadow-sm shadow-maroon-900/20">
          <Play size={14} /> Generate
        </button>
      </div>
    </div>
  );

  if (selectedVendor) {
    return (
      <div className="p-6">
        <VendorProfileHistory 
          vendor={selectedVendor}
          onBack={() => setSelectedVendor(null)}
          shopProfile={shopProfile}
        />
      </div>
    );
  }

  return (
    <ERPReportLayout
      title="Vendor Balances"
      description="Consolidated list of all vendor account balances (Payables/Receivables) from Party ledger."
      stats={stats}
      filters={Filters}
      actions={[
        { label: "Print Balances", onClick: printPage, icon: Printer },
        { label: "Export Excel", onClick: () => exportToExcel(filteredData, "VendorBalances.xlsx"), icon: FileSpreadsheet },
      ]}
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-4 border-maroon-800 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold">Fetching live vendor balances...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 mx-4">
            <Users size={48} className="mb-4 opacity-30" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No vendor balances found for the selected criteria</p>
          </div>
        ) : (
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse border-b border-slate-200 dark:border-slate-800 min-w-max">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-8">#</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Type</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">City</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Opening</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Debit</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Credit</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, i) => {
                  const bal = formatBalance(row.closing);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">{i + 1}</td>
                      <td 
                        onClick={() => setSelectedVendor(row.rawParty)}
                        className="px-4 py-3 text-[11px] font-bold text-blue-600 cursor-pointer hover:underline"
                      >
                        {row.vendor}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-center">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black border border-rose-200 bg-rose-50 text-rose-600 uppercase tracking-wider">{row.type}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300 text-center">{row.city}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 text-right">
                        {row.opening > 0 ? `+Rs. ${row.opening.toLocaleString()}` : row.opening < 0 ? `-Rs. ${Math.abs(row.opening).toLocaleString()}` : "Rs. 0"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-medium text-rose-600 text-right">
                        {row.debit !== 0 ? `-Rs. ${Math.abs(row.debit).toLocaleString()}` : "Rs. 0"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-medium text-emerald-600 text-right">
                        {row.credit !== 0 ? `+Rs. ${Math.abs(row.credit).toLocaleString()}` : "Rs. 0"}
                      </td>
                      <td className={`px-4 py-3 text-[11px] font-black text-right ${bal.color}`}>
                        {Math.abs(row.closing).toLocaleString()}
                        {bal.label && <span className="ml-1 text-[9px] font-bold opacity-70">{bal.label}</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 dark:bg-slate-800/50 font-black">
                  <td colSpan={4} className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-slate-800 dark:text-slate-100">Grand Total</td>
                  <td className="px-4 py-3 text-[11px] text-right">{filteredData.reduce((s, r) => s + r.opening, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] text-right">{totalDebit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] text-right">{totalCredit.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-[11px] text-right ${closingFmt.color}`}>
                    {Math.abs(totalClosing).toLocaleString()}
                    {closingFmt.label && <span className="ml-1 text-[9px] font-bold opacity-70">{closingFmt.label}</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ERPReportLayout>
  );
}
