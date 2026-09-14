/* ============================================================
   APP — rendering + interaction logic
   ============================================================ */

/* ---------------- Time helpers ---------------- */
function todayStr() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TRIP_DEFAULTS.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function nowHHMM() {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TRIP_DEFAULTS.timezone, hour: "2-digit", minute: "2-digit", hour12: false });
  return fmt.format(new Date());
}
function nowHour() {
  return parseInt(nowHHMM().split(":")[0], 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function fmtDateLong(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function fmtDateShort(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
/** Show at most 2 decimal places; avoids float noise like 91.600000000000001. */
function fmtNum(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return null;
  return parseFloat(Number(n).toFixed(2));
}
function fmtNumStr(n) {
  const v = fmtNum(n);
  return v == null ? "" : String(v);
}
function fmtTime12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
function greeting() {
  const h = nowHour();
  if (h < 5) return { text: "Good night", emoji: "🌙" };
  if (h < 12) return { text: "Good morning", emoji: "🌅" };
  if (h < 17) return { text: "Good afternoon", emoji: "☀️" };
  if (h < 21) return { text: "Good evening", emoji: "🌆" };
  return { text: "Good night", emoji: "🌙" };
}

/* ---------------- Modal ---------------- */
const Modal = (() => {
  const overlay = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const bodyEl = document.getElementById("modal-body");
  const saveBtn = document.getElementById("modal-save");
  const deleteBtn = document.getElementById("modal-delete");
  const cancelBtn = document.getElementById("modal-cancel");
  const closeBtn = document.getElementById("modal-close");

  let currentFields = [];
  let onSaveCb = null;
  let onDeleteCb = null;

  function fieldHtml(f, value) {
    const v = value == null ? "" : value;
    if (f.type === "textarea") {
      return `<div class="field"><label>${f.label}</label><textarea data-key="${f.key}" placeholder="${f.placeholder || ""}">${v}</textarea></div>`;
    }
    if (f.type === "checkbox") {
      return `<div class="field field-checkbox"><input type="checkbox" data-key="${f.key}" ${v ? "checked" : ""}/><label>${f.label}</label></div>`;
    }
    if (f.type === "select") {
      const opts = f.options.map((o) => `<option value="${o.value}" ${o.value === v ? "selected" : ""}>${o.label}</option>`).join("");
      return `<div class="field"><label>${f.label}</label><select data-key="${f.key}">${opts}</select></div>`;
    }
    const type = f.type || "text";
    return `<div class="field"><label>${f.label}</label><input type="${type}" data-key="${f.key}" value="${v}" placeholder="${f.placeholder || ""}"/></div>`;
  }

  function open({ title, fields, values = {}, onSave, onDelete }) {
    titleEl.textContent = title;
    currentFields = fields;
    onSaveCb = onSave;
    onDeleteCb = onDelete || null;

    bodyEl.innerHTML = "";
    let i = 0;
    while (i < fields.length) {
      if (fields[i].row) {
        const rowFields = [];
        // Cap at 2 per row — more than that overflows narrow/mobile modals
        while (i < fields.length && fields[i].row && rowFields.length < 2) { rowFields.push(fields[i]); i++; }
        const rowHtml = rowFields.map((f) => fieldHtml(f, values[f.key])).join("");
        bodyEl.insertAdjacentHTML("beforeend", `<div class="field-row">${rowHtml}</div>`);
      } else {
        bodyEl.insertAdjacentHTML("beforeend", fieldHtml(fields[i], values[fields[i].key]));
        i++;
      }
    }

    deleteBtn.classList.toggle("hidden", !onDeleteCb);
    overlay.classList.remove("hidden");
  }

  function collectValues() {
    const values = {};
    currentFields.forEach((f) => {
      const el = bodyEl.querySelector(`[data-key="${f.key}"]`);
      if (!el) return;
      if (f.type === "checkbox") values[f.key] = el.checked;
      else if (f.type === "number") values[f.key] = el.value === "" ? null : Number(el.value);
      else values[f.key] = el.value;
    });
    return values;
  }

  function close() {
    overlay.classList.add("hidden");
    onSaveCb = null;
    onDeleteCb = null;
  }

  saveBtn.addEventListener("click", () => {
    if (onSaveCb) onSaveCb(collectValues());
    close();
  });
  deleteBtn.addEventListener("click", () => {
    if (onDeleteCb) onDeleteCb();
    close();
  });
  cancelBtn.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  return { open, close };
})();

/* ---------------- Edit mode ---------------- */
let editMode = Store.getUiState().editMode;

function setEditMode(on) {
  editMode = on;
  Store.setUiState({ editMode: on });
  document.body.classList.toggle("edit-mode", on);
  renderAll();
}

/* ---------------- Item modal openers ---------------- */
const ITEM_FIELDS = [
  { key: "emoji", label: "Emoji", placeholder: "📍" },
  { key: "text", label: "What", placeholder: "e.g. Moraine Lake" },
  { key: "arrive", label: "Arrive", type: "time", row: true },
  { key: "leave", label: "Leave", type: "time", row: true },
  { key: "distanceKm", label: "Distance from previous (km)", type: "number", placeholder: "auto from map links", row: true },
  { key: "durationMin", label: "Travel time from previous (min)", type: "number", placeholder: "auto from map links", row: true },
  { key: "link", label: "Link (optional)", type: "url", placeholder: "https://…" },
  { key: "mapLink", label: "Google Maps link (optional)", type: "url", placeholder: "https://maps.app.goo.gl/…" },
];

// "time" was the old single-field name — fall back to it for items saved before arrive/leave existed
function itemArrive(item) { return item.arrive || item.time || ""; }

const PLAN_LISTS = ["activities", "ifTimePermits"];

function openItemModal(dayId, listName, item) {
  const listLabel = { activities: "Activity", ifTimePermits: "If-time item", stops: "Stop" }[listName];
  const trip = Store.getTrip();
  const extraFields = [];
  if (item && PLAN_LISTS.includes(listName)) {
    extraFields.push({
      key: "moveToList",
      label: "Section",
      type: "select",
      options: [
        { value: "activities", label: "Today's plan" },
        { value: "ifTimePermits", label: "If time permits" },
      ],
    });
  }
  if (item) {
    extraFields.push({
      key: "moveToDay",
      label: "Day",
      type: "select",
      options: trip.days.map((d) => ({ value: d.id, label: `${fmtDateShort(d.date)} — ${d.headline}` })),
    });
  }
  const fields = item ? [...ITEM_FIELDS, ...extraFields] : ITEM_FIELDS;

  Modal.open({
    title: item ? `Edit ${listLabel}` : `Add ${listLabel}`,
    fields,
    values: item ? { ...item, moveToList: listName, moveToDay: dayId } : { emoji: "📍" },
    onSave: (values) => {
      if (!values.text) return;
      const targetDayId = values.moveToDay;
      const targetListName = values.moveToList;
      delete values.moveToDay;
      delete values.moveToList;
      if (item) {
        Store.updateItem(dayId, listName, item.id, values);
        if (targetListName && targetListName !== listName) {
          Store.moveItemBetweenLists(dayId, listName, targetListName, item.id);
        }
        if (targetDayId && targetDayId !== dayId) {
          Store.moveItemToDay(dayId, targetDayId, targetListName || listName, item.id);
        }
      } else {
        Store.addItem(dayId, listName, values);
      }
    },
    onDelete: item ? () => { Store.removeItem(dayId, listName, item.id); } : null,
  });
}

const HOTEL_FIELDS = [
  { key: "name", label: "Hotel / stay name", placeholder: "e.g. Sandman Hotel" },
  { key: "city", label: "City", placeholder: "e.g. Calgary" },
  { key: "rooms", label: "Rooms", placeholder: "e.g. 1 room" },
  { key: "link", label: "Booking link", type: "url", placeholder: "https://…" },
  { key: "confirmed", label: "Booked / confirmed", type: "checkbox" },
];

function openHotelModal(dayId, hotel) {
  Modal.open({
    title: hotel ? "Edit hotel" : "Add hotel",
    fields: HOTEL_FIELDS,
    values: hotel || {},
    onSave: (values) => {
      if (!values.name) return;
      if (hotel) Store.updateItem(dayId, "hotels", hotel.id, values);
      else Store.addItem(dayId, "hotels", values);
    },
    onDelete: hotel ? () => { Store.removeItem(dayId, "hotels", hotel.id); } : null,
  });
}

function openAddDayModal() {
  const placeOptions = Object.entries(TRIP_DEFAULTS.places).map(([key, p]) => ({ value: key, label: p.name }));
  Modal.open({
    title: "Add a day",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "emoji", label: "Emoji", placeholder: "📍" },
      { key: "headline", label: "Headline", placeholder: "e.g. Free day" },
      { key: "from", label: "From", row: true },
      { key: "to", label: "To", row: true },
      { key: "travelTime", label: "Travel time (optional)", placeholder: "e.g. 🚗 ~1h 30m" },
      { key: "place", label: "Weather location", type: "select", options: placeOptions },
    ],
    values: { emoji: "📍", place: "banff" },
    onSave: (values) => {
      if (!values.date) return;
      Store.addDay({ ...values, activities: [], ifTimePermits: [], stops: [], hotels: [], notes: "" });
      renderAll();
    },
  });
}

/* ---------------- Shared: activity row ---------------- */
function activityRow(dayId, listName, item, opts = {}) {
  const li = document.createElement("li");
  const canCheck = listName !== "stops";
  if (item.done) li.classList.add("done");
  if (opts.pastTime) li.classList.add("past-time");
  if (opts.upNext) li.classList.add("up-next");

  const metaBits = [];
  const arriveVal = itemArrive(item);
  if (arriveVal) metaBits.push(`🕐 ${fmtTime12(arriveVal)}${item.leave ? "–" + fmtTime12(item.leave) : ""}`);
  const meta = metaBits.length ? `<div class="ameta">${metaBits.join(" · ")}</div>` : "";
  const linkBits = [];
  if (item.link) linkBits.push(`<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="alink" onclick="event.stopPropagation()">🔗 Details</a>`);
  if (item.mapLink) linkBits.push(`<a href="${item.mapLink}" target="_blank" rel="noopener noreferrer" class="alink" onclick="event.stopPropagation()">📍 Map</a>`);
  const linkHtml = linkBits.length ? `<div class="alinks">${linkBits.join("")}</div>` : "";

  li.innerHTML = `
    <span class="aemoji">${item.emoji || "📍"}</span>
    <div class="atext-wrap"><span class="atext">${item.text}</span>${meta}${linkHtml}</div>
  `;

  if (canCheck) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.done;
    cb.addEventListener("change", (e) => {
      e.stopPropagation();
      Store.updateItem(dayId, listName, item.id, { done: cb.checked });
      li.classList.toggle("done", cb.checked);
    });
    li.appendChild(cb);
  }

  if (typeof opts.index === "number" && opts.len > 1) {
    const reorder = document.createElement("span");
    reorder.className = "reorder-btns";
    const up = document.createElement("button");
    up.className = "reorder-btn";
    up.textContent = "▲";
    up.disabled = opts.index === 0;
    up.addEventListener("click", (e) => {
      e.stopPropagation();
      Store.moveItem(dayId, listName, item.id, -1);
    });
    const down = document.createElement("button");
    down.className = "reorder-btn";
    down.textContent = "▼";
    down.disabled = opts.index === opts.len - 1;
    down.addEventListener("click", (e) => {
      e.stopPropagation();
      Store.moveItem(dayId, listName, item.id, 1);
    });
    reorder.appendChild(up);
    reorder.appendChild(down);
    li.appendChild(reorder);
  }

  if (PLAN_LISTS.includes(listName)) {
    const moveBtn = document.createElement("button");
    moveBtn.className = "move-section-btn";
    if (listName === "activities") {
      moveBtn.textContent = "↓";
      moveBtn.title = "Move to If time permits";
      moveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Store.moveItemBetweenLists(dayId, "activities", "ifTimePermits", item.id);
      });
    } else {
      moveBtn.textContent = "↑";
      moveBtn.title = "Move to Today's plan";
      moveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Store.moveItemBetweenLists(dayId, "ifTimePermits", "activities", item.id);
      });
    }
    li.appendChild(moveBtn);
  }

  const editBtn = document.createElement("button");
  editBtn.className = "item-edit-btn";
  editBtn.textContent = "✏️";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openItemModal(dayId, listName, item);
  });
  li.appendChild(editBtn);

  return li;
}

/* ---------------- Travel-time connectors between consecutive items ---------------- */
function minutesBetween(hhmmA, hhmmB) {
  const [h1, m1] = hhmmA.split(":").map(Number);
  const [h2, m2] = hhmmB.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60; // assume it rolls past midnight rather than going backward
  return diff;
}

function fmtDuration(mins) {
  if (mins < 1) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Driving gap between consecutive stops — distance/duration stored on the next item.
function travelSegment(prevItem, nextItem) {
  let km = nextItem.distanceKm != null && nextItem.distanceKm !== "" ? Number(nextItem.distanceKm) : null;
  let mins = nextItem.durationMin != null && nextItem.durationMin !== "" ? Number(nextItem.durationMin) : null;
  if (km != null && Number.isNaN(km)) km = null;
  if (mins != null && Number.isNaN(mins)) mins = null;

  if (mins == null) {
    const leave = prevItem.leave || itemArrive(prevItem);
    const arrive = itemArrive(nextItem);
    if (leave && arrive) mins = minutesBetween(leave, arrive);
  }

  if (mins == null && km == null) return null;
  return { mins, km };
}

function connectorLi(segment, nextItem) {
  const li = document.createElement("li");
  li.className = "connector";
  if (nextItem?.flightLeg) {
    li.innerHTML = `<span class="connector-line"></span><span class="connector-duration">✈️ flight leg</span><span class="connector-line"></span>`;
  } else if (segment) {
    const parts = [];
    if (segment.mins != null) parts.push(`~${fmtDuration(segment.mins)}`);
    if (segment.km != null) parts.push(`${fmtNumStr(segment.km)} km`);
    li.innerHTML = `<span class="connector-line"></span><span class="connector-duration">🚗 ${parts.join(" · ")}</span><span class="connector-line"></span>`;
  } else {
    li.innerHTML = `<span class="connector-line"></span><span class="connector-duration muted">🚗 add map links on both stops to estimate drive</span><span class="connector-line"></span>`;
  }
  return li;
}

// Renders a list of items into `container`, inserting a dashed connector
// (with computed travel duration/distance) between each consecutive pair.
function appendItemsWithConnectors(container, dayId, listName, items, optsFn) {
  items.forEach((item, i) => {
    const extraOpts = optsFn ? optsFn(item, i) : {};
    container.appendChild(activityRow(dayId, listName, item, { ...extraOpts, index: i, len: items.length }));
    if (i < items.length - 1) {
      container.appendChild(connectorLi(travelSegment(item, items[i + 1]), items[i + 1]));
    }
  });
}

function totalKmForItems(items) {
  const total = items.reduce((sum, it) => sum + (typeof it.distanceKm === "number" ? it.distanceKm : 0), 0);
  return total > 0 ? fmtNum(total) : null;
}

/** Activities + stops in list order — the day's driving route. */
function dayRouteItems(day) {
  return [...(day.activities || []), ...(day.stops || [])];
}

function itemCoords(item) {
  if (typeof item.lat === "number" && typeof item.lon === "number") {
    return { lat: item.lat, lon: item.lon };
  }
  return null;
}

/** Google Maps directions URL from resolved coordinate points. */
function googleMapsUrlFromPoints(points) {
  if (!points.length) return null;
  if (points.length === 1) {
    const p = points[0];
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  }
  const path = points.map((p) => `${p.lat},${p.lon}`).join("/");
  return `https://www.google.com/maps/dir/${path}/data=!4m2!4m1!3e0`;
}

function updateDirectionsLink(link, points, totalItems) {
  const url = googleMapsUrlFromPoints(points);
  if (!url) {
    link.removeAttribute("href");
    link.textContent = "🗺️ Add map links to get directions";
    link.title = "";
    return;
  }
  link.href = url;
  if (points.length >= 2) {
    link.textContent = `🗺️ Google Maps directions (${points.length} stops)`;
    link.title = points.length < totalItems
      ? `${totalItems - points.length} stop(s) could not be located`
      : "";
  } else {
    link.textContent = "🗺️ Open in Google Maps";
    link.title = points.length < totalItems
      ? `${totalItems - points.length} stop(s) could not be located`
      : "";
  }
}

/** Directions button — resolves missing map pins from map links, then updates the URL. */
function appendDayDirectionsLink(container, day) {
  const items = dayRouteItems(day);
  const hasAnyMap = items.some((i) => i.mapLink || i.text);
  if (!hasAnyMap) return;

  const link = document.createElement("a");
  link.className = "day-directions-btn";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const initial = items.map(itemCoords).filter(Boolean);
  updateDirectionsLink(link, initial, items.length);
  if (!link.href) link.textContent = "🗺️ Loading directions…";
  container.appendChild(link);

  if (initial.length === items.length || typeof Routing === "undefined") return;

  const trip = Store.getTrip();
  Routing.hydrateDayRouteCoords(day, trip).then(({ points, changed }) => {
    updateDirectionsLink(link, points, items.length);
    if (changed) Store.onCoordsChanged(day.id);
  }).catch(() => {
    updateDirectionsLink(link, initial, items.length);
  });
}

function hotelCard(dayId, hotel) {
  const div = document.createElement("div");
  div.className = "hotel-card";
  const statusClass = hotel.confirmed ? "confirmed" : "pending";
  const statusLabel = hotel.confirmed ? "✅ Booked" : "⏳ Pending";
  div.innerHTML = `
    <div class="hotel-top">
      <div>
        <div class="hotel-name">${hotel.name}</div>
        <div class="hotel-meta">${hotel.city || ""}${hotel.rooms ? " · " + hotel.rooms : ""}</div>
      </div>
      <span class="status ${statusClass}">${statusLabel}</span>
      <button class="item-edit-btn">✏️</button>
    </div>
    ${hotel.link ? `<a href="${hotel.link}" target="_blank" rel="noopener noreferrer" class="hotel-link-btn">View booking →</a>` : ""}
  `;
  div.querySelector(".item-edit-btn").addEventListener("click", () => openHotelModal(dayId, hotel));
  return div;
}

/* ---------------- Countdown / hero ---------------- */
function renderCountdown() {
  const trip = Store.getTrip();
  const today = todayStr();
  const el = document.getElementById("countdown");

  if (today < trip.startDate) {
    const d = daysBetween(today, trip.startDate);
    el.innerHTML = `
      <div class="chip"><span class="num">${d}</span><span class="lbl">day${d === 1 ? "" : "s"} to go</span></div>
      <div class="chip"><span class="num">${trip.travelers}</span><span class="lbl">travelers</span></div>
      <div class="chip"><span class="num">${trip.days.length}</span><span class="lbl">days trip</span></div>
    `;
  } else if (today >= trip.startDate && today <= trip.endDate) {
    const dayIndex = trip.days.findIndex((d) => d.date === today);
    el.innerHTML = `<div class="banner-text">🎉 You're on the trip! Day ${dayIndex + 1} of ${trip.days.length}</div>`;
  } else {
    el.innerHTML = `<div class="banner-text">✅ Trip complete — hope it was amazing!</div>`;
  }
}

/* ---------------- Weather (shared cache per render pass) ---------------- */
async function fetchDayWeather(day) {
  if (!day.place || !TRIP_DEFAULTS.places[day.place]) return null;
  const place = TRIP_DEFAULTS.places[day.place];
  try {
    return await Weather.getForDate(day.place, place, day.date);
  } catch {
    return null;
  }
}

/* ---------------- List view (Itinerary tab) ---------------- */
function buildDayCard(day, index, today) {
  const tpl = document.getElementById("day-card-template");
  const node = tpl.content.cloneNode(true);
  const card = node.querySelector(".day-card");
  card.dataset.dayId = day.id;

  if (day.date === today) card.classList.add("today");
  if (day.date < today) card.classList.add("past");

  const emojiEl = node.querySelector(".day-emoji");
  emojiEl.textContent = day.emoji;
  emojiEl.contentEditable = editMode;
  emojiEl.addEventListener("blur", () => Store.updateDayField(day.id, "emoji", emojiEl.textContent.trim()));

  node.querySelector(".day-date").textContent = fmtDateShort(day.date);

  const headingEl = node.querySelector(".day-heading");
  headingEl.textContent = day.headline;
  headingEl.contentEditable = editMode;
  headingEl.addEventListener("blur", () => Store.updateDayField(day.id, "headline", headingEl.textContent.trim()));

  const routeLine = node.querySelector(".route-line");
  routeLine.innerHTML = `
    <div>📍 <span class="re" contenteditable="${editMode}" data-f="from">${day.from}</span> <span style="opacity:.5">→</span> <span class="re" contenteditable="${editMode}" data-f="to">${day.to}</span></div>
    <div class="travel-time" contenteditable="${editMode}" data-f="travelTime">${day.travelTime || ""}</div>
  `;
  routeLine.querySelectorAll("[data-f]").forEach((el) => {
    el.addEventListener("blur", () => Store.updateDayField(day.id, el.dataset.f, el.textContent.trim()));
  });
  appendDayDirectionsLink(routeLine, day);

  const photoBtn = node.querySelector(".photo-upload-btn");
  if (PHOTO_ALBUM_URL) {
    photoBtn.href = PHOTO_ALBUM_URL;
  } else {
    photoBtn.classList.add("hidden");
  }

  const actKm = totalKmForItems(day.activities);
  if (actKm != null) {
    node.querySelector(".section h4").insertAdjacentHTML("beforeend", ` <span class="header-km">· ${actKm} km total</span>`);
  }
  const actList = node.querySelector(".activity-list");
  appendItemsWithConnectors(actList, day.id, "activities", day.activities);

  const iftSection = node.querySelector(".if-time-section");
  if (day.ifTimePermits.length || editMode) {
    iftSection.classList.remove("hidden");
    const list = iftSection.querySelector(".activity-list");
    appendItemsWithConnectors(list, day.id, "ifTimePermits", day.ifTimePermits);
  }

  const stopsSection = node.querySelector(".stops-section");
  if ((day.stops && day.stops.length) || editMode) {
    stopsSection.classList.remove("hidden");
    const list = stopsSection.querySelector(".activity-list");
    appendItemsWithConnectors(list, day.id, "stops", day.stops || []);
  }

  const hotelSection = node.querySelector(".hotel-section");
  if (day.hotels.length || editMode) {
    hotelSection.classList.remove("hidden");
    const list = hotelSection.querySelector(".hotel-list");
    day.hotels.forEach((h) => list.appendChild(hotelCard(day.id, h)));
  }

  node.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const listName = btn.dataset.list;
      if (listName === "hotels") openHotelModal(day.id, null);
      else openItemModal(day.id, listName, null);
    });
  });

  const notesInput = node.querySelector(".notes-input");
  notesInput.value = day.notes || "";
  notesInput.addEventListener("input", () => Store.updateDayField(day.id, "notes", notesInput.value));

  const weatherEl = node.querySelector(".day-weather");
  weatherEl.innerHTML = `<span class="wemoji">…</span>`;

  const header = node.querySelector(".day-card-header");
  header.addEventListener("click", (e) => {
    if (editMode && e.target.isContentEditable) return;
    card.classList.toggle("open");
  });

  if (day.date === today || Store.getUiState().openDay === day.id) card.classList.add("open");

  return { card, weatherEl };
}

async function renderDayList() {
  const trip = Store.getTrip();
  const container = document.getElementById("day-list");
  container.innerHTML = "";
  const today = todayStr();

  const built = [];
  trip.days.forEach((day, i) => {
    const { card, weatherEl } = buildDayCard(day, i, today);
    container.appendChild(card);
    built.push({ day, weatherEl });
  });

  built.forEach(async ({ day, weatherEl }) => {
    const w = await fetchDayWeather(day);
    if (!w) { weatherEl.innerHTML = ""; return; }
    weatherEl.innerHTML = `<span class="wemoji">${w.emoji}</span> ${fmtNumStr(w.high)}°/${fmtNumStr(w.low)}°`;
    weatherEl.title = `${w.label} · Rain chances ${fmtNumStr(w.precipChance)}% · source: ${w.source}`;
  });

  document.getElementById("add-day-btn").onclick = openAddDayModal;
}

/* ---------------- Day Swipe View ---------------- */
let dayViewIndex = 0;

function computeTimeAwareness(day, isToday) {
  if (!isToday) return { pastMap: {}, upNextId: null };
  const now = nowHHMM();
  const timed = day.activities.filter((a) => itemArrive(a)).sort((a, b) => itemArrive(a).localeCompare(itemArrive(b)));
  const pastMap = {};
  let upNextId = null;
  for (const a of timed) {
    if (itemArrive(a) < now) pastMap[a.id] = true;
    else if (upNextId === null) upNextId = a.id;
  }
  return { pastMap, upNextId };
}

function buildDayPanel(day, index, today) {
  const panel = document.createElement("div");
  panel.className = "day-panel";
  panel.dataset.dayId = day.id;

  const isToday = day.date === today;
  const g = greeting();

  const card = document.createElement("div");
  card.className = "day-panel-card";

  const photo = document.createElement("div");
  photo.className = "day-panel-photo";
  if (day.photo) photo.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.15)), url('${day.photo}')`;
  else photo.style.background = "linear-gradient(135deg, #1b3a4b, #2fa88c)";
  photo.innerHTML = `
    <div class="day-panel-photo-content">
      <div class="day-panel-greeting">${isToday ? `${g.emoji} ${g.text}` : fmtDateShort(day.date)}</div>
      <div class="day-panel-title">${day.emoji} ${day.headline}</div>
      <div class="day-panel-sub">📍 ${day.from} → ${day.to}</div>
      ${day.travelTime ? `<div class="day-panel-travel">${day.travelTime}</div>` : ""}
    </div>
  `;
  card.appendChild(photo);

  const body = document.createElement("div");
  body.className = "day-panel-body";

  const weatherRow = document.createElement("div");
  weatherRow.className = "day-panel-weather";
  weatherRow.innerHTML = `<span class="wemoji">…</span> <span class="wtext">Loading forecast…</span>`;
  body.appendChild(weatherRow);

  appendDayDirectionsLink(body, day);

  const { pastMap, upNextId } = computeTimeAwareness(day, isToday);

  function plainHeader(text, kmTotal) {
    const h = document.createElement("h4");
    h.innerHTML = kmTotal != null ? `${text} <span class="header-km">· ${kmTotal} km total</span>` : text;
    h.style.margin = "0 0 8px";
    h.style.fontSize = "0.72rem";
    h.style.textTransform = "uppercase";
    h.style.letterSpacing = "0.06em";
    h.style.color = "var(--text-muted)";
    return h;
  }

  const actHeader = document.createElement("div");
  actHeader.className = "section-head";
  const actHeaderLeft = document.createElement("div");
  actHeaderLeft.className = "section-head-left";
  actHeaderLeft.appendChild(plainHeader("Today's plan", totalKmForItems(day.activities)));
  const editToggleBtn = document.createElement("button");
  editToggleBtn.className = "edit-toggle-inline" + (editMode ? " active" : "");
  editToggleBtn.title = "Edit itinerary";
  editToggleBtn.textContent = "✏️";
  editToggleBtn.addEventListener("click", () => setEditMode(!editMode));
  actHeaderLeft.appendChild(editToggleBtn);
  actHeader.appendChild(actHeaderLeft);
  const addActBtn = document.createElement("button");
  addActBtn.className = "add-btn";
  addActBtn.textContent = "＋";
  addActBtn.addEventListener("click", () => openItemModal(day.id, "activities", null));
  actHeader.appendChild(addActBtn);
  body.appendChild(actHeader);

  const list = document.createElement("ul");
  list.className = "activity-list";
  list.style.marginBottom = "14px";
  appendItemsWithConnectors(list, day.id, "activities", day.activities, (a) => ({ pastTime: pastMap[a.id], upNext: a.id === upNextId }));
  body.appendChild(list);

  function optionalListSection(title, listName, items, canCheckOverride) {
    if (!items.length && !editMode) return;
    const header = document.createElement("div");
    header.className = "section-head";
    header.appendChild(plainHeader(title));
    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.textContent = "＋";
    addBtn.addEventListener("click", () => openItemModal(day.id, listName, null));
    header.appendChild(addBtn);
    body.appendChild(header);

    const ul = document.createElement("ul");
    ul.className = "activity-list" + (listName === "ifTimePermits" ? " muted" : "");
    ul.style.marginBottom = "14px";
    appendItemsWithConnectors(ul, day.id, listName, items);
    body.appendChild(ul);
  }

  optionalListSection("If time permits", "ifTimePermits", day.ifTimePermits);
  optionalListSection("Stops along the way", "stops", day.stops || []);

  if (day.hotels.length) {
    body.appendChild(plainHeader("Staying at"));
    const hlist = document.createElement("div");
    hlist.className = "hotel-list";
    hlist.style.marginBottom = "14px";
    day.hotels.forEach((h) => hlist.appendChild(hotelCard(day.id, h)));
    body.appendChild(hlist);
  }

  if (PHOTO_ALBUM_URL) {
    const photoBtn = document.createElement("a");
    photoBtn.className = "photo-upload-btn";
    photoBtn.textContent = "📸 Add photos from today";
    photoBtn.href = PHOTO_ALBUM_URL;
    photoBtn.target = "_blank";
    photoBtn.rel = "noopener";
    photoBtn.style.marginBottom = "0";
    body.appendChild(photoBtn);
  }

  card.appendChild(body);
  panel.appendChild(card);

  return { panel, weatherRow, day };
}

function renderDayView(scrollTo = true) {
  const trip = Store.getTrip();
  const today = todayStr();
  const swipe = document.getElementById("day-swipe");
  const dotsEl = document.getElementById("day-dots");
  swipe.innerHTML = "";
  dotsEl.innerHTML = "";

  let defaultIndex = trip.days.findIndex((d) => d.date === today);
  if (defaultIndex === -1) defaultIndex = today < trip.days[0].date ? 0 : trip.days.length - 1;
  if (dayViewIndex >= trip.days.length) dayViewIndex = defaultIndex;
  if (!scrollTo) defaultIndex = dayViewIndex;

  const panels = [];
  trip.days.forEach((day, i) => {
    const { panel, weatherRow } = buildDayPanel(day, i, today);
    swipe.appendChild(panel);
    panels.push({ day, weatherRow });

    const dot = document.createElement("div");
    dot.className = "dot" + (i === defaultIndex ? " active" : "");
    dot.addEventListener("click", () => goToDay(i));
    dotsEl.appendChild(dot);
  });

  panels.forEach(async ({ day, weatherRow }) => {
    const w = await fetchDayWeather(day);
    if (!w) { weatherRow.innerHTML = ""; return; }
    weatherRow.innerHTML = `
      <span class="wemoji">${w.emoji}</span>
      <div class="wtext-wrap">
        <div class="wtext">${w.label} · ${fmtNumStr(w.high)}°/${fmtNumStr(w.low)}°</div>
        <div class="wsub">Rain chances ${fmtNumStr(w.precipChance)}%</div>
      </div>
      <span class="wsource">${w.source}</span>`;
  });

  dayViewIndex = defaultIndex;
  // Rebuilding the panel list above always resets scrollLeft to 0, regardless of
  // `scrollTo` — so we always need to re-place it at the current day, instantly
  // (no animation): `scrollTo` only decides *which* day that is (today vs. wherever
  // the user already was), not whether repositioning happens at all.
  requestAnimationFrame(() => {
    const target = swipe.children[defaultIndex];
    if (target) {
      swipe.style.scrollSnapType = "none";
      swipe.style.scrollBehavior = "auto";
      swipe.scrollLeft = target.offsetLeft - 14;
      swipe.style.scrollBehavior = "";
      swipe.style.scrollSnapType = "";
    }
  });

  swipe.onscroll = () => {
    const idx = Math.round(swipe.scrollLeft / swipe.clientWidth);
    if (idx !== dayViewIndex && idx >= 0 && idx < trip.days.length) {
      dayViewIndex = idx;
      updateDots();
    }
  };

  function updateDots() {
    [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === dayViewIndex));
  }

  document.getElementById("day-prev").onclick = () => goToDay(Math.max(0, dayViewIndex - 1));
  document.getElementById("day-next").onclick = () => goToDay(Math.min(trip.days.length - 1, dayViewIndex + 1));

  function goToDay(i) {
    dayViewIndex = i;
    const target = swipe.children[i];
    if (target) {
      // Scroll only the horizontal container itself (not scrollIntoView, which
      // can also nudge the page's vertical scroll for tall panels). Scroll-snap
      // can otherwise fight a smooth-scroll write and snap straight back to the
      // old position, so briefly turn snapping off while we set the position.
      swipe.style.scrollSnapType = "none";
      swipe.scrollLeft = target.offsetLeft - 14;
      requestAnimationFrame(() => { swipe.style.scrollSnapType = ""; });
    }
    updateDots();
  }
}

/* ---------------- Overview tab ---------------- */
function renderOverview() {
  const trip = Store.getTrip();
  const container = document.getElementById("overview-content");
  const confirmedHotels = trip.days.flatMap((d) => d.hotels || []).filter((h) => h.confirmed);
  const pendingHotels = trip.days.flatMap((d) => d.hotels || []).filter((h) => !h.confirmed);

  container.innerHTML = `
    <div class="info-card">
      <h3>🧭 Trip at a glance</h3>
      <div class="stat-row"><span>Dates</span><span class="v">${fmtDateLong(trip.startDate)} – ${fmtDateLong(trip.endDate)}</span></div>
      <div class="stat-row"><span>Duration</span><span class="v">${trip.days.length} days</span></div>
      <div class="stat-row"><span>Travelers</span><span class="v">${trip.travelers} adults</span></div>
      <div class="stat-row"><span>Route</span><span class="v">Calgary → Banff → Jasper → Calgary</span></div>
    </div>
    <div class="info-card">
      <h3>🏨 Hotel status</h3>
      <div class="stat-row"><span>✅ Confirmed</span><span class="v">${confirmedHotels.length}</span></div>
      <div class="stat-row"><span>⏳ Pending decision</span><span class="v">${pendingHotels.length}</span></div>
    </div>
    ${PHOTO_ALBUM_URL ? `<div class="info-card">
      <h3>📸 Trip photo album</h3>
      <div style="font-size:0.88rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">
        Snap a shot after an activity or while switching cars? Add it straight to the shared album.
      </div>
      <a class="photo-upload-btn" style="margin-bottom:0;" href="${PHOTO_ALBUM_URL}" target="_blank" rel="noopener">📸 Open photo album</a>
    </div>` : ""}
    <div class="info-card">
      <h3>🌦️ About the weather</h3>
      <div style="font-size:0.88rem; color:var(--text-muted); line-height:1.5;">
        Live forecasts load automatically for each day once it's within ~16 days out.
        Until then you'll see September seasonal averages for the Rockies as a placeholder.
        Once fetched, forecasts are cached on your phone so they still show offline.
      </div>
    </div>
  `;
}


/* ---------------- Packing tab ---------------- */
function renderPacking() {
  const trip = Store.getTrip();
  const container = document.getElementById("packing-content");
  container.innerHTML = "";

  trip.packing.forEach((cat) => {
    const packed = cat.items.filter((i) => i.packed).length;
    const div = document.createElement("div");
    div.className = "packing-category";
    div.innerHTML = `
      <h3>${cat.category}</h3>
      <div class="packing-progress">${packed} / ${cat.items.length} packed</div>
    `;
    cat.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "packing-item" + (item.packed ? " packed" : "");
      row.innerHTML = `<input type="checkbox" ${item.packed ? "checked" : ""}/><span>${item.text}</span><button class="remove-btn">✕</button>`;
      row.querySelector("input").addEventListener("change", () => { Store.togglePackingItem(cat.id, item.id); renderPacking(); });
      row.querySelector(".remove-btn").addEventListener("click", () => { Store.removePackingItem(cat.id, item.id); renderPacking(); });
      div.appendChild(row);
    });
    const addRow = document.createElement("div");
    addRow.className = "packing-add-row";
    addRow.innerHTML = `<input type="text" placeholder="Add item…"/><button>Add</button>`;
    const input = addRow.querySelector("input");
    const commit = () => {
      if (input.value.trim()) { Store.addPackingItem(cat.id, input.value.trim()); renderPacking(); }
    };
    addRow.querySelector("button").addEventListener("click", commit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
    div.appendChild(addRow);
    container.appendChild(div);
  });

  const addCatRow = document.createElement("div");
  addCatRow.className = "packing-add-row";
  addCatRow.innerHTML = `<input type="text" placeholder="New category (e.g. Kids' stuff)…"/><button>Add category</button>`;
  const catInput = addCatRow.querySelector("input");
  addCatRow.querySelector("button").addEventListener("click", () => {
    if (catInput.value.trim()) { Store.addPackingCategory(catInput.value.trim()); renderPacking(); }
  });
  container.appendChild(addCatRow);
}

/* ---------------- Journey map (visual, screenshot-friendly) ---------------- */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildRouteNodes(trip) {
  const nodes = [];
  trip.days.forEach((day, i) => {
    const last = nodes[nodes.length - 1];
    if (last && last.place === day.place) last.endDayIdx = i;
    else nodes.push({ place: day.place, startDayIdx: i, endDayIdx: i });
  });
  return nodes
    .filter((n) => TRIP_DEFAULTS.places[n.place])
    .map((n) => ({ ...n, ...TRIP_DEFAULTS.places[n.place] }));
}

let journeyOverrideNodeIndex = null;

function currentNodeIndex(nodes, trip) {
  if (journeyOverrideNodeIndex !== null) return journeyOverrideNodeIndex;
  const today = todayStr();
  if (today < trip.startDate) return -1; // before trip
  if (today > trip.endDate) return nodes.length; // after trip
  const dayIdx = trip.days.findIndex((d) => d.date === today);
  if (dayIdx === -1) return -1;
  const idx = nodes.findIndex((n) => dayIdx >= n.startDayIdx && dayIdx <= n.endDayIdx);
  return idx === -1 ? 0 : idx;
}

function nodePos(i, n) {
  const x = 34 + i * ((300 - 68) / Math.max(n - 1, 1));
  const y = 105 + 48 * Math.sin(i * 1.35);
  return { x, y };
}

function renderJourneyMap() {
  const trip = Store.getTrip();
  const nodes = buildRouteNodes(trip);
  const n = nodes.length;
  const idx = currentNodeIndex(nodes, trip);
  const wrap = document.getElementById("journey-map-wrap");
  if (!wrap) return;

  const points = nodes.map((node, i) => ({ ...node, ...nodePos(i, n) }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // mover position: clamp before/after trip to first/last node, offset slightly
  let moverX, moverY, moverEmoji, statusText;
  if (idx <= -1) {
    moverX = points[0].x - 18; moverY = points[0].y - 8;
    moverEmoji = "✈️";
    const d = daysBetween(todayStr(), trip.startDate);
    statusText = d > 0 ? `Wheels up in ${d} day${d === 1 ? "" : "s"}` : "Trip starting today!";
  } else if (idx >= n) {
    moverX = points[n - 1].x + 18; moverY = points[n - 1].y - 8;
    moverEmoji = "✅";
    statusText = "Trip complete — welcome home!";
  } else {
    const p = points[idx];
    moverX = p.x; moverY = p.y;
    moverEmoji = idx === 0 || idx === n - 1 ? "✈️" : "🚗";
    statusText = `You're in ${p.name} — ${trip.days[p.startDayIdx].headline}`;
  }

  const pins = points
    .map((p, i) => {
      const visited = idx > i || idx >= n;
      const isCurrent = i === idx;
      const dateLabel = p.startDayIdx === p.endDayIdx
        ? fmtDateShort(trip.days[p.startDayIdx].date).replace(/^\w+, /, "")
        : `${fmtDateShort(trip.days[p.startDayIdx].date).replace(/^\w+, /, "")}–${fmtDateShort(trip.days[p.endDayIdx].date).split(" ").pop()}`;
      return `
        <g class="jm-pin ${visited ? "visited" : ""} ${isCurrent ? "current" : ""}">
          <circle cx="${p.x}" cy="${p.y}" r="${isCurrent ? 10 : 7}" />
          <text x="${p.x}" y="${p.y + 4}" class="jm-pin-emoji" font-size="${isCurrent ? 11 : 8}">${p.emoji}</text>
          <text x="${p.x}" y="${p.y + 22}" class="jm-pin-label">${p.name}</text>
          <text x="${p.x}" y="${p.y + 32}" class="jm-pin-date">${dateLabel}</text>
        </g>`;
    })
    .join("");

  wrap.innerHTML = `
    <div class="journey-map">
      <div class="journey-map-caption">🚗 Road Trip Progress</div>
      <svg viewBox="0 0 320 210" class="journey-svg">
        <polygon class="jm-mountain jm-mountain-1" points="0,150 40,90 80,150" />
        <polygon class="jm-mountain jm-mountain-2" points="60,150 110,70 170,150" />
        <polygon class="jm-mountain jm-mountain-3" points="150,150 200,95 250,150" />
        <polygon class="jm-mountain jm-mountain-1" points="230,150 275,85 320,150" />
        <path d="${pathD}" class="jm-road" />
        ${pins}
        <g class="jm-mover" style="transform: translate(${moverX}px, ${moverY}px)">
          <circle r="13" class="jm-mover-glow" />
          <text y="6" text-anchor="middle" font-size="15">${moverEmoji}</text>
        </g>
      </svg>
      <div class="journey-status">${statusText}</div>
      <div class="journey-actions">
        <button id="journey-locate-btn" class="journey-btn">📍 Use my location</button>
        <span class="journey-hint">Screenshot this for your story!</span>
      </div>
    </div>
  `;

  document.getElementById("journey-locate-btn").addEventListener("click", () => {
    const btn = document.getElementById("journey-locate-btn");
    if (!navigator.geolocation) { btn.textContent = "Location not supported"; return; }
    btn.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let bestIdx = 0, bestDist = Infinity;
        nodes.forEach((node, i) => {
          const d = haversineKm(latitude, longitude, node.lat, node.lon);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        });
        journeyOverrideNodeIndex = bestIdx;
        renderJourneyMap();
      },
      () => { btn.textContent = "📍 Use my location"; alert("Couldn't get your location — check location permissions."); },
      { timeout: 8000 }
    );
  });
}

/* ---------------- Map tab ---------------- */
let leafletMapInstance = null;
let leafletMapLatLngs = [];

function refitSatelliteMap() {
  // The map tab may be display:none when it's (re)rendered, so Leaflet computes
  // a 0×0 container and picks a bogus zoom. Re-fit whenever the tab actually becomes visible.
  if (!leafletMapInstance || !leafletMapLatLngs.length) return;
  leafletMapInstance.invalidateSize();
  leafletMapInstance.fitBounds(leafletMapLatLngs, { padding: [30, 30] });
}

function renderSatelliteMap(stops) {
  const el = document.getElementById("satellite-map");
  if (!el || typeof L === "undefined") return;

  if (leafletMapInstance) {
    leafletMapInstance.remove();
    leafletMapInstance = null;
  }

  const map = L.map(el, { scrollWheelZoom: false });
  leafletMapInstance = map;

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  }).addTo(map);

  const latlngs = stops.map((s) => [s.lat, s.lon]);
  leafletMapLatLngs = latlngs;
  L.polyline(latlngs, { color: "#ffd166", weight: 3, dashArray: "6 6" }).addTo(map);

  stops.forEach((s) => {
    L.marker([s.lat, s.lon])
      .addTo(map)
      .bindPopup(`<b>${s.emoji} ${s.name}</b><br>${s.headline}<br>${fmtDateShort(s.date)}`);
  });

  if (latlngs.length) map.fitBounds(latlngs, { padding: [30, 30] });

  // Re-fit once more shortly after in case the container was hidden at init time
  setTimeout(refitSatelliteMap, 200);
}

function renderMap() {
  const trip = Store.getTrip();
  const container = document.getElementById("map-content");
  const seen = new Set();
  const stops = [];
  trip.days.forEach((day) => {
    const place = TRIP_DEFAULTS.places[day.place];
    if (place && !seen.has(day.place + day.date)) {
      seen.add(day.place + day.date);
      stops.push({ ...place, date: day.date, headline: day.headline, emoji: day.emoji });
    }
  });

  container.innerHTML = `
    <div id="journey-map-wrap"></div>
    <div class="info-card" style="margin-bottom:14px; padding:0; overflow:hidden;">
      <div id="satellite-map" class="satellite-map"></div>
      <div style="font-size:0.78rem; color:var(--text-muted); padding:10px 14px;">
        🛰️ Satellite view (Esri World Imagery) — needs a connection to load tiles; pinch to zoom, drag to pan.
      </div>
    </div>
    <div class="map-route">
      ${stops
        .map(
          (s) => `
        <div class="map-stop">
          <div class="map-line"></div>
          <div class="map-pin">${s.emoji}</div>
          <div class="map-stop-content">
            <div class="map-stop-name">${s.name} — ${s.headline}</div>
            <div class="map-stop-date">${fmtDateShort(s.date)}</div>
            <div class="map-links">
              <a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}" target="_blank" rel="noopener">Google Maps</a>
              <a href="https://maps.apple.com/?q=${encodeURIComponent(s.name)}&ll=${s.lat},${s.lon}" target="_blank" rel="noopener">Apple Maps</a>
            </div>
          </div>
        </div>`
        )
        .join("")}
    </div>
  `;

  renderJourneyMap();
  renderSatelliteMap(stops);
}

/* ---------------- Tabs ---------------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
      document.getElementById(`view-${btn.dataset.tab}`).classList.remove("hidden");
      if (btn.dataset.tab === "day") renderDayView(true);
      if (btn.dataset.tab === "map") setTimeout(refitSatelliteMap, 50);
    });
  });
}

/* ---------------- Offline banner ---------------- */
function setupOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ---------------- PWA install prompt ---------------- */
function setupInstallPrompt() {
  let deferredPrompt;
  const toast = document.getElementById("install-toast");
  const dismissedKey = "banff_install_dismissed";

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem(dismissedKey)) toast.classList.remove("hidden");
  });

  document.getElementById("install-btn").addEventListener("click", async () => {
    toast.classList.add("hidden");
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });

  document.getElementById("install-dismiss").addEventListener("click", () => {
    toast.classList.add("hidden");
    localStorage.setItem(dismissedKey, "1");
  });
}

/* ---------------- Service worker ---------------- */
function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // When a new service worker takes over (a fresh deploy was picked up),
  // reload once so the tab actually shows the new version instead of
  // silently staying on stale cached JS/CSS forever.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=29").then((reg) => {
      // Proactively check for a newer service-worker.js instead of waiting
      // for the browser's own (sometimes lazy) update check.
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(console.error);
  });
}

/* ---------------- Render everything ---------------- */
function renderAll() {
  renderCountdown();
  renderDayList();
  renderOverview();
  renderPacking();
  renderMap();
  renderDayView(false);
}

/* ---------------- Init ---------------- */
function init() {
  document.body.classList.toggle("edit-mode", editMode);
  Store.onChange(() => renderAll());
  renderAll();
  renderDayView(true);
  setupTabs();
  setupOfflineBanner();
  setupSyncBanner();
  setupInstallPrompt();
  setupServiceWorker();

  Store.init().then(() => renderAll());
}

function setupSyncBanner() {
  const banner = document.getElementById("sync-banner");
  if (!banner || typeof Sync === "undefined") return;

  Sync.onStatus((status) => {
    if (!navigator.onLine || status === "offline") {
      banner.textContent = "📡 Offline — edits saved on this device, will sync when back online";
      banner.classList.remove("hidden");
      return;
    }
    if (status === "syncing") {
      banner.textContent = "☁️ Saving to server…";
      banner.classList.remove("hidden");
      return;
    }
    if (status === "error") {
      banner.textContent = "⚠️ Couldn't reach server — edits kept on this device";
      banner.classList.remove("hidden");
      return;
    }
    if (status === "saved") {
      banner.textContent = "✓ Saved to server";
      banner.classList.remove("hidden");
      clearTimeout(setupSyncBanner._hideTimer);
      setupSyncBanner._hideTimer = setTimeout(() => banner.classList.add("hidden"), 2500);
      return;
    }
    banner.classList.add("hidden");
  });
}

document.addEventListener("DOMContentLoaded", init);
