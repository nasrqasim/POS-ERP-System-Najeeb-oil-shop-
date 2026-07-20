"use client";

import { 
  DollarSign, 
  ArrowDownLeft, 
  ArrowUpRight 
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

interface StatsCardsProps {
  selectedDate?: string;
}

export default function StatsCards({ selectedDate }: StatsCardsProps) {
  const [data, setData] = useState({
    cashBank: { opening: 0, receipts: 0, payments: 0, current: 0 },
    receivables: { opening: 0, sales: 0, receipts: 0, current: 0 },
    payables: { opening: 0, purchases: 0, payments: 0, current: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = selectedDate ? `/api/dashboard?date=${selectedDate}` : "/api/dashboard";
        const res = await fetch(url);
        const json = await res.json();
        if (json.ok) {
          setData({
            cashBank: json.data.cashBank || { opening: 0, receipts: 0, payments: 0, current: 0 },
            receivables: json.data.receivables || { opening: 0, sales: 0, receipts: 0, current: 0 },
            payables: json.data.payables || { opening: 0, purchases: 0, payments: 0, current: 0 }
          });
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedDate]);

  const fmt = (n: number) => Math.round(n).toLocaleString();

  const stats = [
    {
      title: "CASH & BANK",
      value: `Rs.${fmt(data.cashBank.current)}`,
      icon: DollarSign,
      color: data.cashBank.current >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      bg: data.cashBank.current >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-rose-50 dark:bg-rose-950/20",
      borderColor: data.cashBank.current >= 0 ? "border-emerald-600" : "border-rose-600",
      href: "/dashboard/cash-banks",
      opening: Math.abs(data.cashBank.opening),
      middleLabel: "Receipts",
      middleValue: data.cashBank.receipts,
      bottomLabel: "Payments",
      bottomValue: data.cashBank.payments
    },
    {
      title: "RECEIVABLES / CUSTOMERS",
      value: `Rs.${fmt(Math.abs(data.receivables.current))}`,
      icon: ArrowDownLeft,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      borderColor: "border-orange-500",
      href: "/dashboard/receivables",
      opening: Math.abs(data.receivables.opening),
      middleLabel: "Sales (Debits)",
      middleValue: data.receivables.sales,
      bottomLabel: "Receipts (Credits)",
      bottomValue: data.receivables.receipts
    },
    {
      title: "PAYABLES / VENDORS",
      value: `Rs.${fmt(Math.abs(data.payables.current))}`,
      icon: ArrowUpRight,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/20",
      borderColor: "border-purple-500",
      href: "/dashboard/payables",
      opening: Math.abs(data.payables.opening),
      middleLabel: "Purchases (Credits)",
      middleValue: data.payables.purchases,
      bottomLabel: "Payments (Debits)",
      bottomValue: data.payables.payments
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <Link 
          href={stat.href}
          key={stat.title}
          className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-b-4 ${stat.borderColor} hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 block cursor-pointer`}
        >
          <div className="flex items-center justify-between mb-5">
            <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.title}</span>
          </div>
          
          <div className="space-y-2 text-xs font-bold mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex justify-between text-slate-500">
              <span>Opening Balance:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">PKR {fmt(stat.opening)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{stat.middleLabel}:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">PKR {fmt(stat.middleValue)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{stat.bottomLabel}:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">PKR ({fmt(stat.bottomValue)})</span>
            </div>
          </div>
          
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Current Balance</p>
            <h3 className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</h3>
          </div>
          
          {/* Decorative background icon */}
          <stat.icon size={80} className={`absolute -right-4 -bottom-4 opacity-5 ${stat.color} pointer-events-none`} />
        </Link>
      ))}
    </div>
  );
}
