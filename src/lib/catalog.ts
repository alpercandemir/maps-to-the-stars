import { Body } from "astronomy-engine";

// J2000/ICRS positions, V magnitudes and rounded distances from SIMBAD.
// Positions are fixed at J2000; proper motion is deliberately not modelled.
export const STARS = [
  {
    id: "polaris",
    body: Body.Star1,
    name: "Polaris",
    constellation: "Ursa Minor",
    ra: 2.530301,
    dec: 89.264109,
    distance: 447,
    magnitude: 1.98,
    color: "#f1e8ce",
    description:
      "The quiet anchor of the northern sky. As Earth turns, the other stars seem to circle this guiding light.",
  },
  {
    id: "sirius",
    body: Body.Star2,
    name: "Sirius",
    constellation: "Canis Major",
    ra: 6.752481,
    dec: -16.716116,
    distance: 8.6,
    magnitude: -1.46,
    color: "#e3eeff",
    description:
      "The brightest star in our night sky, just 8.6 light-years away. A brilliant companion to winter evenings.",
  },
  {
    id: "vega",
    body: Body.Star3,
    name: "Vega",
    constellation: "Lyra",
    ra: 18.615649,
    dec: 38.783689,
    distance: 25,
    magnitude: 0.03,
    color: "#d9e8ff",
    description:
      "A blue-white light in the summer sky. Its light has travelled for about 25 years to reach this moment.",
  },
  {
    id: "arcturus",
    body: Body.Star4,
    name: "Arcturus",
    constellation: "Boötes",
    ra: 14.26103,
    dec: 19.182409,
    distance: 36.7,
    magnitude: -0.05,
    color: "#f7c48b",
    description:
      "A warm orange giant, and a familiar light on spring and summer nights. Its name means guardian of the bear.",
  },
  {
    id: "betelgeuse",
    body: Body.Star5,
    name: "Betelgeuse",
    constellation: "Orion",
    ra: 5.919529,
    dec: 7.407063,
    distance: 548,
    magnitude: 0.42,
    color: "#eeaa82",
    description:
      "The red supergiant marking Orion’s shoulder. Its brightness changes over time; the map uses a representative magnitude.",
  },
  {
    id: "rigel",
    body: Body.Star6,
    name: "Rigel",
    constellation: "Orion",
    ra: 5.242298,
    dec: -8.20164,
    distance: 860,
    magnitude: 0.13,
    color: "#d1e4ff",
    description:
      "A luminous blue supergiant at Orion’s foot. A distant, cool-looking light with an extraordinarily hot surface.",
  },
  {
    id: "aldebaran",
    body: Body.Star7,
    name: "Aldebaran",
    constellation: "Taurus",
    ra: 4.598677,
    dec: 16.509302,
    distance: 65,
    magnitude: 0.85,
    color: "#efbe8c",
    description:
      "The amber eye of Taurus. This orange giant appears near a cluster of stars, but is much closer to us.",
  },
  {
    id: "capella",
    body: Body.Star8,
    name: "Capella",
    constellation: "Auriga",
    ra: 5.278155,
    dec: 45.997991,
    distance: 42.9,
    magnitude: 0.08,
    color: "#f3e2b5",
    description:
      "A golden point in the northern sky. What looks like one star is actually a system with two bright giant stars.",
  },
] as const;

export interface Place {
  label: string;
  country: string;
  lat: number;
  lon: number;
  zone: string;
}
// Bundled city suggestions remain available when worldwide search is unavailable.
export const CITIES: Place[] = [
  {
    label: "Kadıköy, Istanbul",
    country: "Türkiye",
    lat: 40.9909,
    lon: 29.0297,
    zone: "Europe/Istanbul",
  },
  {
    label: "Istanbul",
    country: "Türkiye",
    lat: 41.0082,
    lon: 28.9784,
    zone: "Europe/Istanbul",
  },
  {
    label: "Ankara",
    country: "Türkiye",
    lat: 39.9334,
    lon: 32.8597,
    zone: "Europe/Istanbul",
  },
  {
    label: "İzmir",
    country: "Türkiye",
    lat: 38.4237,
    lon: 27.1428,
    zone: "Europe/Istanbul",
  },
  {
    label: "London",
    country: "United Kingdom",
    lat: 51.5074,
    lon: -0.1278,
    zone: "Europe/London",
  },
  {
    label: "Paris",
    country: "France",
    lat: 48.8566,
    lon: 2.3522,
    zone: "Europe/Paris",
  },
  {
    label: "Berlin",
    country: "Germany",
    lat: 52.52,
    lon: 13.405,
    zone: "Europe/Berlin",
  },
  {
    label: "New York",
    country: "United States",
    lat: 40.7128,
    lon: -74.006,
    zone: "America/New_York",
  },
  {
    label: "Los Angeles",
    country: "United States",
    lat: 34.0522,
    lon: -118.2437,
    zone: "America/Los_Angeles",
  },
  {
    label: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lon: 139.6503,
    zone: "Asia/Tokyo",
  },
  {
    label: "Sydney",
    country: "Australia",
    lat: -33.8688,
    lon: 151.2093,
    zone: "Australia/Sydney",
  },
  {
    label: "Cape Town",
    country: "South Africa",
    lat: -33.9249,
    lon: 18.4241,
    zone: "Africa/Johannesburg",
  },
  {
    label: "Reykjavík",
    country: "Iceland",
    lat: 64.1466,
    lon: -21.9426,
    zone: "Atlantic/Reykjavik",
  },
  {
    label: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lon: -58.3816,
    zone: "America/Argentina/Buenos_Aires",
  },
  {
    label: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lon: 103.8198,
    zone: "Asia/Singapore",
  },
  {
    label: "Delhi",
    country: "India",
    lat: 28.6139,
    lon: 77.209,
    zone: "Asia/Kolkata",
  },
];
