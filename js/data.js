/* ============================================================
   TRIP DEFAULTS — the starting template.
   Once the app runs, all edits happen in the browser (via the
   ✏️ Edit mode) and live in localStorage — see js/store.js.
   Editing this file only changes what a *fresh* install starts
   from (or what "Reset to defaults" restores).
   ============================================================ */

/* Private Immich share removed for public archive — set your own URL if needed. */
const PHOTO_ALBUM_URL = "";

const TRIP_DEFAULTS = {
  title: "Banff & Jasper Road Trip",
  year: 2026,
  travelers: 4,
  timezone: "America/Edmonton", // Mountain Time
  currency: "CAD",
  startDate: "2026-09-02",
  endDate: "2026-09-10",

  // Coordinates used for weather lookups + map links
  places: {
    calgary: { name: "Calgary", lat: 51.0447, lon: -114.0719, emoji: "🏙️" },
    banff: { name: "Banff", lat: 51.1784, lon: -115.5708, emoji: "🏔️" },
    canmore: { name: "Canmore", lat: 51.0891, lon: -115.3594, emoji: "⛰️" },
    lakeLouise: { name: "Lake Louise", lat: 51.4254, lon: -116.1773, emoji: "🏞️" },
    cochrane: { name: "Cochrane", lat: 51.1892, lon: -114.4676, emoji: "🌄" },
    hinton: { name: "Hinton", lat: 53.4001, lon: -117.5885, emoji: "🌲" },
    jasper: { name: "Jasper", lat: 52.8737, lon: -118.0814, emoji: "🦌" },
  },

  packing: [
    {
      category: "Documents",
      items: [
        { text: "Passports / ID", packed: false },
        { text: "Flight confirmations", packed: false },
        { text: "Hotel/Airbnb confirmations", packed: false },
        { text: "Rental car confirmation + license", packed: false },
        { text: "Parks Canada pass (Discovery Pass)", packed: false },
      ],
    },
    {
      category: "Clothing",
      items: [
        { text: "Layers (Sept mountain weather swings 30°F+)", packed: false },
        { text: "Waterproof/windproof jacket", packed: false },
        { text: "Hiking boots", packed: false },
        { text: "Warm hat + gloves (mornings are cold)", packed: false },
        { text: "Swimsuit (hot springs!)", packed: false },
      ],
    },
    {
      category: "Gear",
      items: [
        { text: "Camera / phone mount", packed: false },
        { text: "Portable charger", packed: false },
        { text: "Bear spray (rent/buy locally, can't fly with it)", packed: false },
        { text: "Reusable water bottles", packed: false },
        { text: "Offline maps downloaded", packed: false },
      ],
    },
  ],

  days: [
    {
      date: "2026-09-02",
      from: "YYZ (Toronto)",
      to: "YYC (Calgary)",
      place: "calgary",
      emoji: "✈️",
      photo: "images/calgary.jpg",
      headline: "Travel day",
      travelTime: "✈️ ~4h direct flight",
      activities: [
        { text: "Leave home", emoji: "🏠" },
        { text: "Drop off car — Park'N Fly (YYZ)", emoji: "🅿️", distanceKm: 60, durationMin: 50, link: "https://parknfly.ca/" },
        { text: "Flight YYZ → YYC", emoji: "✈️" },
        { text: "Sleep / settle in", emoji: "😴" },
      ],
      ifTimePermits: [],
      stops: [],
      hotels: [
        {
          name: "Sandman Hotel Calgary Airport",
          city: "Calgary",
          rooms: "1 room",
          link: "https://ca.hotels.com/ho217554/sandman-hotel-calgary-airport-calgary-canada/",
          confirmed: true,
        },
      ],
      notes: "",
    },
    {
      date: "2026-09-03",
      from: "Calgary",
      to: "Banff town",
      place: "banff",
      emoji: "🏔️",
      photo: "images/bow-falls.jpg",
      headline: "Into the mountains",
      travelTime: "🚗 ~1h 25m (Calgary → Banff)",
      activities: [
        { text: "Pick up rental car (Turo)", emoji: "🚙", arrive: "07:00" },
        { text: "Banff town", emoji: "🏘️" },
        { text: "Bow Falls", emoji: "💦" },
        { text: "Morant's Curve", emoji: "🚂" },
        { text: "Canmore town", emoji: "🛍️" },
      ],
      ifTimePermits: [{ text: "Johnston Canyon", emoji: "🥾" }],
      stops: [],
      hotels: [
        {
          name: "Canmore Hotel",
          city: "Canmore",
          rooms: "1 room",
          link: "https://secure.webrez.com/hotel/3084",
          confirmed: false,
        },
      ],
      notes: "Car pickup (Turo) in Calgary SE — Thu Sep 3, 7:00 AM.",
    },
    {
      date: "2026-09-04",
      from: "Canmore",
      to: "Banff",
      place: "lakeLouise",
      emoji: "🏞️",
      photo: "images/moraine-lake.jpg",
      headline: "Lake day",
      travelTime: "🚗 ~1h to Lake Louise / Emerald Lake area",
      activities: [
        { text: "Lake Moraine / Lake Louise shuttle", emoji: "🚌" },
        { text: "Drive to Emerald Lake", emoji: "🟢" },
      ],
      ifTimePermits: [
        { text: "Kayak", emoji: "🛶" },
        { text: "Natural Bridge", emoji: "🌉" },
        { text: "Takakkaw Falls", emoji: "💧" },
      ],
      stops: [],
      hotels: [
        {
          name: "Super 8 by Wyndham Cochrane",
          city: "Cochrane",
          rooms: "1 room",
          link: "https://www.booking.com/hotel/ca/super-8-cochrane.en-gb.html",
          confirmed: true,
        },
      ],
      notes: "Other options considered: Canmore / Calgary.",
    },
    {
      date: "2026-09-05",
      from: "Canmore / Calgary",
      to: "Hinton",
      place: "hinton",
      emoji: "🧊",
      photo: "images/peyto-lake.jpg",
      headline: "Icefields Parkway",
      travelTime: "🚗 ~3h (Lake Louise → Hinton via Icefields Pkwy)",
      activities: [
        { text: "Icefields Parkway drive", emoji: "🛣️" },
        { text: "Bow Lake", emoji: "🏞️" },
        { text: "Peyto Lake", emoji: "💎" },
        { text: "Sunwapta Falls", emoji: "💦" },
      ],
      ifTimePermits: [{ text: "Saskatchewan River Crossing", emoji: "🌊" }],
      stops: [],
      hotels: [
        {
          name: "Holiday Inn Hinton",
          city: "Hinton",
          rooms: "1 room · 4 adults (Sept 5–7, discounted)",
          link: "",
          confirmed: true,
        },
      ],
      notes: "",
    },
    {
      date: "2026-09-06",
      from: "Hinton",
      to: "Jasper National Park",
      place: "jasper",
      emoji: "🦌",
      photo: "images/pyramid-lake.jpg",
      headline: "Jasper",
      travelTime: "🚗 ~1h 5m (Hinton → Jasper)",
      activities: [
        { text: "Jasper town", emoji: "🏘️" },
        { text: "Pyramid Lake (sunset)", emoji: "🌅" },
      ],
      ifTimePermits: [{ text: "Maligne Canyon / cruise (if open)", emoji: "🚤" }],
      stops: [],
      hotels: [
        {
          name: "Holiday Inn Hinton",
          city: "Hinton",
          rooms: "2 rooms · 2 adults each (Sept 5–7, discounted)",
          link: "",
          confirmed: true,
        },
      ],
      notes: "Same Hinton booking as Sept 5, back for the night.",
    },
    {
      date: "2026-09-07",
      from: "Hinton",
      to: "Banff / Calgary",
      place: "banff",
      emoji: "🧊",
      photo: "images/columbia-icefield.jpg",
      headline: "Columbia Icefield",
      travelTime: "🚗 ~3h 45m (Jasper → Banff via Columbia Icefield)",
      activities: [
        { text: "Athabasca Falls", emoji: "💦" },
        { text: "Columbia Icefield Skywalk", emoji: "🚶" },
        { text: "Columbia Icefield", emoji: "🧊" },
      ],
      ifTimePermits: [],
      stops: [],
      hotels: [
        {
          name: "Entire house (Airbnb)",
          city: "Calgary",
          rooms: "Entire house, Sept 7–10",
          link: "https://www.airbnb.ca/",
          confirmed: false,
        },
        {
          name: "Sundown Home",
          city: "Cochrane",
          rooms: "Entire house, 2 rooms",
          link: "https://www.booking.com/",
          confirmed: false,
        },
      ],
      notes: "Hotel for tonight still pending — Calgary Airbnb vs Cochrane house.",
    },
    {
      date: "2026-09-08",
      from: "Canmore / Calgary",
      to: "Canmore / Calgary",
      place: "canmore",
      emoji: "♨️",
      photo: "images/hot-springs.jpg",
      headline: "Kananaskis & hot springs",
      travelTime: "🚗 ~45m (Banff/Canmore → Kananaskis)",
      activities: [
        { text: "Kananaskis Village", emoji: "🏔️" },
        { text: "Hot springs", emoji: "♨️" },
      ],
      ifTimePermits: [{ text: "Johnston Canyon (if not visited already)", emoji: "🥾" }],
      stops: [],
      hotels: [
        {
          name: "Entire house (Airbnb)",
          city: "Calgary",
          rooms: "Entire house, Sept 7–10",
          link: "https://www.airbnb.ca/",
          confirmed: false,
        },
      ],
      notes: "",
    },
    {
      date: "2026-09-09",
      from: "Calgary",
      to: "Calgary",
      place: "calgary",
      emoji: "🦕",
      photo: "images/drumheller.jpg",
      headline: "Calgary day",
      travelTime: "🚗 ~1h 10m (Canmore → Calgary)",
      activities: [
        { text: "Calgary Zoo", emoji: "🦁" },
        { text: "Drumheller / Badlands", emoji: "🦕" },
        { text: "Horseshoe Canyon", emoji: "🐎" },
        { text: "Peace Bridge", emoji: "🌉" },
      ],
      ifTimePermits: [],
      stops: [],
      hotels: [
        {
          name: "Entire house (Airbnb)",
          city: "Calgary",
          rooms: "Entire house, Sept 7–10",
          link: "https://www.airbnb.ca/",
          confirmed: false,
        },
      ],
      notes: "",
    },
    {
      date: "2026-09-10",
      from: "YYC (Calgary)",
      to: "YYZ (Toronto)",
      place: "calgary",
      emoji: "🏠",
      photo: "images/calgary.jpg",
      headline: "Fly home",
      travelTime: "✈️ ~4h direct flight",
      activities: [
        { text: "Return rental car (Turo)", emoji: "🚙", arrive: "09:00" },
        { text: "Depart YYC → YYZ", emoji: "✈️" },
        { text: "Pick up car — Park'N Fly (YYZ)", emoji: "🅿️", link: "https://parknfly.ca/" },
        { text: "Arrive home", emoji: "🏠", distanceKm: 60, durationMin: 50 },
      ],
      ifTimePermits: [],
      stops: [],
      hotels: [],
      notes: "Car return (Turo) in Calgary SE — Thu Sep 10, 9:00 AM.",
    },
  ],
};
