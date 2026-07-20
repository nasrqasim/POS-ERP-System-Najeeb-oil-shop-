"use client";

import { useState, useEffect } from "react";
import ERPPageHeader from "@/components/erp/ui/ERPPageHeader";
import ERPDataTable from "@/components/erp/ui/ERPDataTable";
import VendorModal from "@/components/erp/maintain/VendorModal";
import QuickPaymentModal from "@/components/erp/maintain/QuickPaymentModal";
import WhatsAppShareModal from "@/components/erp/whatsapp/WhatsAppShareModal";
import VendorProfileHistory from "@/components/erp/maintain/VendorProfileHistory";
import { Plus, FileText, Download, Printer, UserCheck, UserX, Wallet, Search, Edit2, Trash2, MapPin, User, Hash, FileSpreadsheet, MessageCircle } from "lucide-react";
import ERPStatCard from "@/components/erp/ui/ERPStatCard";
import { exportToExcel, downloadTemplate, printPage, printListDocument, triggerFileInput, importFromExcel } from "@/lib/excel";

export default function VendorsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeVendor, setActiveVendor] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waParty, setWaParty] = useState<any>(null);
  const [selectedProfileVendor, setSelectedProfileVendor] = useState<any>(null);

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/parties?type=vendor");
      const json = await res.json();
      if (json.ok) {
        setVendors(json.data);
      }
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
    fetchVendors();
    fetchShopProfile();
  }, []);

  useEffect(() => {
    if (vendors.length > 0 && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const vendorId = params.get("vendorId");
      if (vendorId) {
        const matched = vendors.find((v: any) => v._id === vendorId);
        if (matched) {
          setSelectedProfileVendor(matched);
        }
      }
    }
  }, [vendors]);

  const handleAdd = () => {
    setSelectedVendor(null);
    setIsModalOpen(true);
  };

  const handleImport = async () => {
    const file = await triggerFileInput();
    if (file) {
      const data = await importFromExcel(file);
      console.log("Imported vendor data:", data);
      alert("Bulk import API needs to be implemented. Data parsed successfully.");
      fetchVendors();
    }
  };

  const handleEdit = (vendor: any) => {
    setSelectedVendor(vendor);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      try {
        const res = await fetch(`/api/parties/${id}`, { method: "DELETE" });
        if (res.ok) fetchVendors();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSave = async (data: any) => {
    const payload = {
      ...data,
      companyName: data.name,
      name: data.companyName || data.name || data.contactPerson || "Unknown",
      code: data.code || `VEND-${Date.now()}`,
      type: "Vendor"
    };

    try {
      if (selectedVendor?._id) {
        const res = await fetch(`/api/parties/${selectedVendor._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) fetchVendors();
      } else {
        const res = await fetch("/api/parties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) fetchVendors();
      }
    } catch (e) {
      console.error(e);
    }
    setIsModalOpen(false);
  };

  const columns = [
    { 
      header: "Account Code", 
      accessor: "code",
      render: (val: string) => (
        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter">{val || "-"}</span>
      )
    },
    { 
      header: "Vendor Name", 
      accessor: "name",
      render: (val: string, row: any) => {
        const hasValidPhone = row.phone && row.phone.replace(/[^0-9]/g, "").length >= 10;
        return (
          <div className="flex flex-col">
            <span className="font-black text-slate-900 dark:text-white">{val}</span>
            {(row.phone || row.contactPerson) && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {row.contactPerson ? `${row.contactPerson} | ` : ""}{row.phone || ""}
                </span>
                {hasValidPhone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWaParty(row);
                      setIsWhatsAppModalOpen(true);
                    }}
                    title="Send WhatsApp Reminder"
                    className="p-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                  >
                    <MessageCircle size={12} className="fill-emerald-600/10" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    { 
      header: "Type", 
      accessor: "category", // Storing types of vendors in category similar to customers
      render: (val: string, row: any) => (
        <span className="px-2 py-1 bg-maroon-50 dark:bg-maroon-900/30 text-maroon-800 dark:text-maroon-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
          {val || row.vendorType || "Supplier"}
        </span>
      )
    },
    { 
      header: "Opening Balance", 
      accessor: "openingBalance", 
      render: (val: number) => {
        const isNegative = val < 0;
        const formattedVal = isNegative 
          ? `-Rs. ${Math.abs(val).toLocaleString()}` 
          : `+Rs. ${val?.toLocaleString() || "0"}`;
        const balanceLabel = isNegative ? " (Debit)" : val > 0 ? " (Credit)" : "";
        return (
          <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
            {formattedVal}{balanceLabel}
          </span>
        );
      }
    },
    { 
      header: "Debit (Payment)", 
      accessor: "debit",
      render: (val: number) => {
        const num = Number(val) || 0;
        if (num !== 0) {
          return <span className="text-sm font-bold text-rose-600">-Rs. {Math.abs(num).toLocaleString()}</span>;
        }
        return <span className="text-sm font-bold text-slate-500">Rs. 0</span>;
      }
    },
    { 
      header: "Credit (Purchased)", 
      accessor: "credit",
      render: (val: number) => {
        const num = Number(val) || 0;
        if (num !== 0) {
          return <span className="text-sm font-bold text-emerald-600">+Rs. {Math.abs(num).toLocaleString()}</span>;
        }
        return <span className="text-sm font-bold text-slate-500">Rs. 0</span>;
      }
    },
    { 
      header: "Closing Balance", 
      accessor: "balance", 
      render: (val: number) => {
        const isNegative = val < 0;
        const formattedVal = isNegative 
          ? `-Rs. ${Math.abs(val).toLocaleString()}` 
          : `+Rs. ${val?.toLocaleString() || "0"}`;
        const balanceLabel = isNegative ? " (Debit)" : val > 0 ? " (Credit)" : "";
        return (
          <span className={`text-sm font-black ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
            {formattedVal}{balanceLabel}
          </span>
        );
      }
    },
    { 
      header: "Status", 
      accessor: "status", 
      render: (val: string) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          val === "Active" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        }`}>
          {val || "Active"}
        </span>
      )
    },
  ];

  // Filter vendors by search term
  const filteredVendors = vendors.filter(v => {
    const term = searchTerm.toLowerCase();
    return (
      v.name?.toLowerCase().includes(term) ||
      v.code?.toLowerCase().includes(term) ||
      v.contactPerson?.toLowerCase().includes(term) ||
      v.phone?.toLowerCase().includes(term) ||
      v.city?.toLowerCase().includes(term) ||
      v.ntn?.toLowerCase().includes(term)
    );
  });

  if (selectedProfileVendor) {
    return (
      <VendorProfileHistory 
        vendor={selectedProfileVendor}
        onBack={() => {
          setSelectedProfileVendor(null);
          fetchVendors();
        }}
        shopProfile={shopProfile}
      />
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          aside, header, nav, .no-print, button, input, select {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .print-header {
            display: block !important;
            text-align: center;
            margin-bottom: 20px;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            table-layout: auto !important;
          }
          th, td {
            border: 1px solid #e2e8f0 !important;
            padding: 8px !important;
            font-size: 10px !important;
            color: black !important;
          }
          .overflow-x-auto {
            overflow: visible !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print">
        <ERPPageHeader 
          title="Vendors" 
          subtitle="Master Data / Vendors"
          actions={[
            { label: "Export Excel", onClick: () => exportToExcel(vendors, "Vendors.xlsx"), icon: FileSpreadsheet },
            { label: "Print List", onClick: () => printListDocument({
                title: "Vendor Balances Report",
                companyName: shopProfile?.companyName || "Al Hadeed Traders",
                companyAddress: shopProfile?.address || "Bela, Balochistan, Pakistan",
                companyPhone: shopProfile?.phone || "",
                columns: [
                  { header: "#", key: "_idx" },
                  { header: "Account Code", key: "code" },
                  { header: "Vendor Name", key: "name" },
                  { header: "Type", key: "category" },
                  { header: "Phone", key: "phone" },
                  { header: "Opening Bal.", key: "openingBalance" },
                  { header: "Debit", key: "debit" },
                  { header: "Credit", key: "credit" },
                  { header: "Closing Bal.", key: "balance" },
                  { header: "Status", key: "status" },
                ],
                rows: filteredVendors.map((v, i) => ({ ...v, _idx: i + 1, openingBalance: `Rs.${(v.openingBalance || 0).toLocaleString()}`, debit: `Rs.${(v.debit || 0).toLocaleString()}`, credit: `Rs.${(v.credit || 0).toLocaleString()}`, balance: `Rs.${(v.balance || 0).toLocaleString()}` })),
                totals: {
                  _idx: "", code: "TOTAL", name: `${filteredVendors.length} Vendors`, category: "", phone: "",
                  openingBalance: `Rs.${filteredVendors.reduce((a, v) => a + (v.openingBalance || 0), 0).toLocaleString()}`,
                  debit: `Rs.${filteredVendors.reduce((a, v) => a + (v.debit || 0), 0).toLocaleString()}`,
                  credit: `Rs.${filteredVendors.reduce((a, v) => a + (v.credit || 0), 0).toLocaleString()}`,
                  balance: `Rs.${filteredVendors.reduce((a, v) => a + (v.balance || 0), 0).toLocaleString()}`,
                  status: "",
                },
              }), icon: Printer },
            { label: "Download Template", onClick: () => downloadTemplate(["Code", "Name", "Contact Person", "Phone", "Email", "City", "NTN", "Balance", "Type", "Status"], "VendorsTemplate.xlsx"), icon: Download },
            { label: "Import Excel", onClick: handleImport, icon: FileText },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <ERPStatCard label="Active Vendors" value={vendors.filter(v => v.status === "Active").length} icon={UserCheck} variant="green" />
        <ERPStatCard label="Inactive Vendors" value={vendors.filter(v => v.status === "Inactive").length} icon={UserX} variant="slate" />
        <ERPStatCard label="Total Payable" value={`Rs. ${(vendors.reduce((acc, v) => acc + (v.balance > 0 ? v.balance : 0), 0) / 1000000).toFixed(1)}M`} icon={Wallet} variant="maroon" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8 no-print">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by vendor name, contact, phone, location..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => printListDocument({
                title: "Vendor Balances Report",
                companyName: shopProfile?.companyName || "Al Hadeed Traders",
                companyAddress: shopProfile?.address || "Bela, Balochistan, Pakistan",
                companyPhone: shopProfile?.phone || "",
                columns: [
                  { header: "#", key: "_idx" },
                  { header: "Account Code", key: "code" },
                  { header: "Vendor Name", key: "name" },
                  { header: "Type", key: "category" },
                  { header: "Opening Bal.", key: "openingBalance" },
                  { header: "Debit", key: "debit" },
                  { header: "Credit", key: "credit" },
                  { header: "Closing Bal.", key: "balance" },
                  { header: "Status", key: "status" },
                ],
                rows: filteredVendors.map((v, i) => ({ ...v, _idx: i + 1, openingBalance: `Rs.${(v.openingBalance || 0).toLocaleString()}`, debit: `Rs.${(v.debit || 0).toLocaleString()}`, credit: `Rs.${(v.credit || 0).toLocaleString()}`, balance: `Rs.${(v.balance || 0).toLocaleString()}` })),
                totals: {
                  _idx: "", code: "TOTAL", name: `${filteredVendors.length} Vendors`, category: "",
                  openingBalance: `Rs.${filteredVendors.reduce((a, v) => a + (v.openingBalance || 0), 0).toLocaleString()}`,
                  debit: `Rs.${filteredVendors.reduce((a, v) => a + (v.debit || 0), 0).toLocaleString()}`,
                  credit: `Rs.${filteredVendors.reduce((a, v) => a + (v.credit || 0), 0).toLocaleString()}`,
                  balance: `Rs.${filteredVendors.reduce((a, v) => a + (v.balance || 0), 0).toLocaleString()}`,
                  status: "",
                },
              })}
              className="flex items-center gap-2 px-8 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-sm"
            >
              <Printer size={18} />
              Print
            </button>
            <button 
              onClick={handleAdd}
              className="flex items-center gap-2 px-8 py-3 bg-maroon-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-maroon-900 transition-all shadow-lg shadow-maroon-800/20"
            >
              <Plus size={18} />
              New Vendor
            </button>
          </div>
        </div>
      </div>

      <div className="print-container bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-maroon-900/5 min-h-[100px]">
        {/* Print Header (Visible only when printing) */}
        <div className="hidden print-header p-6 pb-0">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{shopProfile?.companyName || "Al Hadeed Traders"}</h2>
          <h3 className="text-sm font-bold text-maroon-800 uppercase tracking-widest mt-1">Vendor Balances Report</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Generated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="p-1">
          {filteredVendors.length > 0 ? (
            <ERPDataTable 
              columns={columns} 
              data={filteredVendors} 
              actions={[
                { label: "Edit", onClick: handleEdit, icon: Edit2 },
                { label: "View Profile", onClick: (row: any) => setSelectedProfileVendor(row), icon: FileText },
                { 
                  label: "WhatsApp Reminder", 
                  onClick: (row: any) => { setWaParty(row); setIsWhatsAppModalOpen(true); }, 
                  icon: MessageCircle,
                  hide: (row: any) => !row.phone || row.phone.replace(/[^0-9]/g, "").length < 10
                },
                { label: "Pay", onClick: (row: any) => { setActiveVendor(row); setIsPaymentModalOpen(true); }, icon: Wallet },
                { label: "Delete", onClick: (row: any) => handleDelete(row._id), icon: Trash2, variant: "danger" },
              ]}
              footerContent={
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-widest text-xs">Total PKR:</td>
                  <td className="px-6 py-4 text-sm">Rs.{filteredVendors.reduce((acc, v) => acc + (v.openingBalance || 0), 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-rose-600">-Rs.{filteredVendors.reduce((acc, v) => acc + (v.debit || 0), 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-emerald-600">+Rs.{filteredVendors.reduce((acc, v) => acc + (v.credit || 0), 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-maroon-800 dark:text-maroon-400">Rs.{filteredVendors.reduce((acc, v) => acc + (v.balance || 0), 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">-</td>
                  <td className="px-6 py-4 print:hidden"></td>
                </tr>
              }
            />
          ) : (
            <div className="py-12 text-center no-print">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No vendors found</p>
            </div>
          )}
        </div>
      </div>

      <VendorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        vendor={selectedVendor}
        onSave={handleSave}
      />

      {activeVendor && (
        <QuickPaymentModal 
          isOpen={isPaymentModalOpen} 
          onClose={() => setIsPaymentModalOpen(false)} 
          vendor={activeVendor} 
          onSuccess={fetchVendors} 
        />
      )}

      <WhatsAppShareModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        party={waParty}
        type="Reminder"
        shopProfile={shopProfile}
      />
    </div>
  );
}
