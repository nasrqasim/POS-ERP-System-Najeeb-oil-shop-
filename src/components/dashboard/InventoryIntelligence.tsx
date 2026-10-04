"use client";

import { useState, useEffect } from "react";
import { Box, ExternalLink, AlertTriangle, MapPin, Package, TrendingDown, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export default function InventoryIntelligence() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    const fetchInv = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.ok && Array.isArray(json.data.categoryData)) {
          setCategoryData(json.data.categoryData);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchInv();
  }, []);

  const tabs = [
    { id: "Overview", icon: Box },
    { id: "Alerts", icon: AlertTriangle },
    { id: "Locations", icon: MapPin }
  ];

  const agingData = [
    { label: "0-30 days", progress: 65, color: "bg-emerald-500", text: "text-emerald-500" },
    { label: "31-60 days", progress: 20, color: "bg-amber-500", text: "text-amber-500" },
    { label: "61-90 days", progress: 10, color: "bg-orange-400", text: "text-orange-500" },
    { label: "90+ days", progress: 5, color: "bg-rose-600", text: "text-rose-600" },
  ];

  const alertsData: any[] = [];
  const locationsData: any[] = [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-maroon-50 dark:bg-maroon-900/30 text-maroon-800 dark:text-maroon-400 rounded-lg">
              <Box size={18} />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Inventory Intelligence</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Stock levels, alerts, and optimization</p>
        </div>
        <Link 
          href="/reports/inventory/intelligence" 
          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-maroon-800 transition-colors border border-slate-200 dark:border-slate-800 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800"
        >
          View More
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black flex items-center gap-1.5 transition-all ${
              activeTab === tab.id 
                ? "bg-maroon-800 text-white shadow-md" 
                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 hover:text-slate-800 dark:text-slate-100 dark:hover:text-slate-200"
            }`}
          >
            <tab.icon size={12} />
            {tab.id}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {activeTab === "Overview" && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1 h-48 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-2">
                <div className="h-full w-full">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                          {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} formatter={(value) => `Rs. ${(value as number).toLocaleString()}`} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                      <Box size={24} className="mb-2 opacity-40" />
                      <p className="text-xs font-bold">No inventory categories yet</p>
                      <p className="text-[10px] text-slate-400">Add products to populate categories</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Inventory Aging</h4>
              <div className="grid grid-cols-2 gap-3">
                {agingData.map((item) => (
                  <div key={item.label} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.color}`}></div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.label}</span>
                      </div>
                      <span className={`text-xs font-black ${item.text}`}>{item.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Alerts" && (
          <div className="space-y-3">
            {alertsData.map((alert, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${alert.color} dark:bg-slate-800 dark:text-slate-200`}>
                    <alert.icon size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${alert.color} dark:bg-slate-800 dark:text-slate-400 dark:text-slate-500`}>{alert.type}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors mb-1">{alert.item}</p>
                    <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      <span>Current: <span className="font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200">{alert.qty}</span></span>
                      <span className="text-slate-300 dark:text-slate-700 dark:text-slate-200">•</span>
                      <span>Threshold: <span className="font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200">{alert.threshold}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Locations" && (
          <div className="space-y-3">
            {locationsData.map((loc, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200">{loc.name}</p>
                  </div>
                  <p className="text-[11px] font-black text-maroon-800 dark:text-maroon-400">{loc.value}</p>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Quantity</span>
                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200">{loc.qty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${loc.capacity > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${loc.capacity}%` }}
                    ></div>
                  </div>
                  <span className={`text-[9px] font-black ${loc.capacity > 80 ? 'text-rose-500' : 'text-emerald-500'}`}>{loc.capacity}% full</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
