"use client";

import { useState, useEffect } from "react";
import ERPModal from "../ui/ERPModal";
import { Save, User, Building, Phone, MapPin, CreditCard, Info, Globe2, FileText, Hash, Wallet, MessageCircle } from "lucide-react";
import WhatsAppShareModal from "../whatsapp/WhatsAppShareModal";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: any;
  onSave?: (data: any) => void;
}

export default function CustomerModal({ isOpen, onClose, customer, onSave }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    contactPerson: "",
    phone: "",
    ntn: "",
    strn: "",
    address: "",
    region: "",
    area: "",
    postalCode: "",
    country: "Pakistan",
    category: "Cash Customer",
    creditLimit: 0,
    creditDays: 30,
    openingBalance: 0,
    closingBalance: 0,
    manualDebit: 0,
    manualCredit: 0,
    status: "Active",
    notes: "",
  });

  const [openingBalanceType, setOpeningBalanceType] = useState<"Credit" | "Debit">("Credit");
  const [closingBalanceType, setClosingBalanceType] = useState<"Credit" | "Debit">("Debit");
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [shopProfile, setShopProfile] = useState<any>(null);

  useEffect(() => {
    const fetchShopProfile = async () => {
      try {
        const res = await fetch("/api/shop-profile");
        const json = await res.json();
        if (json.ok) setShopProfile(json.data);
      } catch (e) {
        console.error(e);
      }
    };
    if (isOpen) {
      fetchShopProfile();
    }
  }, [isOpen]);

  useEffect(() => {
    if (customer) {
      const op = customer.openingBalance || 0;
      const cl = customer.balance || 0;
      setOpeningBalanceType(op > 0 ? "Debit" : "Credit");
      setClosingBalanceType(cl >= 0 ? "Debit" : "Credit");
      setFormData({
        code: customer.code || "",
        name: customer.companyName || customer.name || "",
        contactPerson: customer.contactPerson || "",
        phone: customer.phone || "",
        ntn: customer.ntn || "",
        strn: customer.strn || "",
        address: customer.address || "",
        region: customer.region || "",
        area: customer.area || "",
        postalCode: customer.postalCode || "",
        country: customer.country || "Pakistan",
        category: customer.category || "Cash Customer",
        creditLimit: customer.creditLimit || 0,
        creditDays: customer.creditDays || 30,
        openingBalance: Math.abs(op),
        closingBalance: Math.abs(cl),
        manualDebit: customer.manualDebit || customer.debit || 0,
        manualCredit: customer.manualCredit || customer.credit || 0,
        status: customer.status || "Active",
        notes: customer.notes || "",
      });
    } else {
      setOpeningBalanceType("Debit");
      setClosingBalanceType("Debit");
      setFormData({
        code: "",
        name: "",
        contactPerson: "",
        phone: "",
        ntn: "",
        strn: "",
        address: "",
        region: "",
        area: "",
        postalCode: "",
        country: "Pakistan",
        category: "Cash Customer",
        creditLimit: 0,
        creditDays: 30,
        openingBalance: 0,
        closingBalance: 0,
        manualDebit: 0,
        manualCredit: 0,
        status: "Active",
        notes: "",
      });
    }
  }, [customer, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      const finalOpeningBalance = openingBalanceType === "Debit" ? Math.abs(Number(formData.openingBalance)) : -Math.abs(Number(formData.openingBalance));
      const finalClosingBalance = closingBalanceType === "Debit" ? Math.abs(Number(formData.closingBalance)) : -Math.abs(Number(formData.closingBalance));
      onSave({
        ...formData,
        openingBalance: finalOpeningBalance,
        closingBalance: finalClosingBalance,
        manualDebit: Number(formData.manualDebit),
        manualCredit: Number(formData.manualCredit)
      });
    }
    onClose();
  };

  return (
    <ERPModal
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? "Edit Customer" : "Add New Customer"}
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <div>
            {customer && formData.phone && formData.phone.replace(/[^0-9]/g, "").length >= 10 && (
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-sm font-black shadow-lg shadow-[#25D366]/20 transition-all"
              >
                <MessageCircle size={18} className="fill-white/10" />
                WhatsApp Details
              </button>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-8 py-2.5 bg-maroon-800 text-white rounded-xl text-sm font-black hover:bg-maroon-900 transition-all shadow-xl shadow-maroon-900/20"
            >
              <Save size={18} />
              {customer ? "Update" : "Create"}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-2 space-y-8">
        {/* Row 0: Account Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Hash size={14} className="text-maroon-800" /> Account Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="Auto-generated if left blank"
            />
          </div>
        </div>

        {/* Row 1: Company & Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User size={14} className="text-maroon-800" /> Customer Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="Full Name"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User size={14} className="text-maroon-800" /> Contact Person
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="Ahmed Khan"
            />
          </div>
        </div>

        {/* Row 2: Email & Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white"
              required
            >
              <option value="Cash Customer">Cash Customer</option>
              <option value="Credit Customer">Credit Customer</option>
              <option value="Cash Customer (Jama)">Cash Customer (Jama)</option>
              <option value="Credit Customer (Counter)">Credit Customer (Counter)</option>
              <option value="Credit Customer Max">Credit Customer Max</option>
              <option value="Credit Customer (Haji Gul)">Credit Customer (Haji Gul)</option>
              <option value="Credit Customer (Makkah)">Credit Customer (Makkah)</option>
              <option value="Credit Customer (Radbook)">Credit Customer (Radbook)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Phone size={14} className="text-maroon-800" /> Phone *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="+92 300 1234567"
              required
            />
          </div>
        </div>

        {/* Row 3: Tax Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Hash size={14} className="text-maroon-800" /> NTN (National Tax Number)
            </label>
            <input
              type="text"
              value={formData.ntn}
              onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="1234567-8"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Hash size={14} className="text-maroon-800" /> STRN (Sales Tax Registration)
            </label>
            <input
              type="text"
              value={formData.strn}
              onChange={(e) => setFormData({ ...formData, strn: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="12-34-5678-901-23"
            />
          </div>
        </div>

        {/* Row 4: Address */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={14} className="text-maroon-800" /> Address
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white min-h-[100px] resize-none"
            placeholder="Street address, area"
          />
        </div>

        {/* Row 5: Region & Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Region
            </label>
            <select
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 outline-none transition-all dark:text-white"
            >
              <option value="">Select Region</option>
              <option>Punjab</option>
              <option>Sindh</option>
              <option>KPK</option>
              <option>Balochistan</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Area
            </label>
            <input
              type="text"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="e.g. Gulberg, DHA"
            />
          </div>
        </div>

        {/* Row 6: Postal Code & Country */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Postal Code
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="74000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Country
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="Pakistan"
            />
          </div>
        </div>

        {/* Row 7: Credit Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} className="text-maroon-800" /> Credit Limit (PKR)
            </label>
            <input
              type="number"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Credit Days
            </label>
            <input
              type="number"
              value={formData.creditDays}
              onChange={(e) => setFormData({ ...formData, creditDays: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
              placeholder="30"
            />
          </div>
        </div>

        {/* Row 8: Opening Balance & Closing Balance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Wallet size={14} className="text-maroon-800" /> Opening Balance
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
                placeholder="0"
              />
              <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl shrink-0 w-36">
                <button
                  type="button"
                  onClick={() => setOpeningBalanceType("Credit")}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all ${
                    openingBalanceType === "Credit"
                      ? "bg-white dark:bg-slate-900 text-maroon-850 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  Credit
                </button>
                <button
                  type="button"
                  onClick={() => setOpeningBalanceType("Debit")}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all ${
                    openingBalanceType === "Debit"
                      ? "bg-white dark:bg-slate-900 text-maroon-855 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  Debit
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Wallet size={14} className="text-maroon-800" /> Closing Balance
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={formData.closingBalance}
                onChange={(e) => setFormData({ ...formData, closingBalance: Number(e.target.value) })}
                className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white"
                placeholder="0"
              />
              <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl shrink-0 w-36">
                <button
                  type="button"
                  onClick={() => setClosingBalanceType("Credit")}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all ${
                    closingBalanceType === "Credit"
                      ? "bg-white dark:bg-slate-900 text-maroon-850 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  Credit
                </button>
                <button
                  type="button"
                  onClick={() => setClosingBalanceType("Debit")}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all ${
                    closingBalanceType === "Debit"
                      ? "bg-white dark:bg-slate-900 text-maroon-855 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  Debit
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 8b: Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 outline-none transition-all dark:text-white"
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        {/* Row 8b: Debit & Credit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} className="text-emerald-600" /> Debit (Sales)
            </label>
            <input
              type="number"
              value={formData.manualDebit}
              onChange={(e) => setFormData({ ...formData, manualDebit: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all dark:text-white"
              placeholder="0"
            />
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Amount owed by customer (sales on credit)</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} className="text-rose-600" /> Credit (Receipts)
            </label>
            <input
              type="number"
              value={formData.manualCredit}
              onChange={(e) => setFormData({ ...formData, manualCredit: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all dark:text-white"
              placeholder="0"
            />
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Payments received from customer</p>
          </div>
        </div>

        {/* Row 9: Notes */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 dark:bg-slate-900 focus:ring-4 focus:ring-maroon-800/5 outline-none transition-all dark:text-white min-h-[80px] resize-none"
            placeholder="Optional notes or additional information"
          />
        </div>
      </form>

      <WhatsAppShareModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        party={{
          ...customer,
          phone: formData.phone,
          name: formData.name,
          status: formData.status,
          balance: customer?.balance !== undefined ? customer.balance : formData.openingBalance,
          type: "Customer"
        }}
        type="Reminder"
        shopProfile={shopProfile}
      />
    </ERPModal>
  );
}
