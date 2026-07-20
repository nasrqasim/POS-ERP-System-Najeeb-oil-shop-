"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PrintTemplate from "@/components/print/PrintTemplate";
import ItemSearchInput from "@/components/erp/ui/ItemSearchInput";
import CustomerModal from "@/components/erp/maintain/CustomerModal";
import ERPModal from "@/components/erp/ui/ERPModal";
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  CheckCircle2, 
  Printer, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  History, 
  FileText, 
  Undo, 
  Settings, 
  Package,
  User,
  AlertCircle,
  ArrowRightLeft,
  ArrowLeft
} from "lucide-react";
import {
  applyUnitFieldUpdate,
  defaultUnitsForItem,
  resolveCatalogItem,
  formatQtyDisplay,
} from "@/lib/itemUnits";

interface SIItem {
  id: string;
  itemId: string;
  itemCode: string;
  description: string;
  cartons: number;
  gallons: number;
  liters: number;
  entryUnit?: "cartons" | "gallons" | "liters";
  ratePerCtn: number;
  grossAmount: number;
  discPercent: number;
  discount: number;
  netAmount: number;
}

interface SaleInvoiceFormProps {
  onClose: () => void;
  initialData?: any;
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-1 min-w-[70px] hover:bg-[#d1d5db] rounded transition-all group">
      <div className="text-slate-600 group-hover:scale-110 transition-transform">{icon}</div>
      <span className="text-[9px] font-bold mt-1 text-slate-700 group-hover:text-black">{label}</span>
    </button>
  );
}

export default function SaleInvoiceForm({ onClose, initialData }: SaleInvoiceFormProps) {
  // Form State
  const [formData, setFormData] = useState({
    serialNo: initialData?.invoiceNo || `SI-${Date.now().toString().slice(-6)}`,
    date: initialData?.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    invoiceType: initialData?.invoiceType || "Sale Invoice",
    vehicleNo: initialData?.regNo || "",
    rangeKms: initialData?.rangeKms || 0,
    termsOfPayment: initialData?.paymentTerms || "Cash",
    incomeAccountId: initialData?.incomeAccountId || "40001001",
    isCancelled: initialData?.isCancelled || false,
    isWholesale: initialData?.isWholesale || false,
    isRetail: initialData?.isRetail || true,
    isOnCredit: initialData?.isCreditBill || false,
    startKms: initialData?.startKms || 0,
    endKms: initialData?.endKms || 0,
    oilGaugeLimit: initialData?.oilGaugeLimit || 0,
    status: initialData?.status || "posted",
    
    // Customer
    customerId: initialData?.partyId?._id || initialData?.partyId || "",
    customerCode: initialData?.partyId?.code || "",
    customerName: initialData?.partyId?.name || "",
    customerAddress: initialData?.partyId?.address || "",
    customerTelephone: initialData?.partyId?.phone || "",
    customerBalance: initialData?.partyId?.balance || 0.00,
    customerCreditLimit: initialData?.partyId?.creditLimit || 0.00,
    
    // Bottom Section
    locationId: initialData?.locationId?._id || initialData?.locationId || "",
    jobNo: initialData?.jobId?.code || "",
    employeeRef: initialData?.employeeId?._id || initialData?.employeeId || "",
    remarks: initialData?.notes || "",
    
    // Totals
    additionalDiscount: initialData?.discountAmount || 0,
    carService: initialData?.carService || 0,
    carServiceDiscount: initialData?.carServiceDiscount || 0,
    amountReceived: initialData?.amountReceived || 0,
    useAdvance: initialData?.useAdvance || false,
    advanceAmountUsed: initialData?.advanceAmountUsed || 0,
    customerAdvanceStats: initialData?.partyId?.advanceStats || null
  });

  const [printData, setPrintData] = useState<any>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const handleSaveCustomer = async (newCustomerData: any) => {
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCustomerData,
          type: "Customer",
          companyName: newCustomerData.name
        })
      });
      const data = await res.json();
      if (data.ok) {
        const savedCustomer = data.data;
        setFormData(prev => ({
          ...prev,
          customerId: savedCustomer._id,
          customerName: savedCustomer.name,
          customerCode: savedCustomer.code,
          customerAddress: savedCustomer.address,
          customerTelephone: savedCustomer.phone,
          customerBalance: 0
        }));
        alert("Customer created and selected successfully!");
        fetchData();
      } else {
        alert("Failed to save customer: " + (data.message || "Unknown error"));
      }
    } catch (e: any) {
      console.error(e);
      alert("Error occurred while saving customer: " + e.message);
    }
  };



  const [items, setItems] = useState<SIItem[]>(() => {
    if (initialData?.lines && initialData.lines.length > 0) {
      return initialData.lines.map((l: any, i: number) => {
        // Determine entry unit based on which field was non-zero
        let entryUnit: "cartons" | "gallons" | "liters" = "cartons";
        if (l.liters > 0) entryUnit = "liters";
        else if (l.gallons > 0) entryUnit = "gallons";
        
        return {
          id: i.toString(),
          itemId: l.itemId?._id || l.itemId,
          itemCode: l.itemId?.code || "",
          description: l.description || "",
          cartons: l.cartons || l.qty || 0,
          gallons: l.gallons || 0,
          liters: l.liters || 0,
          entryUnit,
          ratePerCtn: l.rate || 0,
          grossAmount: l.grossAmount || 0,
          discPercent: l.discountPercent || 0,
          discount: (l.grossAmount * (l.discountPercent || 0)) / 100,
          netAmount: l.netAmount || 0
        };
      });
    }
    return [{
      id: "1",
      itemId: "",
      itemCode: "",
      description: "",
      cartons: 0,
      gallons: 0,
      liters: 0,
      entryUnit: "cartons",
      ratePerCtn: 0,
      grossAmount: 0,
      discPercent: 0,
      discount: 0,
      netAmount: 0
    }];
  });

  const [selectedLineId, setSelectedLineId] = useState<string | null>("1");
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const isInitializedRef = useRef(false);

  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [itemHistory, setItemHistory] = useState<any[]>([]);

  const [banks, setBanks] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, partiesRes, locsRes, empsRes, banksRes] = await Promise.all([
        fetch("/api/items"),
        fetch("/api/parties"),
        fetch("/api/locations"),
        fetch("/api/employees"),
        fetch("/api/banks")
      ]);
      const [itemsData, partiesData, locsData, empsData, banksData] = await Promise.all([
        itemsRes.json(),
        partiesRes.json(),
        locsRes.json(),
        empsRes.json(),
        banksRes.json()
      ]);
      if (itemsData.ok) setAvailableItems(itemsData.data);
      if (partiesData.ok) {
        // Exclude deleted/inactive customers
        const activeCustomers = partiesData.data.filter((p: any) => 
          p.type === "Customer" && 
          p.status?.toLowerCase() === "active" && 
          !p.isDeleted && 
          !p.deleted
        );
        setCustomers(activeCustomers);
        setAllCustomers(activeCustomers);

        // Only set default customer on initial load of a new invoice
        if (!initialData?._id && !isInitializedRef.current) {
          const defaultCust = activeCustomers.find((c: any) => 
            c.name.toLowerCase().includes("walk-in")
          );
          if (defaultCust) {
            setFormData(prev => ({
              ...prev,
              customerId: defaultCust._id,
              customerName: defaultCust.name,
              customerCode: defaultCust.code,
              customerAddress: defaultCust.address || "",
              customerTelephone: defaultCust.phone || "",
              customerBalance: defaultCust.balance || 0,
              customerCreditLimit: defaultCust.creditLimit || 0
            }));
          }
        }
        isInitializedRef.current = true;
      }
      if (locsData.ok) setLocations(locsData.data);
      if (empsData.ok) setEmployees(empsData.data);
      if (banksData.ok) setBanks(banksData.data);
    } catch (e) { console.error(e); }
  }, [initialData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Track currently edited invoice ID
  const [currentInvoiceId, setCurrentInvoiceId] = useState(initialData?._id || "");

  // Debounced search for customers when user types
  useEffect(() => {
    if (!showCustomerSearch) return;
    
    const query = formData.customerName;
    if (!query) {
      setCustomers(allCustomers);
      return;
    }
    const delay = 200;
    
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/parties/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.ok) {
          setCustomers(json.data);
        }
      } catch (e) {
        console.error("Error searching customers:", e);
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [formData.customerName, showCustomerSearch, allCustomers]);

  useEffect(() => {
    if (allCustomers.length > 0 && formData.customerId) {
      const currentCust = allCustomers.find(c => c._id === formData.customerId);
      if (currentCust) {
        setFormData(prev => ({
          ...prev,
          customerBalance: currentCust.balance || 0,
          customerCreditLimit: currentCust.creditLimit || 0,
          customerCode: currentCust.code || prev.customerCode,
          customerAddress: currentCust.address || prev.customerAddress,
          customerTelephone: currentCust.phone || prev.customerTelephone,
          customerName: currentCust.name || prev.customerName,
          customerAdvanceStats: currentCust.advanceStats || null
        }));
      }
    }
  }, [allCustomers, formData.customerId]);

  const [showPrevInvoicesModal, setShowPrevInvoicesModal] = useState(false);
  const [prevInvoices, setPrevInvoices] = useState<any[]>([]);
  const [isLoadingPrevInvoices, setIsLoadingPrevInvoices] = useState(false);
  const [selectedPrevInvoice, setSelectedPrevInvoice] = useState<any | null>(null);
  
  const [prevInvoiceHistory, setPrevInvoiceHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [showReceivePaymentDialog, setShowReceivePaymentDialog] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"Cash" | "Bank">("Cash");
  const [payBankId, setPayBankId] = useState("");
  const [payRemarks, setPayRemarks] = useState("");
  const [payDate, setPayDate] = useState("");
  const [isPostingPayment, setIsPostingPayment] = useState(false);
  const [prevInvoiceSearchQuery, setPrevInvoiceSearchQuery] = useState("");

  const fetchPrevInvoices = useCallback(async () => {
    if (!formData.customerId) return;
    setIsLoadingPrevInvoices(true);
    try {
      const res = await fetch(`/api/invoices?partyId=${formData.customerId}`);
      const json = await res.json();
      if (json.ok) {
        setPrevInvoices(json.data.filter((i: any) => i.type === "sale" || i.type === "non_tax_sale"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPrevInvoices(false);
    }
  }, [formData.customerId]);

  useEffect(() => {
    if (showPrevInvoicesModal && formData.customerId) {
      fetchPrevInvoices();
    }
  }, [showPrevInvoicesModal, formData.customerId, fetchPrevInvoices]);

  const fetchPaymentHistory = useCallback(async (invoiceId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment`);
      const json = await res.json();
      if (json.ok) {
        setPrevInvoiceHistory(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPrevInvoice?._id) {
      fetchPaymentHistory(selectedPrevInvoice._id);
    } else {
      setPrevInvoiceHistory([]);
    }
  }, [selectedPrevInvoice, fetchPaymentHistory]);

  const handlePostPayment = async () => {
    if (!selectedPrevInvoice) return;
    const amountNum = Number(payAmount) || 0;
    if (amountNum <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }
    const outstanding = (selectedPrevInvoice.totalAmount || 0) - (selectedPrevInvoice.amountReceived || 0);
    if (amountNum > outstanding) {
      alert("Payment amount cannot exceed the outstanding balance.");
      return;
    }

    setIsPostingPayment(true);
    try {
      const res = await fetch(`/api/invoices/${selectedPrevInvoice._id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          paymentMethod: payMethod,
          bankId: payMethod === "Bank" ? payBankId : undefined,
          date: payDate || new Date().toISOString().split("T")[0],
          remarks: payRemarks
        })
      });
      const json = await res.json();
      if (json.ok) {
        alert("Payment received successfully!");
        setShowReceivePaymentDialog(false);
        setPayAmount("");
        setPayRemarks("");
        // Refresh invoices and history
        await fetchPrevInvoices();
        const updatedInvoice = await fetch(`/api/invoices/${selectedPrevInvoice._id}`).then(r => r.json());
        if (updatedInvoice.ok) {
          setSelectedPrevInvoice(updatedInvoice.data);
        }
        fetchData();
      } else {
        alert("Failed to save payment: " + (json.message || "Unknown error"));
      }
    } catch (e: any) {
      console.error(e);
      alert("Error saving payment: " + e.message);
    } finally {
      setIsPostingPayment(false);
    }
  };

  const handleEditInvoiceFromModal = (inv: any) => {
    if (inv.status?.toLowerCase() === "posted" || inv.status?.toLowerCase() === "paid") {
      const pin = prompt("This invoice is POSTED. Please enter Supervisor PIN to edit:");
      if (pin !== "1234") {
        alert("Invalid PIN. Unauthorized to edit posted invoices.");
        return;
      }
    }

    setCurrentInvoiceId(inv._id);
    setFormData({
      serialNo: inv.invoiceNo,
      date: inv.date ? new Date(inv.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      invoiceType: inv.invoiceType || "Sale Invoice",
      vehicleNo: inv.regNo || "",
      rangeKms: inv.rangeKms || 0,
      termsOfPayment: inv.paymentTerms || "Cash",
      incomeAccountId: inv.incomeAccountId || "40001001",
      isCancelled: inv.isCancelled || false,
      isWholesale: inv.isWholesale || false,
      isRetail: inv.isRetail || true,
      isOnCredit: inv.isCreditBill || false,
      startKms: inv.startKms || 0,
      endKms: inv.endKms || 0,
      oilGaugeLimit: inv.oilGaugeLimit || 0,
      status: inv.status || "posted",
      
      customerId: inv.partyId?._id || inv.partyId || "",
      customerCode: inv.partyId?.code || "",
      customerName: inv.partyId?.name || "",
      customerAddress: inv.partyId?.address || "",
      customerTelephone: inv.partyId?.phone || "",
      customerBalance: inv.partyId?.balance || 0.00,
      customerCreditLimit: inv.partyId?.creditLimit || 0.00,
      
      locationId: inv.locationId?._id || inv.locationId || "",
      jobNo: inv.jobId?.code || "",
      employeeRef: inv.employeeId?._id || inv.employeeId || "",
      remarks: inv.notes || "",
      
      additionalDiscount: inv.discountAmount || 0,
      carService: inv.carService || 0,
      carServiceDiscount: inv.carServiceDiscount || 0,
      amountReceived: inv.amountReceived || 0,
      useAdvance: inv.useAdvance || false,
      advanceAmountUsed: inv.advanceAmountUsed || 0,
      customerAdvanceStats: inv.partyId?.advanceStats || null
    });

    if (inv.lines && inv.lines.length > 0) {
      setItems(inv.lines.map((l: any, idx: number) => ({
        id: idx.toString(),
        itemId: l.itemId?._id || l.itemId,
        itemCode: l.itemId?.code || "",
        description: l.description || "",
        cartons: l.cartons || l.qty || 0,
        gallons: l.gallons || 0,
        liters: l.liters || 0,
        ratePerCtn: l.rate || 0,
        grossAmount: l.grossAmount || 0,
        discPercent: l.discountPercent || 0,
        discount: (l.grossAmount * (l.discountPercent || 0)) / 100,
        netAmount: l.netAmount || 0
      })));
    }

    setShowPrevInvoicesModal(false);
  };

  const displayBalance = useMemo(() => {
    const name = formData.customerName || "";
    if (name.toLowerCase().includes("walk-in")) {
      return "0.00";
    }
    const bal = formData.customerBalance;
    if (bal === 0) return "0.00";
    if (bal > 0) {
      return `${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
    } else {
      return `${Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
    }
  }, [formData.customerName, formData.customerBalance]);

  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const customerListRef = useRef<HTMLDivElement>(null);

  const displayedCustomers = useMemo(() => {
    if (!showCustomerSearch) return [];
    return customers;
  }, [showCustomerSearch, customers]);

  useEffect(() => {
    setActiveCustomerIndex(0);
  }, [displayedCustomers.length]);

  useEffect(() => {
    if (showCustomerSearch && customerListRef.current) {
      const container = customerListRef.current;
      const activeItem = container.children[activeCustomerIndex] as HTMLElement;
      if (activeItem) {
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        const elemTop = activeItem.offsetTop;
        const elemBottom = elemTop + activeItem.clientHeight;

        if (elemTop < containerTop) {
          container.scrollTo({ top: elemTop, behavior: "smooth" });
        } else if (elemBottom > containerBottom) {
          container.scrollTo({ top: elemBottom - container.clientHeight, behavior: "smooth" });
        }
      }
    }
  }, [activeCustomerIndex, showCustomerSearch]);

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCustomerSearch) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setShowCustomerSearch(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCustomerIndex(prev => 
        prev < displayedCustomers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCustomerIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setActiveCustomerIndex(prev => 
        Math.min(displayedCustomers.length - 1, prev + 10)
      );
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setActiveCustomerIndex(prev => Math.max(0, prev - 10));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveCustomerIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveCustomerIndex(displayedCustomers.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = displayedCustomers[activeCustomerIndex];
      if (selected) {
        setFormData(prev => ({
          ...prev,
          customerId: selected._id,
          customerName: selected.name,
          customerCode: selected.code,
          customerAddress: selected.address || "",
          customerTelephone: selected.phone || "",
          customerBalance: selected.balance || 0,
          customerCreditLimit: selected.creditLimit || 0
        }));
        setShowCustomerSearch(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowCustomerSearch(false);
    }
  };

  const handlePriceTypeChange = (isWholesale: boolean) => {
    setFormData({ ...formData, isWholesale, isRetail: !isWholesale });
    setItems(prev => prev.map(i => {
      const item = availableItems.find(ai => ai._id === i.itemId);
      if (item) {
        const baseRate = isWholesale ? (item.wholesaleRate || item.rate || 0) : (item.retailRate || item.rate || 0);
        const ratePerCtn = formData.isOnCredit ? baseRate * 1.10 : baseRate;
        
        // Gross Amount = Cartons × Rate Per Carton
        const cartons = Number(i.cartons) || 0;
        const grossAmount = cartons * ratePerCtn;
        const discount = (grossAmount * (i.discPercent || 0)) / 100;
        const netAmount = grossAmount - discount;
        
        return { ...i, ratePerCtn, grossAmount, discount, netAmount };
      }
      return i;
    }));
  };

  const addItem = () => {
    const newItem = { id: Date.now().toString(), itemId: "", itemCode: "", description: "", cartons: 0, gallons: 0, liters: 0, entryUnit: "cartons" as const, ratePerCtn: 0, grossAmount: 0, discPercent: 0, discount: 0, netAmount: 0 };
    setItems([...items, newItem]);
    setSelectedLineId(newItem.id);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
      if (selectedLineId === id) setSelectedLineId(items[0].id);
    }
  };

  const updateItem = (id: string, field: keyof SIItem, value: any) => {
    setItems(items.map(i => {
      if (i.id === id) {
        let updated = { ...i, [field]: value };
        if (field === "itemCode") {
          updated.itemId = "";
          updated.description = "";
        }
        const item = availableItems.find(ai => ai._id === (field === "itemId" ? value : i.itemId));

        // Use dynamic conversion from item master
        if (field === "cartons" || field === "gallons" || field === "liters") {
          const catalogItem = resolveCatalogItem(availableItems, updated);
          updated.entryUnit = field;
          
          // Apply unit conversion
          updated = applyUnitFieldUpdate(updated, field, value, catalogItem);
        }

        // Calculate gross amount: ALWAYS use Cartons × RatePerCtn
        if (field === "cartons" || field === "gallons" || field === "liters" || field === "ratePerCtn" || field === "discPercent" || field === "itemId") {
          const cartons = Number(updated.cartons) || 0;
          const ratePerCtn = Number(updated.ratePerCtn) || 0;
          const discPercent = Number(updated.discPercent) || 0;
          
          // Gross Amount = Cartons × Rate Per Carton
          const grossAmount = cartons * ratePerCtn;
          const discount = (grossAmount * discPercent) / 100;
          const netAmount = grossAmount - discount;
          
          // Round ONLY the final monetary values to 2 decimal places
          updated.grossAmount = Math.round(grossAmount * 100) / 100;
          updated.discount = Math.round(discount * 100) / 100;
          updated.netAmount = Math.round(netAmount * 100) / 100;
        }

        if (field === "itemId" && item) {
          updated.itemCode = item.code;
          updated.description = item.name;
          const baseRate = formData.isWholesale ? (item.wholesaleRate || item.rate || 0) : (item.retailRate || item.rate || 0);
          updated.ratePerCtn = formData.isOnCredit ? baseRate * 1.10 : baseRate;
          
          // Use dynamic conversion from item master for default units
          updated = defaultUnitsForItem(updated, item);
          updated.entryUnit = "cartons"; // Default entry unit when item is selected

          // Calculate gross amount based on cartons (default entry unit)
          const qty = Number(updated.cartons) || 0;
          updated.grossAmount = qty * (Number(updated.ratePerCtn) || 0);
          updated.discount = (updated.grossAmount * (Number(updated.discPercent) || 0)) / 100;
          updated.netAmount = updated.grossAmount - updated.discount;
          
          // Round to 2 decimal places to avoid floating point precision errors
          updated.grossAmount = Math.round(updated.grossAmount * 100) / 100;
          updated.discount = Math.round(updated.discount * 100) / 100;
          updated.netAmount = Math.round(updated.netAmount * 100) / 100;
        }
        return updated;
      }
      return i;
    }));
  };

  const grossTotal = useMemo(() => items.reduce((acc, curr) => acc + curr.grossAmount, 0), [items]);
  const subTotalAmount = useMemo(() => items.reduce((acc, curr) => acc + curr.netAmount, 0), [items]);
  const netTotal = useMemo(() => {
    const serviceAmt = Math.max(0, Number(formData.carService) || 0);
    const serviceDisc = Math.min(serviceAmt, Math.max(0, Number(formData.carServiceDiscount) || 0));
    const maxAddDisc = subTotalAmount + serviceAmt - serviceDisc;
    const addDisc = Math.min(maxAddDisc, Math.max(0, Number(formData.additionalDiscount) || 0));
    
    const calculated = subTotalAmount + serviceAmt - serviceDisc - addDisc;
    return Math.max(0, calculated);
  }, [subTotalAmount, formData.carService, formData.carServiceDiscount, formData.additionalDiscount]);
  const balanceAmount = netTotal - Number(formData.amountReceived) - (formData.useAdvance ? Number(formData.advanceAmountUsed) : 0);

  const handleSave = useCallback(async (status: string) => {
    if (formData.isOnCredit && (!formData.customerId || formData.customerName.toLowerCase().includes("walk-in"))) {
      alert("Customer selection is required for credit sales. Credit sales cannot be made to Walk-in Cash Customer.");
      return;
    }

    const outstanding = netTotal - Number(formData.amountReceived) - (formData.useAdvance ? Number(formData.advanceAmountUsed) : 0);
    if (outstanding < 0) {
      alert("Payment cannot exceed the invoice amount. Outstanding cannot become negative.");
      return;
    }

    const payload = {
      ...initialData,
      invoiceNo: formData.serialNo,
      type: "sale",
      date: formData.date || new Date().toISOString(),
      partyId: formData.customerId || null,
      regNo: formData.vehicleNo,
      rangeKms: formData.rangeKms,
      paymentTerms: formData.termsOfPayment,
      isCreditBill: formData.isOnCredit,
      startKms: formData.startKms,
      endKms: formData.endKms,
      oilGaugeLimit: formData.oilGaugeLimit,
      locationId: formData.locationId || null,
      employeeId: formData.employeeRef || null,
      notes: formData.remarks,
      lines: items.filter(l => l.itemId).map(l => ({
        itemId: l.itemId,
        description: l.description,
        cartons: l.cartons || 0,
        gallons: l.gallons || 0,
        liters: l.liters || 0,
        rate: l.ratePerCtn || 0,
        grossAmount: l.grossAmount || 0,
        discountPercent: l.discPercent || 0,
        netAmount: l.netAmount || 0
      })),
      subTotal: grossTotal || 0,
      discountAmount: Number(formData.additionalDiscount) || 0,
      carService: Number(formData.carService) || 0,
      carServiceDiscount: Number(formData.carServiceDiscount) || 0,
      totalAmount: netTotal || 0,
      amountReceived: Number(formData.amountReceived) || 0,
      status: status,
      useAdvance: formData.useAdvance,
      advanceAmountUsed: formData.useAdvance ? Number(formData.advanceAmountUsed) : 0
    };

    try {
      const res = await fetch(currentInvoiceId ? `/api/invoices/${currentInvoiceId}` : "/api/invoices", {
        method: currentInvoiceId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Sale Invoice saved successfully!");
        if (confirm("Do you want to print the receipt?")) {
          setPrintData({
            invoiceNo: payload.invoiceNo,
            date: payload.date,
            customer: formData.customerName || "Walk-in Customer",
            linkedRef: payload.reference,
            total: payload.totalAmount,
            subtotal: payload.subTotal,
            taxAmount: 0,
            discountAmount: payload.discountAmount,
            carService: payload.carService,
            carServiceDiscount: payload.carServiceDiscount,
            regNo: payload.regNo,
            startKms: payload.startKms,
            endKms: payload.endKms,
            rangeKms: payload.rangeKms,
            lines: items.filter(l => l.itemId).map(l => ({
              description: l.description,
              cartons: l.cartons || 0,
              gallons: l.gallons || 0,
              liters: l.liters || 0,
              rate: l.ratePerCtn || 0,
              netAmount: l.netAmount || 0
            }))
          });
        } else {
          onClose();
        }
      } else {
        const text = await res.text();
        try {
          const error = JSON.parse(text);
          alert("Failed to save invoice: " + (error.message || "Unknown error"));
        } catch {
          alert("Failed to save invoice. Server returned error: " + text.substring(0, 150));
        }
      }
    } catch (e: any) { 
      console.error(e); 
      alert("Error occurred while saving: " + e.message);
    }
  }, [formData, items, grossTotal, netTotal, initialData, currentInvoiceId, onClose]);

  const selectedItemDetails = useMemo(() => {
    if (previewItemId) return availableItems.find(i => i._id === previewItemId) || null;
    const line = items.find(l => l.id === selectedLineId);
    if (!line || !line.itemId) return null;
    return availableItems.find(i => i._id === line.itemId);
  }, [previewItemId, selectedLineId, items, availableItems]);

  useEffect(() => {
    async function fetchHistory() {
      if (!selectedItemDetails?._id) {
        setItemHistory([]);
        return;
      }
      try {
        const res = await fetch(`/api/invoices?type=sale`);
        const data = await res.json();
        if (data.ok) {
          const records: any[] = [];
          data.data.forEach((inv: any) => {
            const line = inv.lines?.find((l: any) => (l.itemId?._id || l.itemId) === selectedItemDetails._id);
            if (line) {
              const qtyParts = [];
              if (line.cartons) qtyParts.push(`${line.cartons}C`);
              if (line.gallons) qtyParts.push(`${line.gallons}G`);
              if (line.liters) qtyParts.push(`${line.liters}L`);
              records.push({
                invoiceNo: inv.invoiceNo,
                date: new Date(inv.date).toLocaleDateString(),
                customer: inv.partyId?.name || "Walk-in",
                quantity: qtyParts.join(", ") || "0",
                rate: line.rate || 0,
                amount: line.netAmount || 0
              });
            }
          });
          setItemHistory(records.slice(0, 5));
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      }
    }
    fetchHistory();
  }, [selectedItemDetails?._id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave("posted");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);



  return (
    <div className="flex flex-col h-screen bg-[#f3f4f6] text-[#333] font-sans overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-[#e5e7eb] border-b border-[#cbd5e1] p-1 flex items-center gap-1 shadow-sm overflow-x-auto no-scrollbar">
        <ToolbarButton icon={<Plus size={16} />} label="New Customer" onClick={() => setShowCustomerModal(true)} />
        <ToolbarButton icon={<Package size={16} />} label="New Item" />
        <div className="w-[1px] h-6 bg-[#cbd5e1] mx-1" />
        <ToolbarButton icon={<PlusCircle size={16} />} label="Add" onClick={addItem} />
        <ToolbarButton icon={<Save size={16} className="text-blue-600" />} label="Save (Ctrl+S)" onClick={() => handleSave("posted")} />
        <ToolbarButton icon={<X size={16} className="text-red-600" />} label="Cancel" onClick={onClose} />
        <ToolbarButton icon={<Trash2 size={16} />} label="Delete" />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel */}
          <div className="col-span-12 lg:col-span-7 bg-white p-4 rounded border border-[#cbd5e1] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h2 className="text-xl font-bold text-slate-700 uppercase">SALE INVOICES</h2>
              <div className="px-4 py-1 rounded-full border-2 text-xs font-black uppercase tracking-widest border-red-500 text-red-500">
                {formData.status.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold w-24">Serial No</label>
                  <div className="flex items-center flex-1 border border-[#cbd5e1] rounded overflow-hidden">
                    <button className="px-2 bg-slate-100 hover:bg-slate-200 border-r"><ChevronLeft size={14}/></button>
                    <input type="text" value={formData.serialNo} className="flex-1 text-center font-bold text-blue-600 outline-none" readOnly />
                    <button className="px-2 bg-slate-100 hover:bg-slate-200 border-l"><ChevronRight size={14}/></button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold w-24">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold w-24">Invoice Type</label>
                  <select value={formData.invoiceType} onChange={e => setFormData({...formData, invoiceType: e.target.value})} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs outline-none">
                    <option>Sale Invoice</option>
                    <option>Credit Note</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold w-24">Vehicle No</label>
                  <input type="text" value={formData.vehicleNo} onChange={e => setFormData({...formData, vehicleNo: e.target.value})} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold w-24">Range KMs</label>
                  <input type="number" value={formData.rangeKms} onChange={e => { const range = Math.max(0, Number(e.target.value) || 0); setFormData({...formData, rangeKms: range, endKms: formData.startKms + range}); }} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold w-24">Payment Terms</label>
                  <input 
                    type="text" 
                    value={formData.termsOfPayment} 
                    onChange={e => {
                      const val = e.target.value;
                      const nextOnCredit = val.toLowerCase().includes("credit");
                      setFormData({
                        ...formData, 
                        termsOfPayment: val,
                        isOnCredit: nextOnCredit
                      });
                      if (nextOnCredit !== formData.isOnCredit) {
                        setItems(prev => prev.map(i => {
                          const item = availableItems.find(ai => ai._id === i.itemId);
                          if (item) {
                            const baseRate = formData.isWholesale ? (item.wholesaleRate || item.rate || 0) : (item.retailRate || item.rate || 0);
                            const ratePerCtn = nextOnCredit ? baseRate * 1.10 : baseRate;
                            const qty = Number(i.cartons) || 0;
                            const grossAmount = qty * ratePerCtn;
                            const discount = (grossAmount * (i.discPercent || 0)) / 100;
                            const netAmount = grossAmount - discount;
                            return { ...i, ratePerCtn, grossAmount, discount, netAmount };
                          }
                          return i;
                        }));
                      }
                    }} 
                    className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-4 border-b pb-2">
                  <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={formData.isCancelled} onChange={e => setFormData({...formData, isCancelled: e.target.checked})} /> Cancel</label>
                  <label className="flex items-center gap-2 text-xs font-bold"><input type="radio" checked={formData.isWholesale} onChange={() => handlePriceTypeChange(true)} /> Whole Sale</label>
                  <label className="flex items-center gap-2 text-xs font-bold"><input type="radio" checked={formData.isRetail} onChange={() => handlePriceTypeChange(false)} /> Retail</label>
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input 
                      type="checkbox" 
                      checked={formData.isOnCredit} 
                      onChange={e => {
                        const nextOnCredit = e.target.checked;
                        setFormData({
                          ...formData, 
                          isOnCredit: nextOnCredit,
                          termsOfPayment: nextOnCredit ? "Credit on Bill" : "Cash"
                        });
                        setItems(prev => prev.map(i => {
                          const item = availableItems.find(ai => ai._id === i.itemId);
                          if (item) {
                            const baseRate = formData.isWholesale ? (item.wholesaleRate || item.rate || 0) : (item.retailRate || item.rate || 0);
                            const ratePerCtn = nextOnCredit ? baseRate * 1.10 : baseRate;
                            const qty = Number(i.cartons) || 0;
                            const grossAmount = qty * ratePerCtn;
                            const discount = (grossAmount * (i.discPercent || 0)) / 100;
                            const netAmount = grossAmount - discount;
                            return { ...i, ratePerCtn, grossAmount, discount, netAmount };
                          }
                          return i;
                        }));
                      }} 
                    /> 
                    On Credit Bill
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><label className="text-[10px] font-black w-20">Start KMs</label><input type="number" value={formData.startKms} onChange={e => { const start = Math.max(0, Number(e.target.value) || 0); setFormData({...formData, startKms: start, endKms: start + formData.rangeKms}); }} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs" /></div>
                    <div className="flex items-center gap-2"><label className="text-[10px] font-black w-20">End KMs</label><input type="number" value={formData.endKms} onChange={e => { const end = Math.max(0, Number(e.target.value) || 0); setFormData({...formData, endKms: end, rangeKms: Math.max(0, end - formData.startKms)}); }} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs" /></div>
                    <div className="flex items-center gap-2"><label className="text-[10px] font-black w-20">Limit</label><input type="number" value={formData.oilGaugeLimit} onChange={e => setFormData({...formData, oilGaugeLimit: Number(e.target.value)})} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs" /></div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="text-[10px] font-black text-slate-400 mb-1">Income Account</div>
                    <div className="flex border border-[#cbd5e1] rounded overflow-hidden">
                      <input type="text" value={formData.incomeAccountId} className="w-20 bg-slate-50 px-2 py-1 text-[10px] font-bold border-r" readOnly />
                      <select className="flex-1 bg-white px-2 py-1 text-[10px] font-bold outline-none"><option>Sales</option></select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="col-span-12 lg:col-span-5 bg-[#fefce8] p-4 rounded border border-[#eab308] shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 text-yellow-600 opacity-20"><User size={64}/></div>
             <h3 className="text-xs font-black text-yellow-800 uppercase tracking-widest mb-4 border-b border-yellow-200 pb-2">Customer Panel</h3>
             <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold w-16">Code</label>
                  <div className="flex-1 flex gap-1">
                    <input type="text" value={formData.customerCode} className="w-32 border border-[#eab308] rounded px-2 py-1 text-xs" readOnly />
                    <div className="flex-1 relative">
                       <input 
                         type="text" 
                         placeholder="Search Customer..." 
                         value={formData.customerName} 
                         onFocus={(e) => { e.target.select(); setShowCustomerSearch(true); }}
                         onChange={e => { 
                           setFormData({
                             ...formData, 
                             customerName: e.target.value,
                             customerId: "",
                             customerCode: "",
                             customerAddress: "",
                             customerTelephone: ""
                           }); 
                           setShowCustomerSearch(true); 
                         }} 
                         onKeyDown={handleCustomerKeyDown}
                         className="w-full border border-[#eab308] rounded px-2 py-1 text-xs outline-none font-bold" 
                       />
                       {showCustomerSearch && (
                         <>
                           <div className="fixed inset-0 z-40" onClick={() => setShowCustomerSearch(false)} />
                           <div ref={customerListRef} className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded shadow-xl z-50 max-h-48 overflow-auto mt-1">
                               {displayedCustomers.map((c, idx) => (
                                 <div 
                                   key={c._id} 
                                   className={`px-3 py-2 text-xs cursor-pointer font-bold border-b relative z-50 transition-colors ${
                                     idx === activeCustomerIndex ? 'bg-yellow-100 text-yellow-900' : 'hover:bg-yellow-50 text-slate-800'
                                   }`} 
                                   onClick={() => {
                                     setFormData({
                                       ...formData, 
                                       customerId: c._id, 
                                       customerName: c.name, 
                                       customerCode: c.code, 
                                       customerAddress: c.address || "", 
                                       customerTelephone: c.phone || "", 
                                       customerBalance: c.balance || 0,
                                       customerCreditLimit: c.creditLimit || 0
                                     });
                                     setShowCustomerSearch(false);
                                   }}
                                 >
                                   {c.code} - {c.name}
                                 </div>
                               ))}
                           </div>
                         </>
                       )}
                    </div>
                  </div>
                </div>
                 <div className="flex gap-3"><label className="text-xs font-bold w-16">Address</label><textarea value={formData.customerAddress} readOnly className="flex-1 border border-[#eab308] rounded px-2 py-1 text-xs h-12 resize-none bg-yellow-50/50 outline-none" /></div>
                 <div className="flex items-center gap-3"><label className="text-xs font-bold w-16">Telephone</label><input type="text" value={formData.customerTelephone} readOnly className="flex-1 border border-[#eab308] rounded px-2 py-1 text-xs bg-yellow-50/50 outline-none" /></div>
                 <div className="grid grid-cols-2 gap-2 mb-1">
                   <div className="flex items-center gap-2 bg-[#fef8c3] px-2 py-1 rounded border border-[#eab308]/40">
                     <label className="text-[9px] font-black text-yellow-900 uppercase">Limit</label>
                     <span className="flex-1 text-right text-xs font-bold text-slate-700">PKR {Math.round(formData.customerCreditLimit).toLocaleString()}</span>
                   </div>
                   <div className="flex items-center gap-2 bg-[#fef8c3] px-2 py-1 rounded border border-[#eab308]/40">
                     <label className="text-[9px] font-black text-yellow-900 uppercase">Outstanding</label>
                     <span className="flex-1 text-right text-xs font-bold text-rose-700">PKR {displayBalance.endsWith("Dr") ? displayBalance.replace(" Dr", "") : "0.00"}</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-3 bg-yellow-100 p-2 rounded">
                   <label className="text-xs font-black text-yellow-900 w-16 uppercase">Balance</label>
                   <div className="flex-1 text-right text-lg font-black text-rose-600 font-mono">
                     {displayBalance}
                   </div>
                 </div>
                 {/* Previous Invoices Button */}
                 <div className="flex justify-end pt-2">
                   <button
                     type="button"
                     onClick={() => setShowPrevInvoicesModal(true)}
                     className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] font-black uppercase tracking-wider rounded transition-all shadow-sm"
                   >
                     Previous Invoices
                   </button>
                 </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-9 bg-white border border-[#cbd5e1] rounded shadow-sm flex flex-col min-h-[300px] overflow-hidden">
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 bg-[#f8fafc] z-20 border-b border-[#cbd5e1]">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-32">Item Code</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r min-w-[200px]">Description</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-24 text-right">Purchase Price</th>
                      <th className="px-2 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-20 text-center">Ctns</th>
                      <th className="px-2 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-20 text-center">Gals</th>
                      <th className="px-2 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-20 text-center">Ltrs</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-24 text-right">Rate Ctn</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-28 text-right">Gross Amt</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-16 text-center">Disc%</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase border-r w-24 text-right">Discount</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase w-28 text-right">Net Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((line) => {
                      return (
                      <tr key={line.id} className={`group ${selectedLineId === line.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onClick={() => setSelectedLineId(line.id)}>
                        <td className="p-0 border-r relative">
                          <ItemSearchInput
                            value={line.itemCode || ""}
                            availableItems={availableItems}
                            onSelect={(selected) => {
                              updateItem(line.id, "itemId", selected._id);
                            }}
                            onChange={(val) => updateItem(line.id, "itemCode", val)}
                            onActiveItemChange={(activeItem) => {
                              setPreviewItemId(activeItem ? activeItem._id : null);
                            }}
                            placeholder="Search..."
                            className="px-3"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs font-medium border-r">{line.description}</td>
                        <td className="px-3 py-2 text-xs font-black text-right border-r font-mono bg-slate-50">
                          {(availableItems.find(ai => ai._id === line.itemId)?.purchaseRate || 0).toFixed(2)}
                        </td>
                        <td className="p-0 border-r"><input type="number" step="any" value={line.cartons} onChange={e => updateItem(line.id, "cartons", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full px-2 py-2 text-xs font-black text-center outline-none bg-transparent" /></td>
                        <td className="p-0 border-r"><input type="number" step="any" value={line.gallons} onChange={e => updateItem(line.id, "gallons", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full px-2 py-2 text-xs font-black text-center outline-none bg-transparent" /></td>
                        <td className="p-0 border-r"><input type="number" step="any" value={line.liters} onChange={e => updateItem(line.id, "liters", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full px-2 py-2 text-xs font-black text-center outline-none bg-transparent" /></td>
                        <td className="p-0 border-r"><input type="number" step="any" value={line.ratePerCtn} onChange={e => updateItem(line.id, "ratePerCtn", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 text-xs font-black text-right outline-none bg-transparent" /></td>
                        <td className="px-3 py-2 text-xs font-black text-right border-r font-mono">{line.grossAmount.toFixed(2)}</td>
                        <td className="p-0 border-r"><input type="number" value={line.discPercent} onChange={e => updateItem(line.id, "discPercent", parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 text-xs font-black text-center outline-none bg-transparent" /></td>
                        <td className="px-3 py-2 text-xs font-black text-right border-r font-mono text-rose-600">{line.discount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs font-black text-right font-mono text-blue-800">{line.netAmount.toFixed(2)}</td>
                        <td className="p-1"><button onClick={() => removeItem(line.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button></td>
                      </tr>
                      );
                    })}
                    <tr className="bg-slate-50"><td colSpan={11} className="p-2"><button onClick={addItem} className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase"><PlusCircle size={14}/> Add New Row</button></td></tr>
                  </tbody>
                </table>
             </div>
          </div>

          <div className="col-span-12 lg:col-span-3 bg-[#f8fafc] border border-[#cbd5e1] rounded shadow-sm flex flex-col p-3 text-xs">
             {selectedItemDetails ? (
               <div className="space-y-2">
                 <div className="flex justify-between items-start">
                   <div className="flex gap-2">
                     <span className="text-slate-500">Selling Price PKR:</span>
                     <span className="font-bold text-black">
                       {formData.isWholesale ? 
                         (selectedItemDetails.wholesaleRate || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 
                         (selectedItemDetails.retailRate || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </span>
                   </div>
                    <div className="flex gap-2 text-rose-600 font-bold flex-col items-end">
                      <div className="flex gap-2">
                        <span>Cartons:</span>
                        <span>{Number(selectedItemDetails.stockQtyCartons || 0).toFixed(2)}</span>
                      </div>
                      {selectedItemDetails.gallonsInCtn || selectedItemDetails.litersInCtn ? (
                        <div className="text-[10px] text-slate-500 font-normal">
                          ({(Number(selectedItemDetails.stockQtyCartons || 0) * (selectedItemDetails.gallonsInCtn || 0)).toFixed(1)} G / 
                           {(Number(selectedItemDetails.stockQtyCartons || 0) * (selectedItemDetails.litersInCtn || 0)).toFixed(1)} L)
                        </div>
                      ) : null}
                    </div>
                 </div>
                 
                 <div className="flex gap-2">
                   <span className="text-slate-500 w-16">Category:</span>
                   <span className="font-bold truncate" title={selectedItemDetails.category || "N/A"}>{selectedItemDetails.category || "N/A"}</span>
                 </div>
                 
                 <div className="flex gap-2">
                   <span className="text-slate-500 w-16">Description:</span>
                   <span className="font-bold truncate" title={selectedItemDetails.name}>{selectedItemDetails.name}</span>
                 </div>

                 <div className="flex gap-2">
                   <span className="text-slate-500 w-16">History:</span>
                   <span className="font-bold truncate">{formData.customerName || "Walk-in (Cash) Customer"}</span>
                 </div>

                 <div className="mt-2 border border-[#cbd5e1] rounded bg-white overflow-hidden">
                   <table className="w-full text-left text-[9px]">
                     <thead className="bg-slate-100 border-b border-[#cbd5e1]">
                       <tr>
                         <th className="p-1 font-normal text-slate-600 border-r border-[#cbd5e1]">Inv. No.</th>
                         <th className="p-1 font-normal text-slate-600 border-r border-[#cbd5e1]">Date</th>
                         <th className="p-1 font-normal text-slate-600 border-r border-[#cbd5e1]">Customer</th>
                         <th className="p-1 font-normal text-slate-600 border-r border-[#cbd5e1]">Quantity</th>
                         <th className="p-1 font-normal text-slate-600 border-r border-[#cbd5e1]">Rate</th>
                         <th className="p-1 font-normal text-slate-600">Amount</th>
                       </tr>
                     </thead>
                     <tbody>
                        {itemHistory.length > 0 ? (
                          itemHistory.map((h, i) => (
                            <tr key={i} className="border-b border-[#cbd5e1] last:border-0">
                              <td className="p-1 border-r border-[#cbd5e1] truncate max-w-[40px]" title={h.invoiceNo}>{h.invoiceNo}</td>
                              <td className="p-1 border-r border-[#cbd5e1] truncate max-w-[40px]">{h.date}</td>
                              <td className="p-1 border-r border-[#cbd5e1] truncate max-w-[50px]" title={h.customer}>{h.customer}</td>
                              <td className="p-1 border-r border-[#cbd5e1] truncate max-w-[40px]">{h.quantity}</td>
                              <td className="p-1 border-r border-[#cbd5e1]">{h.rate}</td>
                              <td className="p-1">{h.amount}</td>
                            </tr>
                          ))
                        ) : (
                          <>
                            <tr>
                              <td className="p-1 border-r border-[#cbd5e1] border-b h-5"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-b border-[#cbd5e1]"></td>
                            </tr>
                            <tr>
                              <td className="p-1 border-r border-[#cbd5e1] border-b h-5"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-r border-[#cbd5e1] border-b"></td>
                              <td className="p-1 border-b border-[#cbd5e1]"></td>
                            </tr>
                          </>
                        )}
                     </tbody>
                   </table>
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex items-center justify-center text-slate-400 italic">No item selected</div>
             )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 pb-8">
           <div className="col-span-12 lg:col-span-7 bg-white p-4 rounded border border-[#cbd5e1] shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <div className="flex items-center gap-2"><label className="text-xs font-bold w-24">Location</label><select value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs">{locations.map(l => (<option key={l._id} value={l._id}>{l.name}</option>))}</select></div>
                   <div className="flex items-center gap-2"><label className="text-xs font-bold w-24">Job No</label><input type="text" value={formData.jobNo} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs" /></div>
                </div>
                <div className="space-y-2">
                   <div className="flex gap-2 col-span-2"><label className="text-xs font-bold w-24 pt-1">Remarks</label><textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-xs h-16 resize-none" /></div>
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="text-[10px] font-black text-slate-400 uppercase mb-1">Amount in Words</div><div className="text-xs font-black text-slate-700 italic">Rupees {netTotal.toLocaleString()} only.</div></div>
           </div>

           <div className="col-span-12 lg:col-span-5 bg-slate-800 text-white p-6 rounded border border-slate-900 shadow-xl space-y-4">
              <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-xs font-bold text-slate-400 uppercase">Gross Total</span><span className="text-lg font-black font-mono">{grossTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Additional Discount</span><input type="number" value={formData.additionalDiscount} onChange={e => setFormData({...formData, additionalDiscount: Math.max(0, Number(e.target.value) || 0)})} className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right font-black font-mono text-rose-400 outline-none no-spinner" /></div>
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Car Service</span><input type="number" value={formData.carService} onChange={e => setFormData({...formData, carService: Math.max(0, Number(e.target.value) || 0)})} className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right font-black font-mono text-blue-300 outline-none no-spinner" /></div>
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Car Wash Discount</span><input type="number" value={formData.carServiceDiscount} onChange={e => setFormData({...formData, carServiceDiscount: Math.max(0, Number(e.target.value) || 0)})} className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right font-black font-mono text-rose-300 outline-none no-spinner" /></div>
                  <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg border border-slate-600 mt-4"><span className="text-sm font-black text-white uppercase tracking-wider">Net Total</span><span className="text-3xl font-black font-mono text-yellow-400">{netTotal.toFixed(2)}</span></div>
                  
                  {formData.customerAdvanceStats && formData.customerAdvanceStats.remainingAdvance > 0 && (
                    <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Advance Balance:</span>
                        <span className="text-sm font-black text-emerald-400 font-mono">
                          PKR {Math.round(formData.customerAdvanceStats.remainingAdvance).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-white">
                          <input
                            type="checkbox"
                            checked={formData.useAdvance}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const toUse = checked ? Math.min(netTotal, formData.customerAdvanceStats.remainingAdvance) : 0;
                              setFormData({
                                ...formData,
                                useAdvance: checked,
                                advanceAmountUsed: toUse
                              });
                            }}
                            className="rounded accent-emerald-500"
                          />
                          Use Advance
                        </label>
                        {formData.useAdvance && (
                          <input
                            type="number"
                            value={formData.advanceAmountUsed}
                            max={Math.min(netTotal, formData.customerAdvanceStats.remainingAdvance)}
                            onChange={(e) => {
                              const val = Math.min(
                                Math.min(netTotal, formData.customerAdvanceStats.remainingAdvance),
                                Math.max(0, Number(e.target.value) || 0)
                              );
                              setFormData({
                                ...formData,
                                advanceAmountUsed: val
                              });
                            }}
                            className="w-28 bg-slate-700 text-emerald-400 border border-slate-600 rounded px-2 py-1 text-right font-black font-mono outline-none"
                          />
                        )}
                      </div>
                    </div>
                  )}
                  
                 <div className="flex justify-between items-center pt-4"><span className="text-xs font-bold text-slate-400 uppercase">Amount Received</span><input type="number" value={formData.amountReceived} onChange={e => setFormData({...formData, amountReceived: Number(e.target.value)})} className="w-40 bg-white text-slate-900 border-none rounded px-3 py-2 text-right text-lg font-black font-mono outline-none" /></div>
                 <div className="flex justify-between items-center pt-2"><span className="text-xs font-bold text-slate-400 uppercase">Balance</span><span className={`text-xl font-black font-mono ${balanceAmount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{balanceAmount.toFixed(2)}</span></div>
              </div>
           </div>
        </div>
      </div>
      {printData && (
        <PrintTemplate 
          formatName="Sale Invoice" 
          data={printData}
          items={printData.lines}
          autoPrint={true}
          onPrintComplete={() => {
            setPrintData(null);
            onClose();
          }}
        />
      )}
      {showCustomerModal && (
        <CustomerModal 
          isOpen={showCustomerModal} 
          onClose={() => setShowCustomerModal(false)} 
          onSave={handleSaveCustomer}
        />
      )}

      {showPrevInvoicesModal && (
        <ERPModal
          isOpen={showPrevInvoicesModal}
          onClose={() => {
            setShowPrevInvoicesModal(false);
            setSelectedPrevInvoice(null);
          }}
          title={`Previous Invoices - ${formData.customerName}`}
          size="2xl"
        >
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search by Invoice No..."
                value={prevInvoiceSearchQuery}
                onChange={(e) => setPrevInvoiceSearchQuery(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1 font-bold"
              />
            </div>

            {/* Invoices Table */}
            <div className="border rounded-lg overflow-hidden bg-white max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b font-black text-slate-500 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Invoice No</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Net Amount</th>
                    <th className="px-4 py-2 text-right">Received</th>
                    <th className="px-4 py-2 text-right">Remaining</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-bold text-slate-700">
                  {isLoadingPrevInvoices ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">Loading invoices...</td>
                    </tr>
                  ) : prevInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No previous invoices found</td>
                    </tr>
                  ) : (
                    prevInvoices
                      .filter((inv) =>
                        inv.invoiceNo.toLowerCase().includes(prevInvoiceSearchQuery.toLowerCase())
                      )
                      .map((inv) => {
                        const remaining = (inv.totalAmount || 0) - (inv.amountReceived || 0);
                        let paymentStatus = "Unpaid";
                        if (remaining <= 0) paymentStatus = "Paid";
                        else if (inv.amountReceived > 0) paymentStatus = "Partially Paid";

                        const isSelected = selectedPrevInvoice?._id === inv._id;

                        return (
                          <tr
                            key={inv._id}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                              isSelected ? "bg-blue-50/50" : ""
                            }`}
                            onClick={() => setSelectedPrevInvoice(inv)}
                          >
                            <td className="px-4 py-2 text-blue-600 font-black">{inv.invoiceNo}</td>
                            <td className="px-4 py-2">{new Date(inv.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right">{(inv.totalAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">{(inv.amountReceived || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-rose-600">{Math.max(0, remaining).toFixed(2)}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black ${
                                paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" :
                                paymentStatus === "Partially Paid" ? "bg-yellow-100 text-yellow-700" :
                                "bg-rose-100 text-rose-700"
                              }`}>
                                {paymentStatus}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleEditInvoiceFromModal(inv)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] uppercase tracking-wider rounded font-black border"
                              >
                                Edit
                              </button>
                              {remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPrevInvoice(inv);
                                    setPayAmount(remaining.toFixed(2));
                                    setPayDate(new Date().toISOString().split("T")[0]);
                                    setShowReceivePaymentDialog(true);
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] uppercase tracking-wider rounded font-black shadow-sm"
                                >
                                  Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected Invoice Details and History */}
            {selectedPrevInvoice && (
              <div className="bg-slate-50 p-4 rounded-xl border space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-between border-b pb-2">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Invoice Items: {selectedPrevInvoice.invoiceNo}
                  </h4>
                  <span className="text-xs font-bold text-slate-700">
                    Outstanding: Rs. {((selectedPrevInvoice.totalAmount || 0) - (selectedPrevInvoice.amountReceived || 0)).toFixed(2)}
                  </span>
                </div>

                {/* Items Mini-list */}
                <div className="text-[10px] space-y-1">
                  {selectedPrevInvoice.lines?.map((line: any, idx: number) => (
                    <div key={idx} className="flex justify-between font-bold text-slate-600">
                      <span>{line.itemId?.name || line.description} (x{line.cartons} ctn)</span>
                      <span>Rs. {(line.netAmount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Payment History Section */}
                <div className="pt-2">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 mb-2">
                    Payment History
                  </h4>
                  {isLoadingHistory ? (
                    <p className="text-[10px] text-slate-400 italic">Loading payment history...</p>
                  ) : prevInvoiceHistory.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No payments recorded for this invoice yet.</p>
                  ) : (
                    <div className="border rounded overflow-hidden bg-white max-h-[150px] overflow-y-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-100 border-b font-black text-slate-500 uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="px-3 py-1.5">Date</th>
                            <th className="px-3 py-1.5">Voucher No</th>
                            <th className="px-3 py-1.5 text-right">Amount Received</th>
                            <th className="px-3 py-1.5">Method</th>
                            <th className="px-3 py-1.5">User</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-bold text-slate-600">
                          {prevInvoiceHistory.map((hist, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5">{new Date(hist.date).toLocaleDateString()}</td>
                              <td className="px-3 py-1.5 font-mono text-slate-900">{hist.voucherNo}</td>
                              <td className="px-3 py-1.5 text-right font-black">{(hist.amountReceived || 0).toFixed(2)}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-black ${
                                  hist.paymentMethod === "Cash" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                                }`}>
                                  {hist.paymentMethod}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-slate-500">{hist.user}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ERPModal>
      )}

      {/* Receive Remaining Payment Dialog */}
      {showReceivePaymentDialog && selectedPrevInvoice && (
        <ERPModal
          isOpen={showReceivePaymentDialog}
          onClose={() => setShowReceivePaymentDialog(false)}
          title={`Receive Outstanding Payment - ${selectedPrevInvoice.invoiceNo}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border flex justify-between items-center font-bold">
              <span className="text-slate-500">Outstanding Balance:</span>
              <span className="text-rose-600 font-black text-sm">
                Rs. {((selectedPrevInvoice.totalAmount || 0) - (selectedPrevInvoice.amountReceived || 0)).toFixed(2)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount to Pay *</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black focus:bg-white outline-none focus:border-emerald-600 transition-all text-right font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method *</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as "Cash" | "Bank")}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:bg-white outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>

            {payMethod === "Bank" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Bank Account *</label>
                <select
                  value={payBankId}
                  onChange={(e) => setPayBankId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:bg-white outline-none"
                >
                  <option value="">-- Select Bank Account --</option>
                  {banks.map((b: any) => (
                    <option key={b._id} value={b._id}>{b.name} ({b.accountNumber})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Date *</label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:bg-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</label>
              <textarea
                rows={2}
                value={payRemarks}
                onChange={(e) => setPayRemarks(e.target.value)}
                placeholder="Payment description..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:bg-white outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReceivePaymentDialog(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePostPayment}
                disabled={isPostingPayment}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-600/10 disabled:opacity-50"
              >
                {isPostingPayment ? "Posting..." : "Post Payment"}
              </button>
            </div>
          </div>
        </ERPModal>
      )}
    </div>
  );
}
