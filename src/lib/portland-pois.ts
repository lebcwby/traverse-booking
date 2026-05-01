/**
 * Portland points of interest with coordinates.
 * Used to generate unique "Nearby Attractions" content per property page.
 */

export type PoiCategory =
  | "dining"
  | "coffee"
  | "parks"
  | "shopping"
  | "transit"
  | "attractions";

export interface Poi {
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory;
}

export interface NearbyPoi extends Poi {
  walkMinutes: number;
}

export const POIS: Poi[] = [
  // ── Dining & Drinks ──
  {
    name: "Salt & Straw (Alberta)",
    lat: 45.559,
    lng: -122.6467,
    category: "dining",
  },
  {
    name: "Tin Shed Garden Cafe",
    lat: 45.559,
    lng: -122.6445,
    category: "dining",
  },
  {
    name: "Pine State Biscuits",
    lat: 45.559,
    lng: -122.65,
    category: "dining",
  },
  {
    name: "Bollywood Theater (Alberta)",
    lat: 45.559,
    lng: -122.648,
    category: "dining",
  },
  {
    name: "Lovely's Fifty Fifty",
    lat: 45.5525,
    lng: -122.6757,
    category: "dining",
  },
  { name: "Prost! Beer Hall", lat: 45.552, lng: -122.6757, category: "dining" },
  { name: "Screen Door", lat: 45.5225, lng: -122.643, category: "dining" },
  { name: "Pok Pok", lat: 45.5043, lng: -122.6353, category: "dining" },
  { name: "Lardo", lat: 45.5119, lng: -122.6326, category: "dining" },
  { name: "Canard", lat: 45.523, lng: -122.643, category: "dining" },
  { name: "Andina", lat: 45.5276, lng: -122.683, category: "dining" },
  {
    name: "Deschutes Brewery (Pearl)",
    lat: 45.527,
    lng: -122.6815,
    category: "dining",
  },
  { name: "Le Pigeon", lat: 45.522, lng: -122.642, category: "dining" },
  { name: "Tasty n Alder", lat: 45.5185, lng: -122.681, category: "dining" },
  { name: "Kachka", lat: 45.52, lng: -122.6362, category: "dining" },
  { name: "Expatriate", lat: 45.5195, lng: -122.627, category: "dining" },
  { name: "Apizza Scholls", lat: 45.5118, lng: -122.6188, category: "dining" },
  { name: "Matt's BBQ", lat: 45.5545, lng: -122.6757, category: "dining" },
  {
    name: "Proud Mary Coffee",
    lat: 45.5589,
    lng: -122.6412,
    category: "dining",
  },
  { name: "Eem", lat: 45.553, lng: -122.6757, category: "dining" },
  { name: "Nostrana", lat: 45.513, lng: -122.65, category: "dining" },
  {
    name: "Ken's Artisan Pizza",
    lat: 45.517,
    lng: -122.641,
    category: "dining",
  },
  { name: "Tusk", lat: 45.521, lng: -122.6428, category: "dining" },
  {
    name: "Olympia Provisions (SE)",
    lat: 45.508,
    lng: -122.6585,
    category: "dining",
  },

  // ── Coffee ──
  {
    name: "Stumptown Coffee (Division)",
    lat: 45.505,
    lng: -122.635,
    category: "coffee",
  },
  {
    name: "Stumptown Coffee (Downtown)",
    lat: 45.5195,
    lng: -122.681,
    category: "coffee",
  },
  {
    name: "Heart Coffee (Hawthorne)",
    lat: 45.5118,
    lng: -122.628,
    category: "coffee",
  },
  {
    name: "Coava Coffee (SE)",
    lat: 45.5195,
    lng: -122.6358,
    category: "coffee",
  },
  { name: "Barista (Pearl)", lat: 45.526, lng: -122.6815, category: "coffee" },
  { name: "Never Coffee", lat: 45.5585, lng: -122.6525, category: "coffee" },
  {
    name: "Good Coffee (Hawthorne)",
    lat: 45.5118,
    lng: -122.638,
    category: "coffee",
  },
  {
    name: "Upper Left Roasters",
    lat: 45.5535,
    lng: -122.676,
    category: "coffee",
  },
  { name: "Courier Coffee", lat: 45.5215, lng: -122.675, category: "coffee" },
  { name: "Either/Or Cafe", lat: 45.5119, lng: -122.644, category: "coffee" },

  // ── Parks & Outdoors ──
  {
    name: "Forest Park (Lower Macleay)",
    lat: 45.5355,
    lng: -122.7115,
    category: "parks",
  },
  { name: "Washington Park", lat: 45.515, lng: -122.71, category: "parks" },
  { name: "Mt. Tabor Park", lat: 45.5117, lng: -122.5947, category: "parks" },
  { name: "Laurelhurst Park", lat: 45.523, lng: -122.6268, category: "parks" },
  { name: "Alberta Park", lat: 45.56, lng: -122.643, category: "parks" },
  {
    name: "Peninsula Park & Rose Garden",
    lat: 45.568,
    lng: -122.673,
    category: "parks",
  },
  { name: "Grant Park", lat: 45.541, lng: -122.629, category: "parks" },
  { name: "Irving Park", lat: 45.554, lng: -122.641, category: "parks" },
  { name: "Cathedral Park", lat: 45.588, lng: -122.762, category: "parks" },
  {
    name: "Tom McCall Waterfront Park",
    lat: 45.5208,
    lng: -122.671,
    category: "parks",
  },
  {
    name: "Sellwood Riverfront Park",
    lat: 45.464,
    lng: -122.655,
    category: "parks",
  },
  {
    name: "Oaks Bottom Wildlife Refuge",
    lat: 45.474,
    lng: -122.658,
    category: "parks",
  },
  { name: "Eastbank Esplanade", lat: 45.513, lng: -122.664, category: "parks" },
  { name: "Pittock Mansion", lat: 45.5328, lng: -122.7171, category: "parks" },
  {
    name: "Ladd's Addition Rose Gardens",
    lat: 45.5095,
    lng: -122.6465,
    category: "parks",
  },
  {
    name: "Colonel Summers Park",
    lat: 45.5137,
    lng: -122.6393,
    category: "parks",
  },
  { name: "Overlook Park", lat: 45.557, lng: -122.683, category: "parks" },

  // ── Shopping ──
  {
    name: "Powell's City of Books",
    lat: 45.5231,
    lng: -122.6815,
    category: "shopping",
  },
  {
    name: "Powell's Books (Hawthorne)",
    lat: 45.5118,
    lng: -122.6326,
    category: "shopping",
  },
  {
    name: "NW 23rd Avenue shops",
    lat: 45.5305,
    lng: -122.6942,
    category: "shopping",
  },
  {
    name: "Hawthorne Boulevard shops",
    lat: 45.5118,
    lng: -122.64,
    category: "shopping",
  },
  {
    name: "Mississippi Avenue shops",
    lat: 45.5525,
    lng: -122.6757,
    category: "shopping",
  },
  {
    name: "Alberta Street shops",
    lat: 45.559,
    lng: -122.6467,
    category: "shopping",
  },
  {
    name: "Division Street shops",
    lat: 45.505,
    lng: -122.635,
    category: "shopping",
  },
  {
    name: "Sellwood Antique Row",
    lat: 45.465,
    lng: -122.653,
    category: "shopping",
  },
  {
    name: "Portland Saturday Market",
    lat: 45.5225,
    lng: -122.67,
    category: "shopping",
  },

  // ── Transit ──
  {
    name: "Hollywood MAX Station",
    lat: 45.5345,
    lng: -122.6215,
    category: "transit",
  },
  {
    name: "Lloyd Center MAX Station",
    lat: 45.529,
    lng: -122.655,
    category: "transit",
  },
  {
    name: "Rose Quarter MAX Station",
    lat: 45.5325,
    lng: -122.667,
    category: "transit",
  },
  {
    name: "Pioneer Courthouse Square (MAX)",
    lat: 45.5189,
    lng: -122.6795,
    category: "transit",
  },
  {
    name: "Gateway Transit Center",
    lat: 45.5295,
    lng: -122.5675,
    category: "transit",
  },
  {
    name: "Union Station (Amtrak)",
    lat: 45.5286,
    lng: -122.6764,
    category: "transit",
  },
  {
    name: "Portland Streetcar (NW)",
    lat: 45.528,
    lng: -122.6845,
    category: "transit",
  },
  { name: "OHSU Tram", lat: 45.4988, lng: -122.67, category: "transit" },
  {
    name: "Sellwood Bridge",
    lat: 45.4615,
    lng: -122.6605,
    category: "transit",
  },
  { name: "Tilikum Crossing", lat: 45.505, lng: -122.665, category: "transit" },

  // ── Attractions ──
  {
    name: "Portland Art Museum",
    lat: 45.5163,
    lng: -122.6835,
    category: "attractions",
  },
  {
    name: "Lan Su Chinese Garden",
    lat: 45.5253,
    lng: -122.6735,
    category: "attractions",
  },
  { name: "OMSI", lat: 45.5083, lng: -122.666, category: "attractions" },
  {
    name: "Jamison Square",
    lat: 45.5285,
    lng: -122.684,
    category: "attractions",
  },
  {
    name: "Pioneer Courthouse Square",
    lat: 45.5189,
    lng: -122.6795,
    category: "attractions",
  },
  { name: "Moda Center", lat: 45.5316, lng: -122.667, category: "attractions" },
  {
    name: "Providence Park",
    lat: 45.5215,
    lng: -122.6916,
    category: "attractions",
  },
  {
    name: "Oregon Convention Center",
    lat: 45.5282,
    lng: -122.6623,
    category: "attractions",
  },
  {
    name: "Mississippi Studios",
    lat: 45.553,
    lng: -122.6757,
    category: "attractions",
  },
  {
    name: "Hollywood Theatre",
    lat: 45.5345,
    lng: -122.624,
    category: "attractions",
  },
  {
    name: "Oaks Amusement Park",
    lat: 45.47,
    lng: -122.66,
    category: "attractions",
  },
  {
    name: "Alberta Street murals",
    lat: 45.559,
    lng: -122.643,
    category: "attractions",
  },
  {
    name: "International Rose Test Garden",
    lat: 45.5167,
    lng: -122.705,
    category: "attractions",
  },
];

/** Haversine distance in meters. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the closest POIs to a given lat/lng.
 * Returns up to `limit` POIs within `maxWalkMinutes`, sorted by distance.
 * Walking estimate: haversine × 1.3 (street grid factor) at 5 km/h.
 */
export function getNearbyPois(
  lat: number,
  lng: number,
  {
    limit = 8,
    maxWalkMinutes = 20,
  }: { limit?: number; maxWalkMinutes?: number } = {}
): NearbyPoi[] {
  const GRID_FACTOR = 1.3;
  const WALK_SPEED_M_PER_MIN = 83; // ~5 km/h

  return POIS.map((poi) => {
    const straightLine = haversineMeters(lat, lng, poi.lat, poi.lng);
    const walkDistance = straightLine * GRID_FACTOR;
    const walkMinutes = Math.round(walkDistance / WALK_SPEED_M_PER_MIN);
    return { ...poi, walkMinutes };
  })
    .filter((p) => p.walkMinutes <= maxWalkMinutes && p.walkMinutes >= 1)
    .sort((a, b) => a.walkMinutes - b.walkMinutes)
    .slice(0, limit);
}

/** Category display labels. */
export const CATEGORY_LABELS: Record<PoiCategory, string> = {
  dining: "Dining",
  coffee: "Coffee",
  parks: "Parks & Outdoors",
  shopping: "Shopping",
  transit: "Transit",
  attractions: "Attractions",
};
