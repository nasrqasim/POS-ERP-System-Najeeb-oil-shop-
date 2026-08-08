"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Phone, MessageCircle, FileText, CheckCircle, AlertTriangle, RefreshCw, Download, Printer } from "lucide-react";
import html2canvas from "html2canvas";

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: any;
  type?: "Statement" | "Invoice" | "Receipt" | "Reminder";
  referenceId?: string;
  documentData?: any; // e.g. ledger rows, invoice details
  shopProfile?: any;
}

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  party,
  type = "Statement",
  referenceId,
  documentData,
  shopProfile
}: WhatsAppShareModalProps) {
  const [phone, setPhone] = useState(party?.phone || party?.mobile || "");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  // Auto-generate default message and handle image generation on open
  useEffect(() => {
    if (isOpen) {
      setPhone(party?.phone || party?.mobile || "");
      setStatus("idle");
      setErrorMessage("");
      setPreviewImg(null);
      setIsGenerating(true);
      setCopySuccess(false);
      
      const customerName = party?.name || party?.companyName || party?.vendor || "Customer";
      const shopName = shopProfile?.companyName || "AL HADEED TRADERS";
      
      let docNo = "-";
      let amountVal = 0;

      if (type === "Invoice" && documentData) {
        docNo = documentData.invoiceNo || documentData.dcNo || documentData.voucherNo || "-";
        amountVal = documentData.grandTotal || documentData.totalAmount || documentData.total || documentData.amount || 0;
      } else if (type === "Receipt" && documentData) {
        docNo = documentData.receiptNumber || documentData.voucherNo || "-";
        amountVal = documentData.amount || 0;
      } else if (type === "Statement" && documentData) {
        docNo = "Statement";
        amountVal = documentData.closing !== undefined ? documentData.closing : (party?.balance || 0);
      } else if (type === "Reminder" && documentData) {
        docNo = "Outstanding Dues";
        amountVal = documentData.closing !== undefined ? documentData.closing : (party?.balance || 0);
      } else {
        amountVal = party?.balance || 0;
      }

      // Format template as requested by the user
      const template = `Assalam O Alaikum,

Please find attached invoice from
${shopName}.

Invoice No: ${docNo}

Amount:
PKR ${Math.round(amountVal).toLocaleString()}

Thank you.`;

      setMessage(template);

      // Trigger html2canvas generation after a brief delay to allow the offscreen elements to fully render
      const timer = setTimeout(() => {
        generatePreviewImage();
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [isOpen, party, type, documentData, shopProfile]);

  const generatePreviewImage = async () => {
    if (!printRef.current) {
      setIsGenerating(false);
      return;
    }
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // High resolution (HD)
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      const pngUrl = canvas.toDataURL("image/png");
      setPreviewImg(pngUrl);
    } catch (err) {
      console.error("Image generation failed", err);
      setErrorMessage("Could not generate invoice preview image.");
      setStatus("error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewImg) return;
    const link = document.createElement("a");
    link.download = `Invoice_${documentData?.invoiceNo || documentData?.receiptNumber || "document"}.png`;
    link.href = previewImg;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!previewImg) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Invoice</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
              img { max-width: 100%; height: auto; display: block; }
              @media print {
                body { background: white; }
                img { width: 100%; height: auto; }
              }
            </style>
          </head>
          <body>
            <img src="${previewImg}" />
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSend = async () => {
    if (!phone) {
      setErrorMessage("Please enter a valid WhatsApp number.");
      setStatus("error");
      return;
    }
    
    setIsSending(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      // Clean and format recipient phone number
      let cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "92" + cleanPhone.substring(1);
      } else if (cleanPhone.length === 10 && cleanPhone.startsWith("3")) {
        cleanPhone = "92" + cleanPhone;
      }

      // Check if client is mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const encodedMsg = encodeURIComponent(message);

      if (isMobile && previewImg) {
        // Try Web Share API on mobile to attach image directly
        const blob = dataURLtoBlob(previewImg);
        const file = new File([blob], "invoice.png", { type: "image/png" });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Invoice Share",
            text: message
          });
          setStatus("success");
          setTimeout(() => onClose(), 2000);
          setIsSending(false);
          return;
        }
      }

      // Desktop Flow or Mobile Share sheet fallback
      if (previewImg) {
        try {
          const blob = dataURLtoBlob(previewImg);
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          setCopySuccess(true);
        } catch (clipErr) {
          console.error("Clipboard write error:", clipErr);
        }
      }

      // Deep link directly into WhatsApp App on both laptop (WhatsApp Desktop app) and mobile devices
      const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
      const webUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

      // Open WhatsApp app protocol directly
      window.location.href = appUrl;
      
      // Fallback: If desktop app isn't registered, open web after brief delay
      setTimeout(() => {
        if (!document.hidden) {
          window.open(webUrl, "erp_whatsapp_window");
        }
      }, 1500);
      
      setStatus("success");
      setTimeout(() => {
        onClose();
      }, 3500);
    } catch (e: any) {
      setStatus("error");
      setErrorMessage(e.message || "An error occurred while sending.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  // Extract items for renderer safely
  const docItems = documentData?.rows || documentData?.lines || documentData?.items || [];
  const customerName = party?.name || party?.companyName || party?.vendor || "Walk-in Cash Customer";
  const customerPhone = party?.phone || party?.mobile || "-";
  const customerAddress = party?.address || "-";
  const shopName = shopProfile?.companyName || "AL HADEED TRADERS";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#25D366] p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <MessageCircle size={24} className="fill-white/20 animate-pulse" />
            <div>
              <h3 className="font-black text-lg">Invoice Preview</h3>
              <p className="text-white/80 text-xs font-bold">Share HD image to customer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors bg-black/10 hover:bg-black/20 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950">
          
          {/* Left Side: Invoice Preview Render */}
          <div className="flex flex-col justify-center items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm min-h-[300px] relative overflow-hidden">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <RefreshCw size={36} className="animate-spin text-[#25D366]" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Generating High Quality Image...</p>
              </div>
            ) : previewImg ? (
              <div className="w-full h-full flex flex-col justify-between items-center">
                <div className="w-full overflow-y-auto border border-slate-100 rounded-lg max-h-[50vh] scrollbar-thin">
                  <img src={previewImg} alt="Invoice Preview" className="w-full h-auto object-contain" />
                </div>
                <div className="flex gap-2 w-full mt-4 justify-center">
                  <button 
                    onClick={handleDownload} 
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-black rounded-lg transition-all"
                  >
                    <Download size={14} /> Download PNG
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-black rounded-lg transition-all"
                  >
                    <Printer size={14} /> Print
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500 font-bold">Failed to load preview.</p>
            )}
          </div>

          {/* Right Side: Message & Target Input */}
          <div className="flex flex-col justify-between space-y-4">
            
            {status === "success" && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 p-4 rounded-xl flex flex-col gap-1 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="shrink-0" />
                  <p className="text-xs font-extrabold uppercase tracking-wider">Session Initialized!</p>
                </div>
                {copySuccess && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold ml-6">
                    Image copied to clipboard! Paste it using <kbd className="bg-emerald-100 dark:bg-emerald-800 px-1 py-0.5 rounded font-black text-xs">Ctrl+V</kbd> inside the opened WhatsApp chat.
                  </p>
                )}
              </div>
            )}

            {status === "error" && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-900/30">
                <AlertTriangle size={20} className="shrink-0" />
                <p className="text-xs font-bold">{errorMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Phone size={12} /> Recipient Phone (WhatsApp)
                </label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +923001234567"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:border-[#25D366] transition-all dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText size={12} /> WhatsApp Text Message
                </label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:border-[#25D366] transition-all dark:text-white leading-relaxed"
                />
              </div>
            </div>

            {/* Hint for Clipboard Paste on Desktop */}
            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 font-bold leading-normal">
              <p className="font-extrabold text-slate-700 dark:text-slate-350 uppercase tracking-widest mb-1">💡 Sharing Guidelines</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>On mobile, you can send the PNG image directly using the system share menu.</li>
                <li>On desktop, clicking &quot;Send&quot; automatically copies the image to your clipboard. Simply press <kbd className="bg-slate-200 dark:bg-slate-800 px-1 rounded">Ctrl+V</kbd> inside the WhatsApp chat to attach the image.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSend}
                disabled={isSending || isGenerating}
                className="flex items-center gap-2 px-8 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-black shadow-lg shadow-[#25D366]/30 transition-all disabled:opacity-50"
              >
                {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {isSending ? "Sending..." : "Send to WhatsApp"}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Hidden Document Render Container (A4 layout rendered off-screen) */}
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none" style={{ position: "absolute", left: "-9999px" }}>
        <div ref={printRef} className="w-[794px] bg-white p-10 text-black font-sans leading-normal flex flex-col justify-between" style={{ minHeight: "1123px" }}>
          
          <div>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-[#800000]">{shopName}</h1>
                <p className="text-xs text-slate-500 font-bold mt-1">{shopProfile?.address || "Main Road, Oil Market"}</p>
                <p className="text-xs text-slate-500 font-bold">Tel: {shopProfile?.phone || "03108444612"}</p>
                {shopProfile?.ntn && <p className="text-xs text-slate-500 font-bold">NTN: {shopProfile.ntn}</p>}
              </div>
              <div className="text-right">
                <h2 className="text-xl font-black uppercase tracking-wide text-[#800000]">
                  {type === "Statement" ? "Account Statement" : type === "Receipt" ? "Cash Receipt" : type === "Reminder" ? "Account Statement" : "Invoice"}
                </h2>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs font-bold text-left mt-2 border border-slate-200 p-2 rounded bg-slate-50">
                  <span className="text-slate-400">Voucher No:</span>
                  <span className="text-slate-800 text-right font-black">
                    {documentData?.invoiceNo || documentData?.receiptNumber || documentData?.voucherNo || "-"}
                  </span>
                  <span className="text-slate-400">Date:</span>
                  <span className="text-slate-800 text-right">
                    {documentData?.date ? new Date(documentData.date).toLocaleDateString() : new Date().toLocaleDateString()}
                  </span>
                  <span className="text-slate-400">Method:</span>
                  <span className="text-slate-800 text-right uppercase">
                    {documentData?.paymentMethod || "Credit"}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-start mb-6">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Billed To</h3>
              <p className="font-extrabold text-sm text-slate-900">{customerName}</p>
              <p className="text-xs text-slate-500 font-bold">Phone: {customerPhone}</p>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Address: {customerAddress}</p>
            </div>

            {/* Table Content Section */}
            {type === "Statement" || type === "Reminder" ? (
              // Ledger / Statement Table
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-400 text-xs font-black uppercase tracking-wider text-slate-600 bg-slate-50">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Doc No</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Debit (PKR)</th>
                    <th className="py-2 px-3 text-right">Credit (PKR)</th>
                    <th className="py-2 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-800 divide-y divide-slate-100">
                  <tr className="bg-slate-50/50 font-black">
                    <td className="py-2 px-3">-</td>
                    <td className="py-2 px-3">-</td>
                    <td className="py-2 px-3 uppercase tracking-tighter text-slate-400">Opening Balance</td>
                    <td className="py-2 px-3 text-right">-</td>
                    <td className="py-2 px-3 text-right">-</td>
                    <td className="py-2 px-3 text-right">PKR {(documentData?.opening || 0).toLocaleString()}</td>
                  </tr>
                  {documentData?.rows?.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-blue-600">{row.voucherNo || row.invoiceNo}</td>
                      <td className="py-2 px-3">{row.remarks || row.type}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {row.debit > 0 ? row.debit.toLocaleString() : "-"}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-700">
                        {row.credit > 0 ? row.credit.toLocaleString() : "-"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        PKR {row.runningBalance?.toLocaleString() || row.balance?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={3} className="py-2 px-3 text-right uppercase text-[10px]">Total Summary</td>
                    <td className="py-2 px-3 text-right text-emerald-700">{(documentData?.totalDr || 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-rose-700">{(documentData?.totalCr || 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-[#800000] text-sm">
                      PKR {(documentData?.closing || 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : type === "Receipt" ? (
              // Receipt Payment Details
              <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm font-bold text-slate-500">Transaction Date:</span>
                  <span className="text-sm font-black text-slate-800">
                    {documentData?.date ? new Date(documentData.date).toLocaleDateString() : new Date().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm font-bold text-slate-500">Receipt Voucher:</span>
                  <span className="text-sm font-black text-[#800000]">{documentData?.receiptNumber || "-"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm font-bold text-slate-500">Amount Received:</span>
                  <span className="text-lg font-black text-emerald-600">PKR {(documentData?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {documentData?.notes && (
                  <div className="pt-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">Remarks / Narration:</span>
                    <p className="text-xs text-slate-700 leading-normal">{documentData.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              // Generic Item Table (Invoice)
              <>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-350 text-xs font-black text-slate-450 uppercase tracking-wider bg-slate-50">
                      <th className="py-2 px-2 text-left w-8">#</th>
                      <th className="py-2 px-2 text-left">Description</th>
                      <th className="py-2 px-2 text-center w-16">Qty</th>
                      <th className="py-2 px-2 text-right w-24">Price/Unit</th>
                      <th className="py-2 px-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {docItems.map((item: any, i: number) => {
                      const desc = item.description || item.itemName || item.accountName || "Product/Item";
                      const qty = item.qty || item.cartons || 1;
                      const price = Number(item.unitPrice || item.rate || item.amount || 0);
                      const total = Number(item.total || item.amount || item.netAmount || 0);

                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2 text-slate-400">{i + 1}</td>
                          <td className="py-2 px-2 text-slate-800 font-black">{desc}</td>
                          <td className="py-2 px-2 text-center">{qty}</td>
                          <td className="py-2 px-2 text-right">PKR {price.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-slate-900 font-black">PKR {total.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {docItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">No items attached.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Subtotals & Signatures */}
                <div className="grid grid-cols-12 gap-6 mt-8 pt-4 border-t border-slate-200">
                  <div className="col-span-7 flex flex-col justify-between">
                    <div className="text-[10px] text-slate-500 font-bold leading-relaxed">
                      <p className="font-extrabold text-slate-700 mb-1">Notes / Terms:</p>
                      <p>1. Goods once sold are only returnable within 7 days in original condition.</p>
                      <p>2. Payment should be completed as per agreed credit terms.</p>
                      {documentData?.notes && <p className="mt-2 text-[#800000] font-black">Remarks: {documentData.notes}</p>}
                    </div>
                  </div>
                  <div className="col-span-5 border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs font-bold space-y-2 text-slate-600">
                    <div className="flex justify-between">
                      <span>Gross Total:</span>
                      <span className="text-slate-800">PKR {Math.round(documentData?.subTotal || documentData?.totalAmount || 0).toLocaleString()}</span>
                    </div>
                    {documentData?.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span className="text-rose-600">-PKR {Math.round(documentData.discountAmount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-300 text-slate-950 uppercase">
                      <span>Net Total:</span>
                      <span className="text-[#800000]">PKR {Math.round(documentData?.totalAmount || documentData?.total || documentData?.amount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer signatures */}
          <div className="mt-16 flex justify-between items-end border-t border-slate-200 pt-6">
            <div>
              <div className="w-36 border-b border-slate-300 mb-1"></div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Customer Signature</p>
            </div>
            <div className="text-center text-[10px] font-black uppercase text-slate-400">
              * Thank you for your business *
            </div>
            <div className="text-right">
              <div className="w-36 border-b border-slate-300 mb-1 ml-auto"></div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Authorized Signature</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
