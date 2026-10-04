import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch,
  querySnapToData, 
  snapToData 
} from "./firestore";

const docCacheStore: Record<string, { data: any[]; timestamp: number }> = {};
const DEFAULT_TTL_MS = 60 * 1000; // 60s cache TTL

export function clearDocumentCache(collectionName?: string) {
  if (collectionName) {
    delete docCacheStore[collectionName.toLowerCase()];
  } else {
    Object.keys(docCacheStore).forEach(k => delete docCacheStore[k]);
  }
}

export async function getDocuments(collectionName: string, queryConstraints: any[] = []) {
  const normCol = collectionName.toLowerCase();
  const now = Date.now();

  if (queryConstraints.length === 0) {
    const cached = docCacheStore[normCol];
    if (cached && (now - cached.timestamp < DEFAULT_TTL_MS)) {
      return cached.data;
    }
  }

  try {
    const colRef = collection(db, collectionName);
    let result: any[];
    if (queryConstraints.length > 0) {
      const q = query(colRef, ...queryConstraints);
      const snap = await getDocs(q);
      result = querySnapToData(snap);
    } else {
      const snap = await getDocs(colRef);
      result = querySnapToData(snap);
      docCacheStore[normCol] = { data: result, timestamp: now };
    }
    return result;
  } catch (err: any) {
    const cached = docCacheStore[normCol];
    if (cached && cached.data) {
      console.warn(`Firestore read failed for ${collectionName} (${err?.message}). Returning stale cached data.`);
      return cached.data;
    }
    throw err;
  }
}

export async function getDocumentById(collectionName: string, id: string) {
  if (!id) return null;
  const docRef = doc(db, collectionName, id);
  const snap = await getDoc(docRef);
  return snapToData(snap);
}

export async function createDocument(collectionName: string, data: any, customId?: string) {
  clearDocumentCache(collectionName);
  const id = customId || data._id || data.id || doc(collection(db, collectionName)).id;
  const docRef = doc(db, collectionName, String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  
  const now = new Date().toISOString();
  if (!payload.createdAt) payload.createdAt = now;
  payload.updatedAt = now;

  await setDoc(docRef, payload, { merge: true });
  return { _id: String(id), id: String(id), ...payload };
}

export async function updateDocument(collectionName: string, id: string, data: any) {
  clearDocumentCache(collectionName);
  const docRef = doc(db, collectionName, id);
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.updatedAt = new Date().toISOString();
  
  await updateDoc(docRef, payload);
  return getDocumentById(collectionName, id);
}

export async function deleteDocument(collectionName: string, id: string) {
  clearDocumentCache(collectionName);
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
  return { success: true, id };
}

export { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, writeBatch, snapToData, querySnapToData };
