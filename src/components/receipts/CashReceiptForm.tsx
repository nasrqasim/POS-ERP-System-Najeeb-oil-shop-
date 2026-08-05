"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, User, Calendar, Hash, DollarSign, FileText, ArrowLeft, X, CheckCircle2, Plus, Trash2, Briefcase, Landmark } from "lucide-react";
import PartyLookupSelect from "@/components/erp/ui/PartyLookupSelect";
import PartyDetailsCard, { type PartyLike, type AccountLike } from "@/components/erp/ui/PartyDetailsCard";

interface CashReceiptFormProps {
  onClose: () => void;
  initialData?: any;
}

export default function CashReceiptForm({ onClose, initialData }: CashReceiptFormProps) {
  const isEdit = !!(initialData && initialData._id);
  const [activeTab, setActiveTab] = useState<"party" | "petty">(
    initialData?.receiptType === "petty" ? "petty" : "party"
  );
  const [partyType, setPartyType] = useState<"Customer" | "Vendor">("Customer");
  const [pettySubTab, setPettySubTab] = useState<"general" | "customer" | "vendor">("general");

  const [formData, setFormData] = useState({
    voucherNo: initialData?.receiptNumber || "Auto-generated",
    date: initialData?.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    partyId: initialData?.partyId?._id || initialData?.partyId || "",
    cashAccountId: initialData?.cashAccountId?._id || initialData?.cashAccountId || "",
    reference: initialData?.reference || "",
    narration: initialData?.narration || "",
    employeeId: initialData?.employeeId?._id || initialData?.employeeId || "",
    jobId: initialData?.jobId?._id || initialData?.jobId || "",
    amount: initialData?.amount || 0,
    notes: initialData?.notes || "",
    partyReceiptType: initialData?.partyReceiptType || "Standard"
  });

  const [contraLines, setContraLines] = useState<any[]>(
    initialData?.contraLines || []
  );

  const [partyLines, setPartyLines] = useState<any[]>(
    initialData?.partyLines || []
  );

  const [availableAccounts, setAvailableAccounts] = useState<AccountLike[]>([]);
  const [availableParties, setAvailableParties] = useState<PartyLike[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [previewParty, setPreviewParty] = useState<PartyLike | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData && availableParties.length > 0) {
      if (initialData.partyId) {
        const pId = initialData.partyId._id || initialData.partyId;
        const found = availableParties.find(p => p._id === pId);
        if (found) {
          setPartyType(found.type === "Vendor" ? "Vendor" : "Customer");
          setPreviewParty(found);
          if (initialData.receiptType === "petty") {
            setPettySubTab(found.type === "Vendor" ? "vendor" : "customer");
          }
        }
      } else if (initialData.receiptType === "petty" && (!initialData.contraLines || initialData.contraLines.length > 0)) {
        setPettySubTab("general");
      }
    }
  }, [initialData, availableParties]);

  // Fetch lookups
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [acctRes, partyRes, empRes, jobRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/parties"),
          fetch("/api/employees"),
          fetch("/api/jobs")
        ]);
        const [acctJson, partyJson, empJson, jobJson] = await Promise.all([
          acctRes.json(),
          partyRes.json(),
          empRes.json(),
          jobRes.json()
        ]);
        if (acctJson.ok) setAvailableAccounts(acctJson.data);
        if (partyJson.ok) setAvailableParties(partyJson.data);
        if (empJson.ok) setEmployees(empJson.data);
        if (jobJson.ok) setJobs(jobJson.data);
      } catch (e) {
        console.error("Error fetching lookups:", e);
      }
    };
    fetchAll();
  }, []);

  // Filter cash accounts (type = 'cash')
  const cashAccounts = useMemo(() => {
    return availableAccounts.filter(a => a.type === "cash" || a.type === "bank");
  }, [availableAccounts]);

  // Filter customers for the simple Party Receipt
  const customers = useMemo(() => {
    return availableParties.filter(p => p.type === "Customer");
  }, [availableParties]);

  // Filter vendors
  const vendors = useMemo(() => {
    return availableParties.filter(p => p.type === "Vendor");
  }, [availableParties]);

  const selectedParty = useMemo(
    () => availableParties.find((p) => p._id === formData.partyId) || previewParty,
    [availableParties, formData.partyId, previewParty]
  );

  const selectedCashAccount = useMemo(
    () => cashAccounts.find((a) => a._id === formData.cashAccountId) || null,
    [cashAccounts, formData.cashAccountId]
  );

  // Auto-calculated totals
  const totalAmount = useMemo(() => {
    if (activeTab === "party") {
      return formData.amount;
    }
    if (activeTab === "petty") {
      if (pettySubTab === "general") {
        return contraLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
      } else {
        return formData.amount;
      }
    }
    return 0;
  }, [activeTab, pettySubTab, formData.amount, contraLines]);

  // Handlers for petty contra lines
  const addContraLine = () => {
    setContraLines([
      ...contraLines,
      { accountId: "", accountTitle: "", description: "", amount: 0 }
    ]);
  };

  const removeContraLine = (index: number) => {
    setContraLines(contraLines.filter((_, idx) => idx !== index));
  };

  const updateContraLine = (index: number, field: string, value: any) => {
    setContraLines(
      contraLines.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, [field]: value };
        if (field === "accountId") {
          const selected = availableAccounts.find(a => a._id === value);
          updated.accountTitle = selected ? selected.title : "";
        }
        return updated;
      })
    );
  };

  // Handlers for multi-party lines
  const addPartyLine = () => {
    setPartyLines([
      ...partyLines,
      { partyId: "", partyName: "", amount: 0, invoiceRef: "" }
    ]);
  };

  const removePartyLine = (index: number) => {
    setPartyLines(partyLines.filter((_, idx) => idx !== index));
  };

  const updatePartyLine = (index: number, field: string, value: any) => {
    setPartyLines(
      partyLines.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, [field]: value };
        if (field === "partyId") {
          const selected = availableParties.find(p => p._id === value);
          updated.partyName = selected ? (selected.companyName || selected.name) : "";
        }
        return updated;
      })
    );
  };

  const handleSave = async (status: "Draft" | "Posted") => {
    if (!formData.date) {
      alert("Please select a date.");
      return;
    }
    if (!formData.cashAccountId) {
      alert("Please select a Cash Account.");
      return;
    }
    if (!formData.narration) {
      alert("Please enter a Narration.");
      return;
    }

    if (activeTab === "party" && !formData.partyId) {
      alert(`Please select a ${partyType} for Party Receipt.`);
      return;
    }

    if (activeTab === "party" && totalAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (activeTab === "petty") {
      if (pettySubTab === "general") {
        if (contraLines.length === 0) {
          alert("Please add at least one Contra Account line.");
          return;
        }
        if (contraLines.some(l => !l.accountId || l.amount <= 0)) {
          alert("Please fill all Contra Account lines with a valid account and amount.");
          return;
        }
      } else {
        if (!formData.partyId) {
          alert(`Please select a ${pettySubTab === "customer" ? "Customer" : "Vendor"} for Petty Receipt.`);
          return;
        }
        if (totalAmount <= 0) {
          alert("Please enter a valid amount.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const selectedCashAcc = cashAccounts.find(a => a._id === formData.cashAccountId);
      const cashAccountTitle = selectedCashAcc ? selectedCashAcc.title : "";

      const payload: any = {
        receiptNumber: formData.voucherNo,
        receiptType: activeTab,
        date: formData.date,
        cashAccountId: formData.cashAccountId,
        cashAccountTitle,
        reference: formData.reference,
        narration: formData.narration,
        employeeId: formData.employeeId || null,
        jobId: formData.jobId || null,
        notes: formData.notes,
        status,
        amount: totalAmount,
        netAmount: totalAmount,
        partyReceiptType: formData.partyReceiptType
      };

      if (activeTab === "party") {
        payload.partyId = formData.partyId;
        payload.contraLines = [];
        payload.partyLines = [];
      } else if (activeTab === "petty") {
        if (pettySubTab === "general") {
          payload.partyId = null;
          payload.contraLines = contraLines.map(l => ({
            accountId: l.accountId,
            accountTitle: l.accountTitle,
            description: l.description,
            amount: Number(l.amount) || 0
          }));
        } else {
          payload.partyId = formData.partyId;
          payload.contraLines = [];
        }
        payload.partyLines = [];
      }

      const url = isEdit ? `/api/cash-receipts/${initialData._id}` : "/api/cash-receipts";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.ok) {
        alert(`Cash Receipt ${isEdit ? "updated" : "saved"} successfully!`);
        onClose();
      } else {
        alert("Error saving: " + (json.message || "Unknown error"));
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to save cash receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      {/* Header Actions */}
      <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEdit ? `Edit Cash Receipt: ${formData.voucherNo}` : "New Cash Receipt"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Receipts / Cash Receipt</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center">
            <X size={16} className="mr-2" /> Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("Draft")}
            className="px-4 py-2 text-sm font-bold text-white bg-maroon-800 hover:bg-maroon-900 rounded-lg flex items-center shadow-lg shadow-maroon-800/20 disabled:opacity-50 transition-all"
          >
            <Save size={16} className="mr-2" /> Save Draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("Posted")}
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            <CheckCircle2 size={16} className="mr-2" /> Save & Post
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 pb-24">
        {/* Tabs */}
        <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit mb-8">
          <button
            onClick={() => !isEdit && setActiveTab("party")}
            disabled={isEdit && activeTab !== "party"}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "party"
                ? "bg-maroon-800 text-white shadow-md"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            } disabled:opacity-50`}
          >
            Party Receipt
          </button>
          <button
            onClick={() => !isEdit && setActiveTab("petty")}
            disabled={isEdit && activeTab !== "petty"}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "petty"
                ? "bg-maroon-800 text-white shadow-md"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            } disabled:opacity-50`}
          >
            Petty Receipt
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8 order-2 md:order-1">
        {/* Section 1: Receipt Details */}
        <section className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center space-x-2 mb-8">
            <div className="w-8 h-8 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-maroon-800 dark:text-maroon-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {activeTab === "party" ? "Party Receipt Details" : "Petty Receipt Details"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Voucher No</label>
              <input value={formData.voucherNo} disabled className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-maroon-800/10 transition-all outline-none"
              />
            </div>

            {activeTab === "party" && (
              <div className="md:col-span-2">
                <PartyLookupSelect
                  parties={availableParties}
                  value={formData.partyId}
                  partyType={partyType}
                  onPartyTypeChange={(t) => {
                    setPartyType(t);
                    setFormData((prev) => ({ ...prev, partyId: "" }));
                    setPreviewParty(null);
                  }}
                  onChange={(id, party) => {
                    setFormData((prev) => ({ ...prev, partyId: id }));
                    setPreviewParty(party);
                  }}
                  onPreview={setPreviewParty}
                  label="Receive From (Customer / Vendor)"
                  required
                />
              </div>
            )}

            {activeTab === "party" && partyType === "Customer" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receipt Sub-Type</label>
                <select
                  value={formData.partyReceiptType}
                  onChange={(e) => setFormData({ ...formData, partyReceiptType: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-maroon-800/10 transition-all outline-none"
                >
                  <option value="Standard">Standard Payment</option>
                  <option value="Advance">Customer Advance</option>
                  <option value="Deposit">Customer Deposit</option>
                  <option value="Extra Cash">Extra Cash Received</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cash Account * (with Balance)</label>
              <select
                value={formData.cashAccountId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFormData({ ...formData, cashAccountId: id });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-maroon-800/10 transition-all outline-none"
              >
                <option value="">Search cash accounts...</option>
                {cashAccounts.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.title || a.name || "Cash Account"} (Rs. {(a.openingBalance || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Reference</label>
              <input
                placeholder="Reference number"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Narration *</label>
              <input
                placeholder="Receipt description (required)"
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-maroon-800/10 transition-all outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Job</label>
              <select
                value={formData.jobId}
                onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none"
              >
                <option value="">-- Select Job --</option>
                {jobs.map(j => (
                  <option key={j._id} value={j._id}>{j.title || j.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section 2: Petty Receipt Forms */}
        {activeTab === "petty" && (
          <div className="space-y-6">
            {/* Petty Sub-Tabs */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setPettySubTab("general")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pettySubTab === "general"
                    ? "bg-maroon-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                General (Contra Account)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPettySubTab("customer");
                  const found = availableParties.find(p => p._id === formData.partyId);
                  if (!found || found.type !== "Customer") {
                    setFormData(prev => ({ ...prev, partyId: "" }));
                  }
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pettySubTab === "customer"
                    ? "bg-maroon-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Customer Petty Receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  setPettySubTab("vendor");
                  const found = availableParties.find(p => p._id === formData.partyId);
                  if (!found || found.type !== "Vendor") {
                    setFormData(prev => ({ ...prev, partyId: "" }));
                  }
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pettySubTab === "vendor"
                    ? "bg-maroon-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Vendor Petty Receipt
              </button>
            </div>

            {pettySubTab === "general" ? (
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Landmark size={18} className="text-maroon-800" /> Contra Accounts
                  </h3>
                  <button
                    type="button"
                    onClick={addContraLine}
                    className="px-4 py-2 text-[10px] font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl uppercase tracking-widest flex items-center hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
                  >
                    <Plus size={14} className="mr-1.5 text-maroon-800" /> Add Line
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">#</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-64">Account *</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[280px]">Description</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-44 text-right">Amount (PKR) *</th>
                        <th className="px-6 py-4 w-16 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {contraLines.length > 0 ? (
                        contraLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <select
                                value={line.accountId}
                                onChange={(e) => updateContraLine(idx, "accountId", e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-maroon-800"
                              >
                                <option value="">-- Select Account --</option>
                                {availableAccounts
                                  .filter(a => !["1000", "1010", "1200", "1300", "2000", "3000", "4000"].includes(a.code || ""))
                                  .map(a => (
                                    <option key={a._id} value={a._id}>{a.title || a.name || "Account"} ({a.code})</option>
                                  ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 min-w-[280px]">
                              <input
                                type="text"
                                placeholder="Description / Narration"
                                value={line.description}
                                onChange={(e) => updateContraLine(idx, "description", e.target.value)}
                                className="w-full min-w-[260px] px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                placeholder="0.00"
                                value={line.amount || ""}
                                onChange={(e) => updateContraLine(idx, "amount", parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-black text-right outline-none"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => removeContraLine(idx)}
                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                            No lines added. Click &apos;Add Line&apos; to record contra accounts.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <PartyLookupSelect
                      parties={pettySubTab === "customer" ? customers : vendors}
                      value={formData.partyId}
                      partyType={pettySubTab === "customer" ? "Customer" : "Vendor"}
                      showTypeToggle={false}
                      onPartyTypeChange={() => {}}
                      onChange={(id, party) => {
                        setFormData((prev) => ({ ...prev, partyId: id }));
                        setPreviewParty(party);
                      }}
                      onPreview={setPreviewParty}
                      label={pettySubTab === "customer" ? "Customer *" : "Vendor *"}
                      required
                    />
                  </div>
                  {pettySubTab === "customer" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receipt Sub-Type</label>
                      <select
                        value={formData.partyReceiptType}
                        onChange={(e) => setFormData({ ...formData, partyReceiptType: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-maroon-800/10 transition-all outline-none"
                      >
                        <option value="Standard">Standard Payment</option>
                        <option value="Advance">Customer Advance</option>
                        <option value="Deposit">Customer Deposit</option>
                        <option value="Extra Cash">Extra Cash Received</option>
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Amount (PKR) *</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={formData.amount || ""}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-4 focus:ring-maroon-800/10 transition-all outline-none"
                    />
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {false && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <User size={18} className="text-maroon-800" /> Party Lines
              </h3>
              <button
                type="button"
                onClick={addPartyLine}
                className="px-4 py-2 text-[10px] font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl uppercase tracking-widest flex items-center hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
              >
                <Plus size={14} className="mr-1.5 text-maroon-800" /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">#</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-72">Party *</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Ref</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-48 text-right">Amount (PKR) *</th>
                    <th className="px-6 py-4 w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {partyLines.length > 0 ? (
                    partyLines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <select
                            value={line.partyId}
                            onChange={(e) => updatePartyLine(idx, "partyId", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-maroon-800"
                          >
                            <option value="">-- Select Party --</option>
                            {availableParties.map(p => (
                              <option key={p._id} value={p._id}>{p.companyName || p.name} ({p.type})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Invoice Reference #"
                            value={line.invoiceRef}
                            onChange={(e) => updatePartyLine(idx, "invoiceRef", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={line.amount || ""}
                            onChange={(e) => updatePartyLine(idx, "amount", parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-black text-right outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => removePartyLine(idx)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                        No lines added. Click &apos;Add Line&apos; to record party receipts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Section 3: Amount Details */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center space-x-2 mb-8">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/30 rounded-lg flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Amount Details</h2>
          </div>

          <div className="max-w-xl space-y-4">
            {(activeTab === "party" || (activeTab === "petty" && pettySubTab !== "general")) ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Amount (PKR) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount || ""}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-maroon-800/30 dark:border-maroon-800/50 rounded-2xl text-3xl font-black text-maroon-800 focus:ring-4 focus:ring-maroon-800/10 focus:bg-white dark:focus:bg-slate-900 transition-all text-right outline-none shadow-inner"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Amount (PKR) - Auto calculated</label>
                <div className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-850 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-3xl font-black text-maroon-800 text-right shadow-inner">
                  {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Amount (PKR)</span>
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </section>

        {/* Section 4: Internal Notes */}
        <section className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <Hash size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Internal Notes</h2>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Internal Notes (not printed)</label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Internal notes (not printed)..."
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-4 focus:ring-slate-800/10 transition-all resize-none outline-none"
            />
          </div>
        </section>
          </div>

          <div className="md:col-span-1 order-1 md:order-2">
            <PartyDetailsCard
              party={selectedParty}
              account={selectedCashAccount}
              title="Party Details"
              emptyMessage="Select or search a customer/vendor — scroll the list to preview balance, or pick one to load live ledger balance."
              refreshLive={!!formData.partyId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
