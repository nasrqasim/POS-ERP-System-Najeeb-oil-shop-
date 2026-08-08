"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ERPPageHeader from "@/components/erp/ui/ERPPageHeader";
import ERPStatCard from "@/components/erp/ui/ERPStatCard";
import ERPDataTable from "@/components/erp/ui/ERPDataTable";
import ItemModal from "@/components/erp/maintain/ItemModal";
import { Plus, FileText, Download, Printer, Network, List, Package, Layers, AlertTriangle, Edit2, Trash2, FileSpreadsheet, ChevronRight, Folder } from "lucide-react";
import { exportToExcel, downloadTemplate, printPage, triggerFileInput, importFromExcel } from "@/lib/excel";
import CategoryModal from "@/components/erp/maintain/CategoryModal";

export default function ItemsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isSalesUser = (role || "").toLowerCase().replace(/\s+/g, "") === "salesuser" || (role || "").toLowerCase().replace(/\s+/g, "") === "sales_user";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catModalType, setCatModalType] = useState<"main" | "sub">("main");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"tree" | "list">("list");
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/items");
      const json = await res.json();
      if (json.ok) setItems(json.data);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.ok) setCategories(json.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchItems(); 
    fetchCategories();
  }, []);

  const handleImport = async () => {
    const file = await triggerFileInput();
    if (file) {
      const data = await importFromExcel(file);
      for (const row of data) {
        await fetch("/api/items", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: row["Code"] || row.code || `ITEM-${Date.now()}`,
            name: row["Item Name"] || row.name || "Unknown Item",
            purchaseRate: parseFloat(row["Purchase Rate"] || row.purchaseRate || "0"),
            wholesaleRate: parseFloat(row["Wholesale Rate"] || row.wholesaleRate || "0"),
            retailRate: parseFloat(row["Retail Rate"] || row.retailRate || "0"),
            stockQtyCartons: parseInt(row["Stock"] || row.stock || "0"),
          }),
        });
      }
      fetchItems();
    }
  };

  const handleAdd = () => { setSelectedItem(null); setIsModalOpen(true); };
  const handleEdit = (item: any) => { setSelectedItem(item); setIsModalOpen(true); };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      await fetch(`/api/items/${id}`, { method: "DELETE" });
      fetchItems();
    }
  };

  const handleSave = async (data: any) => {
    try {
      const res = selectedItem?._id 
        ? await fetch(`/api/items/${selectedItem._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        : await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      
      const json = await res.json();
      if (!json.ok) {
        alert(json.message || "Failed to save item");
      } else {
        fetchItems();
        setIsModalOpen(false);
      }
    } catch (e) {
      alert("An error occurred while saving item");
      console.error(e);
    }
  };

  const handleSaveCategory = async (data: any) => {
    const res = await fetch("/api/categories", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(data) 
    });
    const json = await res.json();
    if (!json.ok) alert(json.message || "Failed to save category");
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this category?")) {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        if (selectedCatId === id) setSelectedCatId(null);
        if (selectedSubCatId === id) setSelectedSubCatId(null);
        fetchCategories();
      } else {
        alert(json.message || "Failed to delete category");
      }
    }
  };

  const mainCats = categories.filter(c => c.type === "main");
  const filteredSubCats = categories.filter(c => c.type === "sub" && (selectedCatId ? String(c.parentId) === String(selectedCatId) : true));
  
  const filteredItems = items.filter(item => {
    if (selectedSubCatId && String(item.subCategoryId) !== String(selectedSubCatId)) return false;
    if (selectedCatId && String(item.mainCategoryId) !== String(selectedCatId)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (item.name || "").toLowerCase().includes(q) ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const lowStockItems = items.filter(i => (i.stockQtyCartons || 0) < (i.reorderLevel || 5));
  const totalValue = items.reduce((acc, i) => acc + ((i.stockQtyCartons || 0) * (i.purchaseRate || 0)), 0);

  const columns = [
    { header: "Code", accessor: "code" },
    { header: "Item Name", accessor: "name" },
    { header: "Unit", accessor: "unit", render: (val: string) => <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-black uppercase tracking-wider">{val || "Liter"}</span> },
    { header: "Purchase Rate", accessor: "purchaseRate", render: (val: number) => <span className="font-bold">Rs.{(val||0).toLocaleString()}</span> },
    { header: "Retail Rate", accessor: "retailRate", render: (val: number) => <span className="font-bold">Rs.{(val||0).toLocaleString()}</span> },
    { header: "Stock Qty", accessor: "stockQtyCartons", render: (val: number, row: any) => (
      <span className={`font-bold ${(val||0) < (row.reorderLevel||5) ? "text-red-500" : "text-slate-900 dark:text-white"}`}>
        {val||0} {row.unit || "Liter"}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <ERPPageHeader title="Chart of Inventory" subtitle="Manage product categories, sub-categories and individual items"
        actions={[
          { label: "Print", onClick: printPage, icon: Printer },
          { label: "Export", onClick: () => exportToExcel(items, "Items.xlsx"), icon: FileSpreadsheet },
          ...(!isSalesUser ? [
            { label: "Download Template", onClick: () => downloadTemplate(["Code", "Item Name", "Purchase Rate", "Wholesale Rate", "Retail Rate", "Stock"], "ItemsTemplate.xlsx"), icon: Download },
            { label: "Import", onClick: handleImport, icon: FileText },
            { label: "Add Item", onClick: handleAdd, icon: Plus, variant: "primary" as const },
          ] : [])
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ERPStatCard label="Total Items" value={items.length} icon={Package} variant="blue" />
        <ERPStatCard label="Low Stock" value={lowStockItems.length} icon={AlertTriangle} variant="orange" />
        <ERPStatCard label="Total Value" value={`PKR ${(totalValue/1000000).toFixed(2)}M`} icon={FileText} variant="green" />
        <ERPStatCard label="Avg Purchase Rate" value={items.length ? `Rs.${Math.round(items.reduce((a,i)=>a+(i.purchaseRate||0),0)/items.length).toLocaleString()}` : "Rs.0"} icon={Layers} variant="maroon" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Categories Sidebar */}
        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Categories</h3>
              {!isSalesUser && (
                <button 
                  onClick={() => { setCatModalType("main"); setIsCatModalOpen(true); }}
                  className="p-1.5 text-maroon-800 hover:bg-maroon-50 rounded-lg transition-all"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              <div className="space-y-1">
                <button 
                  onClick={() => { setSelectedCatId(null); setSelectedSubCatId(null); }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${!selectedCatId ? "bg-maroon-800 text-white shadow-lg shadow-maroon-900/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                >
                  <Layers size={14} /> All Categories
                </button>
                {mainCats.map(cat => (
                  <div key={cat._id} className="group relative">
                    <button 
                      onClick={() => { setSelectedCatId(String(cat._id)); setSelectedSubCatId(null); }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${selectedCatId && String(selectedCatId) === String(cat._id) ? "bg-maroon-50 dark:bg-maroon-900/20 text-maroon-800 dark:text-maroon-400" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Folder size={14} className={selectedCatId && String(selectedCatId) === String(cat._id) ? "text-maroon-800" : "text-slate-400"} />
                        {cat.name}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isSalesUser && (
                          <Trash2 
                            size={12} 
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all" 
                            onClick={(e) => handleDeleteCategory(String(cat._id), e)}
                          />
                        )}
                        <ChevronRight size={14} className={selectedCatId && String(selectedCatId) === String(cat._id) ? "opacity-100" : "opacity-0"} />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sub-Categories</h3>
              {!isSalesUser && (
                <button 
                  onClick={() => { setCatModalType("sub"); setIsCatModalOpen(true); }}
                  className="p-1.5 text-maroon-800 hover:bg-maroon-50 rounded-lg transition-all"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              {selectedCatId ? (
                <div className="space-y-1">
                  <button 
                    onClick={() => setSelectedSubCatId(null)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${!selectedSubCatId ? "bg-maroon-50 dark:bg-maroon-900/20 text-maroon-800 dark:text-maroon-400" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                  >
                    All Sub-Categories
                  </button>
                  {filteredSubCats.map(sub => (
                    <div key={sub._id} className="group relative">
                      <button 
                        key={sub._id}
                        onClick={() => setSelectedSubCatId(String(sub._id))}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${selectedSubCatId && String(selectedSubCatId) === String(sub._id) ? "bg-maroon-50 dark:bg-maroon-900/20 text-maroon-800 dark:text-maroon-400" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-maroon-800" />
                          {sub.name}
                        </div>
                        {!isSalesUser && (
                          <Trash2 
                            size={12} 
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all" 
                            onClick={(e) => handleDeleteCategory(String(sub._id), e)}
                          />
                        )}
                      </button>
                    </div>
                  ))}
                  {filteredSubCats.length === 0 && <p className="text-[10px] text-center text-slate-400 py-4 font-bold uppercase tracking-widest">No sub-categories</p>}
                </div>
              ) : (
                <p className="text-[10px] text-center text-slate-400 py-8 font-bold uppercase tracking-widest">Select a category first</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[600px]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4">Items</h3>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-4">
              <button onClick={() => setViewMode("list")} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "list" ? "bg-white dark:bg-slate-900 text-maroon-800 dark:text-maroon-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>
                <List size={14} /> List View
              </button>
            </div>
          </div>
          <ERPDataTable columns={columns} data={filteredItems}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by item name or code..."
            actions={!isSalesUser ? [
              { label: "Edit", onClick: handleEdit, icon: Edit2 },
              { label: "Delete", onClick: (row: any) => handleDelete(row._id), icon: Trash2, variant: "danger" },
            ] : undefined}
          />
        </div>
      </div>

      <ItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} item={selectedItem} onSave={handleSave} />
      <CategoryModal 
        isOpen={isCatModalOpen} 
        onClose={() => setIsCatModalOpen(false)} 
        onSave={handleSaveCategory} 
        type={catModalType}
        parentId={selectedCatId || ""}
        categories={categories}
      />
    </div>
  );
}
