#!/usr/bin/env node
/* Trip-data API + Google Maps link resolver + server-side routing. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { resolveItemCoords } = require("./mapLinks");
const { recalculateTrip } = require("./routing");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "trip.json");
const TMP_FILE = DATA_FILE + ".tmp";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readTripFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeTripFile(payload) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(TMP_FILE, json, "utf8");
  fs.renameSync(TMP_FILE, DATA_FILE);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function tripSavedAt(payload) {
  if (!payload) return "";
  return payload.savedAt || payload.trip?.savedAt || "";
}

async function saveTripPayload(payload, res) {
  if (!payload || typeof payload !== "object" || !payload.trip) {
    sendJson(res, 400, { error: "body must include trip" });
    return;
  }
  if (!payload.savedAt) payload.savedAt = new Date().toISOString();

  const existing = readTripFile();
  const existingAt = tripSavedAt(existing);
  if (existingAt && existingAt > payload.savedAt) {
    sendJson(res, 409, { error: "stale", savedAt: existingAt });
    return;
  }

  writeTripFile(payload);
  sendJson(res, 200, { ok: true, savedAt: payload.savedAt });
}

async function ensureRoutes(payload) {
  if (!payload?.trip) return payload;
  if (await recalculateTrip(payload.trip)) {
    payload.savedAt = new Date().toISOString();
    writeTripFile(payload);
  }
  return payload;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/resolve-map") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    const mapUrl = url.searchParams.get("url");
    const text = url.searchParams.get("text");
    const nearLat = url.searchParams.get("nearLat");
    const nearLon = url.searchParams.get("nearLon");
    const placeName = url.searchParams.get("placeName");

    if (!mapUrl && !text) {
      sendJson(res, 400, { error: "url or text query param required" });
      return;
    }

    const prevLat = url.searchParams.get("prevLat");
    const prevLon = url.searchParams.get("prevLon");
    const prev = prevLat && prevLon ? { lat: +prevLat, lon: +prevLon } : null;

    const coords = await resolveItemCoords(
      { mapLink: mapUrl || "", text: text || "" },
      {
        prev,
        placeName: placeName || null,
        nearLat: nearLat != null ? +nearLat : null,
        nearLon: nearLon != null ? +nearLon : null,
      }
    );

    if (!coords) {
      sendJson(res, 404, { error: "could not resolve coordinates" });
      return;
    }
    sendJson(res, 200, coords);
    return;
  }

  if (url.pathname === "/api/trip") {
    if (req.method === "GET") {
      const data = readTripFile();
      if (!data) {
        sendJson(res, 404, { error: "no saved trip yet" });
        return;
      }
      if (url.searchParams.get("recalc") === "1") {
        await ensureRoutes(data);
      }
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      try {
        const raw = await readBody(req);
        const payload = JSON.parse(raw);
        await saveTripPayload(payload, res);
      } catch (err) {
        sendJson(res, 400, { error: err.message || "invalid JSON" });
      }
      return;
    }

    sendJson(res, 405, { error: "method not allowed" });
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`itinerary-api listening on :${PORT}, data at ${DATA_FILE}`);
});
