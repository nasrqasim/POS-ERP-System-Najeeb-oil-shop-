"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Eye, 
  Calendar, 
  Tag, 
  Banknote, 
  DollarSign, 
  TrendingUp, 
  CalendarDays,
  FileSpreadsheet,
  Printer
} from "lucide-react";
import ERPPageHeader from "@/components/erp/ui/ERPPageHeader";
import OtherIncomeModal from "@/components/erp/receipts/OtherIncomeModal";
import { exportToExcel, printPage } from "@/lib/excel";

export default function OtherIncomePage() {
  const [incomes, setIncomes] = useState<any[]>([]);
  const [profits, setProfits] = useState({
    daily: 0,
    monthly: 0,
    yearly: 0
  });

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [statsLoading, setStatsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<any>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");

  // Fetch Profits from existing Profit & Loss engine
  const fetchProfits = useCallback(async () => {
    setStatsLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const startOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const startOfYearStr = `${new Date().getFullYear()}-01-01`;

      const [dailyRes, monthlyRes, yearlyRes] = await Promise.allSettled([
        fetch(`/api/reports/profit-loss?fromDate=${todayStr}&toDate=${todayStr}`).then(r => r.json()),
        fetch(`/api/reports/profit-loss?fromDate=${startOfMonthStr}&toDate=${todayStr}`).then(r => r.json()),
        fetch(`/api/reports/profit-loss?fromDate=${startOfYearStr}&toDate=${todayStr}`).then(r => r.json())
      ]);

      const getVal = (res: PromiseSettledResult<any>) => {
        if (res.status === "fulfilled" && res.value?.ok && res.value?.data) {
          return Number(res.value.data.netProfit) || 0;
        }
        return 0;
      };

      setProfits({
        daily: getVal(dailyRes),
        monthly: getVal(monthlyRes),
        yearly: getVal(yearlyRes)
      });
    } catch (e) {
      console.error("Failed to fetch profits:", e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Saved Incomes with search and filters
  const fetchIncomes = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (filterType) params.append("incomeType", filterType);
      if (filterPayment) params.append("paymentMethod", filterPayment);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);

      const res = await fetch(`/api/other-incomes?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setIncomes(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch other incomes:", e);
    } finally {
      setTableLoading(false);
    }
  }, [searchTerm, filterType, filterPayment, fromDate, toDate]);

  useEffect(() => {
    fetchProfits();
    fetchIncomes();
  }, [fetchProfits, fetchIncomes]);

  const handleAdd = () => {
    setSelectedIncome(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleView = (income: any) => {
    setSelectedIncome(income);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const handleEdit = (income: any) => {
    setSelectedIncome(income);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this income record? The financial journal and balances will be reversed safely.")) {
      try {
        const res = await fetch(`/api/other-incomes/${id}`, { method: "DELETE" });
        const json = await res.json();
        if (json.ok) {
          alert("Income record deleted successfully!");
          fetchIncomes();
          fetchProfits();
        } else {
          alert("Error: " + json.message);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSave = async (data: any) => {
    try {
      let res;
      if (selectedIncome?._id) {
        res = await fetch(`/api/other-incomes/${selectedIncome._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
      } else {
        res = await fetch("/api/other-incomes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
      }

      const json = await res.json();
      if (json.ok) {
        alert(selectedIncome?._id ? "Income record updated!" : "Income record saved successfully!");
        fetchIncomes();
        fetchProfits();
      } else {
        alert("Failed to save: " + json.message);
      }
    } catch (e) {
      console.error(e);
      alert("Error saving record");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <ERPPageHeader 
        title="Other Income Records" 
        subtitle="Receipts / Other Income"
        actions={[
          { label: "Print List", onClick: printPage, icon: Printer },
          { label: "Export Excel", onClick: () => exportToExcel(incomes, "OtherIncomeRecords.xlsx"), icon: FileSpreadsheet }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5 relative overflow-hidden">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Daily Net Profit</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
              {statsLoading ? "Loading..." : `Rs.${profits.daily.toLocaleString()}`}
            </h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5 relative overflow-hidden">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Net Profit</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
              {statsLoading ? "Loading..." : `Rs.${profits.monthly.toLocaleString()}`}
            </h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5 relative overflow-hidden">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
            <CalendarDays size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Yearly Net Profit</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
              {statsLoading ? "Loading..." : `Rs.${profits.yearly.toLocaleString()}`}
            </h4>
          </div>
        </div>
      </div>

      {/* Main Income Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Toolbar & Filters */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-xl w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search by title, reason, or notes..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all text-slate-900 dark:text-white"
              />
            </div>
            <button 
              onClick={handleAdd}
              className="flex items-center gap-2 px-8 py-3.5 bg-maroon-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-maroon-900 transition-all shadow-lg shadow-maroon-800/20 w-full md:w-auto justify-center"
            >
              <Plus size={18} />
              Add Other Income
            </button>
          </div>

          {/* Quick Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
            <div className="flex flex-col">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Income Type</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white outline-none"
              >
                <option value="">All Types</option>
                <option value="One Time">One Time</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Payment Method</label>
              <select
                value={filterPayment}
                onChange={e => setFilterPayment(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white outline-none"
              >
                <option value="">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Online">Online</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none"
              />
            </div>

            <div className="flex flex-col col-span-2 sm:col-span-1 justify-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("");
                  setFilterPayment("");
                  setFromDate("");
                  setToDate("");
                }}
                className="w-full text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-100 dark:border-rose-950 rounded-xl py-2.5 transition-all text-center"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Reason / Description</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
              {tableLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 font-bold text-slate-400">
                    Loading income records...
                  </td>
                </tr>
              ) : incomes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 font-bold text-slate-400">
                    No income records found matching your filters.
                  </td>
                </tr>
              ) : (
                incomes.map((inc) => (
                  <tr key={inc._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                      {inc.date ? new Date(inc.date).toLocaleDateString('en-GB') : "-"}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                      {inc.title}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {inc.description || "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-black font-mono text-emerald-600">
                      Rs.{(inc.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                        inc.incomeType === "One Time" ? "bg-blue-50 text-blue-600" :
                        inc.incomeType === "Monthly" ? "bg-amber-50 text-amber-600" : "bg-purple-50 text-purple-600"
                      }`}>
                        {inc.incomeType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-black uppercase tracking-widest">
                        {inc.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {inc.reference || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleView(inc)}
                          title="View Details"
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl transition-all"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(inc)}
                          title="Edit"
                          className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(inc._id)}
                          title="Delete"
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Other Income Form / Modal */}
      {isModalOpen && (
        <OtherIncomeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          income={selectedIncome}
          onSave={handleSave}
          mode={modalMode}
        />
      )}
    </div>
  );
}
