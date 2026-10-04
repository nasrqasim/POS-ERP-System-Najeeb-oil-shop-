"use client";

import { useState, useEffect } from "react";
import { Activity, ExternalLink, Package, ShoppingCart, User, Shield, Info, CheckCircle2, Clock, LogIn, Database } from "lucide-react";
import Link from "next/link";

export default function ActivityFeed() {
  const [activeTab, setActiveTab] = useState("Transactions");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tabs = ["Transactions", "Activities", "Active Users"];

  useEffect(() => {
    if (activeTab === "Transactions") {
      const fetchTransactions = async () => {
        setIsLoading(true);
        try {
          const res = await fetch("/api/journal-entries");
          const json = await res.json();
          if (json.ok) {
            // Map Journal Entries to Activity Feed format
            const mapped = json.data.slice(0, 10).map((j: any) => ({
              id: j.voucherNo,
              status: "Posted",
              user: "System",
              type: j.accountTitle,
              time: new Date(j.date).toLocaleDateString(),
              amount: (j.debit > 0 ? `+Rs.${j.debit}` : `-Rs.${j.credit}`),
              color: "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500",
              amountColor: j.debit > 0 ? "text-emerald-500" : "text-rose-500",
              Icon: j.debit > 0 ? ShoppingCart : Package,
              iconBg: j.debit > 0 ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500",
              typeColor: j.debit > 0 ? "text-emerald-500" : "text-rose-500"
            }));
            setTransactions(mapped);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchTransactions();
    }
  }, [activeTab]);

  const activities = [
    { title: "System Ready", desc: "Al Hadeed Traders ERP is online and connected to Atlas.", time: "Live", Icon: Database, iconBg: "bg-purple-50 text-purple-600" },
  ];

  const activeUsers = [
    { initials: "U", name: "Current User", role: "admin", time: "Now", status: "online", color: "bg-maroon-800 text-white" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
            <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-maroon-50 dark:bg-maroon-900/30 text-maroon-800 dark:text-maroon-400 rounded-lg">
                <Activity size={18} />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Activity Feed</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Recent transactions and system activities</p>
        </div>
        <Link 
          href="/reports" 
          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-maroon-800 transition-colors border border-slate-200 dark:border-slate-800 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800"
        >
          View More
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="flex gap-1 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all ${
              activeTab === tab 
                ? "bg-maroon-800 text-white shadow-md" 
                : "text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:text-slate-100 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
        {activeTab === "Transactions" && (
          transactions.length > 0 ? (
            transactions.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${item.iconBg} dark:bg-slate-800 dark:text-slate-200`}>
                    <item.Icon size={16} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-maroon-800 dark:group-hover:text-maroon-400 transition-colors">{item.id}</p>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${item.color} dark:bg-slate-800 dark:text-slate-400 dark:text-slate-500`}>
                            {item.status}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">{item.user}</p>
                    <div className="flex items-center gap-2 text-[10px] font-medium">
                        <span className={item.typeColor}>{item.type}</span>
                        <span className="text-slate-300 dark:text-slate-700 dark:text-slate-200">•</span>
                        <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1"><Clock size={10}/> {item.time}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${item.amountColor}`}>{item.amount}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Activity size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">No recent transactions</p>
              <p className="text-[10px] text-slate-400">Transactions will appear here as vouchers are created</p>
            </div>
          )
        )}

        {activeTab === "Activities" && activities.map((item, idx) => (
          <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
            <div className={`p-3 rounded-full shrink-0 ${item.iconBg} dark:bg-slate-800 dark:text-slate-200`}>
              <item.Icon size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-1.5">{item.desc}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1"><Clock size={10} /> {item.time}</p>
            </div>
          </div>
        ))}

        {activeTab === "Active Users" && (
            <div className="space-y-6">
                <div className="flex justify-between px-6 pb-6 pt-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-center">
                        <p className="text-3xl font-black text-emerald-500 mb-1">1</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Online</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black text-amber-500 mb-1">0</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Away</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black text-slate-300 dark:text-slate-600 dark:text-slate-300 mb-1">1</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Offline</p>
                    </div>
                </div>
                <div className="space-y-2">
                    {activeUsers.map((user, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:border-slate-800 dark:hover:border-slate-800">
                        <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${user.color}`}>
                                {user.initials}
                            </div>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${user.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 dark:text-slate-200 leading-none mb-1.5">{user.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{user.role}</p>
                        </div>
                        </div>
                        <div className="text-right">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{user.time}</p>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
