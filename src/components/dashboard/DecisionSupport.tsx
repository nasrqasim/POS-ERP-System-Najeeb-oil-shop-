"use client";

import { useState } from "react";
import { Zap, ExternalLink, Sparkles, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function DecisionSupport() {
  const [activeTab, setActiveTab] = useState("Insights");
  const insights: any[] = [];
  const actions: any[] = [];
  const approvals: any[] = [];
  const alerts: any[] = [];

  const tabs = [
    { label: "Insights", count: insights.length },
    { label: "Actions", count: actions.length },
    { label: "Approvals", count: approvals.length },
    { label: "Alerts", count: alerts.length }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Decision Support</h2>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider">AI-powered insights and action items</p>
          </div>
        </div>
        <Link 
          href="/ai-insights" 
          className="flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
        >
          View More
          <ExternalLink size={14} />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.label)}
            className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === tab.label 
                ? "bg-maroon-800 text-white shadow-lg" 
                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 hover:text-slate-800 dark:text-slate-100 dark:hover:text-slate-200"
            }`}
          >
            {tab.label === "Insights" && <Sparkles size={14} className={activeTab === "Insights" ? "text-amber-300" : "text-amber-500"} />}
            {tab.label === "Actions" && <CheckCircle2 size={14} />}
            {tab.label === "Approvals" && <Clock size={14} />}
            {tab.label === "Alerts" && <AlertCircle size={14} />}
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab.label ? "bg-white dark:bg-slate-900/20" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === "Insights" && insights.length > 0 && insights.map((insight) => (
          <div key={insight.id} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-maroon-900 dark:group-hover:text-maroon-400 transition-colors">{insight.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{insight.type}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 dark:text-slate-400 dark:text-slate-500">{insight.priority}</span>
                </div>
              </div>
              <Sparkles size={24} className="text-amber-400 opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
              {insight.description}
            </p>
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{insight.goal}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">{insight.date}</span>
            </div>
          </div>
        ))}

        {activeTab === "Actions" && actions.length > 0 && actions.map((action) => (
          <div key={action.id} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-maroon-900 dark:group-hover:text-maroon-400 transition-colors">{action.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{action.type}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">{action.priority}</span>
                </div>
              </div>
              <CheckCircle2 size={24} className="text-blue-400 opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
              {action.description}
            </p>
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{action.goal}</span>
              </div>
              <span className="text-[10px] font-bold text-rose-500">{action.date}</span>
            </div>
          </div>
        ))}

        {activeTab === "Approvals" && approvals.length > 0 && approvals.map((approval) => (
          <div key={approval.id} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-slate-200 group-hover:text-maroon-900 dark:group-hover:text-maroon-400 transition-colors">{approval.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">{approval.type}</span>
                </div>
              </div>
              <Clock size={24} className="text-purple-400 opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
              {approval.description}
            </p>
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors">Approve</button>
                <button className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Reject</button>
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">{approval.date}</span>
            </div>
          </div>
        ))}

        {activeTab === "Alerts" && alerts.length > 0 && alerts.map((alert) => (
          <div key={alert.id} className="p-6 rounded-3xl bg-rose-50/30 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50/50 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-black text-rose-800 dark:text-rose-400 transition-colors">{alert.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">{alert.type}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-600 text-white">{alert.priority}</span>
                </div>
              </div>
              <AlertCircle size={24} className="text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {alert.description}
            </p>
            <div className="flex items-center justify-between pt-6 border-t border-rose-100 dark:border-rose-900/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{alert.goal}</span>
              </div>
              <span className="text-[10px] font-bold text-rose-400 dark:text-rose-500">{alert.date}</span>
            </div>
          </div>
        ))}

        {((activeTab === "Insights" && insights.length === 0) ||
          (activeTab === "Actions" && actions.length === 0) ||
          (activeTab === "Approvals" && approvals.length === 0) ||
          (activeTab === "Alerts" && alerts.length === 0)) && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
             <CheckCircle2 size={48} strokeWidth={1} className="mb-4 opacity-20" />
             <p className="text-sm font-bold">All caught up - no pending {activeTab.toLowerCase()}</p>
             <p className="text-[10px] mt-1 font-medium">System checked: {new Date().toLocaleDateString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
