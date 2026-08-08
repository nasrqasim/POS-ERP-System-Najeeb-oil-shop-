"use client";

import { useState, useEffect } from "react";
import PurchaseInvoiceForm from "@/components/purchases/PurchaseInvoiceForm";
import PurchaseInvoiceDetails from "@/components/purchases/PurchaseInvoiceDetails";
import ERPPageHeader from "@/components/erp/ui/ERPPageHeader";
import WhatsAppShareModal from "@/components/erp/whatsapp/WhatsAppShareModal";
import { Plus, Search, Filter, Eye, Edit, Trash2, FileText, Link2, ExternalLink, Clock, CheckCircle2, Printer, FileSpreadsheet, Upload, MessageCircle } from "lucide-react";
import { exportToExcel, printPage } from "@/lib/excel";

interface PurchaseInvoice {
  id: string;
  docNo: string;
  date: string;
  vendor: string;
  vendorInvNo: string;
  linkedRef: string;
  total: number;
  balance: number;
  status: "Draft" | "Posted" | "Paid" | "Cancelled";
}


export default function PurchaseInvoicePage() {
  const [showForm, setShowForm] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseInvoice | null>(null);
  const [editOrder, setEditOrder] = useState<PurchaseInvoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waParty, setWaParty] = useState<any>(null);
  const [waDocData, setWaDocData] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/invoices?type=purchase", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setInvoices(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopProfile = async () => {
    try {
      const res = await fetch("/api/shop-profile");
      const json = await res.json();
      if (json.ok) setShopProfile(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchShopProfile();
  }, [showForm]);


  const handleSaveInvoice = (data: any) => {
    if (data.id) {
      setInvoices(invoices.map(i => i.id === data.id ? { ...i, ...data } : i));
    } else {
      setInvoices([...invoices, { ...data, id: Date.now().toString() }]);
    }
    setShowForm(false);
    setEditOrder(null);
  };

  const deleteInvoice = async (id: string) => {
    if (confirm("Are you sure you want to delete this purchase invoice?")) {
      try {
        const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
        if (res.ok) {
          setInvoices(invoices.filter(i => i._id !== id));
          alert("Deleted successfully");
        } else {
          alert("Failed to delete");
        }
      } catch (e) { console.error(e); }
    }
  };

  if (showForm) {
    return <PurchaseInvoiceForm 
      onClose={() => {
        setShowForm(false);
        setEditOrder(null);
      }} 
      onSave={handleSaveInvoice}
      initialData={editOrder}
    />;
  }

  if (viewOrder) {
    return (
      <PurchaseInvoiceDetails 
        invoice={viewOrder} 
        onClose={() => setViewOrder(null)} 
        onEdit={() => {
          setEditOrder(viewOrder);
          setShowForm(true);
          setViewOrder(null);
        }} 
      />
    );
  }

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchQuery || 
      inv.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.partyId?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.partyId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.vendorInvNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.linkedRef?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || inv.status?.toLowerCase() === statusFilter.toLowerCase();
    
    const invDateStr = inv.date ? new Date(inv.date).toISOString().split('T')[0] : "";
    const matchesDate = !filterDate || invDateStr === filterDate;
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="Purchase Invoice"
        description="Manage your purchase invoices and vendor payments."
        actions={[
          { label: "Import", onClick: () => window.location.href = "/ai-studio", icon: Upload },
          { label: "Export", onClick: () => exportToExcel(invoices, "PurchaseInvoices.xlsx"), icon: FileSpreadsheet }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-maroon-50 text-maroon-800 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Invoices</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{invoices.length}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <Link2 size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Outstanding</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">
              PKR {invoices.reduce((sum, i) => sum + (i.balance || 0), 0).toLocaleString()}
            </h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Posted</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{invoices.filter(i => i.status === "Posted").length}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest">Paid</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{invoices.filter(i => i.status === "Paid").length}</h4>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 dark:bg-slate-800/50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by invoice#, vendor, vendor inv#..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800/10 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <input 
              type="date" 
              value={filterDate} 
              onChange={(e) => setFilterDate(e.target.value)} 
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/10 transition-all"
            />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maroon-800/10 transition-all flex-1 md:flex-none"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Posted">Posted</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <button 
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-2 bg-maroon-800 text-white rounded-lg text-sm font-bold hover:bg-maroon-900 transition-all shadow-lg shadow-maroon-800/20"
            >
              <Plus size={18} />
              New Invoice
            </button>
            <button className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-12">#</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Invoice #</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vendor Inv#</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Linked Ref</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Balance</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv, i) => (
                  <tr key={inv._id || inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/50 transition-colors group">
                    <td className="px-6 py-4 text-slate-500 font-medium">{i + 1}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-maroon-800 transition-colors">{inv.invoiceNo}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                        {inv.date ? new Date(inv.date).toLocaleDateString() : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{inv.partyId?.companyName || inv.partyId?.name || "N/A"}</span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{inv.vendorInvNo}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-maroon-800">
                        {inv.linkedRef} <ExternalLink size={12} className="opacity-50" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{(inv.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${(inv.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {(inv.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : 
                        inv.status === "Posted" ? "bg-blue-100 text-blue-700" : 
                        inv.status === "Cancelled" ? "bg-rose-100 text-rose-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setViewOrder(inv)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-maroon-800 hover:bg-maroon-50 rounded-lg transition-all" 
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => { setEditOrder(inv); setShowForm(true); }}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => setViewOrder(inv)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-all" title="Print Invoice"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setWaParty(inv.partyId || { name: inv.vendorName || "Vendor" });
                            setWaDocData({ ...inv, rows: inv.items });
                            setIsWhatsAppModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded-lg transition-all" title="WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button 
                          onClick={() => deleteInvoice(inv._id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" 
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No purchase invoices found.</p>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 dark:bg-slate-950 text-white">
                <td colSpan={6} className="px-6 py-3 text-xs font-black uppercase tracking-widest">Grand Total ({filteredInvoices.length} Invoices)</td>
                <td className="px-6 py-3 text-right text-xs font-black">{filteredInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-3 text-right text-xs font-black">{filteredInvoices.reduce((s, i) => s + (i.balance || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-50 bg-slate-50 dark:bg-slate-800/50/30 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
          <span>Total: {filteredInvoices.length} invoice(s)</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span> Posted: {filteredInvoices.filter(i => i.status === "Posted").length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Paid: {filteredInvoices.filter(i => i.status === "Paid").length}
            </span>
          </div>
        </div>
      </div>

      <WhatsAppShareModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        party={waParty}
        type="Invoice"
        documentData={waDocData}
        shopProfile={shopProfile}
      />
    </div>
  );
}

