"use client";

import ERPReportLayout from "@/components/erp/reports/ERPReportLayout";
import { Clock, Download, Printer, Play, FileSpreadsheet } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";
import { useState, useEffect } from "react";
import { stockToDisplayUnits } from "@/lib/itemUnits";

export default function InventoryLedgerReportPage() {
  const [hasSearched, setHasSearched] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [displayUnit, setDisplayUnit] = useState<"cartons" | "gallons" | "litres">("cartons");
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch('/api/items');
        const json = await res.json();
        if (json.ok) setItems(json.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchItems();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedItemId) {
      alert("Please select an item");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/inventory-ledger?itemId=${selectedItemId}`);
      const json = await res.json();
      if (json.ok) {
        setLedgerData(json.data);
        setHasSearched(true);
      } else {
        alert(json.message || "Failed to fetch ledger data");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching ledger data");
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    if (itemId && hasSearched) {
      // Auto-refresh if already searched
      handleGenerateReport();
    }
  };

  const handleExportExcel = () => {
    const exportData = displayData.map((row: any) => {
      const inDisplay = stockToDisplayUnits(row.in || row.qtyIn || 0, conversionValues);
      const outDisplay = stockToDisplayUnits(row.out || row.qtyOut || 0, conversionValues);
      const balDisplay = stockToDisplayUnits(row.balance || 0, conversionValues);
      
      const getValue = (display: { cartons: number; gallons: number; liters: number }) => {
        switch (displayUnit) {
          case "cartons": return display.cartons;
          case "gallons": return display.gallons;
          case "litres": return display.liters;
          default: return display.cartons;
        }
      };

      const formatDate = (date: Date | string) => {
        if (!date) return "-";
        const d = new Date(date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      return {
        Date: formatDate(row.date),
        Type: row.type,
        DocNo: row.refNo || row.docNo,
        Location: row.location,
        QtyIn: getValue(inDisplay),
        QtyOut: getValue(outDisplay),
        Balance: getValue(balDisplay),
      };
    });
    
    exportToExcel(exportData, `InventoryLedger_${getUnitLabel()}.xlsx`);
  };

  const Filters = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item *</label>
          <select 
            value={selectedItemId}
            onChange={(e) => handleItemChange(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500"
          >
            <option value="">Select Item</option>
            {items.map((item) => (
              <option key={item._id} value={item._id} className="text-slate-900 dark:text-white">
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">From Date</label>
          <input type="date" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">To Date</label>
          <input type="date" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Location</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Locations</option>
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Transaction Type</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All Types</option>
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Direction</label>
          <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20">
            <option>All</option>
            <option>In</option>
            <option>Out</option>
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Display Unit</label>
          <select 
            value={displayUnit}
            onChange={(e) => setDisplayUnit(e.target.value as "cartons" | "gallons" | "litres")}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
          >
            <option value="cartons">Cartons (CTN)</option>
            <option value="gallons">Gallons</option>
            <option value="litres">Litres</option>
          </select>
        </div>
        
        <div className="md:col-span-5 flex justify-end gap-2 mt-4">
          <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 flex items-center justify-center gap-1.5">
            <Download size={14} /> Export CSV
          </button>
          <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 flex items-center justify-center gap-1.5">
            <Printer size={14} /> Print
          </button>
          <button 
            className="px-3 py-2 bg-maroon-800 text-white rounded-lg text-xs font-bold hover:bg-maroon-900 flex items-center justify-center gap-1.5 shadow-sm shadow-maroon-900/20"
            onClick={handleGenerateReport}
            disabled={loading}
          >
            <Play size={14} /> {loading ? "Loading..." : "Generate Report"}
          </button>
        </div>
      </div>
    </div>
  );

  const dummyData = [
    { id: 1, date: "28-Apr-2026", type: "Opening", docNo: "-", location: "Main Warehouse", qtyIn: 50, qtyOut: 0, balance: 50 },
    { id: 2, date: "29-Apr-2026", type: "Sales Invoice", docNo: "SI-001", location: "Main Warehouse", qtyIn: 0, qtyOut: 10, balance: 40 },
    { id: 3, date: "30-Apr-2026", type: "Purchase Order", docNo: "PO-022", location: "Main Warehouse", qtyIn: 100, qtyOut: 0, balance: 140 },
  ];

  const displayData = ledgerData?.rows || dummyData;
  const selectedItem = items.find(i => i._id === selectedItemId) || items[0] || { gallonsInCtn: 4, litersInCtn: 16 };
  const conversionValues = ledgerData ? { gallonsInCtn: ledgerData.gallonsInCtn || 4, litersInCtn: ledgerData.litersInCtn || 16 } : selectedItem;

  const getUnitLabel = () => {
    switch (displayUnit) {
      case "cartons": return "CTN";
      case "gallons": return "Gal";
      case "litres": return "Ltr";
      default: return "CTN";
    }
  };

  return (
    <ERPReportLayout
      title="Inventory Ledger"
      description="Stock movement history for specific items across all warehouse locations."
      filters={Filters}
      actions={[
        { label: "Print Ledger", onClick: printPage, icon: Printer },
        { label: "Export Excel", onClick: handleExportExcel, icon: FileSpreadsheet },
      ]}
    >
      <div className="p-0">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">
            <Clock size={48} className="mb-4 opacity-30" />
            <p className="text-sm font-medium">Select an item and date range to view the ledger</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50/50 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Doc #</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Location</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Qty In ({getUnitLabel()})</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Qty Out ({getUnitLabel()})</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Balance ({getUnitLabel()})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayData.map((row: any, index: number) => {
                const inDisplay = stockToDisplayUnits(row.in, conversionValues);
                const outDisplay = stockToDisplayUnits(row.out, conversionValues);
                const balDisplay = stockToDisplayUnits(row.balance, conversionValues);
                
                const getDisplayQty = (display: { cartons: number; gallons: number; liters: number }) => {
                  switch (displayUnit) {
                    case "cartons": return display.cartons.toFixed(2);
                    case "gallons": return display.gallons.toFixed(2);
                    case "litres": return display.liters.toFixed(2);
                    default: return display.cartons.toFixed(2);
                  }
                };
                
                const formatDate = (date: Date | string) => {
                  if (!date) return "-";
                  const d = new Date(date);
                  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                };
                
                return (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">{formatDate(row.date)}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">{row.type}</td>
                    <td className="px-6 py-4 text-xs font-bold text-blue-600 cursor-pointer hover:underline">{row.refNo}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">{row.location}</td>
                    <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">
                      {row.in > 0 ? getDisplayQty(inDisplay) : '-'}
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-rose-600 text-right">
                      {row.out > 0 ? getDisplayQty(outDisplay) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-slate-800 dark:text-slate-100 text-right">
                      {getDisplayQty(balDisplay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
              <tr>
                <td className="px-6 py-3 text-xs font-black text-slate-700 dark:text-slate-200" colSpan={4}>Total</td>
                <td className="px-6 py-3 text-xs font-black text-emerald-600 text-right">
                  {(() => {
                    const totalIn = ledgerData?.totalIn || displayData.reduce((sum: number, row: any) => sum + (row.qtyIn || row.in || 0), 0);
                    const inDisplay = stockToDisplayUnits(totalIn, conversionValues);
                    switch (displayUnit) {
                      case "cartons": return inDisplay.cartons.toFixed(2);
                      case "gallons": return inDisplay.gallons.toFixed(2);
                      case "litres": return inDisplay.liters.toFixed(2);
                      default: return inDisplay.cartons.toFixed(2);
                    }
                  })()}
                </td>
                <td className="px-6 py-3 text-xs font-black text-rose-600 text-right">
                  {(() => {
                    const totalOut = ledgerData?.totalOut || displayData.reduce((sum: number, row: any) => sum + (row.qtyOut || row.out || 0), 0);
                    const outDisplay = stockToDisplayUnits(totalOut, conversionValues);
                    switch (displayUnit) {
                      case "cartons": return outDisplay.cartons.toFixed(2);
                      case "gallons": return outDisplay.gallons.toFixed(2);
                      case "litres": return outDisplay.liters.toFixed(2);
                      default: return outDisplay.cartons.toFixed(2);
                    }
                  })()}
                </td>
                <td className="px-6 py-3 text-sm font-black text-slate-800 dark:text-slate-100 text-right">
                  {(() => {
                    const closingBalance = ledgerData?.closingBalance || (displayData[displayData.length - 1]?.balance || 0);
                    const balDisplay = stockToDisplayUnits(closingBalance, conversionValues);
                    switch (displayUnit) {
                      case "cartons": return balDisplay.cartons.toFixed(2);
                      case "gallons": return balDisplay.gallons.toFixed(2);
                      case "litres": return balDisplay.liters.toFixed(2);
                      default: return balDisplay.cartons.toFixed(2);
                    }
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </ERPReportLayout>
  );
}
