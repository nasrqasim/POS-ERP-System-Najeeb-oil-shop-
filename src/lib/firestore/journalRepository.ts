import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, querySnapToData, snapToData } from "./firestore";

const COLLECTION = "journalentries";

export async function getAllJournalEntries(partyId?: string) {
  const colRef = collection(db, COLLECTION);
  if (partyId) {
    const q = query(colRef, where("partyId", "==", partyId));
    const snap = await getDocs(q);
    return querySnapToData(snap);
  }
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function getJournalEntryById(id: string) {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  return snapToData(snap);
}

export async function createJournalEntry(data: any) {
  const id = data._id || data.id || doc(collection(db, COLLECTION)).id;
  const docRef = doc(db, COLLECTION, String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function updateJournalEntry(id: string, data: any) {
  const docRef = doc(db, COLLECTION, id);
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.updatedAt = new Date().toISOString();
  await updateDoc(docRef, payload);
  return getJournalEntryById(id);
}

export async function deleteJournalEntry(id: string) {
  const docRef = doc(db, COLLECTION, id);
  await deleteDoc(docRef);
  return { success: true, id };
}
