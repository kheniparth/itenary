/* ============================================================
   SYNC — push/pull trip data to the server (host disk via API).
   localStorage remains the offline cache; /data/trip.json is
   the durable copy that survives container restarts.
   ============================================================ */

const Sync = (() => {
  const API = "/api/trip";
  let saveTimer = null;
  let pending = false;
  let lastSavedAt = null;
  let getPayload = null;
  const statusListeners = [];

  function setStatus(status, detail) {
    statusListeners.forEach((fn) => fn(status, detail));
  }

  function onStatus(fn) {
    statusListeners.push(fn);
  }

  async function fetchTrip(timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(API, { cache: "no-store", signal: ctrl.signal });
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`fetch ${resp.status}`);
      return resp.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function pushTrip(trip, savedAt) {
    const resp = await fetch(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ trip, savedAt }),
    });
    if (!resp.ok) throw new Error(`push ${resp.status}`);
    const data = await resp.json();
    lastSavedAt = data.savedAt || savedAt;
    pending = false;
    setStatus("saved", lastSavedAt);
    return data;
  }

  /** Debounced save — always reads the latest trip via getPayload(). */
  function schedulePush(payloadFn) {
    getPayload = payloadFn;
    clearTimeout(saveTimer);
    if (!navigator.onLine) {
      pending = true;
      setStatus("offline");
      return;
    }
    setStatus("syncing");
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      if (!navigator.onLine || !getPayload) {
        pending = true;
        setStatus("offline");
        return;
      }
      try {
        const { trip, savedAt } = getPayload();
        await pushTrip(trip, savedAt);
      } catch {
        pending = true;
        setStatus("error");
      }
    }, 600);
  }

  async function flush(payloadFn) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!navigator.onLine) return false;
    const fn = payloadFn || getPayload;
    if (!fn) return false;
    try {
      const { trip, savedAt } = fn();
      await pushTrip(trip, savedAt);
      return true;
    } catch {
      pending = true;
      setStatus("error");
      return false;
    }
  }

  window.addEventListener("online", () => {
    setStatus("online");
    document.dispatchEvent(new CustomEvent("banff:online"));
  });

  window.addEventListener("offline", () => setStatus("offline"));

  // Push pending edits before the tab closes or navigates away.
  window.addEventListener("pagehide", () => {
    if (!getPayload || !navigator.onLine) return;
    try {
      const { trip, savedAt } = getPayload();
      navigator.sendBeacon(API, new Blob([JSON.stringify({ trip, savedAt })], { type: "application/json" }));
    } catch { /* ignore */ }
  });

  return {
    fetchTrip,
    schedulePush,
    flush,
    onStatus,
    isPending: () => pending,
  };
})();
