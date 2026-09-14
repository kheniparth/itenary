/* ============================================================
   ROUTING — driving distance/duration between activity stops.
   Coordinates from map links; wrong pins corrected via server
   geocoding using activity name + day region.
   ============================================================ */

const Routing = (() => {
  const OSRM = "https://router.project-osrm.org/route/v1/driving";
  const RESOLVE_API = "/api/resolve-map";
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

  async function resolveItemCoords(item, { prev, day, trip }) {
    if (!item.mapLink && !item.text) return null;

    const region = dayPlaceCoords(day, trip) || {};
    const params = new URLSearchParams();
    if (item.mapLink) params.set("url", item.mapLink);
    if (item.text) params.set("text", item.text);
    if (prev?.lat != null) {
      params.set("prevLat", String(prev.lat));
      params.set("prevLon", String(prev.lon));
    }
    const placeName = dayPlaceName(day, trip);
    if (placeName) params.set("placeName", placeName);
    if (region.lat != null) params.set("nearLat", String(region.lat));
    if (region.lon != null) params.set("nearLon", String(region.lon));

    try {
      const resp = await fetch(`${RESOLVE_API}?${params}`, { cache: "no-store" });
      if (resp.ok) return resp.json();
    } catch {
      /* fall through */
    }
    return null;
  }

  async function syncItemCoords(item, ctx) {
    if (!item.mapLink && !item.text) {
      delete item.lat;
      delete item.lon;
      return false;
    }
    const coords = await resolveItemCoords(item, ctx);
    if (coords) {
      item.lat = coords.lat;
      item.lon = coords.lon;
      return true;
    }
    delete item.lat;
    delete item.lon;
    return false;
  }

  function cacheKey(a, b) {
    return `${a.lat},${a.lon}|${b.lat},${b.lon}`;
  }

  async function drivingSegment(from, to) {
    const key = cacheKey(from, to);
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

  function hasCoords(item) {
    return typeof item.lat === "number" && typeof item.lon === "number";
  }

  async function recalculateList(items, day, trip) {
    if (!items?.length) return;

    for (let i = 0; i < items.length; i++) {
      const prev = i > 0 ? items[i - 1] : null;
      await syncItemCoords(items[i], { prev, day, trip });
    }

    if (items[0]) {
      delete items[0].distanceKm;
      delete items[0].durationMin;
      delete items[0].flightLeg;
    }

    for (let i = 0; i < items.length - 1; i++) {
      const prev = items[i];
      const next = items[i + 1];

      if (!hasCoords(prev) || !hasCoords(next)) {
        delete next.distanceKm;
        delete next.durationMin;
        delete next.flightLeg;
        continue;
      }

      try {
        const seg = await drivingSegment(prev, next);
        if (seg.km > 500) {
          next.flightLeg = true;
          delete next.distanceKm;
          delete next.durationMin;
        } else {
          delete next.flightLeg;
          next.distanceKm = seg.km;
          next.durationMin = seg.mins;
        }
      } catch {
        delete next.distanceKm;
        delete next.durationMin;
        delete next.flightLeg;
      }
    }
  }

  async function recalculateDay(day, trip) {
    if (!day) return;
    await recalculateList(day.activities, day, trip);
    await recalculateList(day.ifTimePermits, day, trip);
    await recalculateList(day.stops || [], day, trip);
  }

  async function recalculateDays(days, trip) {
    const unique = [...new Set(days.filter(Boolean))];
    for (const day of unique) await recalculateDay(day, trip);
  }

  async function recalculateTrip(trip) {
    for (const day of trip.days) await recalculateDay(day, trip);
  }

  async function hydrateDayRouteCoords(day, trip) {
    const items = [...(day.activities || []), ...(day.stops || [])];
    let changed = false;
    const points = [];
    let prev = null;

    for (const item of items) {
      if (!hasCoords(item) && (item.mapLink || item.text)) {
        if (await syncItemCoords(item, { prev, day, trip })) changed = true;
      }
      if (hasCoords(item)) {
        points.push({ lat: item.lat, lon: item.lon });
        prev = { lat: item.lat, lon: item.lon };
      }
    }
    return { points, changed };
  }

  return {
    resolveItemCoords,
    recalculateList,
    recalculateDay,
    recalculateDays,
    recalculateTrip,
    hydrateDayRouteCoords,
  };
})();
