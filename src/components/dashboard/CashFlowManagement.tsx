"use client";

import { useState, useEffect } from "react";
import { Banknote, ExternalLink, ArrowUpRight, ArrowDownLeft, TrendingUp, ArrowRightLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function CashFlowManagement() {
  const [activeTab, setActiveTab] = useState("Flow");
  const [flowData, setFlowData] = useState<any[]>([
    { month: 'Jan', inflow: 450000, outflow: 380000 },
    { month: 'Feb', inflow: 520000, outflow: 410000 },
    { month: 'Mar', inflow: 480000, outflow: 450000 },
    { month: 'Apr', inflow: 610000, outflow: 390000 },
    { month: 'May', inflow: 590000, outflow: 420000 },
    { month: 'Jun', inflow: 650000, outflow: 480000 },
  ]);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.ok && json.data.flowData?.length) {
          setFlowData(json.data.flowData);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchFlow();
  }, []);

  const tabs = [
    { id: "Flow", icon: ArrowRightLeft },
    { id: "Payables", icon: ArrowUpRight },
    { id: "Receivables", icon: ArrowDownLeft },
    { id: "Forecast", icon: TrendingUp }
  ];

  const payablesData = [
    { name: "Alpha Supplies Ltd", amount: "Rs. 125,000", due: "Due in 5 days", urgency: "text-rose-500 bg-rose-50" },
    { name: "Delta Logistics", amount: "Rs. 85,000", due: "Due in 12 days", urgency: "text-amber-500 bg-amber-50" },
    { name: "Omega Industries", amount: "Rs. 45,000", due: "Due in 20 days", urgency: "text-emerald-500 bg-emerald-50" },
  ];

  const receivablesData = [
    { name: "Global Motors", amount: "Rs. 250,000", due: "Overdue 3 days", urgency: "text-rose-500 bg-rose-50" },
    { name: "Tech Auto Parts", amount: "Rs. 180,000", due: "Due Tomorrow", urgency: "text-amber-500 bg-amber-50" },
    { name: "City Transport Co.", amount: "Rs. 95,000", due: "Due in 8 days", urgency: "text-emerald-500 bg-emerald-50" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-lg">
              <Banknote size={18} />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Cash Flow Management</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Track inflows, outflows, and projections</p>
        </div>
        <Link 
          href="/reports/financial/cash-management" 
          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-800 transition-colors border border-slate-200 dark:border-slate-800 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800"
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
        {activeTab === "Flow" && (
          <div className="space-y-6">
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flowData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(value) => `Rs.${value/1000}k`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#0f172a', color: '#fff' }}
                    formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, undefined]}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInflow)" />
                  <Area type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOutflow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 group hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300 rounded-lg">
                    <ArrowDownLeft size={14} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Inflow</p>
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">Rs. 3,300,000</h4>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 group hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-rose-100 dark:bg-rose-800 text-rose-600 dark:text-rose-300 rounded-lg">
                    <ArrowUpRight size={14} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Outflow</p>
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">Rs. 2,530,000</h4>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Payables" && (
          <div className="space-y-3">
            {payablesData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:bg-maroon-50 dark:group-hover:bg-maroon-900/30 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors">
                    <ArrowUpRight size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-maroon-900 dark:group-hover:text-maroon-400 transition-colors">{item.name}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1 inline-block ${item.urgency} dark:bg-slate-800 dark:text-slate-400 dark:text-slate-500`}>{item.due}</span>
                  </div>
                </div>
                <p className="text-sm font-black text-rose-600 dark:text-rose-400">{item.amount}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Receivables" && (
          <div className="space-y-3">
            {receivablesData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    <ArrowDownLeft size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{item.name}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1 inline-block ${item.urgency} dark:bg-slate-800 dark:text-slate-400 dark:text-slate-500`}>{item.due}</span>
                  </div>
                </div>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{item.amount}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Forecast" && (
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl text-slate-300">
             <Calendar size={32} className="mb-3 text-slate-200 dark:text-slate-700 dark:text-slate-200" />
             <p className="text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-1">AI Forecast Generation</p>
             <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 dark:text-slate-600 dark:text-slate-300 max-w-[200px] text-center">Collect more data to generate 30-day cash flow predictions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
