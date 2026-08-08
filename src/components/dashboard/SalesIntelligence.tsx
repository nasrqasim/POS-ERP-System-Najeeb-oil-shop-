"use client";

import { useState, useEffect } from "react";
import { TrendingUp, ExternalLink, Filter, MapPin, Package, Users, ChevronRight, BarChart3, Award } from "lucide-react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

export default function SalesIntelligence() {
  const [activeTab, setActiveTab] = useState("Funnel");
  const [productsData, setProductsData] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [conversionRate, setConversionRate] = useState("100%");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.ok) {
          if (json.data.topProducts?.length) setProductsData(json.data.topProducts);
          if (json.data.topCustomers?.length) setCustomersData(json.data.topCustomers);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);
  
  const tabs = [
    { id: "Funnel", icon: Filter },
    { id: "Regions", icon: MapPin },
    { id: "Products", icon: Package },
    { id: "Customers", icon: Users }
  ];

  const funnelData = [
    { label: "Quotations", count: 12, amount: "Rs.450,000", progress: "100%", color: "border-maroon-800" },
    { label: "Accepted", count: 8, amount: "Rs.320,000", progress: "66.6%", color: "border-maroon-600" },
    { label: "Sale Orders", count: 7, amount: "Rs.290,000", progress: "58.3%", color: "border-maroon-500" },
    { label: "Approved", count: 6, amount: "Rs.250,000", progress: "50.0%", color: "border-maroon-400" },
    { label: "Invoiced", count: 5, amount: "Rs.210,000", progress: "41.6%", color: "border-maroon-300" },
  ];

  const regionsData = [
    { name: "North Region", value: 450000, fill: "#881337" },
    { name: "South Region", value: 320000, fill: "#be123c" },
    { name: "East Region", value: 180000, fill: "#e11d48" },
    { name: "West Region", value: 95000, fill: "#fb7185" },
  ];

  const defaultProductsData = [
    { name: "Premium Engine Oil 5W-40", qty: "450 L", amount: "Rs.150,000", trend: "+12%" },
    { name: "Industrial Lubricant XP", qty: "320 L", amount: "Rs.85,000", trend: "+5%" },
    { name: "Brake Fluid DOT 4", qty: "280 L", amount: "Rs.42,000", trend: "-2%" },
    { name: "Heavy Duty Gear Oil", qty: "150 L", amount: "Rs.35,000", trend: "+8%" },
  ];

  const defaultCustomersData = [
    { name: "Alpha Transport Co.", type: "B2B", amount: "Rs.125,000", orders: 12 },
    { name: "Delta Logistics", type: "B2B", amount: "Rs.85,000", orders: 8 },
    { name: "General Customer", type: "Retail", amount: "Rs.45,000", orders: 24 },
    { name: "Omega Industries", type: "B2B", amount: "Rs.32,000", orders: 3 },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-maroon-50 dark:bg-maroon-900/30 text-maroon-800 dark:text-maroon-400 rounded-lg">
              <TrendingUp size={18} />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Sales Intelligence</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Sales pipeline and performance analysis</p>
        </div>
        <Link 
          href="/reports/sales/intelligence" 
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
        {activeTab === "Funnel" && (
          <div className="space-y-3">
            {funnelData.map((item) => (
              <div 
                key={item.label}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-l-4 ${item.color} bg-white dark:bg-slate-900 border border-y-slate-100 border-r-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group`}
              >
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-maroon-900 dark:group-hover:text-maroon-400 transition-colors">{item.label}</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 w-6 text-right">{item.count}</span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 w-20 text-right">{item.amount}</span>
                  <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md w-14 text-center">{item.progress}</span>
                </div>
              </div>
            ))}
            <div className="mt-6 p-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><BarChart3 size={12} /> Conversion Rate</p>
                  <h4 className="text-2xl font-black text-white">41.6%</h4>
                </div>
                <div className="h-12 w-12 rounded-full border-4 border-emerald-500/30 flex items-center justify-center text-[10px] font-black text-emerald-400 bg-emerald-500/10">
                  +5%
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Regions" && (
          <div className="space-y-4">
            <div className="h-48 mb-6 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionsData} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} formatter={(value) => `Rs. ${(value as number).toLocaleString()}`} />
                  <Bar dataKey="value" barSize={16} radius={[0, 4, 4, 0]}>
                    {regionsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {regionsData.map((region) => (
                <div key={region.name} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{region.name}</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 dark:text-white">Rs.{region.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Products" && (
          <div className="space-y-3">
            {(productsData.length ? productsData : defaultProductsData).map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center justify-center text-[10px] font-black group-hover:bg-maroon-50 dark:group-hover:bg-maroon-900/30 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors">{product.name}</p>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{product.qty} Sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">{product.amount}</p>
                  <p className={`text-[9px] font-black mt-0.5 ${product.trend?.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{product.trend || '+5%'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Customers" && (
          <div className="space-y-3">
            {(customersData.length ? customersData : defaultCustomersData).map((customer, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Award size={14} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors">{customer.name}</p>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 inline-block">{customer.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{customer.amount}</p>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{customer.orders} orders</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
