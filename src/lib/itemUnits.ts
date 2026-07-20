/** Carton / gallon / litre conversion helpers — single source of truth from item master. */

export type PackItem = {
  name?: string;
  gallonsInCtn?: number;
  litersInCtn?: number;
} | null | undefined;

export type UnitLine = {
  cartons?: number | string;
  gallons?: number | string;
  liters?: number | string;
  entryUnit?: "cartons" | "gallons" | "liters";
};

export type PackSizes = { gallonsInCtn: number; litersInCtn: number };

/** Read pack sizes from the selected item master record only (no hardcoded defaults). */
export function getPackSizes(item?: PackItem): PackSizes {
  return {
    gallonsInCtn: Math.max(0, Number(item?.gallonsInCtn) || 0),
    litersInCtn: Math.max(0, Number(item?.litersInCtn) || 0),
  };
}

export function validateItemPackSizes(
  gallonsInCtn: unknown,
  litersInCtn: unknown
): { ok: true } | { ok: false; message: string } {
  const g = Number(gallonsInCtn);
  const l = Number(litersInCtn);

  if (gallonsInCtn === "" || litersInCtn === "" || gallonsInCtn == null || litersInCtn == null) {
    return { ok: false, message: "Gallons and litres per carton are required." };
  }
  if (Number.isNaN(g) || Number.isNaN(l)) {
    return { ok: false, message: "Gallons and litres per carton must be valid numbers." };
  }
  if (g <= 0) {
    return { ok: false, message: "Gallons per carton must be greater than zero." };
  }
  if (l <= 0) {
    return { ok: false, message: "Litres per carton must be greater than zero." };
  }
  if (g < 0 || l < 0) {
    return { ok: false, message: "Conversion values cannot be negative." };
  }
  return { ok: true };
}

export function cartonsToGallons(cartons: number, item?: PackItem): number {
  const { gallonsInCtn } = getPackSizes(item);
  return roundUnit(cartons * gallonsInCtn);
}

export function cartonsToLiters(cartons: number, item?: PackItem): number {
  const { litersInCtn } = getPackSizes(item);
  return roundUnit(cartons * litersInCtn);
}

export function stockToDisplayUnits(
  cartons: number,
  item?: PackItem
): { cartons: number; gallons: number; liters: number } {
  const c = Number(cartons) || 0;
  return {
    cartons: roundUnit(c),
    gallons: cartonsToGallons(c, item),
    liters: cartonsToLiters(c, item),
  };
}

export function unitMultiplierForDisplay(
  displayUnit: "cartons" | "gallons" | "litres" | "liters",
  item?: PackItem
): number {
  const { gallonsInCtn, litersInCtn } = getPackSizes(item);
  if (displayUnit === "gallons") return gallonsInCtn;
  if (displayUnit === "litres" || displayUnit === "liters") return litersInCtn;
  return 1;
}

export function applyCartonGallonLiterConversion<
  T extends UnitLine
>(
  line: T,
  field: "cartons" | "gallons" | "liters",
  value: number,
  item?: PackItem
): T {
  const { gallonsInCtn, litersInCtn } = getPackSizes(item);
  const updated = { ...line, entryUnit: field };

  if (field === "cartons") {
    // Gallons = Cartons × GPC
    // Litres = Cartons × LPC
    updated.cartons = value;
    updated.gallons = gallonsInCtn > 0 ? value * gallonsInCtn : 0;
    updated.liters = litersInCtn > 0 ? value * litersInCtn : 0;
  } else if (field === "gallons") {
    // Cartons = Gallons / GPC
    // Then calculate litres from cartons: Litres = Cartons × LPC
    updated.gallons = value;
    updated.cartons = gallonsInCtn > 0 ? value / gallonsInCtn : 0;
    updated.liters = litersInCtn > 0 ? updated.cartons * litersInCtn : 0;
  } else if (field === "liters") {
    // Cartons = Litres / LPC
    // Then calculate gallons from cartons: Gallons = Cartons × GPC
    updated.liters = value;
    updated.cartons = litersInCtn > 0 ? value / litersInCtn : 0;
    updated.gallons = gallonsInCtn > 0 ? updated.cartons * gallonsInCtn : 0;
  }

  return updated;
}

/** Apply a cartons/gallons/liters edit with linked conversion (skips sync while value is ""). */
export function applyUnitFieldUpdate<T extends UnitLine>(
  line: T,
  field: "cartons" | "gallons" | "liters",
  value: number | string,
  item?: PackItem
): T {
  const updated = { ...line, [field]: value };
  if (value === "") return updated;
  const num = Number(value);
  if (Number.isNaN(num)) return updated;
  const converted = applyCartonGallonLiterConversion(updated, field, num, item);
  return {
    ...converted,
    cartons: roundUnit(converted.cartons),
    gallons: roundUnit(converted.gallons),
    liters: roundUnit(converted.liters),
  };
}

function roundUnit(n: number | string | undefined): number {
  const v = Number(n) || 0;
  // Use 6 decimal places for internal calculations to maintain precision
  return Math.round(v * 1000000) / 1000000;
}

export function formatQtyDisplay(n: number | string | undefined, decimals: number = 3): string {
  const v = roundUnit(n);
  // If it's a whole number, show without decimals
  if (Number.isInteger(v)) return v.toString();
  // Show with specified decimal places, but remove trailing zeros
  const formatted = v.toFixed(decimals).replace(/\.?0+$/, '');
  return formatted;
}

/** Default qty when an item is picked: 1 CTN → item pack gallons/liters. */
export function defaultUnitsForItem<T extends UnitLine>(line: T, item?: PackItem): T {
  const { gallonsInCtn, litersInCtn } = getPackSizes(item);
  return {
    ...line,
    cartons: 1,
    gallons: gallonsInCtn,
    liters: litersInCtn,
    entryUnit: "cartons",
  };
}

export function emptyUnitLine(): { cartons: number; gallons: number; liters: number } {
  return { cartons: 0, gallons: 0, liters: 0 };
}

/** @deprecated Use applyUnitFieldUpdate — purchase uses the same item master conversion. */
export function applyPurchaseUnitFieldUpdate<T extends UnitLine>(
  line: T,
  field: "cartons" | "gallons" | "liters",
  value: number | string,
  item?: PackItem
): T {
  return applyUnitFieldUpdate(line, field, value, item);
}

/** @deprecated Use defaultUnitsForItem — purchase uses the same item master conversion. */
export function defaultPurchaseUnitsForItem<T extends UnitLine>(line: T, item?: PackItem): T {
  return defaultUnitsForItem(line, item);
}

/** Resolve catalog item from line id or code (for unit sync when itemId missing). */
export function resolveCatalogItem<
  T extends { _id?: string; code?: string }
>(
  items: T[],
  line: { itemId?: string; itemCode?: string }
): T | undefined {
  if (line.itemId) return items.find((i) => i._id === line.itemId);
  const code = String(line.itemCode || "").trim();
  if (code) return items.find((i) => String(i.code || "").trim() === code);
  return undefined;
}

/** Stock movement quantity in cartons (canonical inventory unit). */
export function lineStockQty(line: { cartons?: number; qty?: number }): number {
  const cartons = Number(line.cartons) || 0;
  const qty = Number(line.qty) || 0;
  if (cartons > 0) return cartons;
  if (qty > 0) return qty;
  return 0;
}

export type ReceiptQtyDisplay = {
  qtyLabel: string;
  equivalentLabel?: string;
};

/** Format invoice line quantity for printed receipts. */
export function formatReceiptLineQty(
  line: UnitLine,
  item?: PackItem
): ReceiptQtyDisplay {
  const cartons = roundUnit(line.cartons);
  const gallons = roundUnit(line.gallons);
  const liters = roundUnit(line.liters);
  const entryUnit = line.entryUnit;

  if (entryUnit === "gallons" && gallons > 0) {
    return {
      qtyLabel: `${formatQtyDisplay(gallons)} Gallons`,
      equivalentLabel: `${formatQtyDisplay(cartons)} Cartons`,
    };
  }
  if (entryUnit === "liters" && liters > 0) {
    return {
      qtyLabel: `${formatQtyDisplay(liters)} Litres`,
      equivalentLabel: `${formatQtyDisplay(cartons)} Cartons`,
    };
  }
  if (cartons > 0) {
    return {
      qtyLabel: `${formatQtyDisplay(cartons)} Cartons`,
      equivalentLabel: `${formatQtyDisplay(gallons)} Gallons / ${formatQtyDisplay(liters)} Litres`,
    };
  }
  if (gallons > 0) {
    return {
      qtyLabel: `${formatQtyDisplay(gallons)} Gallons`,
      equivalentLabel: `${formatQtyDisplay(cartons)} Cartons`,
    };
  }
  if (liters > 0) {
    return {
      qtyLabel: `${formatQtyDisplay(liters)} Litres`,
      equivalentLabel: `${formatQtyDisplay(cartons)} Cartons`,
    };
  }
  return { qtyLabel: "0" };
}

export function filterAndSortItems<
  T extends { _id: string; code?: string; name?: string }
>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = items
    .map((item) => {
      const code = String(item.code || "").toLowerCase();
      const name = String(item.name || "").toLowerCase();
      const haystack = `${code} ${name}`;
      let score = 0;

      if (code === q || name === q) score += 1000;
      if (code.includes(q) || name.includes(q)) score += 500;
      if (name.endsWith(` ${q}`) || name.endsWith(q) || code.endsWith(q)) score += 400;
      if (tokens.every((t) => haystack.includes(t))) score += 300;

      for (const t of tokens) {
        if (code === t || name === t) score += 200;
        else if (code.startsWith(t) || name.startsWith(t)) score += 120;
        else if (code.includes(t) || name.includes(t)) score += 80;
      }

      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.item);
}
