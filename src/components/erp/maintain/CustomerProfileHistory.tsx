"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, FileText, Printer, MessageCircle, Calendar, Wallet, Search, Play, 
  ShoppingBag, CreditCard, ChevronRight, TrendingUp, BarChart2, CalendarDays, Award,
  RefreshCw, X
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ERPStatCard from "@/components/erp/ui/ERPStatCard";
import WhatsAppShareModal from "@/components/erp/whatsapp/WhatsAppShareModal";

interface CustomerProfileHistoryProps {
  customer: any;
  onBack: () => void;
  shopProfile: any;
  fetchCustomers?: () => void;
}

export default function CustomerProfileHistory({
  customer,
  onBack,
  shopProfile,
  fetchCustomers
}: CustomerProfileHistoryProps) {
  // Tabs State
  const [activeTab, setActiveTab] = useState<"sales" | "payments" | "products" | "outstanding" | "ledger" | "analytics">("sales");
  
  // Current Customer State with latest advance stats
  const [currentCustomer, setCurrentCustomer] = useState<any>(customer);

  // Data State
  const [sales, setSales] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ledger Dates State
  const [ledgerFromDate, setLedgerFromDate] = useState("");
  const [ledgerToDate, setLedgerToDate] = useState("");
  const [filterByPeriod, setFilterByPeriod] = useState(false);
  
  // WhatsApp Share Modal
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waDocData, setWaDocData] = useState<any>(null);
  const [waType, setWaType] = useState<"Statement" | "Reminder">("Reminder");

  // Invoice Details Modal
  const [viewInvoice, setViewInvoice] = useState<any>(null);

  // Pagination & Filter States
  const [salesPage, setSalesPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesStatus, setSalesStatus] = useState("all");

  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsMethod, setPaymentsMethod] = useState("all");

  const [productsPage, setProductsPage] = useState(1);
  const [productsSearch, setProductsSearch] = useState("");

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
      if (tabParam && ["sales", "payments", "products", "outstanding", "ledger", "analytics"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  // Fetch Sales and Receipts
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [salesRes, cashRes, bankRes, partyRes] = await Promise.all([
        fetch("/api/sales"),
        fetch("/api/cash-receipts"),
        fetch("/api/bank-receipts"),
        fetch(`/api/parties/${customer._id}`)
      ]);
      const [salesJson, cashJson, bankJson, partyJson] = await Promise.all([
        salesRes.json(),
        cashRes.json(),
        bankRes.json(),
        partyRes.json()
      ]);

      if (partyJson.ok && partyJson.data) {
        setCurrentCustomer(partyJson.data);
      }

      let customerSales: any[] = [];
      let customerReceipts: any[] = [];

      // 1. Process Sales & Returns
      if (salesJson.ok && salesJson.data) {
        customerSales = salesJson.data.filter((s: any) => 
          s.partyId?._id === customer._id || 
          s.customerName === customer.name || 
          s.customerName === customer.companyName
        );
      }

      // 2. Process Cash Receipts
      if (cashJson.ok && cashJson.data) {
        cashJson.data.forEach((r: any) => {
          const match = r.party === customer._id || r.party === customer.name || r.party === customer.companyName || r.partyId?._id === customer._id;
          if (match) {
            customerReceipts.push({
              ...r,
              method: "Cash",
              reference: r.reference || r.receiptNumber,
              user: r.employeeId?.name || "Admin"
            });
          }
        });
      }

      // 3. Process Bank Receipts
      if (bankJson.ok && bankJson.data) {
        bankJson.data.forEach((r: any) => {
          const match = r.party === customer._id || r.party === customer.name || r.party === customer.companyName || r.partyId?._id === customer._id;
          if (match) {
            customerReceipts.push({
              ...r,
              method: "Bank",
              reference: r.instrumentNo || r.receiptNumber,
              user: "Admin"
            });
          }
        });
      }

      setSales(customerSales.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
      setReceipts(customerReceipts.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
    } catch (e) {
      console.error("Error loading customer profile history details:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentCustomer(customer);
    fetchData();
  }, [customer]);

  // Recalculates transactions ledger when date range is applied
  const getProcessedLedger = () => {
    // Use absolute value of opening balance for display (receivables/payables should be positive)
    const initialOpening = Math.abs(currentCustomer.openingBalance || 0);
    const startRange = filterByPeriod ? new Date(ledgerFromDate || "2000-01-01") : new Date("2000-01-01");
    const endRange = filterByPeriod ? new Date(ledgerToDate || "2100-01-01") : new Date("2100-01-01");
    if (filterByPeriod) {
      endRange.setHours(23, 59, 59, 999);
    }

    const txs: any[] = [];

    // Process Sales & Returns
    sales.forEach((s: any) => {
      const isReturn = s.type === "sale_return" || s.type === "non_tax_sale_return";
      txs.push({
        date: new Date(s.date || s.createdAt),
        voucherNo: s.invoiceNo,
        type: isReturn ? "Sale Return" : "Sale Invoice",
        remarks: s.notes || (isReturn ? "Goods Returned" : `Sales invoice posted (${s.paymentMethod || 'Credit'})`),
        debit: isReturn ? 0 : s.totalAmount || 0,
        credit: isReturn ? s.totalAmount || 0 : 0
      });
    });

    // Process Receipts
    receipts.forEach((r: any) => {
      txs.push({
        date: new Date(r.date || r.createdAt),
        voucherNo: r.receiptNumber,
        type: r.method === "Cash" ? "Cash Receipt" : "Bank Receipt",
        remarks: r.remarks || `Payment received via ${r.method}`,
        debit: 0,
        credit: r.amount || 0
      });
    });

    // Sort all transactions chronologically
    txs.sort((a, b) => a.date.getTime() - b.date.getTime());

    let opening = initialOpening;
    const beforeTxs = txs.filter(t => t.date.getTime() < startRange.getTime());
    const duringTxs = txs.filter(t => t.date.getTime() >= startRange.getTime() && t.date.getTime() <= endRange.getTime());

    // Compute dynamic opening balance up to From Date
    beforeTxs.forEach(t => {
      opening += t.debit - t.credit;
    });

    let runningBalance = opening;
    let totalDr = 0;
    let totalCr = 0;

    const rows = duringTxs.map(t => {
      runningBalance += t.debit - t.credit;
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
  const totalSales = sales.filter(s => s.type !== "sale_return" && s.type !== "non_tax_sale_return").reduce((a, s) => a + (s.totalAmount || 0), 0);
  const totalReceived = receipts.reduce((a, r) => a + (r.amount || 0), 0);
  
  const lastPurchaseTx = sales.find(s => s.type !== "sale_return" && s.type !== "non_tax_sale_return");
  const lastPaymentTx = receipts[0];

  const outstandingAmount = Math.max(0, (currentCustomer.openingBalance || 0) + totalSales - totalReceived);

  // TAB 1: Filtered Sales
  const filteredSales = sales.filter(s => {
    const isReturn = s.type === "sale_return" || s.type === "non_tax_sale_return";
    const matchesSearch = s.invoiceNo?.toLowerCase().includes(salesSearch.toLowerCase()) ||
      s.items?.some((item: any) => item.description?.toLowerCase().includes(salesSearch.toLowerCase())) ||
      s.lines?.some((item: any) => item.description?.toLowerCase().includes(salesSearch.toLowerCase()));
    
    const matchesStatus = salesStatus === "all" || 
      (salesStatus === "return" && isReturn) ||
      (salesStatus === "paid" && s.status?.toLowerCase() === "paid") ||
      (salesStatus === "unpaid" && s.status?.toLowerCase() === "unpaid") ||
      (salesStatus === "posted" && s.status?.toLowerCase() === "posted");

    return matchesSearch && matchesStatus;
  });

  const paginatedSales = filteredSales.slice((salesPage - 1) * itemsPerPage, salesPage * itemsPerPage);

  // TAB 2: Filtered Payments
  const filteredPayments = receipts.filter(p => {
    const matchesSearch = p.receiptNumber?.toLowerCase().includes(paymentsSearch.toLowerCase()) ||
      p.reference?.toLowerCase().includes(paymentsSearch.toLowerCase());
    const matchesMethod = paymentsMethod === "all" || p.method?.toLowerCase() === paymentsMethod.toLowerCase();
    return matchesSearch && matchesMethod;
  });

  const paginatedPayments = filteredPayments.slice((paymentsPage - 1) * itemsPerPage, paymentsPage * itemsPerPage);

  // TAB 3: Product History computation
  const getProductHistory = () => {
    const productsMap = new Map<string, any>();
    
    sales.forEach(s => {
      const itemsList = s.lines || s.items || [];
      const date = new Date(s.date || s.createdAt);

      itemsList.forEach((item: any) => {
        const itemCode = item.itemId?.code || item.itemCode || "N/A";
        const itemName = item.itemId?.name || item.description || "Unknown Item";
        const qty = item.qty || item.cartons || 1;
        const rate = item.rate || item.unitPrice || 0;

        if (productsMap.has(itemName)) {
          const prev = productsMap.get(itemName);
          productsMap.set(itemName, {
            ...prev,
            count: prev.count + 1,
            qty: prev.qty + qty,
            lastDate: date.getTime() > prev.lastDate.getTime() ? date : prev.lastDate,
            lastRate: date.getTime() > prev.lastDate.getTime() ? rate : prev.lastRate
          });
        } else {
          productsMap.set(itemName, {
            code: itemCode,
            name: itemName,
            count: 1,
            qty: qty,
            lastDate: date,
            lastRate: rate
          });
        }
      });
    });

    return Array.from(productsMap.values()).filter(p => 
      p.name.toLowerCase().includes(productsSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productsSearch.toLowerCase())
    );
  };

  const productHistory = getProductHistory();
  const paginatedProducts = productHistory.slice((productsPage - 1) * itemsPerPage, productsPage * itemsPerPage);

  // TAB 4: Outstanding Invoices computation
  const getOutstandingInvoices = () => {
    return sales.filter(s => {
      const outstanding = (s.totalAmount || 0) - (s.amountReceived || 0);
      const matchesSearch = s.invoiceNo?.toLowerCase().includes(outstandingSearch.toLowerCase());
      return outstanding > 0 && matchesSearch;
    });
  };

  const outstandingInvoices = getOutstandingInvoices();
  const paginatedOutstanding = outstandingInvoices.slice((outstandingPage - 1) * itemsPerPage, outstandingPage * itemsPerPage);

  // TAB 6: Analytics Trends computation
  const getAnalyticsData = () => {
    const monthlyData: { [key: string]: { sales: number; payments: number } } = {};
    const last6Months: string[] = [];

    // Initialize last 6 months
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      last6Months.push(label);
      monthlyData[label] = { sales: 0, payments: 0 };
    }

    // Map sales to months
    sales.forEach(s => {
      if (s.type === "sale_return" || s.type === "non_tax_sale_return") return;
      const d = new Date(s.date || s.createdAt);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (monthlyData[label]) {
        monthlyData[label].sales += s.totalAmount || 0;
      }
    });

    // Map payments to months
    receipts.forEach(r => {
      const d = new Date(r.date || r.createdAt);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (monthlyData[label]) {
        monthlyData[label].payments += r.amount || 0;
      }
    });

    return last6Months.map(month => ({
      name: month,
      Sales: Math.round(monthlyData[month].sales),
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
          Back to List
        </button>
        <div className="flex gap-2">
          {currentCustomer.phone && currentCustomer.phone.replace(/[^0-9]/g, "").length >= 10 && (
            <button 
              onClick={() => {
                setWaDocData(ledgerData);
                setWaType("Statement");
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

      {/* Customer Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-maroon-800/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-maroon-800 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md">
                {currentCustomer.name?.substring(0, 2).toUpperCase() || "CU"}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{currentCustomer.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">{currentCustomer.code || "No Code"}</span>
                  <span className="text-xs font-black text-maroon-800 bg-maroon-50 px-2 py-0.5 rounded-full uppercase tracking-wider">{currentCustomer.category || "Cash Customer"}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-1 gap-x-6 text-xs text-slate-500 font-bold">
              <p>📱 <span className="text-slate-700 dark:text-slate-350 ml-1">{currentCustomer.phone || currentCustomer.mobile || "-"}</span></p>
              <p>📍 <span className="text-slate-700 dark:text-slate-350 ml-1">{currentCustomer.address || "-"}</span></p>
              <p>🌍 <span className="text-slate-700 dark:text-slate-350 ml-1">Region: {currentCustomer.region || currentCustomer.area || "-"}</span></p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-850 pt-4 lg:pt-0 lg:pl-8">
            {currentCustomer.advanceStats && currentCustomer.advanceStats.remainingAdvance > 0 && (
              <div className="text-left min-w-[120px] bg-emerald-55 border border-emerald-100 dark:border-emerald-950/20 px-3 py-1.5 rounded-xl">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Advance Bal</p>
                <p className="text-lg font-black text-emerald-600 mt-0.5">PKR {Math.round(currentCustomer.advanceStats.remainingAdvance || 0).toLocaleString()}</p>
              </div>
            )}
            <div className="text-left min-w-[120px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit Limit</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">PKR {Math.round(currentCustomer.creditLimit || 0).toLocaleString()}</p>
            </div>
            <div className="text-left min-w-[120px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Balance</p>
              <p className={`text-lg font-black mt-0.5 ${currentCustomer.balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                PKR {Math.round(currentCustomer.balance || 0).toLocaleString()}
                <span className="text-xs ml-0.5 font-bold">{currentCustomer.balance < 0 ? ' (Dr)' : ' (Cr)'}</span>
              </p>
            </div>
            <div className="text-left min-w-[120px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Outstanding Dues</p>
              <p className="text-lg font-black text-[#800000] mt-0.5">PKR {Math.round(outstandingAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <ERPStatCard 
          label="Total Sales Value" 
          value={`PKR ${Math.round(totalSales).toLocaleString()}`} 
          icon={ShoppingBag} 
          variant="slate" 
        />
        <ERPStatCard 
          label="Total Received" 
          value={`PKR ${Math.round(totalReceived).toLocaleString()}`} 
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

      {/* Profile Tab Navigation */}
      <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200 dark:border-slate-800 no-print">
        {[
          { id: "sales", label: "Sales History", icon: ShoppingBag },
          { id: "payments", label: "Payment History", icon: CreditCard },
          { id: "products", label: "Product History", icon: Award },
          { id: "outstanding", label: "Outstanding Bills", icon: Wallet },
          { id: "ledger", label: "Detailed Ledger", icon: FileText },
          { id: "analytics", label: "Analytics & Trends", icon: BarChart2 }
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
            <RefreshCw size={36} className="animate-spin text-maroon-850 mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Fetching profile records...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: Sales History */}
            {activeTab === "sales" && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search sales by invoice number or item..."
                      value={salesSearch}
                      onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type:</span>
                    <select
                      value={salesStatus}
                      onChange={(e) => { setSalesStatus(e.target.value); setSalesPage(1); }}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="all">All Invoices</option>
                      <option value="posted">Posted</option>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
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
                        <th className="px-4 py-3.5">Items Purchased</th>
                        <th className="px-4 py-3.5 text-center">Qty</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5 text-right">Discount</th>
                        <th className="px-4 py-3.5 text-right">Paid</th>
                        <th className="px-4 py-3.5 text-right">Remaining</th>
                        <th className="px-4 py-3.5 text-center">Status</th>
                        <th className="px-4 py-3.5 text-center w-16">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedSales.length > 0 ? (
                        paginatedSales.map((item, idx) => {
                          const isReturn = item.type === "sale_return" || item.type === "non_tax_sale_return";
                          const totalQty = (item.lines || item.items || []).reduce((a: number, l: any) => a + (l.qty || l.cartons || 1), 0);
                          const itemsSummary = (item.lines || item.items || []).map((l: any) => l.description || l.itemName || "Item").join(", ");
                          const unpaidVal = (item.totalAmount || 0) - (item.amountReceived || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                              <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.invoiceNo}</span></td>
                              <td className="px-4 py-3.5">{new Date(item.date || item.createdAt).toLocaleDateString()}</td>
                              <td className="px-4 py-3.5 max-w-[200px] truncate" title={itemsSummary}>{itemsSummary || "-"}</td>
                              <td className="px-4 py-3.5 text-center">{totalQty}</td>
                              <td className="px-4 py-3.5 text-right text-slate-950 dark:text-white">PKR {Math.round(item.totalAmount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-amber-600">PKR {Math.round(item.discountAmount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(item.amountReceived || 0).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(unpaidVal).toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  isReturn ? "bg-orange-100 text-orange-800" :
                                  item.status?.toLowerCase() === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                }`}>
                                  {isReturn ? "Return" : item.status || "Posted"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <button 
                                  onClick={() => setViewInvoice(item)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-[#800000] inline-flex items-center justify-center"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400 italic font-bold">No sales invoices match this criteria.</td></tr>
                      )}
                      {filteredSales.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={3} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({filteredSales.length} Invoices)</td>
                          <td className="px-4 py-3.5 text-center">{filteredSales.reduce((a, s) => a + (s.lines || s.items || []).reduce((b: number, l: any) => b + (l.qty || l.cartons || 1), 0), 0)}</td>
                          <td className="px-4 py-3.5 text-right">PKR {Math.round(filteredSales.reduce((a, s) => a + (s.totalAmount || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-amber-600">PKR {Math.round(filteredSales.reduce((a, s) => a + (s.discountAmount || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(filteredSales.reduce((a, s) => a + (s.amountReceived || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(filteredSales.reduce((a, s) => a + ((s.totalAmount || 0) - (s.amountReceived || 0)), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5"></td>
                          <td className="px-4 py-3.5"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredSales.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(filteredSales.length, (salesPage - 1) * itemsPerPage + 1)}-{Math.min(filteredSales.length, salesPage * itemsPerPage)} of {filteredSales.length} Invoices</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={salesPage === 1}
                        onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={salesPage * itemsPerPage >= filteredSales.length}
                        onClick={() => setSalesPage(p => p + 1)}
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
                      placeholder="Search receipts by receipt number or reference..."
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
                      <option value="cash">Cash Receipts</option>
                      <option value="bank">Bank Receipts</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                        <th className="px-4 py-3.5">Receipt No</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5">Payment Method</th>
                        <th className="px-4 py-3.5">Reference</th>
                        <th className="px-4 py-3.5">Narration / Remarks</th>
                        <th className="px-4 py-3.5">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedPayments.length > 0 ? (
                        paginatedPayments.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                            <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.receiptNumber}</span></td>
                            <td className="px-4 py-3.5">{new Date(item.date || item.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(item.amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                item.method === "Cash" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                              }`}>
                                {item.method}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">{item.reference || "-"}</td>
                            <td className="px-4 py-3.5 max-w-[200px] truncate" title={item.remarks}>{item.remarks || item.narration || "-"}</td>
                            <td className="px-4 py-3.5 text-slate-400">{item.user}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic font-bold">No payments match this criteria.</td></tr>
                      )}
                      {filteredPayments.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({filteredPayments.length} Receipts)</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(filteredPayments.reduce((a, r) => a + (r.amount || 0), 0)).toLocaleString()}</td>
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

            {/* TAB 3: Product History */}
            {activeTab === "products" && (
              <div className="space-y-4">
                <div className="flex gap-3 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search purchased items by code or name..."
                      value={productsSearch}
                      onChange={(e) => { setProductsSearch(e.target.value); setProductsPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                        <th className="px-4 py-3.5">Item Code</th>
                        <th className="px-4 py-3.5">Item Name</th>
                        <th className="px-4 py-3.5 text-center">Purchase Count</th>
                        <th className="px-4 py-3.5 text-center">Total Qty</th>
                        <th className="px-4 py-3.5">Last Purchase Date</th>
                        <th className="px-4 py-3.5 text-right">Last Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-350">
                      {paginatedProducts.length > 0 ? (
                        paginatedProducts.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                            <td className="px-4 py-3.5 uppercase tracking-wider text-slate-500 font-bold">{item.code}</td>
                            <td className="px-4 py-3.5"><span className="font-extrabold text-slate-900 dark:text-white">{item.name}</span></td>
                            <td className="px-4 py-3.5 text-center">{item.count}</td>
                            <td className="px-4 py-3.5 text-center text-slate-950 dark:text-white">{item.qty}</td>
                            <td className="px-4 py-3.5">{new Date(item.lastDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3.5 text-right text-slate-950 dark:text-white">PKR {Math.round(item.lastRate).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic font-bold">No product purchases match this criteria.</td></tr>
                      )}
                      {productHistory.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({productHistory.length} Products)</td>
                          <td className="px-4 py-3.5 text-center">{productHistory.reduce((a, p) => a + (p.count || 0), 0)}</td>
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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(productHistory.length, (productsPage - 1) * itemsPerPage + 1)}-{Math.min(productHistory.length, productsPage * itemsPerPage)} of {productHistory.length} Products</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={productsPage === 1}
                        onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={productsPage * itemsPerPage >= productHistory.length}
                        onClick={() => setProductsPage(p => p + 1)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Outstanding Invoices */}
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
                      <tr className="border-b border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
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
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
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
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic font-bold">No outstanding invoices match this criteria.</td></tr>
                      )}
                      {outstandingInvoices.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-950 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-widest text-[9px]">Grand Total ({outstandingInvoices.length} Bills)</td>
                          <td className="px-4 py-3.5 text-right">PKR {Math.round(outstandingInvoices.reduce((a, s) => a + (s.totalAmount || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600">PKR {Math.round(outstandingInvoices.reduce((a, s) => a + (s.amountReceived || 0), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right text-rose-600">PKR {Math.round(outstandingInvoices.reduce((a, s) => a + ((s.totalAmount || 0) - (s.amountReceived || 0)), 0)).toLocaleString()}</td>
                          <td className="px-4 py-3.5"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {outstandingInvoices.length > itemsPerPage && (
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {Math.min(outstandingInvoices.length, (outstandingPage - 1) * itemsPerPage + 1)}-{Math.min(outstandingInvoices.length, outstandingPage * itemsPerPage)} of {outstandingInvoices.length} Bills</p>
                    <div className="flex gap-1">
                      <button 
                        disabled={outstandingPage === 1}
                        onClick={() => setOutstandingPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={outstandingPage * itemsPerPage >= outstandingInvoices.length}
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

            {/* TAB 5: Detailed Ledger */}
            {activeTab === "ledger" && (
              <div className="space-y-6">
                
                {/* Date Filter Panel */}
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
                  <ERPStatCard label="Total Debit (Sales)" value={`Rs. ${Math.round(ledgerData.totalDr).toLocaleString()}`} icon={Play} variant="green" />
                  <ERPStatCard label="Total Credit (Receipts)" value={`Rs. ${Math.round(ledgerData.totalCr).toLocaleString()}`} icon={Play} variant="orange" />
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
                        <th className="px-4 py-3 text-right">Balance</th>
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
                                row.type === "Sale Invoice" ? "bg-emerald-50 text-emerald-600" :
                                row.type === "Sale Return" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                              }`}>
                                {row.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">{row.remarks}</td>
                            <td className="px-4 py-3 text-right text-emerald-700">
                              {row.debit > 0 ? `Rs. ${Math.round(row.debit).toLocaleString()}` : "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-rose-700">
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
                        <td className="px-4 py-3.5 text-right text-emerald-700">Rs. {Math.round(ledgerData.totalDr).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-rose-700">Rs. {Math.round(ledgerData.totalCr).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-maroon-800 dark:text-maroon-400 text-sm">
                          Rs. {Math.round(ledgerData.closing).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB 6: Analytics & Trends */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                
                {/* Statistics Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-gradient-to-tr from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-blue-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} /> Average Invoice Value</p>
                    <p className="text-2xl font-black text-blue-900 dark:text-white mt-2">
                      PKR {sales.length > 0 ? Math.round(totalSales / sales.filter(s => s.type !== "sale_return" && s.type !== "non_tax_sale_return").length || 0).toLocaleString() : 0}
                    </p>
                  </div>
                  <div className="p-5 bg-gradient-to-tr from-emerald-50 to-emerald-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-emerald-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><Award size={12} /> Top Purchased Product</p>
                    <p className="text-lg font-black text-emerald-900 dark:text-white mt-2 truncate" title={topProduct?.name || "N/A"}>
                      {topProduct?.name || "N/A"}
                    </p>
                    {topProduct && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">Total Purchased Qty: {topProduct.qty}</p>}
                  </div>
                  <div className="p-5 bg-gradient-to-tr from-indigo-50 to-indigo-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-indigo-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><ShoppingBag size={12} /> Total Sales Count</p>
                    <p className="text-2xl font-black text-indigo-900 dark:text-white mt-2">
                      {sales.filter(s => s.type !== "sale_return" && s.type !== "non_tax_sale_return").length} Invoices
                    </p>
                  </div>
                  <div className="p-5 bg-gradient-to-tr from-rose-50 to-rose-100 dark:from-slate-800 dark:to-slate-800/60 rounded-3xl border border-rose-200/50 dark:border-slate-750 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={12} /> Payment Ratio</p>
                    <p className="text-2xl font-black text-rose-900 dark:text-white mt-2">
                      {totalSales > 0 ? Math.round((totalReceived / totalSales) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Trend Chart */}
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-6">6-Month Purchase Trend (Sales vs Payments)</h3>
                  
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
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
                        <Area type="monotone" dataKey="Sales" stroke="#800000" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
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

      {/* Invoice Details Viewer Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
            <div className="bg-slate-100 dark:bg-slate-850 p-5 flex justify-between items-center shrink-0 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase">Invoice Details</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Ref No: {viewInvoice.invoiceNo}</p>
              </div>
              <button 
                onClick={() => setViewInvoice(null)} 
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-white"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 text-xs font-bold">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Invoice Info</p>
                  <p className="text-slate-800 dark:text-slate-200">Date: {new Date(viewInvoice.date || viewInvoice.createdAt).toLocaleDateString()}</p>
                  <p className="text-slate-800 dark:text-slate-200 uppercase">Method: {viewInvoice.paymentMethod || "Credit"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Vehicle / Services</p>
                  {viewInvoice.regNo ? (
                    <>
                      <p className="text-slate-800 dark:text-slate-200">Vehicle No: {viewInvoice.regNo}</p>
                      <p className="text-slate-800 dark:text-slate-200">Range: {viewInvoice.rangeKMs || viewInvoice.rangeKms || 0} KMs</p>
                    </>
                  ) : (
                    <p className="text-slate-400 italic">No vehicle details</p>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Products & Materials</p>
                <div className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 font-black uppercase text-[10px] text-slate-400">
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2 text-center w-12">Qty</th>
                        <th className="px-4 py-2 text-right w-24">Rate</th>
                        <th className="px-4 py-2 text-right w-24">Net Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-slate-700 dark:text-slate-350">
                      {(viewInvoice.lines || viewInvoice.items || []).map((line: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-bold">{line.description || line.itemName || "Item"}</td>
                          <td className="px-4 py-2.5 text-center">{line.qty || line.cartons || 1}</td>
                          <td className="px-4 py-2.5 text-right">PKR {Math.round(line.rate || line.unitPrice || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">PKR {Math.round(line.netAmount || line.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invoice Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-64 border border-slate-100 dark:border-slate-850 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-xs font-bold space-y-1.5 text-slate-500">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-slate-800 dark:text-slate-200">PKR {Math.round(viewInvoice.subTotal || viewInvoice.totalAmount || 0).toLocaleString()}</span>
                  </div>
                  {viewInvoice.discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span className="text-rose-600">-PKR {Math.round(viewInvoice.discountAmount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t pt-1.5 text-slate-950 dark:text-white">
                    <span>Net Amount:</span>
                    <span className="text-maroon-800 dark:text-maroon-400">PKR {Math.round(viewInvoice.totalAmount || viewInvoice.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Sharing */}
      <WhatsAppShareModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        party={customer}
        type={waType}
        documentData={waDocData}
        shopProfile={shopProfile}
      />

    </div>
  );
}
