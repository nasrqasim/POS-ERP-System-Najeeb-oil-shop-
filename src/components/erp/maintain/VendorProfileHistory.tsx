"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, FileText, Printer, MessageCircle, Calendar, Wallet, Search, Play, 
  ShoppingBag, CreditCard, ChevronRight, TrendingUp, BarChart2, CalendarDays, Award, X,
  RefreshCw
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ERPStatCard from "@/components/erp/ui/ERPStatCard";
import WhatsAppShareModal from "@/components/erp/whatsapp/WhatsAppShareModal";

interface VendorProfileHistoryProps {
  vendor: any;
  onBack: () => void;
  shopProfile: any;
}

export default function VendorProfileHistory({
  vendor,
  onBack,
  shopProfile
}: VendorProfileHistoryProps) {
  // Tabs State
  const [activeTab, setActiveTab] = useState<"purchases" | "payments" | "items" | "outstanding" | "ledger" | "analytics">("purchases");
  
  // Data State
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ledger Dates State
  const [ledgerFromDate, setLedgerFromDate] = useState("");
  const [ledgerToDate, setLedgerToDate] = useState("");
  const [filterByPeriod, setFilterByPeriod] = useState(false);
  
  // WhatsApp Share Modal
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waDocData, setWaDocData] = useState<any>(null);

  // Purchase Details Modal
  const [viewPurchase, setViewPurchase] = useState<any>(null);

  // Pagination & Filter States
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesSearch, setPurchasesSearch] = useState("");
  const [purchasesType, setPurchasesType] = useState("all");

  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsMethod, setPaymentsMethod] = useState("all");

  const [itemsPage, setItemsPage] = useState(1);
  const [itemsSearch, setItemsSearch] = useState("");

  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingSearch, setOutstandingSearch] = useState("");

  const itemsPerPage = 8;

  // Initialize dates
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setLedgerFromDate(`${year}-${month}-01`);
    setLedgerToDate(`${year}-${month}-${day}`);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["purchases", "payments", "items", "outstanding", "ledger", "analytics"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  // Fetch Purchases and Payments
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [purchasesRes, cashRes, bankRes] = await Promise.all([
        fetch("/api/purchases"),
        fetch("/api/cash-payments"),
        fetch("/api/bank-payments")
      ]);
      const [purchasesJson, cashJson, bankJson] = await Promise.all([
        purchasesRes.json(),
        cashRes.json(),
        bankRes.json()
      ]);

      let vendorPurchases: any[] = [];
      let vendorPayments: any[] = [];

      // 1. Process Purchases & Returns
      if (purchasesJson.ok && purchasesJson.data) {
        vendorPurchases = purchasesJson.data.filter((p: any) => 
          p.partyId?._id === vendor._id || 
          p.vendor === vendor.name || 
          p.vendor === vendor.companyName
        );
      }

      // 2. Process Cash Payments
      if (cashJson.ok && cashJson.data) {
        cashJson.data.forEach((p: any) => {
          const match = p.partyId?._id === vendor._id || p.partyId === vendor._id || p.vendor === vendor._id || p.vendor === vendor.name || p.vendor === vendor.companyName;
          if (match) {
            vendorPayments.push({
              ...p,
              method: "Cash",
              reference: p.reference || p.voucherNo,
              user: p.employeeId?.name || "Admin"
            });
          }
        });
      }

      // 3. Process Bank Payments
      if (bankJson.ok && bankJson.data) {
        bankJson.data.forEach((p: any) => {
          // bank-payments Aggregate joins with party and populates vendor string
          const match = p.vendor === vendor.name || p.vendor === vendor.companyName || p.partyId === vendor._id;
          if (match) {
            vendorPayments.push({
              ...p,
              method: "Bank",
              reference: p.chequeNo || p.voucherNo,
              user: "Admin"
            });
          }
        });
      }

      setPurchases(vendorPurchases.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
      setPayments(vendorPayments.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
    } catch (e) {
      console.error("Error loading vendor profile history details:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vendor]);

  // Recalculates transactions ledger when date range is applied
  const getProcessedLedger = () => {
    const initialOpening = vendor.openingBalance || 0;
    const startRange = filterByPeriod ? new Date(ledgerFromDate || "2000-01-01") : new Date("2000-01-01");
    const endRange = filterByPeriod ? new Date(ledgerToDate || "2100-01-01") : new Date("2100-01-01");
    if (filterByPeriod) {
      endRange.setHours(23, 59, 59, 999);
    }

    const txs: any[] = [];

    // Process Purchases & Returns (Purchases increase credit (payable), Returns increase debit (receivable))
    purchases.forEach((p: any) => {
      const isReturn = p.type === "purchase_return" || p.type === "non_tax_purchase_return";
      txs.push({
        date: new Date(p.date || p.createdAt),
        voucherNo: p.invoiceNo || p.poNumber,
        type: isReturn ? "Purchase Return" : "Purchase Invoice",
        remarks: p.notes || (isReturn ? "Goods Returned to Vendor" : `Purchase invoice posted (${p.paymentMethod || 'Credit'})`),
        debit: isReturn ? p.totalAmount || 0 : 0,
        credit: isReturn ? 0 : p.totalAmount || 0
      });
    });

    // Process Payments (Payments to vendor increase debit (reduce payable))
    payments.forEach((p: any) => {
      txs.push({
        date: new Date(p.date || p.createdAt),
        voucherNo: p.voucherNo,
        type: p.method === "Cash" ? "Cash Payment" : "Bank Payment",
        remarks: p.narration || p.notes || `Payment made via ${p.method}`,
        debit: p.amount || 0,
        credit: 0
      });
    });

    // Sort all transactions chronologically
    txs.sort((a, b) => a.date.getTime() - b.date.getTime());

    let opening = initialOpening;
    const beforeTxs = txs.filter(t => t.date.getTime() < startRange.getTime());
    const duringTxs = txs.filter(t => t.date.getTime() >= startRange.getTime() && t.date.getTime() <= endRange.getTime());

    // Compute dynamic opening balance up to From Date
    beforeTxs.forEach(t => {
      opening += t.credit - t.debit;
    });

    let runningBalance = opening;
    let totalDr = 0;
    let totalCr = 0;

    const rows = duringTxs.map(t => {
      runningBalance += t.credit - t.debit;
      totalDr += t.debit;
      totalCr += t.credit;
      return {
        ...t,
        runningBalance
      };
    });

    return {
      opening,
      rows,
      totalDr,
      totalCr,
      closing: runningBalance
    };
  };

  const ledgerData = getProcessedLedger();

  // Overview metrics calculations
  const totalPurchases = purchases.filter(p => p.type !== "purchase_return" && p.type !== "non_tax_purchase_return").reduce((a, p) => a + (p.totalAmount || 0), 0);
  const totalPaymentsVal = payments.reduce((a, p) => a + (p.amount || 0), 0);
  
  const lastPurchaseTx = purchases.find(p => p.type !== "purchase_return" && p.type !== "non_tax_purchase_return");
  const lastPaymentTx = payments[0];

  const currentPayable = Math.max(0, (vendor.openingBalance || 0) + totalPurchases - totalPaymentsVal);

  // TAB 1: Filtered Purchases
  const filteredPurchases = purchases.filter(p => {
    const isReturn = p.type === "purchase_return" || p.type === "non_tax_purchase_return";
    const matchesSearch = p.invoiceNo?.toLowerCase().includes(purchasesSearch.toLowerCase()) ||
      p.items?.some((item: any) => item.description?.toLowerCase().includes(purchasesSearch.toLowerCase())) ||
      p.lines?.some((item: any) => item.description?.toLowerCase().includes(purchasesSearch.toLowerCase()));
    
    const matchesType = purchasesType === "all" || 
      (purchasesType === "return" && isReturn) ||
      (purchasesType === "posted" && p.status?.toLowerCase() === "posted") ||
      (purchasesType === "paid" && p.status?.toLowerCase() === "paid");

    return matchesSearch && matchesType;
  });

  const paginatedPurchases = filteredPurchases.slice((purchasesPage - 1) * itemsPerPage, purchasesPage * itemsPerPage);

  // TAB 2: Filtered Payments
  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.voucherNo?.toLowerCase().includes(paymentsSearch.toLowerCase()) ||
      p.reference?.toLowerCase().includes(paymentsSearch.toLowerCase());
    const matchesMethod = paymentsMethod === "all" || p.method?.toLowerCase() === paymentsMethod.toLowerCase();
    return matchesSearch && matchesMethod;
  });

  const paginatedPayments = filteredPayments.slice((paymentsPage - 1) * itemsPerPage, paymentsPage * itemsPerPage);

  // TAB 3: Item Purchase History computation
  const getProductHistory = () => {
    const productsMap = new Map<string, any>();
    
    purchases.forEach(p => {
      const itemsList = p.lines || p.items || [];
      const date = new Date(p.date || p.createdAt);

      itemsList.forEach((item: any) => {
        const itemCode = item.itemId?.code || item.itemCode || "N/A";
        const itemName = item.itemId?.name || item.description || "Unknown Item";
        const qty = item.qty || item.cartons || 1;
        const rate = item.rate || item.unitPrice || 0;

        if (productsMap.has(itemName)) {
          const prev = productsMap.get(itemName);
          productsMap.set(itemName, {
            ...prev,
            qty: prev.qty + qty,
            totalRate: prev.totalRate + (rate * qty),
            lastDate: date.getTime() > prev.lastDate.getTime() ? date : prev.lastDate
          });
        } else {
          productsMap.set(itemName, {
            code: itemCode,
            name: itemName,
            qty: qty,
            totalRate: rate * qty,
            lastDate: date
          });
        }
      });
    });

    return Array.from(productsMap.values()).map(p => ({
      ...p,
      avgRate: p.qty > 0 ? Math.round(p.totalRate / p.qty) : 0
    })).filter(p => 
      p.name.toLowerCase().includes(itemsSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(itemsSearch.toLowerCase())
    );
  };

  const productHistory = getProductHistory();
  const paginatedProducts = productHistory.slice((itemsPage - 1) * itemsPerPage, itemsPage * itemsPerPage);

  // TAB 4: Outstanding Bills computation
  const getOutstandingBills = () => {
    return purchases.filter(p => {
      const outstanding = (p.totalAmount || 0) - (p.amountReceived || 0);
      const matchesSearch = p.invoiceNo?.toLowerCase().includes(outstandingSearch.toLowerCase());
      return outstanding > 0 && matchesSearch;
    });
  };

  const outstandingBills = getOutstandingBills();
  const paginatedOutstanding = outstandingBills.slice((outstandingPage - 1) * itemsPerPage, outstandingPage * itemsPerPage);

  // TAB 6: Analytics Trend data
  const getAnalyticsData = () => {
    const monthlyData: { [key: string]: { purchases: number; payments: number } } = {};
    const last6Months: string[] = [];

    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      last6Months.push(label);
      monthlyData[label] = { purchases: 0, payments: 0 };
    }

    purchases.forEach(p => {
      if (p.type === "purchase_return" || p.type === "non_tax_purchase_return") return;
      const d = new Date(p.date || p.createdAt);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (monthlyData[label]) {
        monthlyData[label].purchases += p.totalAmount || 0;
      }
    });

    payments.forEach(pay => {
      const d = new Date(pay.date || pay.createdAt);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (monthlyData[label]) {
        monthlyData[label].payments += pay.amount || 0;
      }
    });

    return last6Months.map(month => ({
      name: month,
      Purchases: Math.round(monthlyData[month].purchases),
      Payments: Math.round(monthlyData[month].payments)
    }));
  };

  const trendData = getAnalyticsData();
  const topProduct = productHistory.sort((a, b) => b.qty - a.qty)[0];

  return (
    <div className="space-y-6">
      
      {/* Action Header */}
      <div className="flex justify-between items-center no-print">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-sm font-black transition-all"
        >
          <ArrowLeft size={18} />
          Back to Vendors
        </button>
        <div className="flex gap-2">
          {vendor.phone && vendor.phone.replace(/[^0-9]/g, "").length >= 10 && (
            <button 
              onClick={() => {
                setWaDocData({
                  opening: ledgerData.opening,
                  rows: ledgerData.rows,
                  totalDr: ledgerData.totalDr,
                  totalCr: ledgerData.totalCr,
                  closing: ledgerData.closing
                });
                setIsWhatsAppModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-sm font-black shadow-xl shadow-[#25D366]/20 transition-all"
            >
              <MessageCircle size={18} />
              WhatsApp Statement
            </button>
          )}
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2.5 bg-maroon-800 hover:bg-maroon-900 text-white rounded-xl text-sm font-black shadow-xl shadow-maroon-900/20 transition-all"
          >
            <Printer size={18} />
            Print Ledger
          </button>
        </div>
      </div>

      {/* Vendor Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-maroon-800/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#800000] text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md">
                {vendor.name?.substring(0, 2).toUpperCase() || "VE"}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{vendor.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">{vendor.code || "No Code"}</span>
                  <span className="text-xs font-black text-maroon-800 bg-maroon-50 px-2 py-0.5 rounded-full uppercase tracking-wider">{vendor.category || "Vendor"}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-1 gap-x-6 text-xs text-slate-500 font-bold">
              <p>📱 <span className="text-slate-700 dark:text-slate-350 ml-1">{vendor.phone || "-"}</span></p>
              <p>📍 <span className="text-slate-700 dark:text-slate-350 ml-1">{vendor.address || vendor.city || "-"}</span></p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-850 pt-4 lg:pt-0 lg:pl-8">
            <div className="text-left min-w-[120px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">PKR {Math.round(vendor.openingBalance || 0).toLocaleString()}</p>
            </div>
            <div className="text-left min-w-[120px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Balance</p>
              <p className={`text-lg font-black mt-0.5 ${vendor.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                PKR {Math.round(vendor.balance || 0).toLocaleString()}
                <span className="text-xs ml-0.5 font-bold">{vendor.balance > 0 ? ' (Payable)' : ' (Advance)'}</span>
              </p>
            </div>
            <div className="text-left min-w-[120px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Outstanding Bills</p>
              <p className="text-lg font-black text-[#800000] mt-0.5">PKR {Math.round(currentPayable).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <ERPStatCard 
          label="Total Purchases" 
          value={`PKR ${Math.round(totalPurchases).toLocaleString()}`} 
          icon={ShoppingBag} 
          variant="slate" 
        />
        <ERPStatCard 
          label="Total Payments" 
          value={`PKR ${Math.round(totalPaymentsVal).toLocaleString()}`} 
          icon={CreditCard} 
          variant="green" 
        />
        <ERPStatCard 
          label="Last Purchase" 
          value={lastPurchaseTx ? `${new Date(lastPurchaseTx.date || lastPurchaseTx.createdAt).toLocaleDateString()} (PKR ${Math.round(lastPurchaseTx.totalAmount).toLocaleString()})` : "No purchases recorded"} 
          icon={CalendarDays} 
          variant="orange" 
        />
        <ERPStatCard 
          label="Last Payment" 
          value={lastPaymentTx ? `${new Date(lastPaymentTx.date || lastPaymentTx.createdAt).toLocaleDateString()} (PKR ${Math.round(lastPaymentTx.amount).toLocaleString()})` : "No payments recorded"} 
          icon={Wallet} 
          variant="maroon" 
        />
      </div>

      {/* Vendor Tab Navigation */}
      <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200 dark:border-slate-800 no-print">
        {[
          { id: "purchases", label: "Purchases", icon: ShoppingBag },
          { id: "payments", label: "Payments", icon: CreditCard },
          { id: "items", label: "Items Purchased", icon: Award },
          { id: "outstanding", label: "Outstanding Bills", icon: Wallet },
          { id: "ledger", label: "Vendor Ledger", icon: FileText },
          { id: "analytics", label: "Purchase Analytics", icon: BarChart2 }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-800 text-maroon-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-250"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm min-h-[400px]">
        {isLoading ? (
          <div className="py-24 text-center text-slate-400">
            <RefreshCw size={36} className="animate-spin text-[#800000] mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Fetching records...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: Purchase History */}
            {activeTab === "purchases" && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search purchases by invoice number or item..."
                      value={purchasesSearch}
                      onChange={(e) => { setPurchasesSearch(e.target.value); setPurchasesPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status:</span>
                    <select
                      value={purchasesType}
                      onChange={(e) => { setPurchasesType(e.target.value); setPurchasesPage(1); }}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="all">All Purchases</option>
                      <option value="posted">Posted</option>
                      <option value="paid">Paid</option>
                      <option value="return">Returns Only</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                        <th className="px-4 py-3.5">Invoice No</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Items</th>
                        <th className="px-4 py-3.5 text-center">Qty</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5 text-right">Paid</th>
                        <th className="px-4 py-3.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedPurchases.length > 0 ? (
                        paginatedPurchases.map((item, idx) => {
                          const isReturn = item.type === "purchase_return" || item.type === "non_tax_purchase_return";
                          const totalQty = (item.lines || item.items || []).reduce((a: number, l: any) => a + (l.qty || l.cartons || 1), 0);
                          const itemsSummary = (item.lines || item.items || []).map((l: any) => l.description || l.itemName || "Item").join(", ");
                          const unpaidVal = (item.totalAmount || 0) - (item.amountReceived || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/50">
                              <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.invoiceNo || item.voucherNo}</span></td>
                              <td className="px-4 py-3.5">{new Date(item.date || item.createdAt).toLocaleDateString()}</td>
                              <td className="px-4 py-3.5 max-w-[200px] truncate" title={itemsSummary}>{itemsSummary || "-"}</td>
                              <td className="px-4 py-3.5 text-center">{totalQty}</td>
                              <td className="px-4 py-3.5 text-right text-slate-950 dark:text-white">PKR {Math.round(item.totalAmount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(item.amountReceived || 0).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-rose-600 font-extrabold">PKR {Math.round(unpaidVal).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic font-bold">No purchase records found.</td></tr>
                      )}
                      {filteredPurchases.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={3} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({filteredPurchases.length} Purchases)</td>
                          <td className="px-4 py-3.5 text-center">{filteredPurchases.reduce((a, p) => a + (p.lines || p.items || []).reduce((b: number, l: any) => b + (l.qty || l.cartons || 1), 0), 0)}</td>
                          <td className="px-4 py-3.5 text-right">PKR {Math.round(filteredPurchases.reduce((a, p) => a + (p.totalAmount || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(filteredPurchases.reduce((a, p) => a + (p.amountReceived || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(filteredPurchases.reduce((a, p) => a + ((p.totalAmount || 0) - (p.amountReceived || 0)), 0)).toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredPurchases.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(filteredPurchases.length, (purchasesPage - 1) * itemsPerPage + 1)}-{Math.min(filteredPurchases.length, purchasesPage * itemsPerPage)} of {filteredPurchases.length} Purchases</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={purchasesPage === 1}
                        onClick={() => setPurchasesPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={purchasesPage * itemsPerPage >= filteredPurchases.length}
                        onClick={() => setPurchasesPage(p => p + 1)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Payment History */}
            {activeTab === "payments" && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search payments by voucher number or reference..."
                      value={paymentsSearch}
                      onChange={(e) => { setPaymentsSearch(e.target.value); setPaymentsPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Method:</span>
                    <select
                      value={paymentsMethod}
                      onChange={(e) => { setPaymentsMethod(e.target.value); setPaymentsPage(1); }}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="all">All Methods</option>
                      <option value="cash">Cash Payments</option>
                      <option value="bank">Bank Payments</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-855 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                        <th className="px-4 py-3.5">Voucher No</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5">Method</th>
                        <th className="px-4 py-3.5">Reference</th>
                        <th className="px-4 py-3.5">Narration / Remarks</th>
                        <th className="px-4 py-3.5">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedPayments.length > 0 ? (
                        paginatedPayments.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/50">
                            <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.voucherNo}</span></td>
                            <td className="px-4 py-3.5">{new Date(item.date || item.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(item.amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-slate-650">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                item.method === "Cash" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                              }`}>
                                {item.method}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">{item.reference || "-"}</td>
                            <td className="px-4 py-3.5 max-w-[200px] truncate" title={item.narration}>{item.narration || item.notes || "-"}</td>
                            <td className="px-4 py-3.5 text-slate-400">{item.user}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic font-bold">No payment records match this criteria.</td></tr>
                      )}
                      {filteredPayments.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({filteredPayments.length} Payments)</td>
                          <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(filteredPayments.reduce((a, p) => a + (p.amount || 0), 0)).toLocaleString()}</td>
                          <td colSpan={4} className="px-4 py-3.5"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredPayments.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(filteredPayments.length, (paymentsPage - 1) * itemsPerPage + 1)}-{Math.min(filteredPayments.length, paymentsPage * itemsPerPage)} of {filteredPayments.length} Payments</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={paymentsPage === 1}
                        onClick={() => setPaymentsPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={paymentsPage * itemsPerPage >= filteredPayments.length}
                        onClick={() => setPaymentsPage(p => p + 1)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Items Purchased History */}
            {activeTab === "items" && (
              <div className="space-y-4">
                <div className="flex gap-3 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search purchased items by code or name..."
                      value={itemsSearch}
                      onChange={(e) => { setItemsSearch(e.target.value); setItemsPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-855 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                        <th className="px-4 py-3.5">Item Code</th>
                        <th className="px-4 py-3.5">Item Name</th>
                        <th className="px-4 py-3.5 text-center">Qty Purchased</th>
                        <th className="px-4 py-3.5 text-right">Avg Purchase Rate</th>
                        <th className="px-4 py-3.5">Last Purchase Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedProducts.length > 0 ? (
                        paginatedProducts.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/50">
                            <td className="px-4 py-3.5 uppercase tracking-wider text-slate-500 font-bold">{item.code}</td>
                            <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.name}</span></td>
                            <td className="px-4 py-3.5 text-center text-slate-950 dark:text-white">{item.qty}</td>
                            <td className="px-4 py-3.5 text-right text-slate-950 dark:text-white">PKR {Math.round(item.avgRate).toLocaleString()}</td>
                            <td className="px-4 py-3.5">{new Date(item.lastDate).toLocaleDateString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic font-bold">No item purchases recorded.</td></tr>
                      )}
                      {productHistory.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({productHistory.length} Items)</td>
                          <td className="px-4 py-3.5 text-center">{productHistory.reduce((a, p) => a + (p.qty || 0), 0)}</td>
                          <td colSpan={2} className="px-4 py-3.5"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {productHistory.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(productHistory.length, (itemsPage - 1) * itemsPerPage + 1)}-{Math.min(productHistory.length, itemsPage * itemsPerPage)} of {productHistory.length} Items</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={itemsPage === 1}
                        onClick={() => setItemsPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={itemsPage * itemsPerPage >= productHistory.length}
                        onClick={() => setItemsPage(p => p + 1)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Outstanding Bills */}
            {activeTab === "outstanding" && (
              <div className="space-y-4">
                <div className="flex gap-3 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search outstanding bills by invoice number..."
                      value={outstandingSearch}
                      onChange={(e) => { setOutstandingSearch(e.target.value); setOutstandingPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-855 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                        <th className="px-4 py-3.5">Invoice No</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5 text-right">Paid</th>
                        <th className="px-4 py-3.5 text-right">Balance</th>
                        <th className="px-4 py-3.5 text-center">Days Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedOutstanding.length > 0 ? (
                        paginatedOutstanding.map((item, idx) => {
                          const outstandingAmt = (item.totalAmount || 0) - (item.amountReceived || 0);
                          const invDate = new Date(item.date || item.createdAt);
                          const daysOut = Math.floor((new Date().getTime() - invDate.getTime()) / (1000 * 3600 * 24));
                          
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/50">
                              <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.invoiceNo}</span></td>
                              <td className="px-4 py-3.5">{invDate.toLocaleDateString()}</td>
                              <td className="px-4 py-3.5 text-right text-slate-950 dark:text-white">PKR {Math.round(item.totalAmount).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(item.amountReceived || 0).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(outstandingAmt).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                  daysOut > 30 ? "bg-red-50 text-red-600 animate-pulse" : daysOut > 15 ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-600"
                                }`}>
                                  {daysOut} Days
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic font-bold">No outstanding bills found.</td></tr>
                      )}
                      {outstandingBills.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({outstandingBills.length} Bills)</td>
                          <td className="px-4 py-3.5 text-right">PKR {Math.round(outstandingBills.reduce((a, b) => a + (b.totalAmount || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(outstandingBills.reduce((a, b) => a + (b.amountReceived || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(outstandingBills.reduce((a, b) => a + ((b.totalAmount || 0) - (b.amountReceived || 0)), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {outstandingBills.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(outstandingBills.length, (outstandingPage - 1) * itemsPerPage + 1)}-{Math.min(outstandingBills.length, outstandingPage * itemsPerPage)} of {outstandingBills.length} Bills</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={outstandingPage === 1}
                        onClick={() => setOutstandingPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={outstandingPage * itemsPerPage >= outstandingBills.length}
                        onClick={() => setOutstandingPage(p => p + 1)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Vendor Ledger */}
            {activeTab === "ledger" && (
              <div className="space-y-6">
                
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-250/50 dark:border-slate-800 no-print">
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="checkbox" 
                      id="filterByPeriod"
                      checked={filterByPeriod} 
                      onChange={(e) => setFilterByPeriod(e.target.checked)}
                      className="rounded border-slate-300 text-maroon-805 focus:ring-maroon-800 h-4 w-4"
                    />
                    <label htmlFor="filterByPeriod" className="text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                      Filter by Period
                    </label>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-end justify-between transition-opacity" style={{ opacity: filterByPeriod ? 1 : 0.5, pointerEvents: filterByPeriod ? 'auto' : 'none' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar size={12} /> Date From
                        </label>
                        <input 
                          type="date" 
                          value={ledgerFromDate}
                          onChange={(e) => setLedgerFromDate(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar size={12} /> Date To
                        </label>
                        <input 
                          type="date" 
                          value={ledgerToDate}
                          onChange={(e) => setLedgerToDate(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                  <ERPStatCard label="Opening Balance" value={`Rs. ${Math.round(ledgerData.opening).toLocaleString()}`} icon={Wallet} variant="slate" />
                  <ERPStatCard label="Total Debit (Payments)" value={`Rs. ${Math.round(ledgerData.totalDr).toLocaleString()}`} icon={Play} variant="orange" />
                  <ERPStatCard label="Total Credit (Purchases)" value={`Rs. ${Math.round(ledgerData.totalCr).toLocaleString()}`} icon={Play} variant="green" />
                  <ERPStatCard label="Closing Balance" value={`Rs. ${Math.round(ledgerData.closing).toLocaleString()}`} icon={Wallet} variant="maroon" />
                </div>

                {/* Ledger Statement Table */}
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Doc No</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Debit (Dr)</th>
                        <th className="px-4 py-3 text-right">Credit (Cr)</th>
                        <th className="px-4 py-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      <tr className="bg-slate-50/50 dark:bg-slate-850/50 font-black">
                        <td className="px-4 py-3 text-slate-400">{filterByPeriod && ledgerFromDate ? new Date(ledgerFromDate).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">-</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded font-black tracking-widest text-slate-500">OPEN</span>
                        </td>
                        <td className="px-4 py-3 uppercase tracking-tighter text-slate-400">{filterByPeriod ? "Opening Balance" : "Balance Brought Forward"}</td>
                        <td className="px-4 py-3 text-right">-</td>
                        <td className="px-4 py-3 text-right">-</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">Rs. {Math.round(ledgerData.opening).toLocaleString()}</td>
                      </tr>

                      {ledgerData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold italic uppercase tracking-wider text-[10px]">
                            No transactions recorded during this period
                          </td>
                        </tr>
                      ) : (
                        ledgerData.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                            <td className="px-4 py-3">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-blue-600">{row.voucherNo}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                row.type?.includes("Payment") ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                              }`}>
                                {row.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">{row.remarks}</td>
                            <td className="px-4 py-3 text-right text-rose-700">
                              {row.debit > 0 ? `Rs. ${Math.round(row.debit).toLocaleString()}` : "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-700">
                              {row.credit > 0 ? `Rs. ${Math.round(row.credit).toLocaleString()}` : "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-extrabold">
                              Rs. {Math.round(row.runningBalance).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}

                      <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t border-slate-200 dark:border-slate-700">
                        <td colSpan={4} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Statement Summary & Closing</td>
                        <td className="px-4 py-3.5 text-right text-rose-700">Rs. {Math.round(ledgerData.totalDr).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-emerald-700">Rs. {Math.round(ledgerData.totalCr).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-maroon-800 dark:text-maroon-400 text-sm">
                          Rs. {Math.round(ledgerData.closing).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB 6: Analytics */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                
                {/* Statistics Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-gradient-to-tr from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-blue-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} /> Average Invoice Value</p>
                    <p className="text-2xl font-black text-blue-900 dark:text-white mt-2">
                      PKR {purchases.length > 0 ? Math.round(totalPurchases / purchases.filter(p => p.type !== "purchase_return" && p.type !== "non_tax_purchase_return").length || 0).toLocaleString() : 0}
                    </p>
                  </div>
                  <div className="p-5 bg-gradient-to-tr from-emerald-50 to-emerald-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-emerald-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><Award size={12} /> Most Purchased Item</p>
                    <p className="text-lg font-black text-emerald-900 dark:text-white mt-2 truncate" title={topProduct?.name || "N/A"}>
                      {topProduct?.name || "N/A"}
                    </p>
                    {topProduct && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">Total Qty: {topProduct.qty}</p>}
                  </div>
                  <div className="p-5 bg-gradient-to-tr from-indigo-50 to-indigo-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-indigo-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><ShoppingBag size={12} /> Total Purchases Count</p>
                    <p className="text-2xl font-black text-indigo-900 dark:text-white mt-2">
                      {purchases.filter(p => p.type !== "purchase_return" && p.type !== "non_tax_purchase_return").length} Invoices
                    </p>
                  </div>
                  <div className="p-5 bg-gradient-to-tr from-rose-50 to-rose-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-rose-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={12} /> Payable Coverage Ratio</p>
                    <p className="text-2xl font-black text-rose-900 dark:text-white mt-2">
                      {totalPurchases > 0 ? Math.round((totalPaymentsVal / totalPurchases) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Trend Chart */}
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-6">6-Month Purchase Trend (Purchases vs Payments)</h3>
                  
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#800000" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#800000" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#25D366" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#25D366" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="Purchases" stroke="#800000" strokeWidth={2} fillOpacity={1} fill="url(#colorPurchases)" />
                        <Area type="monotone" dataKey="Payments" stroke="#25D366" strokeWidth={2} fillOpacity={1} fill="url(#colorPayments)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>

      {/* WhatsApp Sharing */}
      <WhatsAppShareModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        party={vendor}
        type="Statement"
        documentData={ledgerData}
        shopProfile={shopProfile}
      />

    </div>
  );
}
