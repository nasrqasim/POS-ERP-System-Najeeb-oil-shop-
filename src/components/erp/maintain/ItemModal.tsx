"use client";

import { useState, useEffect } from "react";
import ERPModal from "../ui/ERPModal";
import { Save, Package, Tag, Layers, Scale } from "lucide-react";
import { validateItemPackSizes } from "@/lib/itemUnits";

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any;
  onSave: (data: any) => void;
}

export default function ItemModal({ isOpen, onClose, item, onSave }: ItemModalProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    code: item?.code || "",
    name: item?.name || "",
    mainCategoryId: item?.mainCategoryId || "",
    subCategoryId: item?.subCategoryId || "",
    litersInCtn: item?.litersInCtn || 0,
    gallonsInCtn: item?.gallonsInCtn || 0,
    purchaseRate: item?.purchaseRate || 0,
    wholesaleRate: item?.wholesaleRate || 0,
    retailRate: item?.retailRate || 0,
    stockQtyCartons: item?.stockQtyCartons || 0,
    reorderLevel: item?.reorderLevel || 0,
    status: item?.status || "Active",
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.ok) setCategories(json.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code || "",
        name: item.name || "",
        mainCategoryId: item.mainCategoryId || "",
        subCategoryId: item.subCategoryId || "",
        litersInCtn: item.litersInCtn || 0,
        gallonsInCtn: item.gallonsInCtn || 0,
        purchaseRate: item.purchaseRate || 0,
        wholesaleRate: item.wholesaleRate || 0,
        retailRate: item.retailRate || 0,
        stockQtyCartons: item.stockQtyCartons || 0,
        reorderLevel: item.reorderLevel || 0,
        status: item.status || "Active",
      });
    } else {
      setFormData({
        code: "",
        name: "",
        mainCategoryId: "",
        subCategoryId: "",
        litersInCtn: 0,
        gallonsInCtn: 0,
        purchaseRate: 0,
        wholesaleRate: 0,
        retailRate: 0,
        stockQtyCartons: 0,
        reorderLevel: 0,
        status: "Active",
      });
    }
    fetchCategories();
  }, [item, isOpen]);

  const mainCats = categories.filter(c => c.type === "main");
  const subCats = categories.filter(c => c.type === "sub" && String(c.parentId) === String(formData.mainCategoryId));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate conversion values
    const validation = validateItemPackSizes(formData.gallonsInCtn, formData.litersInCtn);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    
    if (onSave) onSave(formData);
    onClose();
  };

  return (
    <ERPModal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? "Edit Item" : "Add New Item"}
      size="lg"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-8 py-2.5 bg-maroon-800 text-white rounded-xl text-sm font-black hover:bg-maroon-900 transition-all shadow-xl shadow-maroon-900/20"
          >
            <Save size={18} />
            {item ? "Update Item" : "Save Item"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Item Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white outline-none"
              placeholder="e.g. ITEM-001"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Item Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white outline-none"
              placeholder="Product name"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Category *</label>
            <select
              value={formData.mainCategoryId}
              onChange={(e) => setFormData({ ...formData, mainCategoryId: e.target.value, subCategoryId: "" })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white outline-none"
              required
            >
              <option value="">Select Category</option>
              {mainCats.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Sub Category *</label>
            <select
              value={formData.subCategoryId}
              onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white outline-none"
              required
            >
              <option value="">Select Sub Category</option>
              {subCats.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Liters in Ctn</label>
            <input
              type="number"
              step="any"
              value={formData.litersInCtn}
              onChange={(e) => setFormData({ ...formData, litersInCtn: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Gallons in Ctn</label>
            <input
              type="number"
              step="any"
              value={formData.gallonsInCtn}
              onChange={(e) => setFormData({ ...formData, gallonsInCtn: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Purchase Rate</label>
            <input
              type="number"
              step="any"
              value={formData.purchaseRate}
              onChange={(e) => setFormData({ ...formData, purchaseRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Wholesale Rate</label>
            <input
              type="number"
              step="any"
              value={formData.wholesaleRate}
              onChange={(e) => setFormData({ ...formData, wholesaleRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Retail Rate</label>
            <input
              type="number"
              step="any"
              value={formData.retailRate}
              onChange={(e) => setFormData({ ...formData, retailRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Opening Stock (Ctns)</label>
            <input
              type="number"
              step="any"
              value={formData.stockQtyCartons}
              onChange={(e) => setFormData({ ...formData, stockQtyCartons: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Reorder Level</label>
            <input
              type="number"
              step="any"
              value={formData.reorderLevel}
              onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black dark:text-white outline-none"
            />
          </div>
        </div>
      </form>
    </ERPModal>
  );
}
