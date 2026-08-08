"use client";

import { useState, useEffect } from "react";
import { Activity, ExternalLink, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function FinancialHealth() {
  const [data, setData] = useState({
    workingCapital: 0,
    grossMarginPercent: 0,
    netMarginPercent: 0,
    currentRatio: "1.85",
    quickRatio: "1.20",
    debtToEquity: "0.45"
  });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.ok) {
          const d = json.data;
          const cash = d.cashBank?.current || 0;
          const ar = d.receivables?.current || 0;
          const ap = d.payables?.current || 1;
          const stock = d.totalStockValue || 0;

          const cRatio = (ap > 0 ? (cash + ar + stock) / ap : 1.5).toFixed(2);
          const qRatio = (ap > 0 ? (cash + ar) / ap : 1.0).toFixed(2);
          const deRatio = (cash + ar > 0 ? ap / (cash + ar) : 0.45).toFixed(2);

          setData({
            workingCapital: d.workingCapital || (cash + ar - ap),
            grossMarginPercent: d.grossMarginPercent || 0,
            netMarginPercent: d.netMarginPercent || 0,
            currentRatio: cRatio,
            quickRatio: qRatio,
            debtToEquity: deRatio
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchHealth();
  }, []);

  const ratios = [
    { title: "Current Ratio", label: "Liquidity measure", value: data.currentRatio, target: "1.50", color: "text-emerald-500", progress: Math.min(100, Math.round((Number(data.currentRatio) / 1.5) * 100)) },
    { title: "Quick Ratio", label: "Acid-test ratio", value: data.quickRatio, target: "1.00", color: "text-emerald-500", progress: Math.min(100, Math.round((Number(data.quickRatio) / 1.0) * 100)) },
    { title: "Debt to Equity", label: "Leverage ratio", value: data.debtToEquity, target: "1.00", color: "text-amber-500", progress: Math.min(100, Math.round(Number(data.debtToEquity) * 100)) },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Financial Health</h2>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Key financial ratios and metrics</p>
          </div>
        </div>
        <Link 
          href="/reports/financial/health" 
          className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-rose-800 transition-colors"
        >
          View More
          <ExternalLink size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {ratios.map((ratio) => (
          <div key={ratio.title} className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
            <div className="relative w-24 h-24 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  className="text-slate-200 dark:text-slate-800"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="251"
                  strokeDashoffset={251 - (251 * ratio.progress) / 100}
                  className={`${ratio.color} transition-all duration-1000`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-800 dark:text-slate-100">
                {ratio.value}
              </div>
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">{ratio.title}</h3>
            <p className="text-[10px] text-slate-400 mb-2 uppercase font-medium">{ratio.label}</p>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
              Target: {ratio.target}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="text-rose-500">%</span> Profit Margins
        </h4>
        <div className="space-y-4">
          {[
            { label: "Gross Margin", value: `${data.grossMarginPercent}%` },
            { label: "Net Margin", value: `${data.netMarginPercent}%` },
          ].map((margin) => (
            <div key={margin.label} className="group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{margin.label}</span>
                <span className="text-sm font-black text-amber-500">{margin.value}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: margin.value.includes("-") ? "0%" : margin.value }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="text-rose-500">$</span> Working Capital
          </h4>
        </div>
        <Link 
          href="/reports/financial/cash-management"
          className="block bg-maroon-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-maroon-900/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-4xl font-black mb-2">Rs. {Math.round(data.workingCapital).toLocaleString()}</h3>
                <p className="text-xs font-bold text-white/60 flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Live Net Liquidity</span>
                </p>
              </div>
              <div className="p-3 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors">
                <ExternalLink size={20} className="text-white/80 group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
