import { getCoordinator } from "../account/coordinator.js";
import { getAccountClient } from "../account/client.js";
import { openNotes } from "./store.js";
let singleton;
function notesService() {
  return singleton || (singleton = createService());
}
function createService() {
  const coordinator = getCoordinator(), listeners = /* @__PURE__ */ new Set();
  let store = null, account = null, transport = null, stopWatch = null, stopStore = null, scope = "", generation = 0, connection = 0, working = false, retry, timer, cloudReady = false, kind = "local", failure = "";
  const uid = () => coordinator.getCachedSelection()?.uid || "@guest";
  const notify = () => {
    for (const fn of listeners) fn();
  };
  async function readStatus() {
    if (!store) return { kind: "loading", text: "Đang mở Notes…" };
    const capturedStore = store, capturedGeneration = generation, rows = await capturedStore.all();
    if (capturedGeneration !== generation || capturedStore !== store) return { kind: "not-loaded", text: "Đang đổi không gian Notes…" };
    const pending = rows.filter((e) => e.dirty).length, conflicts = rows.filter((e) => e.conflicts.length).length;
    const state = { kind: conflicts ? "conflict" : scope === "@guest" ? "local" : !navigator.onLine ? "offline" : failure ? "error" : pending ? "pending" : cloudReady ? "synced" : kind, pending, conflicts };
    state.text = { conflict: "Có xung đột · giữ đủ các phiên bản", local: scope === "@guest" ? "Đã lưu trên máy · Guest" : "Đã lưu trên máy · Chờ xác minh Cloud", offline: "Đã lưu trên máy · Chờ có mạng", error: "Đã lưu trên máy · Đồng bộ chưa thành công", pending: "Đã lưu trên máy · Chờ đồng bộ", synced: "Đã đồng bộ", syncing: "Đã lưu trên máy · Đang đồng bộ", reauth: "Đã lưu trên máy · Cần đăng nhập lại" }[state.kind] || "Đã lưu trên máy · Chưa xác minh Cloud";
    if (scope !== "@guest") coordinator.publishAreaStatus({ uid: scope, area: "notes", status: { kind: state.kind === "loading" ? "not-loaded" : state.kind, pending, conflicts } });
    return state;
  }
  async function status(){
    try{return await readStatus();}
    catch(error){
      // A failed cache read cannot establish Saved/Synced or break another screen.
      if(scope!=="@guest")coordinator.publishAreaStatus({uid:scope,area:'notes',status:{kind:'error'}});
      return {kind:'error',text:'Chưa xác minh lưu Notes · không đọc được bộ nhớ. Không xóa dữ liệu trình duyệt; thử mở lại app.'};
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(pump, 700);
    notify();
  }
  async function pump() {
    if (working || !store || !transport || !navigator.onLine) return;
    working = true;
    const captured = store, g = generation, t = transport;
    kind = "syncing";
    try {
      await captured.sweep();
      for (let i = 0; i < 100 && g === generation; i++) {
        const op = await captured.nextOperation();
        if (!op) break;
        const remote = await t.commit(op);
        if (g !== generation) break;
        await captured.acknowledge(op, remote);
      }
      if (g === generation) {
        failure = "";
        kind = cloudReady ? "synced" : "syncing";
      }
    } catch (e) {
      if (g === generation) {
        failure = e.message;
        kind = "error";
        clearTimeout(retry);
        retry = setTimeout(() => {
          working = false;
          connect();
        }, 15e3);
      }
    } finally {
      working = false;
      notify();
      status().catch(() => {
      });
    }
  }
  async function connect() {
    const g = generation, c = ++connection;
    stopWatch?.();
    stopWatch = null;
    transport = null;
    cloudReady = false;
    if (scope === "@guest") {
      kind = "local";
      notify();
      return;
    }
    try {
      account = await getAccountClient();
      await account.ready;
      if (g !== generation || c !== connection) return;
      if (account.currentUser()?.uid !== scope) {
        kind = "reauth";
        notify();
        return;
      }
      transport = account.notesTransport();
      const target = store;
      stopWatch = transport.watch(async (remote) => {
        if (g !== generation || c !== connection) return;
        await target.receive(remote);
      }, () => {
        if (g !== generation || c !== connection) return;
        cloudReady = true;
        failure = "";
        schedule();
      }, (e) => {
        if (g !== generation || c !== connection) return;
        failure = e.message;
        kind = "error";
        notify();
      });
      schedule();
    } catch (e) {
      if (g === generation && c === connection) {
        failure = e.message;
        kind = "error";
        notify();
      }
    }
  }
  async function switchScope() {
    const next = uid();
    if (next === scope && store) return;
    scope = next;
    const g = ++generation;
    stopWatch?.();
    stopStore?.();
    stopWatch = null;
    transport = null;
    store = null;
    cloudReady = false;
    failure = "";
    kind = "local";
    clearTimeout(timer);
    clearTimeout(retry);
    notify();
    const opened = await openNotes({ uid: next });
    if (g !== generation) {
      opened.close();
      return;
    }
    store = opened;
    await store.sweep();
    stopStore = store.subscribe(schedule);
    notify();
    await connect();
  }
  const ready = switchScope();
  coordinator.subscribe(() => switchScope().catch((e) => {
    failure = e.message;
    notify();
  }));
  addEventListener("online", () => connect());
  addEventListener("offline", () => notify());
  getAccountClient().then((a) => {
    account = a;
    let auth = "";
    a.subscribe(() => {
      const next = (a.currentUser()?.uid || "") + ":" + coordinator.generation;
      if (next !== auth) {
        auth = next;
        connect();
      }
    });
  }).catch(() => {
  });
  setInterval(() => {
    status().catch(() => {
    });
    if (navigator.onLine && !working) schedule();
  }, 3e4);
  return { ready, get store() {
    return store;
  }, get scope() {
    return scope;
  }, get generation() {
    return generation;
  }, status, schedule, subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, async flush() {
    clearTimeout(timer);
    await pump();
  }, get error() {
    return failure;
  } };
}
export {
  notesService
};
