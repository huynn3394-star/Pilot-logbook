import { collection, doc, onSnapshot, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { validate, expired } from "./model.js";
function createNotesTransport({ db, uid, getAuthGeneration }) {
  const generation = getAuthGeneration(), guard = () => {
    if (generation !== getAuthGeneration()) throw Error("Phiên Notes đã thay đổi.");
  };
  const head = (id) => doc(db, "users", uid, "notesV1Heads", id), record = (id) => doc(db, "users", uid, "notesV1Records", id), receipt = (id) => doc(db, "users", uid, "notesV1Commits", id);
  const decode = (id, h, r) => {
    const value = !h || h.expiresAt?.toMillis() <= Date.now() || !r ? null : validate(JSON.parse(r.payload));
    if(value && (value.id !== id || value.kind !== h.kind || r.revision !== h.revision))throw Error('Bản ghi Notes trên Cloud không khớp định danh. Dữ liệu trên máy được giữ nguyên.');
    return {id, operationId:h?.operationId, revision:h?.revision||0, value};
  };
  const readRemote = (id) => runTransaction(db, async (tx) => {
    guard();
    const [h, r] = await Promise.all([tx.get(head(id)), tx.get(record(id))]);
    guard();
    return decode(id, h.exists() ? h.data() : null, r.exists() ? r.data() : null);
  });
  return {
    watch(onRemote, onReady, onError) {
      guard();
      let chain = Promise.resolve(), initial = true;
      return onSnapshot(collection(db, "users", uid, "notesV1Heads"), { includeMetadataChanges: true }, (snap) => {
        if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
        const changes = initial ? snap.docs.map((doc2) => ({ doc: doc2, type: "added" })) : snap.docChanges({ includeMetadataChanges: true });
        initial = false;
        chain = chain.then(async () => {
          guard();
          for (const change of changes) {
            if (change.type === "removed") continue;
            const remote = await readRemote(change.doc.id);
            guard();
            await onRemote(remote);
          }
          guard();
          onReady();
        }).catch(onError);
      }, onError);
    },
    async commit(operation) {
      guard();
      validate(operation.value);
      return runTransaction(db, async (tx) => {
        guard();
        const [h, r, c] = await Promise.all([tx.get(head(operation.id)), tx.get(record(operation.id)), tx.get(receipt(operation.operationId))]);
        guard();
        const current = decode(operation.id, h.exists() ? h.data() : null, r.exists() ? r.data() : null);
        if (c.exists() || current.revision !== operation.baseRevision) return current;
        if (h.exists() && h.data().expiresAt?.toMillis() <= Date.now()) return current;
        if (expired(operation.value)) return current;
        const revision = current.revision + 1, expiresAt = operation.value.expiresAt ? Timestamp.fromMillis(operation.value.expiresAt) : null;
        tx.set(head(operation.id), { version: 1, revision, kind: operation.value.kind, operationId: operation.operationId, expiresAt, updatedAt: serverTimestamp() });
        tx.set(record(operation.id), { version: 1, revision, operationId: operation.operationId, payload: JSON.stringify(operation.value), expiresAt });
        tx.set(receipt(operation.operationId), { version: 1, id: operation.id, revision });
        return { id: operation.id, operationId: operation.operationId, revision, value: operation.value };
      }).catch(async (error) => {
        guard();
        if (!["permission-denied", "aborted"].includes(error.code)) throw error;
        const current = await readRemote(operation.id);
        if (current.revision > operation.baseRevision) return current;
        throw error;
      }).then((result) => {
        guard();
        return result;
      });
    }
  };
}
export {
  createNotesTransport
};
