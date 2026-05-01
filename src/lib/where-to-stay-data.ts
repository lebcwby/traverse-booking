export interface NeighborhoodData {
  id: string;
  name: string;
  slug: string;
  color: string;
  lat: number;
  lng: number;
  bestFor: string[];
  scores: {
    walkability: number;
    dining: number;
    nightlife: number;
  };
  vibe: string;
  description: string[];
  image: string;
  imageAlt: string;
}

export const NEIGHBORHOODS: NeighborhoodData[] = [
  {
    id: "hawthorne",
    name: "Hawthorne & Belmont",
    slug: "hawthorne-belmont",
    color: "#e53e3e",
    lat: 45.5118,
    lng: -122.627,
    bestFor: ["couples", "foodies", "first-time visitors"],
    scores: { walkability: 9, dining: 9, nightlife: 7 },
    vibe: "Eclectic & local",
    description: [
      "Hawthorne Boulevard is Portland's most walkable commercial strip — vintage shops, independent restaurants, and great coffee all within a few blocks of your front door. It's the neighborhood we recommend most for first-time visitors.",
      "Belmont, one block north, is quieter but equally charming — tucked-away wine bars, neighborhood bakeries, and tree-lined residential streets. Together, these two streets give you the best of Portland within walking distance of your rental.",
    ],
    image: "/images/home/poi-hawthorne.jpg",
    imageAlt:
      "Hawthorne Boulevard street scene with vintage shops and restaurants in Portland",
  },
  {
    id: "alberta",
    name: "Alberta Arts District",
    slug: "alberta",
    color: "#3182ce",
    lat: 45.559,
    lng: -122.647,
    bestFor: ["creatives", "art lovers", "vibrant nightlife"],
    scores: { walkability: 8, dining: 9, nightlife: 9 },
    vibe: "Creative & vibrant",
    description: [
      "Alberta Street is Portland's creative heart — murals on every block, independent galleries, and some of the city's best restaurants. The monthly Last Thursday art walk fills the street with artists, musicians, and food vendors from May through September.",
      "The neighborhood has an energy you won't find anywhere else in Portland. It's also home to some of the city's best brunch spots, craft cocktail bars, and late-night food. If you want Portland at its most alive, stay here.",
    ],
    image: "/images/home/poi-alberta.jpg",
    imageAlt:
      "Alberta Street murals and art galleries in Portland's Arts District",
  },
  {
    id: "nw23rd",
    name: "NW 23rd & Alphabet District",
    slug: "nw-23rd",
    color: "#d69e2e",
    lat: 45.5325,
    lng: -122.699,
    bestFor: ["shopping", "upscale dining", "walkable urban vibe"],
    scores: { walkability: 9, dining: 8, nightlife: 6 },
    vibe: "Upscale & polished",
    description: [
      "The closest thing Portland has to a European high street — boutiques, brunch spots, and Forest Park trailheads all within walking distance. NW 23rd has the polish of a curated shopping district with the character of a real neighborhood.",
      "The Alphabet District streets (named Burnside through Westover) are lined with historic apartment buildings and Victorian homes. It's one of the most photogenic neighborhoods in the city, and one of the few where you can walk to both fine dining and a forest trail.",
    ],
    image: "/images/home/poi-nw23rd.jpg",
    imageAlt: "NW 23rd Avenue boutiques and tree-lined streets in Portland",
  },
  {
    id: "mississippi",
    name: "Mississippi Avenue",
    slug: "mississippi",
    color: "#805ad5",
    lat: 45.553,
    lng: -122.675,
    bestFor: ["craft beer", "eclectic vibes", "live music"],
    scores: { walkability: 8, dining: 8, nightlife: 8 },
    vibe: "Eclectic & lively",
    description: [
      "Mississippi Avenue packs an incredible density of bars, restaurants, and shops into a few short blocks. String lights overhead, local artisans in converted warehouses, and some of Portland's best live music venues make this one of the city's most energetic streets.",
      "It's also home to Mississippi Studios, one of Portland's best small music venues, and a rotating cast of food carts. The neighborhood has a creative, unpretentious energy that feels distinctly Portland.",
    ],
    image: "/images/home/poi-mississippi.jpg",
    imageAlt: "Mississippi Avenue string lights and shops in North Portland",
  },
  {
    id: "division",
    name: "Division & Clinton",
    slug: "southeast-portland",
    color: "#38a169",
    lat: 45.5045,
    lng: -122.634,
    bestFor: ["food scene", "modern Portland", "young professionals"],
    scores: { walkability: 8, dining: 10, nightlife: 7 },
    vibe: "Foodie & modern",
    description: [
      "Division Street has quietly become Portland's most exciting food corridor. James Beard-nominated restaurants, innovative cocktail bars, and the city's best ice cream shop are all within a few blocks. Clinton Street, one block south, adds a quieter residential counterpoint.",
      "This is modern Portland — newer construction mixed with classic bungalows, bike lanes everywhere, and a food scene that rivals neighborhoods twice its size. If you care most about eating well, Division is your neighborhood.",
    ],
    image: "/images/home/photo-1656975188530-44ac2e9446f7.jpeg",
    imageAlt:
      "Division Street restaurants and modern architecture in Southeast Portland",
  },
  {
    id: "pearl",
    name: "Pearl District",
    slug: "pearl-district",
    color: "#2b6cb0",
    lat: 45.5265,
    lng: -122.6835,
    bestFor: ["galleries", "urban luxury", "walkable downtown-adjacent"],
    scores: { walkability: 10, dining: 8, nightlife: 6 },
    vibe: "Urban & upscale",
    description: [
      "The Pearl District is Portland's most walkable neighborhood — converted warehouses now house art galleries, upscale restaurants, and Powell's City of Books, the world's largest independent bookstore. It's the closest thing to downtown without actually being downtown.",
      "If you prefer an urban setting with polished restaurants and gallery openings over dive bars and food carts, the Pearl is your spot. It's also the most convenient base for exploring the rest of the city — streetcar access, easy highway connections, and walkable to the waterfront.",
    ],
    image: "/images/home/poi-pearl.jpg",
    imageAlt:
      "Pearl District converted warehouse buildings and galleries in Portland",
  },
  {
    id: "sellwood",
    name: "Sellwood",
    slug: "sellwood-moreland",
    color: "#dd6b20",
    lat: 45.466,
    lng: -122.653,
    bestFor: ["antique lovers", "families", "quiet neighborhood feel"],
    scores: { walkability: 7, dining: 7, nightlife: 4 },
    vibe: "Charming & quiet",
    description: [
      "Sellwood is Portland's antique district — a dozen shops lining SE 13th Avenue, plus cafes, bakeries, and a genuine small-town feel that's rare this close to a city center. Oaks Bottom Wildlife Refuge and Sellwood Riverfront Park are both within walking distance.",
      "This is the neighborhood for travelers who want to slow down. Families love the parks and quiet residential streets. Couples love the charming restaurants and weekend farmers market. It's a 15-minute drive to the busier neighborhoods, but that's part of the appeal.",
    ],
    image: "/images/home/poi-sellwood.jpg",
    imageAlt:
      "Sellwood antique shops and tree-lined streets in Southeast Portland",
  },
  {
    id: "stjohns",
    name: "St. Johns",
    slug: "north-portland",
    color: "#319795",
    lat: 45.59,
    lng: -122.753,
    bestFor: ["Cathedral Park", "bridge views", "off the beaten path"],
    scores: { walkability: 7, dining: 6, nightlife: 5 },
    vibe: "Quirky & residential",
    description: [
      "St. Johns feels like its own small town within Portland — a tight-knit commercial strip centered around a historic movie theater, a handful of beloved restaurants, and Cathedral Park under the gothic arches of the St. Johns Bridge.",
      "It's the most off-the-beaten-path neighborhood on this list, and that's exactly why some travelers love it. If you want a quiet base with character, easy access to Forest Park trails, and one of the most photographed bridges in the Pacific Northwest, St. Johns delivers.",
    ],
    image: "/images/home/photo-1743040510243-d5fcd8f3864c.jpeg",
    imageAlt: "St. Johns Bridge and Cathedral Park in North Portland",
  },
];

export const WHERE_TO_STAY_FAQ = [
  {
    question: "Is it safe to stay outside downtown Portland?",
    answer:
      "Yes — Portland's residential neighborhoods are where most locals live and are generally safer and more pleasant for visitors than the downtown core. Neighborhoods like Hawthorne, Alberta, NW 23rd, and Sellwood are well-established, walkable, and have active commercial strips with restaurants and shops. Most of our guests tell us they felt safer and more comfortable in the neighborhoods than they expected.",
  },
  {
    question: "How far are Portland neighborhoods from the airport?",
    answer:
      "Portland International Airport (PDX) is about 20-30 minutes from most of our neighborhoods by car or rideshare. The MAX Light Rail also connects the airport to downtown and several neighborhoods for about $2.50. We include detailed directions and transportation tips in every booking confirmation.",
  },
  {
    question: "Are vacation rentals cheaper than Portland hotels?",
    answer:
      "For groups of 3 or more, vacation rentals are almost always more affordable than booking multiple hotel rooms. A 3-bedroom home that sleeps 6-8 guests typically costs less per person than two hotel rooms. Solo travelers and couples may find comparable pricing, but get significantly more space, a full kitchen, and a better location. Booking direct on booktraverse.com also saves 10-15% vs. Airbnb or VRBO fees.",
  },
  {
    question: "What's the best neighborhood for families visiting Portland?",
    answer:
      "Hawthorne and Sellwood are our top picks for families. Both have quiet residential streets, parks within walking distance, family-friendly restaurants, and homes with yards. Hawthorne offers more walkable dining options, while Sellwood is quieter with easier access to Oaks Bottom Wildlife Refuge and Sellwood Park.",
  },
  {
    question: "Do I need a car in Portland?",
    answer:
      "It depends on your neighborhood. In Hawthorne, Alberta, NW 23rd, Mississippi, and the Pearl District, you can walk to restaurants, coffee shops, and attractions without a car. For Sellwood and St. Johns, a car or occasional rideshare is more convenient. Portland also has good public transit (buses and MAX Light Rail) and is one of the most bike-friendly cities in the US.",
  },
  {
    question: "What's the best time to visit Portland?",
    answer:
      "June through September offers warm, dry weather and Portland's famous outdoor dining, festivals, and farmers markets. July and August are peak season — book 3-4 weeks ahead. May and October are shoulder season gems with fewer crowds and lower prices. Winter (November-March) is rainy but mild, with lower rates, no crowds, and Portland's cozy indoor dining scene at its best.",
  },
];
