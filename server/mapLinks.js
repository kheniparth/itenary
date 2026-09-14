/* Parse and resolve Google Maps share links → { lat, lon }. */

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordsFromText(text) {
  if (!text || typeof text !== "string") return null;
  const dec = decodeURIComponent(text);

  let m = dec.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2] };

  m = dec.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2] };

  m = dec.match(/[?&](?:query|q)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2] };

  m = dec.match(/[?&]ll=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2] };

  m = dec.match(/[?&]center=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2] };

  m = dec.match(/!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2] };

  return null;
}

const UA = "Mozilla/5.0 (compatible; BanffTrip/1.0)";

function nameMatchesQuery(featureName, text) {
  const n = (featureName || "").toLowerCase();
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return words.length > 0 && words.every((w) => n.includes(w));
}

/** Name search biased toward the day's region (fixes wrong Google place pins). */
async function geocodeNear(text, placeName, nearLat, nearLon) {
  if (!text || nearLat == null || nearLon == null) return null;
  const q = placeName ? `${text}, ${placeName}` : text;
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${nearLat}&lon=${nearLon}&limit=8`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.features?.length) return null;

    let best = null;
    let bestDist = Infinity;
    for (const f of data.features) {
      const name = f.properties?.name;
      if (!nameMatchesQuery(name, text)) continue;
      const [lon, lat] = f.geometry.coordinates;
      const d = haversineKm(nearLat, nearLon, lat, lon);
      if (d < bestDist) {
        bestDist = d;
        best = { lat, lon };
      }
    }
    return bestDist < 250 ? best : null;
  } catch {
    return null;
  }
}

async function resolveMapLink(mapUrl) {
  if (!mapUrl || !/^https?:\/\//i.test(mapUrl)) return null;

  const direct = parseCoordsFromText(mapUrl);
  if (direct) return direct;

  try {
    const resp = await fetch(mapUrl, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
    const finalUrl = resp.url || mapUrl;
    let coords = parseCoordsFromText(finalUrl);
    if (coords) return coords;

    const html = await resp.text();
    coords = parseCoordsFromText(html);
    if (coords) return coords;

    const canon = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
    if (canon) {
      coords = parseCoordsFromText(canon[1]);
      if (coords) return coords;
    }
  } catch {
    /* fall through */
  }

  return null;
}

/**
 * Best coords for an activity: map link first, then name search if the pin
 * is implausibly far from the previous stop or the day's region.
 */
async function resolveItemCoords(item, { prev, placeName, nearLat, nearLon }) {
  if (!item.mapLink && !item.text) return null;

  let coords = item.mapLink ? await resolveMapLink(item.mapLink) : null;

  const anchor = prev?.lat != null ? { lat: prev.lat, lon: prev.lon } : { lat: nearLat, lon: nearLon };

  if (coords && anchor.lat != null) {
    const dist = haversineKm(anchor.lat, anchor.lon, coords.lat, coords.lon);
    if (dist > 150 && item.text) {
      const fallback = await geocodeNear(item.text, placeName, anchor.lat, anchor.lon);
      if (fallback) {
        const fallbackDist = haversineKm(anchor.lat, anchor.lon, fallback.lat, fallback.lon);
        if (fallbackDist < dist) coords = fallback;
      }
    }
  } else if (!coords && item.text && anchor.lat != null) {
    coords = await geocodeNear(item.text, placeName, anchor.lat, anchor.lon);
  }

  return coords;
}

module.exports = { parseCoordsFromText, resolveMapLink, geocodeNear, resolveItemCoords, haversineKm };
