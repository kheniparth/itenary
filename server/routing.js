/* Server-side driving distance/duration between activity stops (OSRM). */

const { resolveItemCoords } = require("./mapLinks");

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const segmentCache = new Map();

function dayPlaceName(day, trip) {
  const key = day?.place;
  return key && trip?.places?.[key] ? trip.places[key].name : null;
}

function dayPlaceCoords(day, trip) {
  const key = day?.place;
  const p = key && trip?.places?.[key] ? trip.places[key] : null;
  return p ? { lat: p.lat, lon: p.lon } : null;
}

async function syncItemCoords(item, ctx) {
  const { prev, day, trip } = ctx;
  const region = dayPlaceCoords(day, trip) || {};
  const coords = await resolveItemCoords(item, {
    prev,
    placeName: dayPlaceName(day, trip),
    nearLat: region.lat,
    nearLon: region.lon,
  });

  if (coords) {
    item.lat = coords.lat;
    item.lon = coords.lon;
    return true;
  }
  delete item.lat;
  delete item.lon;
  return false;
}

function hasCoords(item) {
  return typeof item.lat === "number" && typeof item.lon === "number";
}

async function drivingSegment(from, to) {
  const key = `${from.lat},${from.lon}|${to.lat},${to.lon}`;
  if (segmentCache.has(key)) return segmentCache.get(key);

  const url = `${OSRM}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("OSRM unavailable");
  const data = await resp.json();
  if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("No route");

  const route = data.routes[0];
  const result = {
    km: Math.round((route.distance / 1000) * 100) / 100,
    mins: Math.round(route.duration / 60),
  };
  segmentCache.set(key, result);
  return result;
}

async function recalculateList(items, day, trip) {
  if (!items?.length) return false;
  let changed = false;

  for (let i = 0; i < items.length; i++) {
    const prev = i > 0 ? items[i - 1] : null;
    const before = items[i].lat;
    await syncItemCoords(items[i], { prev, day, trip });
    if (items[i].lat !== before) changed = true;
  }

  if (items[0]) {
    if (items[0].distanceKm != null) { delete items[0].distanceKm; changed = true; }
    if (items[0].durationMin != null) { delete items[0].durationMin; changed = true; }
    if (items[0].flightLeg) { delete items[0].flightLeg; changed = true; }
  }

  for (let i = 0; i < items.length - 1; i++) {
    const prev = items[i];
    const next = items[i + 1];

    if (!hasCoords(prev) || !hasCoords(next)) {
      if (next.distanceKm != null) { delete next.distanceKm; changed = true; }
      if (next.durationMin != null) { delete next.durationMin; changed = true; }
      if (next.flightLeg) { delete next.flightLeg; changed = true; }
      continue;
    }

    try {
      const seg = await drivingSegment(prev, next);
      if (seg.km > 500) {
        next.flightLeg = true;
        if (next.distanceKm != null) { delete next.distanceKm; changed = true; }
        if (next.durationMin != null) { delete next.durationMin; changed = true; }
      } else {
        if (next.flightLeg) { delete next.flightLeg; changed = true; }
        if (next.distanceKm !== seg.km) { next.distanceKm = seg.km; changed = true; }
        if (next.durationMin !== seg.mins) { next.durationMin = seg.mins; changed = true; }
      }
    } catch {
      if (next.distanceKm != null) { delete next.distanceKm; changed = true; }
      if (next.durationMin != null) { delete next.durationMin; changed = true; }
      if (next.flightLeg) { delete next.flightLeg; changed = true; }
    }
  }

  return changed;
}

async function recalculateTrip(trip) {
  if (!trip?.days) return false;
  let changed = false;
  for (const day of trip.days) {
    if (await recalculateList(day.activities, day, trip)) changed = true;
    if (await recalculateList(day.ifTimePermits, day, trip)) changed = true;
    if (await recalculateList(day.stops || [], day, trip)) changed = true;
  }
  return changed;
}

module.exports = { recalculateTrip };
