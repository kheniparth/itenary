/* ============================================================
   WEATHER — Open-Meteo (no API key needed).
   Live forecast when the date is within ~16 days out.
   Falls back to September seasonal normals otherwise.
   Everything is cached in localStorage so it works offline
   after the first successful fetch.
   ============================================================ */

const Weather = (() => {
  const CACHE_KEY = "banff_weather_cache_v1";
  const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

  // Rough September Rockies climate normals as offline fallback (sample trip region)
  const SEASONAL_FALLBACK = { high: 17, low: 4, code: 2, precipChance: 30 };

  const WMO = {
    0: { label: "Clear sky", emoji: "☀️" },
    1: { label: "Mostly clear", emoji: "🌤️" },
    2: { label: "Partly cloudy", emoji: "⛅" },
    3: { label: "Overcast", emoji: "☁️" },
    45: { label: "Fog", emoji: "🌫️" },
    48: { label: "Rime fog", emoji: "🌫️" },
    51: { label: "Light drizzle", emoji: "🌦️" },
    53: { label: "Drizzle", emoji: "🌦️" },
    55: { label: "Heavy drizzle", emoji: "🌧️" },
    61: { label: "Light rain", emoji: "🌦️" },
    63: { label: "Rain", emoji: "🌧️" },
    65: { label: "Heavy rain", emoji: "🌧️" },
    71: { label: "Light snow", emoji: "🌨️" },
    73: { label: "Snow", emoji: "❄️" },
    75: { label: "Heavy snow", emoji: "❄️" },
    80: { label: "Rain showers", emoji: "🌦️" },
    81: { label: "Rain showers", emoji: "🌧️" },
    82: { label: "Violent showers", emoji: "⛈️" },
    95: { label: "Thunderstorm", emoji: "⛈️" },
    96: { label: "Thunderstorm + hail", emoji: "⛈️" },
    99: { label: "Thunderstorm + hail", emoji: "⛈️" },
  };

  function describeCode(code) {
    return WMO[code] || { label: "—", emoji: "🌡️" };
  }

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }

  async function fetchForPlace(placeKey, place) {
    const cache = loadCache();
    const cached = cache[placeKey];
    const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

    if (fresh) return cached;

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=America%2FEdmonton&forecast_days=16`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("bad response");
      const json = await res.json();

      const byDate = {};
      json.daily.time.forEach((date, i) => {
        byDate[date] = {
          high: Math.round(json.daily.temperature_2m_max[i]),
          low: Math.round(json.daily.temperature_2m_min[i]),
          code: json.daily.weather_code[i],
          precipChance: json.daily.precipitation_probability_max[i],
        };
      });

      const result = { fetchedAt: Date.now(), live: true, byDate };
      cache[placeKey] = result;
      saveCache(cache);
      return result;
    } catch (err) {
      // offline or API failure — return whatever we have cached, even if stale
      if (cached) return { ...cached, stale: true };
      return null;
    }
  }

  /**
   * Get weather for a specific date + place.
   * Returns { high, low, code, label, emoji, precipChance, source: 'live'|'cache'|'seasonal' }
   */
  async function getForDate(placeKey, place, dateStr) {
    const data = await fetchForPlace(placeKey, place);
    if (data && data.byDate && data.byDate[dateStr]) {
      const d = data.byDate[dateStr];
      const desc = describeCode(d.code);
      return {
        ...d,
        ...desc,
        source: data.stale ? "cache (stale)" : data.live ? "live" : "cache",
      };
    }
    // seasonal fallback
    const desc = describeCode(SEASONAL_FALLBACK.code);
    return { ...SEASONAL_FALLBACK, ...desc, source: "seasonal average" };
  }

  return { getForDate, describeCode };
})();
