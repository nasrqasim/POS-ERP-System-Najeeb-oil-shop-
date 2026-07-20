"use client";

import ERPReportLayout from "@/components/erp/reports/ERPReportLayout";
import { Download, Printer, Play, Box, AlertTriangle, XCircle, AlertCircle, Search, RefreshCcw, ShoppingCart, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";
import { useState, useEffect } from "react";
import { stockToDisplayUnits } from "@/lib/itemUnits";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

export default function LowStockAlertReportPage() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showOnlyBelowReorder, setShowOnlyBelowReorder] = useState(true);

  // Filters State
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubCategory, setSelectedSubCategory] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [itemsRes, catsRes] = await Promise.all([
          fetch('/api/items'),
          fetch('/api/categories')
        ]);
        const itemsJson = await itemsRes.json();
        const catsJson = await catsRes.json();
        
        if (itemsJson.ok) {
          setItems(itemsJson.data);
        }
        if (catsJson.ok) {
          setCategories(catsJson.data);
        }
      } catch (e) {
        console.error("Error fetching report data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const categoryMap = new Map(categories.map(c => [c._id, c]));

  // 1. First calculate full items with category names and stock status
  const mappedItems = items.map(item => {
    const stock = item.stockQtyCartons || 0;
    const reorder = item.reorderLevel || 0;
    const safety = Math.floor(reorder * 0.5); // Placeholder safety stock
    const gap = stock - reorder;
    
    let status = "Adequate";
    if (stock === 0) status = "Out of Stock";
    else if (stock <= reorder) status = "Critical";
    else if (stock <= reorder * 1.2) status = "Warning";

    const mainCategory = categoryMap.get(item.mainCategoryId);
    const subCategory = categoryMap.get(item.subCategoryId);

    return {
      ...item,
      stock,
      reorder,
      safety,
      gap,
      status,
      mainCategoryName: mainCategory?.name || "",
      subCategoryName: subCategory?.name || ""
    };
  });

  // 2. Filter items based on selected criteria (excluding reorder toggle to calculate stats properly)
  const filteredItems = mappedItems.filter(item => {
    // Category filter
    if (selectedCategory !== "All" && item.mainCategoryId !== selectedCategory) return false;

    // Sub Category filter
    if (selectedSubCategory !== "All" && item.subCategoryId !== selectedSubCategory) return false;

    // Location filter
    if (selectedLocation !== "All" && "Warehouse-1" !== selectedLocation) return false;

    // Alert Level filter
    if (selectedLevel !== "All") {
      if (selectedLevel === "Out of Stock" && item.status !== "Out of Stock") return false;
      if (selectedLevel === "Below Reorder" && item.status !== "Critical") return false;
      if (selectedLevel === "Safety Stock Warning" && item.status !== "Warning") return false;
    }

    // Date Filter (show items updated/created on or before selected date)
    if (selectedDate) {
      const itemDate = new Date(item.updatedAt || item.createdAt || Date.now());
      const filterDate = new Date(selectedDate);
      filterDate.setHours(23, 59, 59, 999); // Include full day
      if (itemDate > filterDate) return false;
    }

    // Search query matches code, name, category, subcategory
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = (item.name || "").toLowerCase().includes(query);
      const matchesCode = (item.code || "").toLowerCase().includes(query);
      const matchesCat = (item.mainCategoryName || "").toLowerCase().includes(query);
      const matchesSubCat = (item.subCategoryName || "").toLowerCase().includes(query);
      if (!matchesName && !matchesCode && !matchesCat && !matchesSubCat) return false;
    }

    return true;
  });

  // 3. Final display list filtered by reorder level toggle
  const lowStockItems = filteredItems.filter(item => !showOnlyBelowReorder || item.stock <= item.reorder);

  const stats = [
    { title: "Total Items", value: filteredItems.length.toString(), icon: Box, iconColor: "text-slate-600 dark:text-slate-300", iconBg: "bg-slate-50 dark:bg-slate-800/50" },
    { title: "Items Below Reorder", value: filteredItems.filter(i => i.stock <= i.reorder).length.toString(), icon: AlertTriangle, iconColor: "text-amber-600", iconBg: "bg-amber-50", wrapperClass: "border-l-4 border-l-amber-500" },
    { title: "Items Out of Stock", value: filteredItems.filter(i => i.stock === 0).length.toString(), icon: XCircle, iconColor: "text-rose-600", iconBg: "bg-rose-50", wrapperClass: "border-l-4 border-l-rose-500" },
    { title: "Warning / Critical", value: filteredItems.filter(i => i.stock <= i.reorder * 1.2).length.toString(), icon: AlertCircle, iconColor: "text-orange-600", iconBg: "bg-orange-50", wrapperClass: "border-l-4 border-l-orange-500" },
  ];

  const Filters = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Category</label>
          <select 
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setSelectedSubCategory("All");
            }}
            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20 dark:text-white"
          >
            <option value="All">All Categories</option>
            {categories.filter(c => c.type === "main").map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sub Category</label>
          <select 
            value={selectedSubCategory}
            onChange={e => setSelectedSubCategory(e.target.value)}
            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20 dark:text-white"
          >
            <option value="All">All Sub Categories</option>
            {categories
              .filter(c => c.type === "sub" && (selectedCategory === "All" || c.parentId === selectedCategory))
              .map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Location</label>
          <select 
            value={selectedLocation}
            onChange={e => setSelectedLocation(e.target.value)}
            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20 dark:text-white"
          >
            <option value="All">All Locations</option>
            <option value="Warehouse-1">Warehouse-1</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alert Level</label>
          <select 
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value)}
            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20 dark:text-white"
          >
            <option value="All">All Levels</option>
            <option value="Out of Stock">Out of Stock</option>
            <option value="Below Reorder">Below Reorder</option>
            <option value="Safety Stock Warning">Safety Stock Warning</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</label>
          <input 
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/20 dark:text-white"
          />
        </div>
        <div className="space-y-1 flex items-end">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={12} />
            <input 
              type="text" 
              placeholder="Search by code, name, category..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-maroon-800/10 font-medium transition-all dark:text-white" 
            />
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-10 h-5 rounded-full p-1 transition-colors ${showOnlyBelowReorder ? 'bg-maroon-800' : 'bg-slate-200'}`} onClick={() => setShowOnlyBelowReorder(!showOnlyBelowReorder)}>
                    <div className={`w-3 h-3 bg-white dark:bg-slate-900 rounded-full transition-transform ${showOnlyBelowReorder ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:text-slate-100">Show Only Below Reorder</span>
            </label>
            <div className="flex items-center gap-2">
                <div className="w-10 h-5 bg-slate-200 rounded-full p-1">
                    <div className="w-3 h-3 bg-white dark:bg-slate-900 rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    Auto-Refresh (60s) <RefreshCcw size={10} />
                </span>
            </div>
        </div>

        <div className="flex gap-2">
            <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 flex items-center justify-center gap-1.5">
                <Download size={14} /> CSV Export
            </button>
            <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 flex items-center justify-center gap-1.5">
                <Printer size={14} /> Print
            </button>
            <button className="px-3 py-2 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-600/20">
                <ShoppingCart size={14} /> Create PO (12)
            </button>
        </div>
      </div>
    </div>
  );

  const pieData = [
    { name: 'Critical', value: items.filter(i => i.stockQtyCartons > 0 && i.stockQtyCartons <= i.reorderLevel).length, color: '#e11d48' },
    { name: 'Warning', value: items.filter(i => i.stockQtyCartons > i.reorderLevel && i.stockQtyCartons <= i.reorderLevel * 1.2).length, color: '#f59e0b' },
    { name: 'Adequate', value: items.filter(i => i.stockQtyCartons > i.reorderLevel * 1.2).length, color: '#10b981' },
    { name: 'Out of Stock', value: items.filter(i => i.stockQtyCartons === 0).length, color: '#000000' },
  ].filter(d => d.value > 0);

  return (
    <ERPReportLayout
      title="Low Stock Alert"
      description="Real-time alerts for items below reorder levels or out of stock."
      stats={stats}
      filters={Filters}
      actions={[
        { label: "Print Alerts", onClick: printPage, icon: Printer },
        { label: "Export Excel", onClick: () => exportToExcel(lowStockItems, "LowStockAlerts.xlsx"), icon: FileSpreadsheet },
      ]}
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-4 border-maroon-800 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold">Checking stock levels...</p>
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50/50 mx-4">
            <CheckCircle2 size={48} className="mb-4 text-emerald-500 opacity-50" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">All items are adequately stocked!</p>
            <p className="text-xs mt-1">No items are currently below their reorder levels.</p>
          </div>
        ) : (
          <>
            <div className="px-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest text-rose-800">Critical Stock Alerts</h3>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded text-xs font-bold">{lowStockItems.length} alerts</span>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest w-8">#</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item Code</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item Name</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Location</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-right">Current Stock (C/G/L)</th>
                      <th className="px-4 py-3 text-[9px] font-black text-amber-600 uppercase tracking-widest text-right">Reorder Level</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Safety Stock</th>
                      <th className="px-4 py-3 text-[9px] font-black text-rose-600 uppercase tracking-widest text-right">Gap</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockItems.map((row, i) => {
                      const stockDisplay = stockToDisplayUnits(row.stock, row);
                      const formatQty = (c: number, g: number, l: number) => 
                        `${c.toFixed(2)} / ${g.toFixed(2)} / ${l.toFixed(2)}`;
                      
                      return (
                        <tr key={row._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/50 transition-colors">
                          <td className="px-4 py-3 text-[11px] font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">{i + 1}</td>
                          <td className="px-4 py-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50/50">{row.code}</td>
                          <td className="px-4 py-3 text-[11px] font-bold text-maroon-800 cursor-pointer hover:underline">{row.name}</td>
                          <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">Warehouse-1</td>
                          <td className={`px-4 py-3 text-[11px] font-black text-right ${row.stock === 0 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>
                            {formatQty(stockDisplay.cartons, stockDisplay.gallons, stockDisplay.liters)}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-black text-amber-600 text-right bg-amber-50/30">{row.reorder}</td>
                          <td className="px-4 py-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right">{row.safety}</td>
                          <td className={`px-4 py-3 text-[11px] font-black text-right bg-rose-50/30 ${row.gap < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{row.gap}</td>
                          <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                  row.status === 'Out of Stock' ? 'bg-rose-100 text-rose-700' : 
                                  row.status === 'Critical' ? 'bg-orange-100 text-orange-700' : 
                                  row.status === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                  {row.status}
                              </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-widest">Stock Health Overview</h3>
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
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-widest">Alert Distribution by Category</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                        { name: 'Lubricants', critical: 2, warning: 5 },
                        { name: 'Filters', critical: 1, warning: 4 },
                    ]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <RechartsTooltip />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }}/>
                      <Bar dataKey="critical" name="Critical" fill="#e11d48" barSize={30} />
                      <Bar dataKey="warning" name="Warning" fill="#f59e0b" barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ERPReportLayout>
  );
}
