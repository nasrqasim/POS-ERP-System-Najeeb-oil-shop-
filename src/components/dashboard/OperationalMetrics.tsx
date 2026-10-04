"use client";

import { CheckCircle2, Clock, RotateCcw, Star, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function OperationalMetrics() {
  const metrics = [
    { title: "Order Fulfillment", value: "0.0%", target: "0.0%", icon: CheckCircle2, color: "text-slate-400", bg: "bg-slate-50" },
    { title: "Avg Delivery Time", value: "0.0 days", target: "0.0 days", icon: Clock, color: "text-slate-400", bg: "bg-slate-50" },
    { title: "Return Rate", value: "0.0%", label: "Neutral", icon: RotateCcw, color: "text-slate-400", bg: "bg-slate-50" },
    { title: "Customer Satisfaction", value: "0.0/5", label: "NPS: 0", icon: Star, color: "text-slate-400", bg: "bg-slate-50" },
  ];

  const distributions = [
    { label: "1-2 days", value: "0%", color: "bg-slate-300" },
    { label: "2-3 days", value: "0%", color: "bg-slate-300" },
    { label: "3-4 days", value: "0%", color: "bg-slate-300" },
    { label: "4+ days", value: "0%", color: "bg-slate-300" },
  ];

  const returnReasons = [
    { label: "Defective", value: "0%", color: "bg-slate-300" },
    { label: "Wrong Item", value: "0%", color: "bg-slate-300" },
    { label: "Changed Mind", value: "0%", color: "bg-slate-300" },
    { label: "Damaged", value: "0%", color: "bg-slate-300" },
  ];

  const ratings = [
    { star: 5, value: "0%", color: "bg-slate-300" },
    { star: 4, value: "0%", color: "bg-slate-300" },
    { star: 3, value: "0%", color: "bg-slate-300" },
    { star: 2, value: "0%", color: "bg-slate-300" },
    { star: 1, value: "0%", color: "bg-slate-300" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Operational Metrics</h2>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider">Performance and efficiency indicators</p>
          </div>
        </div>
        <Link 
          href="/reports/sales/operational-metrics" 
          className="flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-white dark:hover:text-white transition-colors"
        >
          View More
          <ExternalLink size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-12">
        {metrics.map((metric) => (
          <div key={metric.title} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 group hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-colors">
            <div className={`p-2 rounded-xl ${metric.bg} dark:bg-slate-800 dark:text-slate-200 ${metric.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
              <metric.icon size={20} />
            </div>
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{metric.title}</h4>
            <div className="flex items-baseline gap-2">
               <span className="text-2xl font-black text-slate-800 dark:text-slate-100 dark:text-white">{metric.value}</span>
               {metric.target && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Target: {metric.target}</span>}
               {metric.label && <span className={`text-[10px] font-bold ${metric.label === "Improving" ? "text-emerald-500" : "text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500"}`}>{metric.label}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-12">
        <div>
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 mb-6">Delivery Time Distribution</h4>
          <div className="flex items-end justify-between h-32 gap-2">
            {distributions.map((item) => (
              <div key={item.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div 
                  className={`w-full ${item.color} rounded-t-xl transition-all duration-1000 hover:opacity-80 cursor-pointer`}
                  style={{ height: item.value }}
                ></div>
                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200">{item.value}</span>
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 mb-6">Return Reasons</h4>
          <div className="space-y-4">
            {returnReasons.map((reason) => (
              <div key={reason.label} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">{reason.label}</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 dark:text-slate-200">{reason.value}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${reason.color} rounded-full transition-all duration-1000`}
                    style={{ width: reason.value }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 mb-6">Rating Distribution</h4>
          <div className="space-y-3">
            {ratings.map((rating) => (
              <div key={rating.star} className="flex items-center gap-4">
                <div className="flex items-center gap-1 w-6">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">{rating.star}</span>
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                </div>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${rating.color} rounded-full transition-all duration-1000`}
                    style={{ width: rating.value }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 w-8">{rating.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
