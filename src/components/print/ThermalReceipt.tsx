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
  return Math.round(num).toString();
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

  const receiptNo = data.invoiceNo || data.poNumber || data.referenceNo || data.receiptNo || data.voucherNo || "8047";
  const operatorName = data.operatorName || data.salesPerson || companyInfo?.userName || "Administrator";
  const salesPerson = data.salesPerson || "-";
  const paymentMethod = data.paymentMethod || data.paymentMode || "Cash";

  return (
    <div 
      className="thermal-receipt-container text-black bg-white p-1 font-sans text-[15px] leading-tight w-[76mm] max-w-[76mm] mx-auto" 
      style={{ color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 600 }}
    >
      {/* Logo */}
      {config?.showLogo && companyInfo?.logo && (
        <div className="flex justify-center mb-1">
          <Image 
            src={companyInfo.logo} 
            alt="Company Logo" 
            width={120}
            height={50}
            unoptimized
            className="h-12 w-auto object-contain grayscale" 
          />
        </div>
      )}

      {/* Company Title */}
      <div className="text-center mb-1">
        <h2 className="font-extrabold uppercase tracking-tight text-[24px] text-black mb-0.5" style={{ color: '#000000', fontWeight: 800, fontSize: '24px' }}>
          {companyInfo?.companyName || "AL HADEED TRADERS"}
        </h2>
        {companyInfo?.address && (
          <p className="text-[12px] font-bold leading-tight mb-0.5 text-black" style={{ color: '#000000', fontWeight: 700 }}>{companyInfo.address}</p>
        )}
        <p className="text-[14px] font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>Tel: {phoneNo}</p>
      </div>

      {/* Solid Filled Black Header Bar for Receipt Type */}
      <div 
        className="bg-black text-white text-center py-1 font-bold uppercase tracking-wider my-2 text-[18px]" 
        style={{ backgroundColor: '#000000', color: '#ffffff', fontWeight: 700, fontSize: '18px' }}
      >
        {data.receiptType || "Sale Receipt"}
      </div>

      {/* Structured Meta Info Section */}
      <div className="text-[15px] text-black my-2 border-b-2 border-black pb-2 space-y-1 text-left" style={{ color: '#000000' }}>
        <div className="flex justify-between items-center">
          <span className="font-normal">Receipt No.</span>
          <span className="text-[15px] font-bold">{receiptNo}</span>
        </div>
        <div className="flex justify-between items-center">
          <span><span className="font-normal">Date</span> &nbsp;<strong className="font-bold">{dateStr}</strong></span>
          <span><span className="font-normal">Time</span> &nbsp;<strong className="font-bold">{timeStr}</strong></span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-normal">Operator Name:</span>
          <span className="font-bold">{operatorName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-normal">Sales Person:</span>
          <span className="font-bold">{salesPerson}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-normal">Customer Name:</span>
          <span className="font-bold truncate max-w-[160px]">{customerName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-normal">Payment Type:</span>
          <span className="font-bold uppercase">{paymentMethod}</span>
        </div>

        {/* Vehicle & KM details */}
        {(data.regNo || data.vehicleNo || data.startKms || data.endKms || data.rangeKms) ? (
          <div className="pt-1 mt-1 border-t border-dashed border-black space-y-0.5">
            {(data.regNo || data.vehicleNo) ? (
              <div className="flex justify-between items-center">
                <span className="font-normal">Vehicle No:</span>
                <span className="font-bold uppercase">{data.regNo || data.vehicleNo}</span>
              </div>
            ) : null}
            {(data.startKms || data.endKms || data.rangeKms) ? (
              <div className="flex justify-between items-center">
                <span className="font-normal">Start / End KM:</span>
                <span className="font-bold">{data.startKms || 0} / {data.endKms || 0}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Items Table Headers */}
      <div className="border-t-2 border-b-2 border-black py-1 my-1 text-[15px] font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>
        <div className="flex justify-between items-center">
          <span className="w-[44%] text-left">Description</span>
          <span className="w-[14%] text-center">Qty</span>
          <span className="w-[21%] text-right">Price/Ctn</span>
          <span className="w-[21%] text-right">Total</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-1.5 mb-1.5 text-[15px] text-black" style={{ color: '#000000' }}>
        {items.map((item: any, i: number) => {
          const desc = item.description || item.itemName || item.accountName || "Item";
          const qty = item.qty || item.cartons || 1;
          const price = Math.round(item.unitPrice || item.rate || item.amount || 0);
          const total = Math.round(item.total || item.amount || item.netAmount || item.grossAmount || 0);
          
          const qtyDisplay = formatReceiptLineQty(item, item);
          
          return (
            <div key={i} className="border-b border-dashed border-black pb-1 pt-0.5">
              {/* Top row: Full Item Name */}
              <div className="text-left font-bold text-[15px] text-black leading-snug break-words">
                {desc}
              </div>
              {/* Bottom row: Unit details + Qty + Price/Ctn + Total */}
              <div className="flex justify-between items-center text-[15px] text-black font-bold mt-0.5">
                <span className="w-[44%] text-left text-[12px] font-bold text-black truncate">
                  {qtyDisplay.equivalentLabel || ""}
                </span>
                <span className="w-[14%] text-center font-bold">
                  {qtyDisplay.qtyLabel || qty}
                </span>
                <span className="w-[21%] text-right font-bold">
                  {price.toLocaleString()}
                </span>
                <span className="w-[21%] text-right font-bold">
                  {total.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-2 text-black font-bold">No items found</div>
        )}
      </div>

      {/* Item & Qty Summary Row */}
      <div className="border-t-2 border-b-2 border-black py-1 my-1.5 text-[15px] font-bold text-black flex justify-between" style={{ color: '#000000', fontWeight: 700 }}>
        <span>Item(s) &nbsp;{itemCount}</span>
        <span>Total Qty &nbsp;{formatQty(totalQty)}</span>
      </div>

      {/* Financial Summary */}
      <div className="space-y-1 text-[15px] font-bold text-black my-1.5 text-right" style={{ color: '#000000', fontWeight: 700 }}>
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
            <span>Discount</span>
            <span>-{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between text-[20px] font-extrabold pt-1.5 pb-1 border-t-2 border-b-2 border-black uppercase my-1" style={{ fontSize: '20px', color: '#000000', fontWeight: 900 }}>
          <span>Net Total PKR</span>
          <span>{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between pt-0.5">
          <span>Amount Received</span>
          <span>{amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash Back PKR</span>
          <span>{cashBack >= 0 ? cashBack.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</span>
        </div>
        {discount > 0 && (
          <div className="text-center font-bold text-[14px] pt-1 uppercase">
            You Saved Rs.{discount.toLocaleString()}
          </div>
        )}
      </div>

      {/* Visit Note */}
      <div className="text-center font-bold my-2.5 text-[15px] uppercase text-black" style={{ color: '#000000', fontWeight: 700 }}>
        *Thanks For Your Visit*
      </div>

      {/* Software By Footer */}
      <div className="text-center text-[13px] font-bold text-black border-t-2 border-black pt-1.5 mt-2" style={{ color: '#000000', fontWeight: 700, fontSize: '13px' }}>
        Software By: Roonjha Developers - 03152914836
      </div>
    </div>
  );
}
