function toStringIdOrNull(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null) {
    if ("_id" in (value as any)) return String((value as any)._id);
    if ("id" in (value as any)) return String((value as any).id);
  }
  const str = String(value).trim();
  if (!str || str === "cash" || str === "bank" || str === "null" || str === "undefined") return null;
  return str;
}

function toDateStringOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "object" && value !== null) {
    const v = value as any;
    if (typeof v.toDate === "function") {
      try { return v.toDate().toISOString(); } catch {}
    }
    const sec = typeof v._seconds === "number" ? v._seconds : v.seconds;
    if (typeof sec === "number") {
      try { return new Date(sec * 1000).toISOString(); } catch {}
    }
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function normalizeInvoiceLine(line: Record<string, unknown>) {
  const cartons = Number(line.cartons ?? line.qty ?? 0);
  const rate = Number(line.rate ?? line.ratePerCarton ?? line.unitPrice ?? line.unitPriceUSD ?? 0);
  const discountPercent = Number(line.discountPercent ?? line.discPercent ?? 0);
  const grossAmount = Number(line.grossAmount ?? cartons * rate);
  const netAmount = Number(
    line.netAmount ?? line.total ?? grossAmount - (grossAmount * discountPercent) / 100
  );

  const normalized: Record<string, unknown> = {
    description: String(line.description ?? ""),
    qty: cartons,
    cartons,
    liters: Number(line.liters ?? 0),
    gallons: Number(line.gallons ?? 0),
    rate,
    ratePerCarton: Number(line.ratePerCarton ?? rate),
    grossAmount,
    discountPercent,
    taxPercent: Number(line.taxPercent ?? 0),
    netAmount,
    priceType: line.priceType ?? "retail",
  };

  const itemId = toStringIdOrNull(line.itemId);
  if (itemId) normalized.itemId = itemId;

  if (line.foreignNetAmount != null) {
    normalized.foreignNetAmount = Number(line.foreignNetAmount);
  }

  return normalized;
}

export function normalizeInvoicePayload(body: Record<string, unknown>) {
  const rawLines = (body.lines ?? body.items ?? []) as Record<string, unknown>[];
  const lines = Array.isArray(rawLines) ? rawLines.map(normalizeInvoiceLine) : [];

  const linkRef =
    body.reference ??
    body.linkToGRN ??
    body.linkToPO ??
    body.poReference ??
    "";

  const paymentKey = String(body.paymentAccountId ?? "").trim().toLowerCase();
  let paymentMethod = body.paymentMethod != null ? String(body.paymentMethod) : "Credit";
  let paymentAccountId = toStringIdOrNull(body.paymentAccountId);
  if (paymentKey === "cash") {
    paymentMethod = "Cash";
    paymentAccountId = null;
  } else if (paymentKey === "bank") {
    paymentMethod = "Bank";
    paymentAccountId = null;
  }

  const payload: Record<string, unknown> = {
    invoiceNo: String(body.invoiceNo ?? ""),
    type: String(body.type ?? ""),
    paymentMethod,
    date: toDateStringOrUndefined(body.date) ?? new Date().toISOString(),
    dueDate: toDateStringOrUndefined(body.dueDate),
    partyId: toStringIdOrNull(body.partyId),
    partyName: body.partyName != null ? String(body.partyName) : body.customerName != null ? String(body.customerName) : undefined,
    customerName: body.customerName != null ? String(body.customerName) : body.partyName != null ? String(body.partyName) : undefined,
    paymentTerms: body.paymentTerms != null ? String(body.paymentTerms) : "",
    employeeId: toStringIdOrNull(body.employeeId),
    jobId: toStringIdOrNull(body.jobId),
    locationId: toStringIdOrNull(body.locationId),
    toLocationId: toStringIdOrNull(body.toLocationId),
    linkedInvoiceId: toStringIdOrNull(body.linkedInvoiceId),
    paymentAccountId,
    reference: String(linkRef || ""),
    vendorInvNo:
      body.vendorInvNo != null
        ? String(body.vendorInvNo)
        : body.vendorInvoiceNo != null
          ? String(body.vendorInvoiceNo)
          : "",
    vendorInvoiceDate: toDateStringOrUndefined(body.vendorInvoiceDate),
    linkToGRN: body.linkToGRN != null ? String(body.linkToGRN) : "",
    linkToPO: body.linkToPO != null ? String(body.linkToPO) : "",
    currency: body.currency != null ? String(body.currency) : "PKR",
    exchangeRate: body.exchangeRate != null ? Number(body.exchangeRate) : undefined,
    gdNo: body.gdNo != null ? String(body.gdNo) : undefined,
    blAwbNo: body.blAwbNo != null ? String(body.blAwbNo) : undefined,
    balance: body.balance != null ? Number(body.balance) : undefined,
    amountReceived:
      body.amountReceived != null ? Number(body.amountReceived) : Number(body.amountPaid ?? 0),
    subTotal: body.subTotal != null ? Number(body.subTotal) : undefined,
    discountAmount: body.discountAmount != null ? Number(body.discountAmount) : undefined,
    taxAmount: body.taxAmount != null ? Number(body.taxAmount) : undefined,
    totalAmount: body.totalAmount != null ? Number(body.totalAmount) : undefined,
    notes: body.notes != null ? String(body.notes) : "",
    status: body.status != null ? String(body.status) : "posted",
    
    // Oil Shop Vehicle & Service fields
    regNo: body.regNo != null ? String(body.regNo) : body.vehicleNo != null ? String(body.vehicleNo) : "",
    vehicleNo: body.vehicleNo != null ? String(body.vehicleNo) : body.regNo != null ? String(body.regNo) : "",
    startKms: body.startKms != null ? Number(body.startKms) : 0,
    endKms: body.endKms != null ? Number(body.endKms) : 0,
    rangeKms: body.rangeKms != null ? Number(body.rangeKms) : 0,
    oilGaugeLimit: body.oilGaugeLimit != null ? Number(body.oilGaugeLimit) : 0,
    carService: body.carService != null ? Number(body.carService) : 0,
    carServiceDiscount: body.carServiceDiscount != null ? Number(body.carServiceDiscount) : 0,

    lines,
  };

  // Remove any undefined keys so Firestore doesn't error out
  const cleanPayload: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (val !== undefined) {
      cleanPayload[key] = val;
    }
  }

  return cleanPayload;
}
