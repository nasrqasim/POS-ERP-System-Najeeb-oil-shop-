import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection as clientCollection, 
  doc as clientDoc, 
  getDoc as clientGetDoc, 
  getDocs as clientGetDocs, 
  setDoc as clientSetDoc, 
  updateDoc as clientUpdateDoc, 
  deleteDoc as clientDeleteDoc, 
  query as clientQuery, 
  where as clientWhere, 
  orderBy as clientOrderBy, 
  limit as clientLimit, 
  writeBatch as clientWriteBatch 
} from "firebase/firestore";
import { adminDb } from "./admin";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBzWSw27wDhUinMS-bMYfHCDqy60RdmXXs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "al-hadeed-traders.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "al-hadeed-traders",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "al-hadeed-traders.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "761871449563",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:761871449563:web:d892f5f502754aed463bfe"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

const isServer = typeof window === "undefined";

const COLLECTION_MAP: Record<string, string> = {
  "journal_entries": "journalentries",
  "journal_entry": "journalentries",
  "cash_receipts": "cashreceipts",
  "cash_receipt": "cashreceipts",
  "bank_receipts": "bankreceipts",
  "bank_receipt": "bankreceipts",
  "cash_payments": "cashpayments",
  "cash_payment": "cashpayments",
  "bank_payments": "bankpayments",
  "bank_payment": "bankpayments",
  "financial_years": "financialyears",
  "financial_year": "financialyears",
  "shop_profiles": "shopprofiles",
  "shop_profile": "shopprofiles",
  "print_formats": "printformats",
  "print_format": "printformats",
  "inventory_settings": "inventorysettings",
  "inventory_setting": "inventorysettings",
  "document_settings": "documentsettings",
  "document_setting": "documentsettings",
  "message_logs": "messagelogs",
  "message_log": "messagelogs",
  "salary_advances": "salaryadvances",
  "salary_advance": "salaryadvances",
  "salary_loans": "salaryloans",
  "salary_loan": "salaryloans",
  "opening_balances": "openingbalances",
  "opening_balance": "openingbalances",
  "product_serials": "productserials",
  "product_serial": "productserials",
  "purchase_orders": "purchaseorders",
  "purchase_order": "purchaseorders",
  "sale_orders": "saleorders",
  "sale_order": "saleorders",
  "vehicle_logs": "vehiclelogs",
  "vehicle_log": "vehiclelogs",
  "stock_logs": "stocklogs",
  "stock_log": "stocklogs",
  "other_incomes": "otherincomes",
  "other_income": "otherincomes",
  "salary_settlements": "salarysettlements",
  "salary_settlement": "salarysettlements",
  "system_logs": "systemlogs",
  "system_log": "systemlogs"
};

export function normalizeCollectionName(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase();
  if (COLLECTION_MAP[lower]) return COLLECTION_MAP[lower];
  return name;
}

export function collection(...args: any[]): any {
  if (isServer) {
    let path = "";
    if (typeof args[0] === "string") {
      path = args.map(a => typeof a === 'string' ? normalizeCollectionName(a) : a).filter(Boolean).join("/");
    } else if (args[0] && args[0].__isServer) {
      path = [args[0].path, ...args.slice(1).map(a => typeof a === 'string' ? normalizeCollectionName(a) : a)].filter(Boolean).join("/");
    } else {
      path = args.slice(1).map(a => typeof a === 'string' ? normalizeCollectionName(a) : a).filter(Boolean).join("/");
    }
    return { __isServer: true, path };
  }
  const normalizedArgs = args.map(arg => typeof arg === 'string' ? normalizeCollectionName(arg) : arg);
  return (clientCollection as any)(...normalizedArgs);
}

export function doc(...args: any[]): any {
  if (isServer) {
    let path = "";
    if (typeof args[0] === "string") {
      path = args.map(a => typeof a === 'string' ? normalizeCollectionName(a) : a).filter(Boolean).join("/");
    } else if (args[0] && args[0].__isServer) {
      path = [args[0].path, ...args.slice(1).map(a => typeof a === 'string' ? normalizeCollectionName(a) : a)].filter(Boolean).join("/");
    } else {
      path = args.slice(1).map(a => typeof a === 'string' ? normalizeCollectionName(a) : a).filter(Boolean).join("/");
    }
    if (path.endsWith('/') || !path.includes('/')) {
      const autoId = adminDb.collection(path || 'tmp').doc().id;
      path = path ? `${path}/${autoId}` : autoId;
    }
    return { __isServer: true, isDoc: true, path, id: path.split('/').pop() };
  }
  const normalizedArgs = args.map(arg => typeof arg === 'string' ? normalizeCollectionName(arg) : arg);
  return (clientDoc as any)(...normalizedArgs);
}

export function query(colRef: any, ...constraints: any[]): any {
  if (isServer) {
    return {
      __isServer: true,
      path: colRef.path,
      constraints: [...(colRef.constraints || []), ...constraints]
    };
  }
  return (clientQuery as any)(colRef, ...constraints);
}

export function where(field: string, op: any, val: any): any {
  if (isServer) {
    return { type: "where", field, op, val };
  }
  return clientWhere(field, op, val);
}

export function orderBy(field: string, dir?: any): any {
  if (isServer) {
    return { type: "orderBy", field, dir };
  }
  return clientOrderBy(field, dir);
}

export function limit(n: number): any {
  if (isServer) {
    return { type: "limit", n };
  }
  return clientLimit(n);
}

export async function getDocs(target: any): Promise<any> {
  if (isServer) {
    let ref: any = adminDb.collection(target.path);
    if (target.constraints) {
      for (const c of target.constraints) {
        if (c.type === "where") ref = ref.where(c.field, c.op, c.val);
        if (c.type === "orderBy") ref = ref.orderBy(c.field, c.dir);
        if (c.type === "limit") ref = ref.limit(c.n);
      }
    }
    const snap = await ref.get();
    return {
      forEach: (cb: any) => snap.docs.forEach((doc: any) => cb({ id: doc.id, data: () => doc.data() })),
      docs: snap.docs.map((doc: any) => ({ id: doc.id, data: () => doc.data() })),
      empty: snap.empty,
      size: snap.size
    };
  }
  return clientGetDocs(target);
}

export async function getDoc(target: any): Promise<any> {
  if (isServer) {
    const snap = await adminDb.doc(target.path).get();
    return {
      exists: () => snap.exists,
      data: () => snap.data(),
      id: snap.id
    };
  }
  return clientGetDoc(target);
}

function sanitizeData(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeData(value);
    }
  }
  return clean;
}

export async function setDoc(target: any, data: any, options?: any): Promise<any> {
  if (isServer) {
    return await adminDb.doc(target.path).set(sanitizeData(data), options || {});
  }
  return clientSetDoc(target, sanitizeData(data), options);
}

export async function updateDoc(target: any, data: any): Promise<any> {
  if (isServer) {
    return await adminDb.doc(target.path).update(sanitizeData(data));
  }
  return clientUpdateDoc(target, sanitizeData(data));
}

export async function deleteDoc(target: any): Promise<any> {
  if (isServer) {
    return await adminDb.doc(target.path).delete();
  }
  return clientDeleteDoc(target);
}

export function writeBatch(): any {
  if (isServer) {
    const batch = adminDb.batch();
    return {
      set: (docRef: any, data: any, options?: any) => batch.set(adminDb.doc(docRef.path), sanitizeData(data), options || {}),
      update: (docRef: any, data: any) => batch.update(adminDb.doc(docRef.path), sanitizeData(data)),
      delete: (docRef: any) => batch.delete(adminDb.doc(docRef.path)),
      commit: () => batch.commit()
    };
  }
  return clientWriteBatch(db);
}

// Recursively convert Firestore Timestamps to ISO date strings
function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (typeof obj.toDate === "function") {
    try {
      return obj.toDate().toISOString();
    } catch {
      return obj;
    }
  }
  if (
    (typeof obj._seconds === "number" && typeof obj._nanoseconds === "number") ||
    (typeof obj.seconds === "number" && typeof obj.nanoseconds === "number")
  ) {
    const sec = typeof obj._seconds === "number" ? obj._seconds : obj.seconds;
    try {
      return new Date(sec * 1000).toISOString();
    } catch {
      return obj;
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(convertTimestamps);
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertTimestamps(value);
  }
  return result;
}

// Helper to convert Firestore Document Snapshots to clean JavaScript objects
export function snapToData(docSnap: any) {
  if (!docSnap || !docSnap.exists()) return null;
  const rawData = docSnap.data();
  const data = convertTimestamps(rawData);
  return {
    _id: docSnap.id,
    id: docSnap.id,
    ...data
  };
}

// Helper to convert QuerySnapshot to array of JavaScript objects
export function querySnapToData(querySnap: any) {
  const list: any[] = [];
  if (!querySnap) return list;
  querySnap.forEach((d: any) => {
    const rawData = d.data();
    const data = convertTimestamps(rawData);
    list.push({
      _id: d.id,
      id: d.id,
      ...data
    });
  });
  return list;
}
