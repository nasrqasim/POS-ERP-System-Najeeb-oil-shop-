"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, ArrowLeft, X, CheckCircle2, Calculator, Users, Calendar, Printer } from "lucide-react";
import { printPage } from "@/lib/excel";

export default function PayrollRunForm({ onClose, initialData }: any) {
  const [staff, setStaff] = useState<any[]>(initialData?.staff || []);
  const [isGenerated, setIsGenerated] = useState(initialData ? true : false);
  const [isSaving, setIsSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    voucherNo: initialData?.voucherNo || `PAY-${Date.now()}`,
    date: initialData?.date ? initialData.date.split("T")[0] : new Date().toISOString().split("T")[0],
    month: initialData?.month || new Date().toISOString().slice(0, 7),
    workingDays: initialData?.workingDays || 26,
    status: initialData?.status || "draft"
  });

  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(data => {
      if (data.ok) setEmployees(data.data);
    });
  }, []);

  const generatePayroll = () => {
    const activeEmployees = employees.filter(e => e.status === "Active" || !e.status);
    const payrollStaff = activeEmployees.map(e => ({
      employeeId: e._id,
      name: e.name,
      designation: e.designation,
      basicSalary: e.basicSalary || 0,
      allowances: 0,
      deductions: 0,
      advances: 0,
      loans: 0,
      netSalary: e.basicSalary || 0
    }));
    setStaff(payrollStaff);
    setIsGenerated(true);
  };

  const totalAmount = staff.reduce((sum, s) => sum + s.netSalary, 0);

  const handleSubmit = async (submitStatus: string) => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        staff,
        totalAmount,
        status: submitStatus
      };
      
      const url = initialData?._id ? `/api/payrolls/${initialData._id}` : "/api/payrolls";
      const method = initialData?._id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        onClose();
      } else {
        alert(json.message || "Failed to save");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{initialData ? "Edit Payroll Run" : "New Payroll Run"}</h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-lg flex items-center">
            <X size={16} className="mr-2" /> Cancel
          </button>
          <button type="button" onClick={() => handleSubmit("draft")} disabled={isSaving || !isGenerated} className="px-4 py-2 text-sm font-bold text-white bg-maroon-800 hover:bg-maroon-900 rounded-lg flex items-center shadow-lg transition-all disabled:opacity-50">
            <Save size={16} className="mr-2" /> Save Draft
          </button>
          <button type="button" onClick={() => handleSubmit("posted")} disabled={isSaving || !isGenerated} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center shadow-lg transition-all disabled:opacity-50">
            <CheckCircle2 size={16} className="mr-2" /> Save & Post
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8 pb-24">
        <section className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Doc Date *</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-maroon-800/20 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Payroll Month *</label>
              <input type="month" value={formData.month} onChange={(e) => setFormData({...formData, month: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-maroon-800/20 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Working Days</label>
              <input type="number" value={formData.workingDays} onChange={(e) => setFormData({...formData, workingDays: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-maroon-800/20 transition-all" />
            </div>
            <button onClick={generatePayroll} className="h-[42px] px-6 bg-maroon-800 hover:bg-maroon-900 text-white text-sm font-bold rounded-xl flex items-center justify-center shadow-lg transition-all">
              <Plus size={18} className="mr-2" /> Generate Payroll
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
          {!isGenerated ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <Users size={32} className="text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Click <strong>Generate Payroll</strong> to pre-fill all active staff.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Name</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">Basic Salary</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">Allowances</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">Deductions</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">Advances/Loans</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32 text-right">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {staff.map((s, idx) => {
                      const updateStaffRow = (field: string, val: number) => {
                        const updated = [...staff];
                        const current = { ...updated[idx], [field]: val };
                        current.netSalary = Math.max(0, (current.basicSalary || 0) + (current.allowances || 0) - (current.deductions || 0) - (current.advances || 0) - (current.loans || 0));
                        updated[idx] = current;
                        setStaff(updated);
                      };

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{s.name || employees.find(e => e._id === s.employeeId)?.name}</div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              value={s.basicSalary}
                              onChange={(e) => updateStaffRow("basicSalary", parseFloat(e.target.value) || 0)}
                              className="w-full text-right bg-transparent text-sm font-bold border-b border-transparent focus:border-maroon-800 outline-none"
                            />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              value={s.allowances}
                              onChange={(e) => updateStaffRow("allowances", parseFloat(e.target.value) || 0)}
                              className="w-full text-right bg-transparent text-sm font-bold border-b border-transparent focus:border-maroon-800 outline-none text-emerald-600"
                            />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              value={s.deductions}
                              onChange={(e) => updateStaffRow("deductions", parseFloat(e.target.value) || 0)}
                              className="w-full text-right bg-transparent text-sm font-bold border-b border-transparent focus:border-maroon-800 outline-none text-rose-600"
                            />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              value={s.advances}
                              onChange={(e) => updateStaffRow("advances", parseFloat(e.target.value) || 0)}
                              className="w-full text-right bg-transparent text-sm font-bold border-b border-transparent focus:border-maroon-800 outline-none text-amber-600"
                            />
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-slate-900 dark:text-white">
                            PKR {(s.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-end border-t border-slate-100">
                <div className="flex justify-between w-full md:w-80 pt-2">
                  <span className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Payroll</span>
                  <span className="text-2xl font-black text-maroon-800 leading-none">PKR {totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
