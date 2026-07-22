"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Package, User, Calendar, CreditCard, Banknote, Building } from "lucide-react";
import ERPModal from "../erp/ui/ERPModal";

interface POSViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
}

export default function POSViewModal({ isOpen, onClose, sale }: POSViewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    fetch("/api/shop-profile")
      .then(res => res.json())
      .then(json => {
        if (json.ok) setCompanyInfo(json.data);
      })
      .catch(err => console.error(err));
    return () => setMounted(false);
  }, []);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalQty = sale.lines?.reduce((acc: number, line: any) => acc + (Number(line.qty) || Number(line.cartons) || 1), 0) || 0;

  return (
    <>
      <ERPModal
        isOpen={isOpen}
        onClose={onClose}
        title="Transaction Details"
        size="lg"
        footer={
          <div className="flex justify-between w-full print:hidden">
            <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
              Close
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-8 py-2.5 bg-maroon-800 text-white rounded-xl text-sm font-black hover:bg-maroon-900 transition-all shadow-xl shadow-maroon-900/20"
            >
              <Printer size={18} /> Print Receipt
            </button>
          </div>
        }
      >
        <div className="p-2">
          {/* Screen Only View */}
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2 uppercase">Receipt Info</label>
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-maroon-800">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{sale.invoiceNo}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(sale.date).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2 uppercase">Customer Info</label>
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-blue-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{sale.partyId?.companyName || sale.partyId?.name || "Walk-in Customer"}</p>
                      <p className="text-[10px] font-bold text-slate-400">{sale.partyId?.contact || "No Contact Provided"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2 uppercase">Payment Details</label>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                    {sale.paymentMethod === 'Cash' ? (
                       <Banknote size={32} className="text-emerald-600 mb-2" />
                    ) : (
                       <CreditCard size={32} className="text-blue-600 mb-2" />
                    )}
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Rs. {(sale.totalAmount || 0).toLocaleString()}</h4>
                    <span className="px-3 py-1 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-full border border-slate-200 dark:border-slate-800">
                      Paid via {sale.paymentMethod || "Credit"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 tracking-widest block uppercase">Items List</label>
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 tracking-widest uppercase">Item Description</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 tracking-widest uppercase text-center w-20">Qty</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 tracking-widest uppercase text-right w-28">Price</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 tracking-widest uppercase text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {sale.lines?.map((line: any, idx: number) => (
                      <tr key={idx} className="text-sm font-bold">
                        <td className="px-6 py-4 text-slate-900 dark:text-white">{line.description || line.itemId?.name}</td>
                        <td className="px-6 py-4 text-center text-slate-500">{line.qty || line.cartons}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{(line.rate || line.ratePerCarton || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-slate-900 dark:text-white font-black">{(line.netAmount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between w-64 text-sm font-bold text-slate-400">
                 <span className="uppercase tracking-widest text-[10px]">Subtotal</span>
                 <span className="text-slate-900 dark:text-white">Rs. {(sale.subTotal || sale.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between w-64 text-sm font-bold text-slate-400">
                 <span className="uppercase tracking-widest text-[10px]">Tax (GST 5%)</span>
                 <span className="text-slate-900 dark:text-white">Rs. {(sale.taxAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between w-64 items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                 <span className="text-[10px] font-black text-maroon-800 uppercase tracking-widest">Grand Total</span>
                 <span className="text-2xl font-black text-maroon-800 tracking-tighter">Rs. {(sale.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </ERPModal>

      {/* Portal Isolated Thermal Receipt directly attached to Body Sibling */}
      {isOpen && mounted && createPortal(
        <div id="print-area" className="w-full flex flex-col bg-white text-black font-sans p-0 m-0" style={{ fontFamily: 'monospace' }}>
          <style>{`
            /* Screen view: hide print-area completely */
            #print-area {
              display: none;
            }

            @media print {
              /* Completely hide the React app root and all other body siblings to prevent background grid bleeding */
              body > *:not(#print-area) {
                display: none !important;
              }
              
              /* Show ONLY the print-area at the top left of the page */
              #print-area {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                margin: 0 !important;
                padding: 4mm !important;
                background: white !important;
                color: black !important;
                box-sizing: border-box !important;
              }
              
              html, body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 80mm !important;
              }
            }
          `}</style>

          {/* Logo / Company Title */}
          <div className="text-center mb-1">
            <h2 className="text-[16px] font-black uppercase tracking-tight text-black" style={{ fontSize: '16px', color: '#000000', fontWeight: 900 }}>
              {companyInfo?.companyName || "AL HADEED TRADERS"}
            </h2>
            <p className="text-[12px] font-black text-black" style={{ color: '#000000', fontWeight: 900 }}>Tel: {companyInfo?.phone || "03108444612"}</p>
          </div>

          {/* Solid Filled Black Header Bar for Receipt Type */}
          <div className="bg-black text-white text-center py-1 font-black uppercase tracking-wider my-1.5 text-[13px]" style={{ backgroundColor: '#000000', color: '#ffffff', fontWeight: 900 }}>
            Sale Receipt
          </div>

          {/* Meta Info Section */}
          <div className="text-[12px] font-black space-y-1 my-1.5 border-b-2 border-black pb-1.5 text-left text-black" style={{ color: '#000000', fontWeight: 900 }}>
            <div className="flex justify-between items-center">
              <span>Receipt No.</span>
              <span className="text-[13px] font-black">{sale.invoiceNo || "8047"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Date &nbsp;{new Date(sale.date).toLocaleDateString('en-GB')}</span>
              <span>Time &nbsp;{new Date(sale.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Operator Name:</span>
              <span className="font-black">Administrator</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Sales Person:</span>
              <span className="font-black">-</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Customer Name:</span>
              <span className="font-black truncate max-w-[160px]">
                {sale.partyId?.companyName || sale.partyId?.name || "Walk-in Customer"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Payment Type:</span>
              <span className="font-black uppercase">{sale.paymentMethod || "Cash"}</span>
            </div>
          </div>

          {/* Items Table Headers */}
          <div className="border-t-2 border-b-2 border-black py-1 my-1 text-[12px] font-black text-black" style={{ color: '#000000', fontWeight: 900 }}>
            <div className="flex justify-between items-center">
              <span className="w-[44%] text-left">Description</span>
              <span className="w-[14%] text-center">Qty</span>
              <span className="w-[21%] text-right">Price/Ctn</span>
              <span className="w-[21%] text-right">Total</span>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-1.5 mb-1.5 text-[12px] font-black text-left text-black" style={{ color: '#000000', fontWeight: 900 }}>
            {sale.lines?.map((line: any, i: number) => {
              const desc = line.description || line.itemId?.name || "Item";
              const qty = line.qty || line.cartons || 1;
              const price = Math.round(line.rate || line.ratePerCarton || 0);
              const total = Math.round(line.netAmount || 0);
              return (
                <div key={i} className="border-b border-dashed border-black pb-1 pt-0.5">
                  {/* Row 1: Item Name / Description */}
                  <div className="text-left font-black text-[13px] text-black leading-snug break-words">{desc}</div>
                  {/* Row 2: Qty / Rate / Total aligned */}
                  <div className="flex justify-between items-center text-[12px] font-black text-black mt-0.5">
                    <span className="w-[44%] text-left text-[11px] font-black text-black"></span>
                    <span className="w-[14%] text-center font-black">{qty}</span>
                    <span className="w-[21%] text-right font-black">{price.toLocaleString()}</span>
                    <span className="w-[21%] text-right font-black">{total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Item & Qty Summary Row */}
          <div className="border-t-2 border-b-2 border-black py-1 my-1.5 text-[12px] font-black flex justify-between text-black" style={{ color: '#000000', fontWeight: 900 }}>
            <span>Item(s) &nbsp;{sale.lines?.length || 0}</span>
            <span>Total Qty &nbsp;{totalQty.toFixed(2)}</span>
          </div>

          {/* Financial Summary */}
          <div className="space-y-1 text-[12px] font-black my-1.5 text-right text-black" style={{ color: '#000000', fontWeight: 900 }}>
            <div className="flex justify-between">
              <span>Gross Total</span>
              <span>{Math.round(sale.subTotal || sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {Math.round(sale.discountAmount || 0) > 0 && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{Math.round(sale.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-[14px] font-black pt-1.5 pb-1 border-t-2 border-b-2 border-black uppercase my-1" style={{ fontSize: '14px', color: '#000000', fontWeight: 900 }}>
              <span>Net Total PKR</span>
              <span>{Math.round(sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span>Amount Received</span>
              <span>{Math.round(sale.amountReceived || sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash Back PKR</span>
              <span>{Math.round((sale.amountReceived || sale.totalAmount || 0) - (sale.totalAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {Math.round(sale.discountAmount || 0) > 0 && (
              <div className="text-center font-black text-[12px] pt-1 uppercase">
                You Saved Rs.{Math.round(sale.discountAmount || 0).toLocaleString()}
              </div>
            )}
          </div>

          {/* Visit Note */}
          <div className="text-center font-black my-2.5 text-[12px] uppercase text-black" style={{ color: '#000000', fontWeight: 900 }}>
            *Thanks For Your Visit*
          </div>

          {/* Software By Footer */}
          <div className="text-center text-[10px] font-black border-t-2 border-black pt-1.5 mt-2 text-black" style={{ color: '#000000', fontWeight: 900 }}>
            Software By: Roonjha developers : 03152914836
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
