"use client";

import React from "react";
import Image from "next/image";
import { formatReceiptLineQty } from "@/lib/itemUnits";

interface ThermalReceiptProps {
  data: any;
  items: any[];
  companyInfo: any;
  config: any;
  dateStr: string;
  timeStr: string;
}

function formatQty(val: any): string {
  if (val === undefined || val === null) return "0";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (Number.isInteger(num)) return num.toString();
  return parseFloat(num.toFixed(4)).toString();
}

export default function ThermalReceipt({
  data,
  items,
  companyInfo,
  config,
  dateStr,
  timeStr,
}: ThermalReceiptProps) {
  const totalQty = items.reduce((acc, item) => acc + (Number(item.qty) || Number(item.cartons) || 1), 0);
  const itemCount = items.length;

  const grossTotal = Math.round(data.subtotal || data.total || 0);
  const discount = Math.round(data.discountAmount || 0);
  const netTotal = Math.round(data.total || data.amount || 0);
  const amountReceived = Math.round(data.amountReceived || data.receivedAmount || netTotal);
  const cashBack = amountReceived - netTotal;

  const carService = Math.round(data.carService || 0);
  const carServiceDiscount = Math.round(data.carServiceDiscount || 0);
  
  const itemsDiscount = items.reduce((acc: number, item: any) => {
    const gross = (Number(item.qty || item.cartons || 1) * Number(item.rate || item.unitPrice || 0));
    const net = Number(item.netAmount || item.total || item.amount || 0);
    return acc + Math.max(0, gross - net);
  }, 0);

  const customerName = (data.customer && data.customer.trim() && data.customer !== "Search Customer...")
    ? data.customer
    : (data.supplier && data.supplier.trim())
    ? data.supplier
    : (data.partyName && data.partyName.trim())
    ? data.partyName
    : "Walk-in Customer";

  const phoneNo = (companyInfo?.phone && companyInfo.phone.trim() !== "-")
    ? companyInfo.phone
    : "03108444612";

  return (
    <div className="thermal-receipt-container text-black bg-white p-2 font-mono text-[13px] font-black leading-tight w-[80mm] max-w-full mx-auto" style={{ color: '#000000' }}>
      {/* Logo */}
      {config.showLogo && companyInfo?.logo && (
        <div className="flex justify-center mb-2">
          <Image 
            src={companyInfo.logo} 
            alt="Company Logo" 
            width={100}
            height={40}
            unoptimized
            className="h-10 w-auto object-contain grayscale" 
          />
        </div>
      )}

      {/* Company Title */}
      <div className="text-center mb-1">
        <h2 className="font-black uppercase tracking-tight" style={{ fontSize: '16px', lineHeight: '1.2', color: '#000000' }}>
          {companyInfo?.companyName || "AL HADEED TRADERS"}
        </h2>
        {companyInfo?.address && (
          <p className="text-[11px] font-black leading-tight mb-0.5" style={{ color: '#000000' }}>{companyInfo.address}</p>
        )}
        <p className="text-[12px] font-black text-black">Tel: {phoneNo}</p>
      </div>

      {/* High-Contrast Bordered Header for Receipt Type */}
      <div className="border-t-2 border-b-2 border-black text-black text-center py-1 font-black uppercase tracking-wider my-2 text-[13px]">
        {data.receiptType || "Sale Receipt"}
      </div>

      {/* Structured Meta Info Section */}
      <div className="text-[12px] text-black my-2 border-b-2 border-black pb-2 space-y-2">
        <div className="flex justify-between items-center text-[13px] border-b border-dashed border-black pb-1.5">
          <span className="font-bold">Receipt No:</span>
          <span className="text-[14px] font-black">{data.invoiceNo || data.poNumber || data.referenceNo || data.receiptNo || data.voucherNo || "6928"}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-tight block">Date</span>
            <span className="font-black">{dateStr}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-tight block">Time</span>
            <span className="font-black">{timeStr}</span>
          </div>
          
          <div>
            <span className="text-[10px] font-bold uppercase tracking-tight block">Customer</span>
            <span className="font-black break-words block max-w-[120px]">{customerName}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-tight block">Cashier</span>
            <span className="font-black">{data.operatorName || data.salesPerson || companyInfo?.userName || "Admin"}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-tight block">Payment</span>
            <span className="font-black uppercase">{data.paymentMethod || data.paymentMode || "Cash"}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-tight block">Vehicle No</span>
            <span className="font-black uppercase">{data.regNo || "-"}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-tight block">Start KM</span>
            <span className="font-black">{data.startKms !== undefined && data.startKms !== null ? data.startKms : "-"}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-tight block">End KM</span>
            <span className="font-black">{data.endKms !== undefined && data.endKms !== null ? data.endKms : "-"}</span>
          </div>
        </div>
      </div>

      {/* Items Table Headers */}
      <div className="border-b-2 border-black pb-1 mb-1 text-[12px] font-black text-black">
        <div className="grid grid-cols-12">
          <span className="col-span-6 text-left">Description</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-2 text-right">Price</span>
          <span className="col-span-2 text-right">Total</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2 mb-2 text-[12px] font-black text-black">
        {items.map((item: any, i: number) => {
          const desc = item.description || item.itemName || item.accountName || "Item";
          const qty = item.qty || item.cartons || 1;
          const price = Math.round(item.unitPrice || item.rate || item.amount || 0);
          const total = Math.round(item.total || item.amount || item.netAmount || item.grossAmount || 0);
          
          // Use formatReceiptLineQty to get converted quantity display
          const qtyDisplay = formatReceiptLineQty(item, item);
          
          return (
            <div key={i} className="border-b border-dashed border-black pb-1.5">
              <div className="text-left font-black text-[12px] text-black leading-snug">{desc}</div>
              <div className="grid grid-cols-12 text-[12px] text-black font-black mt-0.5">
                <span className="col-span-6 text-[10px] text-slate-600">{qtyDisplay.equivalentLabel || ""}</span>
                <span className="col-span-2 text-center">{qtyDisplay.qtyLabel}</span>
                <span className="col-span-2 text-right">{price.toLocaleString()}</span>
                <span className="col-span-2 text-right font-black">{total.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-2 text-black font-black">No items found</div>
        )}
      </div>

      {/* Item & Qty Summary Row */}
      <div className="border-t-2 border-b-2 border-black py-1.5 my-2 text-[12px] font-black text-black flex justify-between">
        <span>Item(s): {itemCount}</span>
        <span>Total Qty: {formatQty(totalQty)}</span>
      </div>

      {/* Financial Summary */}
      <div className="space-y-1.5 text-[12px] font-black text-black my-2 text-right">
        <div className="flex justify-between">
          <span>Gross Total</span>
          <span>{grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        {itemsDiscount > 0 && (
          <div className="flex justify-between">
            <span>Product Discount</span>
            <span>-{itemsDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {carService > 0 && (
          <div className="flex justify-between">
            <span>Car Service Charges</span>
            <span>+{carService.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {carServiceDiscount > 0 && (
          <div className="flex justify-between">
            <span>Car Wash Discount</span>
            <span>-{carServiceDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Additional Discount</span>
            <span>-{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-black pt-2 pb-1 border-t-2 border-b-2 border-black uppercase my-1" style={{ fontSize: '14px' }}>
          <span>Net Total PKR</span>
          <span>{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Amount Received</span>
          <span>{amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash Back PKR</span>
          <span>{cashBack >= 0 ? cashBack.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</span>
        </div>
      </div>

      {/* Visit Note */}
      <div className="text-center font-black my-3 text-[12px] uppercase text-black">
        * Thanks For Your Visit *
      </div>

      {/* Software By Footer */}
      <div className="text-center text-[10px] font-black text-black border-t-2 border-black pt-1.5 mt-2">
        Software By: Roonjha Developers : 03152914836
      </div>
    </div>
  );
}
