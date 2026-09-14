/* ============================================================
   STORE — single source of truth for live trip data.
   Offline cache: localStorage. Durable copy: server /data/trip.json
   (survives container restarts; shared across all devices).
   ============================================================ */

const Store = (() => {
  const TRIP_KEY = "banff_trip_v2";
  const UI_KEY = "banff_ui_v2";

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function ensureIds(trip) {
    trip.days.forEach((day) => {
      day.activities.forEach((a) => { if (!a.id) a.id = uid(); });
      day.ifTimePermits.forEach((a) => { if (!a.id) a.id = uid(); });
      (day.stops || (day.stops = [])).forEach((s) => { if (!s.id) s.id = uid(); });
      day.hotels.forEach((h) => { if (!h.id) h.id = uid(); });
      if (!day.id) day.id = uid();
    });
    trip.packing.forEach((cat) => {
      if (!cat.id) cat.id = uid();
      cat.items.forEach((i) => { if (!i.id) i.id = uid(); });
    });
    return trip;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(TRIP_KEY);
      if (raw) return ensureIds(JSON.parse(raw));
    } catch {}
    return null;
  }

  let trip = loadLocal() || ensureIds(deepClone(TRIP_DEFAULTS));
  let ready = true;
  const changeListeners = [];
  let recalcGen = 0;

  function onChange(fn) {
    changeListeners.push(fn);
  }

  function notifyChange() {
    if (!ready) return;
    changeListeners.forEach((fn) => fn());
  }

  /** Recalculate driving legs after list order or map links change. */
  async function recalcRoutesForDays(dayIds) {
    if (typeof Routing === "undefined" || !navigator.onLine) return;
    const gen = ++recalcGen;
    const days = dayIds.map((id) => getDay(id)).filter(Boolean);
    if (!days.length) return;
    await Routing.recalculateDays(days, trip);
    if (gen !== recalcGen) return;
    persist();
    notifyChange();
  }

  function afterListMutation(...dayIds) {
    persist();
    notifyChange();
    recalcRoutesForDays(dayIds).catch(() => {});
  }

  function tripSavedAt(payload) {
    return payload?.savedAt || payload?.trip?.savedAt || "";
  }

  function applyServerIfNewer(serverPayload) {
    const serverAt = tripSavedAt(serverPayload);
    const localAt = trip.savedAt || "";
    if (serverAt && (!localAt || serverAt > localAt)) {
      trip = ensureIds(serverPayload.trip);
      trip.savedAt = serverAt;
      localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
      notifyChange();
      return true;
    }
    return false;
  }

  function persist() {
    trip.savedAt = new Date().toISOString();
    localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
    if (typeof Sync !== "undefined") {
      Sync.schedulePush(() => ({ trip, savedAt: trip.savedAt }));
    }
  }

  /** Pull from server only when it is newer than local — never clobber fresh edits. */
  async function init() {
    if (navigator.onLine && typeof Sync !== "undefined") {
      try {
        const serverPayload = await Sync.fetchTrip();
        if (serverPayload?.trip) {
          const applied = applyServerIfNewer(serverPayload);
          if (!applied && trip.savedAt) {
            await Sync.flush(() => ({ trip, savedAt: trip.savedAt }));
          }
        }
      } catch {
        /* keep local copy */
      }
    }

    document.addEventListener("banff:online", async () => {
      try {
        const fresh = await Sync.fetchTrip();
        if (fresh?.trip) {
          const applied = applyServerIfNewer(fresh);
          if (!applied && trip.savedAt) {
            await Sync.flush(() => ({ trip, savedAt: trip.savedAt }));
          }
        }
      } catch { /* ignore */ }
    });

    return trip;
  }

  function getTrip() {
    return trip;
  }

  function resetToDefaults() {
    trip = ensureIds(deepClone(TRIP_DEFAULTS));
    persist();
    notifyChange();
    return trip;
  }

  function getDay(dayId) {
    return trip.days.find((d) => d.id === dayId);
  }

  function updateDayField(dayId, field, value) {
    const day = getDay(dayId);
    if (day) { day[field] = value; persist(); notifyChange(); }
  }

  function addItem(dayId, listName, item) {
    const day = getDay(dayId);
    if (!day) return;
    item.id = uid();
    day[listName].push(item);
    afterListMutation(dayId);
    return item;
  }

  function updateItem(dayId, listName, itemId, patch) {
    const day = getDay(dayId);
    if (!day) return;
    const item = day[listName].find((i) => i.id === itemId);
    if (item) {
      Object.assign(item, patch);
      afterListMutation(dayId);
    }
  }

  function removeItem(dayId, listName, itemId) {
    const day = getDay(dayId);
    if (!day) return;
    day[listName] = day[listName].filter((i) => i.id !== itemId);
    afterListMutation(dayId);
  }

  function moveItem(dayId, listName, itemId, direction) {
    const day = getDay(dayId);
    if (!day) return;
    const list = day[listName];
    const idx = list.findIndex((i) => i.id === itemId);
    const newIdx = idx + direction;
    if (idx === -1 || newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    afterListMutation(dayId);
  }

  function moveItemToDay(fromDayId, toDayId, listName, itemId) {
    if (fromDayId === toDayId) return;
    const fromDay = getDay(fromDayId);
    const toDay = getDay(toDayId);
    if (!fromDay || !toDay) return;
    const idx = fromDay[listName].findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const [item] = fromDay[listName].splice(idx, 1);
    toDay[listName].push(item);
    afterListMutation(fromDayId, toDayId);
  }

  function moveItemBetweenLists(dayId, fromListName, toListName, itemId) {
    if (fromListName === toListName) return;
    const day = getDay(dayId);
    if (!day) return;
    const fromList = day[fromListName];
    if (!fromList) return;
    const idx = fromList.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const [item] = fromList.splice(idx, 1);
    delete item.distanceKm;
    delete item.durationMin;
    delete item.flightLeg;
    day[toListName].push(item);
    afterListMutation(dayId);
  }

  function addDay(day) {
    day.id = uid();
    day.activities = day.activities || [];
    day.ifTimePermits = day.ifTimePermits || [];
    day.stops = day.stops || [];
    day.hotels = day.hotels || [];
    day.notes = day.notes || "";
    trip.days.push(day);
    trip.days.sort((a, b) => a.date.localeCompare(b.date));
    persist();
    notifyChange();
    return day;
  }

  function removeDay(dayId) {
    trip.days = trip.days.filter((d) => d.id !== dayId);
    persist();
    notifyChange();
  }

  // ---- Packing list ----
  function togglePackingItem(catId, itemId) {
    const cat = trip.packing.find((c) => c.id === catId);
    const item = cat && cat.items.find((i) => i.id === itemId);
    if (item) { item.packed = !item.packed; persist(); notifyChange(); }
  }

  function addPackingItem(catId, text) {
    const cat = trip.packing.find((c) => c.id === catId);
    if (!cat) return;
    const item = { id: uid(), text, packed: false };
    cat.items.push(item);
    persist();
    notifyChange();
    return item;
  }

  function removePackingItem(catId, itemId) {
    const cat = trip.packing.find((c) => c.id === catId);
    if (!cat) return;
    cat.items = cat.items.filter((i) => i.id !== itemId);
    persist();
    notifyChange();
  }

  function addPackingCategory(name) {
    const cat = { id: uid(), category: name, items: [] };
    trip.packing.push(cat);
    persist();
    notifyChange();
    return cat;
  }

  // ---- UI state (edit mode, open day, view mode) ----
  function getUiState() {
    try {
      return JSON.parse(localStorage.getItem(UI_KEY)) || { editMode: false, openDay: null };
    } catch {
      return { editMode: false, openDay: null };
    }
  }
  function setUiState(patch) {
    const s = { ...getUiState(), ...patch };
    localStorage.setItem(UI_KEY, JSON.stringify(s));
    return s;
  }

  async function backfillRoutes() {
    if (typeof Routing === "undefined" || !navigator.onLine) return;
    await Routing.recalculateTrip(trip);
    persist();
    notifyChange();
  }

  function onCoordsChanged(dayId) {
    persist();
    notifyChange();
    recalcRoutesForDays(dayId).catch(() => {});
  }

  async function hydrateDayCoords(dayId) {
    const day = getDay(dayId);
    if (!day || typeof Routing === "undefined") return false;
    const { changed } = await Routing.hydrateDayRouteCoords(day, trip);
    if (changed) onCoordsChanged(dayId);
    return changed;
  }

  return {
    init, getTrip, resetToDefaults, getDay,
    updateDayField, addItem, updateItem, removeItem, moveItem, moveItemToDay, moveItemBetweenLists,
    addDay, removeDay,
    togglePackingItem, addPackingItem, removePackingItem, addPackingCategory,
    getUiState, setUiState, onChange, backfillRoutes, hydrateDayCoords, onCoordsChanged,
  };
})();
