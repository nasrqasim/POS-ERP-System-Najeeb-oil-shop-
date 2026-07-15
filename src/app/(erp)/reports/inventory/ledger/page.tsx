"use client";

import ERPReportLayout from "@/components/erp/reports/ERPReportLayout";
import SearchableItemSelect from "@/components/erp/ui/SearchableItemSelect";
import { Download, Printer, Play, Clock, Box, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Eye } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";
import { useState, useEffect, useMemo } from "react";
import { lineStockQty } from "@/lib/itemUnits";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function InventoryLedgerReportPage() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ openingBalance: 0, totalIn: 0, totalOut: 0, closingBalance: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const handleInvoiceClick = (refNo: string) => {
    const inv = invoices.find(i => i.invoiceNo === refNo);
    if (inv) {
      setSelectedInvoice(inv);
    } else {
      alert(`Invoice ${refNo} not found`);
    }
  };

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(json => { if (json.ok) setItems(json.data); })
      .catch(console.error);

    fetch('/api/categories')
      .then(r => r.json())
      .then(json => { if (json.ok) setCategories(json.data.filter((c: any) => c.type === "main")); })
      .catch(console.error);

    fetch('/api/invoices')
      .then(r => r.json())
      .then(json => { if (json.ok) setInvoices(json.data); })
      .catch(console.error);
  }, []);

  const handleGenerate = async (itemIdOverride?: string) => {
    const id = itemIdOverride || selectedItemId;
    if (!id) return alert("Please select an item");
    setIsLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ itemId: id });
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/reports/inventory-ledger?${params}`);
      const json = await res.json();
      if (json.ok) {
        const payload = json.data;
        const rows = Array.isArray(payload) ? payload : (payload.rows || []);
        setData(rows.map((t: any) => ({
          ...t,
          date: new Date(t.date).toISOString(),
        })));
        if (!Array.isArray(payload) && payload) {
          setSummary({
            openingBalance: payload.openingBalance ?? 0,
            totalIn: payload.totalIn ?? 0,
            totalOut: payload.totalOut ?? 0,
            closingBalance: payload.closingBalance ?? 0,
          });
        } else {
          const totalIn = rows.reduce((s: number, r: any) => s + (r.in || 0), 0);
          const totalOut = rows.reduce((s: number, r: any) => s + (r.out || 0), 0);
          const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0;
          const openingBalance = rows.length > 0 ? rows[0].balance - rows[0].in + rows[0].out : 0;
          setSummary({ openingBalance, totalIn, totalOut, closingBalance });
        }
      } else {
        alert(json.message || "Failed to load ledger");
        setData([]);
      }
    } catch (e) {
      console.error("Error generating ledger:", e);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLedger = (itemId: string) => {
    setSelectedItemId(itemId);
    handleGenerate(itemId);
  };

  const filteredItems = items.filter(item => {
    if (selectedCategory === "All") return true;
    const catObj = categories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase());
    if (!catObj) return false;
    return item.mainCategoryId === catObj.id || item.mainCategoryId === catObj._id;
  });

  const itemsWithOpening = useMemo(() => {
    const startRange = fromDate ? new Date(fromDate) : new Date("2000-01-01");
    
    return filteredItems.map(item => {
      let qtyIn = 0;
      let qtyOut = 0;
      
      const IN_TYPES = new Set([
        "purchase", "import_purchase", "non_tax_purchase", "sale_return", "non_tax_sale_return", "add_stock", "grn"
      ]);
      const OUT_TYPES = new Set([
        "sale", "non_tax_sale", "pos", "pos_counter_sale", "purchase_return", "non_tax_purchase_return", "reduce_stock", "challan"
      ]);
      
      invoices.forEach((inv: any) => {
        if (inv.status === "cancelled" || inv.status === "Cancelled") return;
        const invDate = new Date(inv.date || inv.createdAt);
        if (invDate < startRange) return;
        
        const invType = String(inv.type || "");
        const isIn = IN_TYPES.has(invType);
        const isOut = OUT_TYPES.has(invType);
        if (!isIn && !isOut) return;
        
        (inv.lines || []).forEach((line: any) => {
          const lineItemId = line.itemId?._id || line.itemId;
          if (String(lineItemId) !== String(item._id)) return;
          
          let qty = lineStockQty(line);
          if (qty <= 0) {
            const liters = Number(line.liters) || 0;
            const gallons = Number(line.gallons) || 0;
            if (liters > 0) qty = liters;
            else if (gallons > 0) qty = gallons;
          }
          if (qty > 0) {
            if (isIn) qtyIn += qty;
            if (isOut) qtyOut += qty;
          }
        });
      });
      
      const closing = item.stockQtyCartons || 0;
      const opening = Math.max(0, closing - qtyIn + qtyOut);
      
      return {
        ...item,
        openingStock: opening
      };
    });
  }, [filteredItems, invoices, fromDate]);

  const totalOpening = useMemo(() => {
    return itemsWithOpening.reduce((sum, item) => sum + (item.openingStock || 0), 0);
  }, [itemsWithOpening]);

  const totalStock = useMemo(() => {
    return itemsWithOpening.reduce((sum, item) => sum + (item.stockQtyCartons || 0), 0);
  }, [itemsWithOpening]);

  const totalStockValue = useMemo(() => {
    return itemsWithOpening.reduce((sum, item) => sum + (item.stockQtyCartons || 0) * (item.purchaseRate || 0), 0);
  }, [itemsWithOpening]);

  const totalRetailValue = useMemo(() => {
    return itemsWithOpening.reduce((sum, item) => sum + (item.stockQtyCartons || 0) * (item.retailRate || 0), 0);
  }, [itemsWithOpening]);

  const selectedItemObj = items.find(i => i._id === selectedItemId);

  const stats = [
    { title: "Opening Balance", value: summary.openingBalance.toLocaleString(), icon: Box, iconColor: "text-slate-600 dark:text-slate-300", iconBg: "bg-slate-50 dark:bg-slate-800/50" },
    { title: "Total In (Qty)", value: summary.totalIn.toLocaleString(), icon: ArrowUpRight, iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
    { title: "Total Out (Qty)", value: summary.totalOut.toLocaleString(), icon: ArrowDownRight, iconColor: "text-rose-600", iconBg: "bg-rose-50" },
    { title: "Closing Balance", value: summary.closingBalance.toLocaleString(), icon: Box, iconColor: "text-blue-600", iconBg: "bg-blue-50", valueColor: "text-blue-600" },
  ];

  const Filters = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
            Item <span className="text-rose-500">*</span>
          </label>
          <SearchableItemSelect
            items={filteredItems}
            value={selectedItemId}
            onChange={(val) => {
              setSelectedItemId(val);
              if (val) {
                handleGenerate(val);
              } else {
                setHasSearched(false);
                setData([]);
              }
            }}
            placeholder="Type code or name..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
      </div>
      
      <div className="flex justify-end gap-2 mt-2">
        {selectedItemId && (
          <button 
            onClick={() => {
              setSelectedItemId("");
              setHasSearched(false);
              setData([]);
            }}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          >
            Show Whole Stock
          </button>
        )}
        <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5">
          <Download size={14} /> Export CSV
        </button>
        <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5">
          <Printer size={14} /> Print
        </button>
        <button 
          className="px-3 py-2 bg-maroon-800 text-white rounded-lg text-[10px] font-bold hover:bg-maroon-900 flex items-center justify-center gap-1.5 shadow-sm shadow-maroon-900/20"
          onClick={() => handleGenerate()}
        >
          <Play size={14} /> Generate Report
        </button>
      </div>
    </div>
  );

  const trendData = data.map(t => ({
    name: new Date(t.date).toLocaleDateString('default', { day: '2-digit', month: 'short' }),
    balance: t.balance
  }));

  return (
    <ERPReportLayout
      title={selectedItemId ? `Inventory Ledger - ${selectedItemObj?.name || ""}` : "Inventory Ledger"}
      description={selectedItemId ? `Detailed historical tracking of all stock movements for ${selectedItemObj?.name || ""}.` : "Overview of current stock for all items."}
      stats={selectedItemId ? stats : undefined}
      filters={Filters}
      actions={[
        { label: "Print Ledger", onClick: printPage, icon: Printer },
        { label: "Export Excel", onClick: () => exportToExcel(selectedItemId ? data : filteredItems, "InventoryLedger.xlsx"), icon: FileSpreadsheet },
      ]}
    >
      <div className="space-y-6">
        {/* Category Filter Buttons */}
        <div className="no-print bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] p-4 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center mx-4">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2">Categories:</span>
          <button
            onClick={() => {
              setSelectedCategory("All");
              setSelectedItemId("");
              setHasSearched(false);
              setData([]);
            }}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
              selectedCategory === "All"
                ? "bg-maroon-800 text-white shadow-sm shadow-maroon-800/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }`}
          >
            All
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id || cat._id}
              onClick={() => {
                setSelectedCategory(cat.name);
                setSelectedItemId("");
                setHasSearched(false);
                setData([]);
              }}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                selectedCategory.toLowerCase() === cat.name.toLowerCase()
                  ? "bg-maroon-800 text-white shadow-sm shadow-maroon-800/20"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-4 border-maroon-800 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold">Generating inventory ledger...</p>
          </div>
        ) : selectedItemId ? (
          // DETAILED ITEM LEDGER VIEW (Switcher Techno Style)
          data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 mx-4">
              <Box size={48} className="mb-4 opacity-30" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No transactions found for this item</p>
            </div>
          ) : (
            <>
              <div className="px-4">
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tran. No.</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Party Name</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Qty In</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Qty Out</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Rate</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gross Amount</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Discount</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amt. Excl. Tax</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">G.S.T.</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amt. Incl. Tax</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Balance Qty</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((row, i) => {
                        const qty = row.in > 0 ? row.in : row.out;
                        const grossAmt = qty * row.rate;
                        return (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}</td>
                            <td className="px-4 py-3 text-[11px] font-bold text-blue-600">
                              <button 
                                onClick={() => handleInvoiceClick(row.refNo)}
                                className="hover:underline flex items-center gap-1 text-left"
                              >
                                {row.refNo}
                              </button>
                            </td>
                            <td 
                              className="px-4 py-3 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:underline cursor-pointer"
                              onClick={() => handleInvoiceClick(row.refNo)}
                            >
                              {row.partyName || "Walk-in (Cash) Customer"}
                            </td>
                            <td className="px-4 py-3 text-[11px] font-black text-emerald-600 text-right">{row.in > 0 ? row.in.toFixed(2) : ""}</td>
                            <td className="px-4 py-3 text-[11px] font-black text-rose-600 text-right">{row.out > 0 ? row.out.toFixed(2) : ""}</td>
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-400">-</td>
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-500 text-right">{row.rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-600 text-right">{grossAmt.toFixed(2)}</td>
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-400 text-right">0.00</td>
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-600 text-right">{grossAmt.toFixed(2)}</td>
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-400 text-right">0.00</td>
                            <td className="px-4 py-3 text-[11px] font-bold text-slate-700 text-right">{row.total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 text-right">{row.balance.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleInvoiceClick(row.refNo)}
                                className="px-2 py-1 bg-maroon-800 text-white rounded text-[10px] font-bold hover:bg-maroon-900 flex items-center justify-center gap-1 mx-auto"
                              >
                                <Eye size={10} /> View Invoice
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Footer Row (Styled like Switcher Techno) */}
                      <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-black">
                        <td colSpan={3} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500"></td>
                        <td className="px-2 py-2 text-right">
                          <span className="inline-block px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-bold text-slate-800 dark:text-slate-100 min-w-[70px]">
                            {summary.totalIn.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span className="inline-block px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-bold text-slate-800 dark:text-slate-100 min-w-[70px]">
                            {summary.totalOut.toFixed(2)}
                          </span>
                        </td>
                        <td colSpan={7} className="px-4 py-3 text-right text-xs font-black text-slate-700 dark:text-slate-300">
                          Balance
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span className="inline-block px-4 py-1 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded text-xs font-black text-blue-700 dark:text-blue-400 min-w-[80px]">
                            {summary.closingBalance.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {trendData.length > 1 && (
                <div className="px-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="balance" stroke="#881337" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )
        ) : (
          // WHOLE STOCK DEFAULT LIST VIEW
          <div className="px-4">
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-8">#</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Code</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Purchase Rate</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Retail Rate</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ltr / Pcs per Ctn</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Opening Balance</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Stock (Cartons)</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Reorder Level</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsWithOpening.map((item, i) => (
                    <tr key={item._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-200">{item.code}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-900 dark:text-white uppercase">{item.name}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300 text-right">Rs. {(item.purchaseRate || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300 text-right">Rs. {(item.retailRate || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-500 text-right">{(item.litersInCtn || item.liters || 0)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 text-right">{(item.openingStock || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 text-right">{(item.stockQtyCartons || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-slate-500 text-right">{(item.reorderLevel || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleViewLedger(item._id)}
                          className="px-2 py-1 bg-maroon-800 text-white rounded text-[10px] font-bold hover:bg-maroon-900 flex items-center justify-center gap-1 mx-auto"
                        >
                          <Eye size={10} /> View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row for Whole Stock List */}
                  <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-black">
                    <td colSpan={3} className="px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-300 text-right">Totals:</td>
                    <td className="px-4 py-3 text-[11px] font-bold text-slate-800 dark:text-slate-100 text-right">
                      Rs. {totalStockValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-bold text-slate-800 dark:text-slate-100 text-right">
                      Rs. {totalRetailValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">-</td>
                    <td className="px-2 py-2 text-right">
                      <span className="inline-block px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-bold text-slate-800 dark:text-slate-100 min-w-[70px]">
                        {totalOpening.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="inline-block px-3 py-1 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded text-[11px] font-bold text-blue-700 dark:text-blue-400 min-w-[70px]">
                        {totalStock.toFixed(2)}
                      </span>
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-right"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Premium Invoice Details Modal */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col relative">
              
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                <div>
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Transaction Invoice</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                    {selectedInvoice.invoiceNo}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      selectedInvoice.status?.toLowerCase() === "paid" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50" : 
                      selectedInvoice.status?.toLowerCase() === "posted" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50" : 
                      "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50"
                    }`}>
                      {selectedInvoice.status || "Posted"}
                    </span>
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold text-slate-500 dark:text-slate-400 text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6">
                {/* Billing Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Party Name</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedInvoice.partyId?.companyName || selectedInvoice.partyId?.name || selectedInvoice.customer || "Walk-in (Cash) Customer"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Transaction Date</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Reference</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedInvoice.reference || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Warehouse Location</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedInvoice.locationId?.name || "Main Warehouse"}
                    </p>
                  </div>
                </div>

                {/* Items List Table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Items Sold / Purchased</h4>
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                          <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                          <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Rate</th>
                          <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gross Amount</th>
                          <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(selectedInvoice.lines || []).map((line: any, idx: number) => {
                          const lineQty = lineStockQty(line);
                          const gross = lineQty * (Number(line.rate) || 0);
                          const net = Number(line.netAmount) || gross;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-950 dark:text-white uppercase">{line.itemId?.name || "Unknown Item"}</p>
                                {line.itemId?.code && <span className="text-[9px] font-bold text-slate-400 mt-0.5 inline-block">Code: {line.itemId.code}</span>}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-200">
                                {lineQty.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                                Rs. {(Number(line.rate) || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                                Rs. {gross.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-950 dark:text-white">
                                Rs. {net.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Totals */}
                <div className="flex flex-col items-end pt-4 border-t border-slate-100 dark:border-slate-800 gap-2">
                  <div className="flex justify-between w-64 text-xs">
                    <span className="font-medium text-slate-400">Total Gross:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Rs. {(Number(selectedInvoice.grossAmount) || Number(selectedInvoice.totalAmount) || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between w-64 text-xs">
                    <span className="font-medium text-slate-400">Discount:</span>
                    <span className="font-bold text-rose-600">Rs. {(Number(selectedInvoice.discountAmount) || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between w-64 text-sm border-t border-slate-200 dark:border-slate-800 pt-2 font-black">
                    <span className="text-slate-800 dark:text-white">Grand Total:</span>
                    <span className="text-blue-700 dark:text-blue-400">Rs. {(Number(selectedInvoice.totalAmount) || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ERPReportLayout>
  );
}
