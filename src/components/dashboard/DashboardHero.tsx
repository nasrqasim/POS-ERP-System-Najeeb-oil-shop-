"use client";

import { 
  Plus, 
  ShoppingCart, 
  BarChart3, 
  Download, 
  Search, 
  Moon, 
  Sun,
  Bell,
  FileText
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

interface DashboardHeroProps {
  userName: string;
}

export default function DashboardHero({ userName }: DashboardHeroProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [time, setTime] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    // Sync initial theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);

    const handleThemeChange = (e: any) => {
      setTheme(e.detail);
    };
    window.addEventListener("theme-changed", handleThemeChange as any);

    // Live clock
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
      setDateStr(
        now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()
      );
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 60000);

    return () => {
      window.removeEventListener("theme-changed", handleThemeChange as any);
      clearInterval(clockInterval);
    };
  }, []);

  const toggleTheme = () => window.dispatchEvent(new CustomEvent("toggle-theme"));
  const openSearch = () => window.dispatchEvent(new CustomEvent("open-search"));
  const handleExportPDF = () => window.print();

  const isLight = theme === "light";

  // Dynamic style objects driven by theme state
  const sectionBg = isLight
    ? "bg-gradient-to-br from-maroon-900 via-maroon-800 to-maroon-700"
    : "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border border-slate-700/60";

  const dividerColor = isLight ? "border-white/10" : "border-slate-700";
  const subText = isLight ? "text-white/70" : "text-slate-400";
  const mutedText = isLight ? "text-white/50" : "text-slate-500";
  const cardBg = isLight
    ? "bg-white/15 border-white/20 backdrop-blur-sm"
    : "bg-slate-800/80 border-slate-700 backdrop-blur-sm";
  const circleTrack = isLight ? "text-white/10" : "text-slate-700";

  const primaryBtn = isLight
    ? "bg-white text-maroon-900 shadow-lg hover:bg-slate-50 hover:-translate-y-0.5"
    : "bg-maroon-700 text-white shadow-lg border border-maroon-600 hover:bg-maroon-600 hover:-translate-y-0.5";

  const secondaryBtn = isLight
    ? "bg-white/20 text-white border border-white/30 hover:bg-white/35"
    : "bg-slate-700/80 text-slate-200 border border-slate-600 hover:bg-slate-600";

  const utilBtn = isLight
    ? "bg-white/20 text-white hover:bg-white/35"
    : "bg-slate-700/80 text-slate-300 hover:bg-slate-700";

  const searchWrapper = isLight
    ? "bg-white/20 border-white/30 text-white/60 hover:bg-white/30"
    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700";

  const searchIconColor = isLight ? "text-white/50" : "text-slate-500";
  const decoBlobColor = isLight ? "bg-white/5" : "bg-maroon-900/20";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <section
      className={`relative rounded-3xl p-6 lg:p-8 shadow-xl transition-all duration-500 ${sectionBg}`}
    >
      {/* Blobs clipped to section, content can overflow */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
        <div className={`absolute -right-20 -bottom-20 w-80 h-80 rounded-full blur-3xl ${decoBlobColor}`}></div>
        <div className={`absolute right-40 -top-20 w-60 h-60 rounded-full blur-3xl ${decoBlobColor}`}></div>
      </div>
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        
        {/* ── Left: Clock + Health ── */}
        <div className="flex items-center gap-8 flex-shrink-0">
          {/* Time & Date */}
          <div className={`space-y-1 border-r pr-8 ${dividerColor}`}>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-white">
              {time || "—:—"}
            </h2>
            <p className={`text-xs font-medium uppercase tracking-widest ${mutedText}`}>
              {dateStr}
            </p>
            <div className={`mt-4 pt-4 border-t ${isLight ? "border-white/5" : "border-slate-700/50"}`}>
              <p className={`text-sm font-medium ${subText}`}>{greeting},</p>
              <p className="text-xl font-black text-white">{userName}!</p>
            </div>
          </div>

          {/* Business Health Ring — hover shows breakdown */}
          <div className="relative group">
            <div className={`flex items-center gap-4 p-4 lg:p-6 rounded-2xl border cursor-pointer transition-all duration-200 group-hover:scale-105 ${cardBg}`}>
              <div className="relative w-20 h-20">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className={circleTrack} />
                  <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent"
                    strokeDasharray="226" strokeDashoffset="25"
                    className="text-emerald-400 transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-white">
                  89%
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium uppercase ${mutedText}`}>Business Health</p>
                <h3 className="text-xl font-black text-emerald-400">Excellent</h3>
              </div>
            </div>

            {/* Hover Tooltip — Health Score Breakdown */}
            <div className="absolute left-0 top-full mt-3 z-50 w-[520px] opacity-0 pointer-events-none -translate-y-2 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 transition-all duration-300 ease-out">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-black text-slate-800 dark:text-white">Health Score Breakdown</span>
                  <span className="text-sm font-black text-emerald-500">89/100</span>
                </div>
                {/* Metrics Table */}
                <div className="p-4">
                  <div className="grid grid-cols-4 gap-2 mb-2 px-1">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Metric</span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Value</span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Target</span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Score</span>
                  </div>
                  {[
                    { name: "Current Ratio", weight: "15%", value: "0.94", target: ">= 1.50", score: 63, color: "bg-amber-400" },
                    { name: "Quick Ratio", weight: "10%", value: "1.00", target: ">= 1.00", score: 100, color: "bg-emerald-500" },
                    { name: "Debt to Equity", weight: "15%", value: "0.00", target: "< 1.50", score: 100, color: "bg-emerald-500" },
                    { name: "Gross Profit Margin", weight: "15%", value: "0.0%", target: "50%", score: 0, color: "bg-red-400" },
                    { name: "Net Profit Margin", weight: "15%", value: "0.0%", target: "20%", score: 0, color: "bg-red-400" },
                    { name: "Inventory Turnover", weight: "10%", value: "0.0x", target: "6-12x", score: 0, color: "bg-red-400" },
                    { name: "Days Sales Outstanding", weight: "10%", value: "0 days", target: "< 45 days", score: 100, color: "bg-emerald-500" },
                    { name: "Order Fulfillment", weight: "5%", value: "0.0%", target: "100%", score: 0, color: "bg-red-400" },
                    { name: "Customer Satisfaction", weight: "5%", value: "4.0/5", target: "5/5", score: 80, color: "bg-emerald-400" },
                  ].map((metric) => (
                    <div key={metric.name} className="grid grid-cols-4 gap-2 items-center py-1.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block leading-tight">{metric.name}</span>
                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">({metric.weight})</span>
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center">{metric.value}</span>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 text-center">{metric.target}</span>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${metric.color}`} style={{ width: `${metric.score}%` }}></div>
                        </div>
                        <span className={`text-xs font-black w-6 text-right ${metric.score >= 80 ? "text-emerald-500" : metric.score >= 50 ? "text-amber-500" : "text-red-400"}`}>
                          {metric.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Weighted average of all metrics. Score is normalised based on available data.</p>
                </div>
              </div>
            </div>
          </div>

        </div>{/* end left panel */}

        {/* ── Right: Buttons + Search ── */}
        <div className="space-y-3 flex-shrink-0 min-w-0 max-w-full xl:max-w-[480px]">
          {/* Action buttons — 2 per row so Export never gets clipped */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/sales/sale-invoice"
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:translate-y-0 ${primaryBtn}`}
            >
              <Plus size={16} />
              New Sale
            </Link>
            <Link
              href="/purchases/purchase-invoice"
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${secondaryBtn}`}
            >
              <ShoppingCart size={16} />
              Purchase
            </Link>
            <Link
              href="/reports/financial/trial-balance"
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${secondaryBtn}`}
            >
              <BarChart3 size={16} />
              Reports
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportPDF}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${secondaryBtn}`}
                title="Print current view"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={() => {
                  document.body.classList.add("printing-snapshot");
                  window.print();
                  setTimeout(() => document.body.classList.remove("printing-snapshot"), 500);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${primaryBtn} border-2 border-white/20`}
                title="Download full website visual snapshot"
              >
                <FileText size={16} />
                PDF
              </button>
            </div>
          </div>

          {/* Search + utility icons */}
          <div className="flex items-center gap-3 no-print">
            <div onClick={openSearch} className="flex-1 relative cursor-pointer min-w-[240px]">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${searchIconColor}`} size={18} />
              <div className={`w-full border rounded-xl py-3 pl-12 pr-4 text-sm font-medium transition-all ${searchWrapper}`}>
                Search anything... (⌘K)
              </div>
            </div>
            <button
              onClick={toggleTheme}
              title={isLight ? "Switch to Dark" : "Switch to Light"}
              className={`p-3 rounded-xl transition-all ${utilBtn}`}
            >
              {isLight ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button className={`p-3 rounded-xl transition-all relative ${utilBtn}`}>
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            </button>
          </div>
        </div>
      </div>

    </section>
  );
}
