export type GuideCategory =
  | "neighborhoods"
  | "food-drink"
  | "outdoors"
  | "events"
  | "travel-tips";

export interface Place {
  name: string;
  detail: string;
  url?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "tip"; text: string }
  | { type: "places"; items: Place[] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "pros-cons"; pros: string[]; cons: string[] }
  | { type: "best-for"; tags: string[] }
  | { type: "faq"; items: FaqItem[] }
  | {
      type: "neighborhood-listings";
      tag: string;
      limit: number;
      browseUrl: string;
      browseLabel: string;
    };

export interface GuideArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: GuideCategory;
  categoryLabel: string;
  author: string;
  authorBio: string;
  publishedAt: string;
  updatedAt: string;
  heroImage: string;
  heroAlt: string;
  excerpt: string;
  content: ContentBlock[];
  relatedSlugs: string[];
  relatedLandingPages: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GUIDE_ARTICLES: GuideArticle[] = [
  // ─── 1. WHERE TO STAY ───────────────────────────────────────────────
  {
    slug: "where-to-stay-in-portland",
    title: "Where to Stay in Portland: A Local's Neighborhood Guide (2026)",
    metaTitle: "Where to Stay in Portland — Best Neighborhoods",
    metaDescription:
      "Portland locals who manage 275+ rentals rank the 10 best neighborhoods. Honest pros & cons, walkability, parking, dining, and real nightly rates for each area.",
    category: "neighborhoods",
    categoryLabel: "Neighborhoods",
    author: "The Book Traverse Team",
    authorBio:
      "Portland locals managing 275+ vacation rentals across the city. We've hosted 80,000+ guests across every neighborhood on this list. We live here, host here, and know every block firsthand.",
    publishedAt: "2026-02-23",
    updatedAt: "2026-03-29",
    heroImage: "/images/home/poi-pearl.jpg",
    heroAlt: "Pearl District street scene in Portland, Oregon",
    excerpt:
      "Portland is a city of neighborhoods. Where you stay shapes your entire trip — choose the right one and you'll walk to dinner, stumble onto the best coffee, and feel the city instead of just seeing it. A local's guide to all 10.",
    relatedSlugs: [
      "best-restaurants-portland",
      "best-parks-portland",
      "best-breweries-portland",
    ],
    relatedLandingPages: [
      "southeast-portland",
      "northeast-portland",
      "northwest-portland",
      "north-portland",
    ],
    content: [
      // ── Intro ──────────────────────────────────────────────────────
      {
        type: "text",
        text: "Portland is a city of neighborhoods. Where you stay shapes your entire trip more than any other decision you'll make. Unlike cities where \"downtown\" is the obvious default, Portland's best food, nightlife, and culture are spread across distinct neighborhoods — each with its own personality, restaurant scene, and walkability. We manage 275+ vacation rentals across all of them, and we've hosted 80,000+ guests. This guide is what we tell everyone who asks us where to stay.",
      },
      {
        type: "text",
        text: "Whether you're weighing Portland hotels against vacation rentals, the neighborhood matters more than the building. A so-so Airbnb on a great block in Hawthorne will give you a better trip than a luxury hotel in a neighborhood that doesn't match your vibe.",
      },

      // ── Portland Geography ─────────────────────────────────────────
      { type: "heading", text: "Understanding Portland's Layout" },
      {
        type: "text",
        text: 'Portland is bisected by the Willamette River. Downtown, the Pearl District, and NW Portland sit on the west bank. The east side — where most locals live, eat, and drink — is home to the majority of the city\'s restaurant, bar, and nightlife scene. Portland is divided into five quadrants (N, NE, NW, SE, SW) plus the newer South Waterfront. Street addresses include the quadrant, so always check whether that "Portland restaurant" is in SE or NW — they could be 30 minutes apart.',
      },
      {
        type: "text",
        text: "The good news: Portland's transit system — the MAX light rail, streetcar, and buses — connects most neighborhoods, and ride-sharing fills the gaps. An Uber from SE to NW rarely costs more than $15. Most neighborhoods on this list are compact enough to explore entirely on foot once you're there.",
      },

      // ── 1. Hawthorne & Belmont ─────────────────────────────────────
      {
        type: "heading",
        text: "Hawthorne & Belmont: Portland's Culinary Heartbeat",
      },
      {
        type: "text",
        text: "If you only have a few days in Portland and want to maximize your restaurant and nightlife experience, stay in Hawthorne. This is the city's culinary and cultural epicenter. Hawthorne Boulevard has more independently owned businesses per block than almost anywhere in Portland — vintage clothing, record stores, bookshops, and restaurants at every turn. Division Street, one block south, is the newer restaurant corridor with James Beard-recognized spots packed into a few blocks. Belmont runs parallel and is quieter, with neighborhood coffee shops and standout brunch spots.",
      },
      {
        type: "image",
        src: "/images/home/poi-hawthorne.jpg",
        alt: "Hawthorne District street scene in Southeast Portland",
        caption: "The Hawthorne District — Portland's culinary heartbeat",
      },
      {
        type: "text",
        text: "The sub-neighborhoods each have a distinct feel. **Hawthorne** is the classic — a long commercial strip where you can walk for 30 minutes without running out of things to discover. **Division Street** is destination dining: Ava Gene's, Langbaan, and a dozen other spots. **Belmont** is the quieter sibling with great coffee and brunch. **Clinton and Richmond**, a block or two off the main corridors, offer tree-lined residential streets — walkability without noise. Further south, **Foster-Powell** is Portland's emerging neighborhood with lower nightly rates and a growing food cart scene.",
      },
      {
        type: "best-for",
        tags: ["Foodies", "Couples", "First-Time Visitors", "Nightlife"],
      },
      {
        type: "pros-cons",
        pros: [
          "Walking distance to 50+ restaurants and bars",
          "Free street parking on most residential blocks",
          "Best food cart pods in the city",
          "Easy access to Mt. Tabor Park trails",
          "Strong coffee shop scene (Heart, Coava, Proud Mary)",
        ],
        cons: [
          "Hawthorne Blvd can get busy on weekend evenings",
          "Limited hotel options — vacation rentals dominate",
          "20-minute bus ride to downtown (or $10 Uber)",
          "Some streets lack sidewalks south of Division",
        ],
      },
      {
        type: "tip",
        text: "Hawthorne is our most-booked area for good reason. Nightly rates for a 2-bedroom house with parking typically start around $150-200/night — less than a single downtown hotel room. Browse [Hawthorne & Belmont rentals](/neighborhoods/hawthorne-belmont).",
      },
      {
        type: "neighborhood-listings",
        tag: "Hawthorne Belmont",
        limit: 4,
        browseUrl: "/neighborhoods/hawthorne-belmont",
        browseLabel: "Browse all Hawthorne & Belmont rentals",
      },

      // ── 2. Alberta Arts District ───────────────────────────────────
      {
        type: "heading",
        text: "Alberta Arts District: Murals, Galleries & Last Thursday",
      },
      {
        type: "text",
        text: "Alberta is Portland's most visually striking neighborhood. Nearly every building on Alberta Street features a mural, and the energy swings between gallery openings, food cart pods, and live music. The anchor event is **Last Thursday** (May through September), when the street closes to traffic and fills with artists, performers, food vendors, and thousands of people — it's Portland's best recurring street party and worth planning a trip around.",
      },
      {
        type: "image",
        src: "/images/home/poi-alberta.jpg",
        alt: "Alberta Arts District murals and street art in Portland",
        caption:
          "Alberta Arts District — murals line every block, Last Thursday fills the street monthly",
      },
      {
        type: "text",
        text: "Beyond the art scene, Alberta has excellent restaurants (Tin Shed, Pine State Biscuits, Yonder), some of the city's best ice cream (Salt & Straw), and a walkable commercial strip that stays lively without feeling crowded. The residential streets surrounding Alberta are classic Portland — Craftsman homes, mature trees, front-porch culture. It's a great neighborhood for travelers who want to feel like they're living in Portland, not visiting it.",
      },
      {
        type: "best-for",
        tags: [
          "Creatives",
          "Art Lovers",
          "Young Travelers",
          "Brunch Enthusiasts",
        ],
      },
      {
        type: "pros-cons",
        pros: [
          "Best street art and gallery scene in Portland",
          "Last Thursday street fair (May-Sept) is unmissable",
          "Excellent walkability along Alberta Street",
          "Free residential parking everywhere",
          "Strong food cart and brewery presence",
        ],
        cons: [
          "No MAX or streetcar — bus or rideshare to other areas",
          "Limited nightlife compared to SE or Mississippi",
          "Some blocks transition quickly from commercial to quiet residential",
        ],
      },
      {
        type: "tip",
        text: "Alberta properties tend to book early for summer months, especially around Last Thursday dates. Our Alberta rentals are mostly 2-3 bedroom houses perfect for groups. See [Alberta Arts District rentals](/neighborhoods/alberta-arts-district).",
      },
      {
        type: "neighborhood-listings",
        tag: "Alberta",
        limit: 4,
        browseUrl: "/neighborhoods/alberta-arts-district",
        browseLabel: "Browse all Alberta Arts District rentals",
      },

      // ── 3. NW 23rd & Nob Hill ─────────────────────────────────────
      {
        type: "heading",
        text: "NW 23rd & Nob Hill: Shopping, Dining & Forest Park",
      },
      {
        type: "text",
        text: "Northwest Portland — specifically the Nob Hill and Alphabet District — is Portland's most polished neighborhood. NW 23rd Avenue is a walkable corridor of boutiques, brunch spots, and upscale restaurants. NW 21st runs parallel with more local gems. And just blocks west, Forest Park's 5,200 acres of trails begin — making NW Portland the rare neighborhood where you can have dinner at a world-class restaurant and hike through old-growth forest before breakfast.",
      },
      {
        type: "image",
        src: "/images/home/poi-nw23rd.jpg",
        alt: "NW 23rd Avenue shops and restaurants in Portland",
        caption:
          "NW 23rd Avenue — Portland's most walkable shopping and dining corridor",
      },
      {
        type: "text",
        text: "The residential streets of Nob Hill are among the most beautiful in the city — large Victorian and Craftsman homes on tree-lined blocks. This is where Book Traverse's Pomeroy building sits: boutique hotel-style suites with full kitchens, right in the heart of the NW walkable zone. Other NW rentals put you on quiet streets within a 5-minute walk of NW 23rd, Forest Park trailheads, and the Pearl District.",
      },
      {
        type: "best-for",
        tags: ["Upscale Travelers", "Nature Lovers", "Shoppers", "Families"],
      },
      {
        type: "pros-cons",
        pros: [
          "Most walkable shopping/dining corridor in Portland",
          "Forest Park trailheads within walking distance",
          "Beautiful residential architecture",
          "Streetcar access to Pearl District and downtown",
          "Excellent brunch scene (Besaws, Stepping Stone, Lovejoy Bakers)",
        ],
        cons: [
          "Tightest parking in the city — meters and permit zones",
          "Higher nightly rates than east side neighborhoods",
          "Can feel more tourist-oriented than SE or Alberta",
        ],
      },
      {
        type: "tip",
        text: "Parking is the biggest challenge in NW. Book a property with dedicated parking if you're driving. Our Pomeroy suites include parking and put you steps from NW 23rd. See [Northwest Portland rentals](/neighborhoods/nob-hill) or [The Pomeroy](/the-pomeroy).",
      },
      {
        type: "neighborhood-listings",
        tag: "NW 23rd",
        limit: 4,
        browseUrl: "/neighborhoods/nob-hill",
        browseLabel: "Browse all NW Portland rentals",
      },

      // ── 4. Pearl District ──────────────────────────────────────────
      {
        type: "heading",
        text: "Pearl District: Powell's, Galleries & Urban Living",
      },
      {
        type: "text",
        text: "The Pearl District is Portland's most urban neighborhood — converted warehouses, high-end galleries, and some of the city's best restaurants packed into a walkable grid. Powell's City of Books, the world's largest independent bookstore, anchors the neighborhood. Tanner Springs Park provides a green oasis. The Portland Streetcar runs through the Pearl, connecting you to downtown and NW Portland without needing a car.",
      },
      {
        type: "text",
        text: "The Pearl is where Portland's hotel and restaurant scene overlap most directly. You'll find the highest concentration of hotels here and downtown, alongside restaurants like Canard, Mediterranean Exploration Company, and Oven & Shaker. The neighborhood has a polished, urban feel — this is Portland's answer to SoHo or the West Loop. It's great for visitors who want walkability, culture, and dining density without needing to explore further afield.",
      },
      {
        type: "best-for",
        tags: [
          "Urban Explorers",
          "Book Lovers",
          "Art & Gallery Fans",
          "Business Travelers",
        ],
      },
      {
        type: "pros-cons",
        pros: [
          "Powell's City of Books and First Thursday gallery walks",
          "Highest restaurant density on the west side",
          "Streetcar + MAX access — no car needed",
          "Walking distance to downtown events and waterfront",
        ],
        cons: [
          "Most expensive area — hotels and rentals both cost more",
          "Parking is metered and valet-only at many buildings",
          'Less "Portland weird" — more polished and chain-adjacent',
          "Borders Old Town, which has visible homelessness",
        ],
      },
      {
        type: "tip",
        text: "The Pearl works best for short stays (1-2 nights) when you want to be close to downtown. For longer stays, the east side neighborhoods offer more space and character for less money. See [Pearl District rentals](/neighborhoods/pearl-district).",
      },
      {
        type: "neighborhood-listings",
        tag: "Pearl District",
        limit: 4,
        browseUrl: "/neighborhoods/pearl-district",
        browseLabel: "Browse all Pearl District rentals",
      },

      // ── 5. Mississippi Avenue ──────────────────────────────────────
      {
        type: "heading",
        text: "Mississippi Avenue: Music, Food Carts & Craft Beer",
      },
      {
        type: "text",
        text: "Mississippi Avenue has evolved from a quiet residential strip into one of Portland's most popular commercial corridors. The walk from Prost! (German-style beer hall) to Mississippi Studios (one of the best small music venues on the West Coast) takes five minutes, with a dozen excellent stops in between — Lovely's Fifty Fifty pizza, StormBreaker Brewing, and a rotating cast of food carts. It's compact, walkable, and has a curated feel without being precious.",
      },
      {
        type: "text",
        text: "The residential streets around Mississippi are classic NE Portland — modest bungalows with big yards, mature trees, and a neighborhood feel that disappears as soon as you step off the main drag. It's one of the best areas for travelers who want a genuine neighborhood experience with world-class dining within walking distance.",
      },
      {
        type: "best-for",
        tags: ["Music Fans", "Beer Lovers", "Casual Dining", "Couples"],
      },
      {
        type: "pros-cons",
        pros: [
          "Mississippi Studios for live music",
          "Excellent food cart pod and breweries",
          "Walkable main strip with neighborhood quiet on side streets",
          "Easy I-5 access for day trips to the coast or gorge",
          "Free residential parking",
        ],
        cons: [
          "Very few hotels — vacation rentals are the main option",
          "Compact commercial strip — less to explore on foot than Hawthorne",
          "Can get crowded on weekend evenings",
        ],
      },
      {
        type: "tip",
        text: "Mississippi is close to both Alberta (10 min walk) and the Lloyd District MAX station (10 min bus). It's a great central NE base. Browse [Mississippi Avenue rentals](/neighborhoods/mississippi-avenue).",
      },
      {
        type: "neighborhood-listings",
        tag: "Mississippi",
        limit: 4,
        browseUrl: "/neighborhoods/mississippi-avenue",
        browseLabel: "Browse all Mississippi Avenue rentals",
      },

      // ── 6. Division & Clinton ──────────────────────────────────────
      {
        type: "heading",
        text: "Division & Clinton: Portland's Restaurant Row",
      },
      {
        type: "text",
        text: "Division Street between SE 20th and SE 50th is Portland's densest restaurant corridor. This is where the city's culinary innovation happens — Ava Gene's, Langbaan, Pok Pok (now closed but its legacy spawned a dozen neighbors), and newcomers that change with the seasons. Clinton Street, running parallel one block south, is quieter and more residential with the iconic Clinton Street Theater, which has hosted Rocky Horror Picture Show screenings since the 1970s.",
      },
      {
        type: "text",
        text: 'This area overlaps with what locals call "inner SE" — between Hawthorne to the north and Woodstock to the south. Richmond and Foster-Powell are nearby sub-neighborhoods with lower prices and a growing food and drink scene. The area is well-connected by bus but is primarily a walking and biking neighborhood — the Springwater Corridor trail runs nearby for longer rides.',
      },
      {
        type: "best-for",
        tags: ["Foodies", "Date Nights", "Quiet Residential Stays"],
      },
      {
        type: "pros-cons",
        pros: [
          "Best restaurant density in Portland per block",
          "Quieter residential streets than Hawthorne",
          "Free parking on almost every street",
          "Close to Ladd's Addition (Portland's oldest planned neighborhood)",
        ],
        cons: [
          "Division can feel like a construction zone — new buildings going up",
          "Less nightlife than Hawthorne or Alberta",
          "Further from MAX light rail",
        ],
      },
      {
        type: "neighborhood-listings",
        tag: "Southeast",
        limit: 4,
        browseUrl: "/neighborhoods/se-portland",
        browseLabel: "Browse all Southeast Portland rentals",
      },

      // ── 7. Sellwood-Moreland ───────────────────────────────────────
      {
        type: "heading",
        text: "Sellwood-Moreland: Antiques, River Trails & Family-Friendly Calm",
      },
      {
        type: "text",
        text: "Sellwood-Moreland is Portland's antiques capital and one of its most family-friendly neighborhoods. Antique Row on SE 13th Avenue has a dozen shops packed into a few blocks. Sellwood Riverfront Park connects to the Springwater Corridor trail for miles of riverside walking and biking. The neighborhood has a quieter, almost small-town feel — families and dog-walkers outnumber bar-hoppers — but it's still just 15 minutes from the heart of SE Portland.",
      },
      {
        type: "image",
        src: "/images/home/poi-sellwood.jpg",
        alt: "Sellwood neighborhood street in Portland",
        caption:
          "Sellwood — Portland's antiques district with a small-town feel",
      },
      {
        type: "best-for",
        tags: [
          "Families",
          "Dog Owners",
          "Antique Hunters",
          "Runners & Cyclists",
        ],
      },
      {
        type: "pros-cons",
        pros: [
          "Quietest neighborhood on this list — ideal for families",
          "Antique Row is a unique Portland experience",
          "Riverfront trail access for running, biking, dog walking",
          "Free parking everywhere",
          "Lower nightly rates than inner SE or NW",
        ],
        cons: [
          "Further from the action — 15-20 min to Hawthorne by bus or car",
          "Limited nightlife and late-night dining",
          "No MAX access — bus or rideshare to other neighborhoods",
        ],
      },
      {
        type: "tip",
        text: "Sellwood properties are some of our most popular with families and guests traveling with dogs. Fenced yards are common. Browse [Sellwood-Moreland rentals](/neighborhoods/sellwood).",
      },
      {
        type: "neighborhood-listings",
        tag: "Sellwood Moreland",
        limit: 4,
        browseUrl: "/neighborhoods/sellwood",
        browseLabel: "Browse all Sellwood rentals",
      },

      // ── 8. St. Johns & North Portland ──────────────────────────────
      {
        type: "heading",
        text: "St. Johns & North Portland: Cathedral Park & Local Charm",
      },
      {
        type: "text",
        text: "North Portland feels like a small town inside a city. The St. Johns neighborhood centers around a main street with locally owned shops, restaurants, and one of Portland's best brewery clusters. Cathedral Park — beneath the gothic arches of the St. Johns Bridge — is one of the most photographed spots in Oregon. Overlook has panoramic views of downtown, Mt. Hood, and Mt. St. Helens on clear days. Kenton has the iconic Paul Bunyan statue and a growing restaurant scene on Denver Avenue.",
      },
      {
        type: "text",
        text: "North Portland is less touristy, more affordable, and deeply authentic. If you want Portland without the polish — real neighborhoods where your neighbors are locals, not other tourists — this is it. It's also the closest area to Forest Park's northern trailheads and a straight shot to Sauvie Island (berry farms, beaches, bird-watching, 20 minutes from St. Johns).",
      },
      {
        type: "best-for",
        tags: [
          "Budget Travelers",
          "Off-the-Beaten-Path",
          "Nature Access",
          "Local Vibes",
        ],
      },
      {
        type: "pros-cons",
        pros: [
          "Most affordable nightly rates in Portland",
          "Cathedral Park and St. Johns Bridge are stunning",
          "Strong local restaurant and brewery scene",
          "MAX Yellow Line through Overlook to downtown",
          "Close to Forest Park and Sauvie Island",
        ],
        cons: [
          "Furthest from SE Portland's restaurant scene",
          "St. Johns can feel isolated from the rest of the city",
          "Fewer dining options per block than inner neighborhoods",
        ],
      },
      {
        type: "tip",
        text: "North Portland is our recommendation for budget-conscious travelers who still want a great neighborhood experience. Nightly rates are typically 20-30% lower than Hawthorne or NW. Browse [North Portland rentals](/neighborhoods/north-portland).",
      },
      {
        type: "neighborhood-listings",
        tag: "North",
        limit: 4,
        browseUrl: "/neighborhoods/north-portland",
        browseLabel: "Browse all North Portland rentals",
      },

      // ── 9. Downtown Portland ───────────────────────────────────────
      {
        type: "heading",
        text: "Downtown Portland: Convenient, But Know What to Expect",
      },
      {
        type: "text",
        text: "We're going to be honest here because other guides aren't: downtown Portland has had a rough few years. The pandemic hit hard, some storefronts are still vacant, and visible homelessness is concentrated in parts of downtown — particularly Old Town/Chinatown and the northern blocks near the Greyhound station. That said, downtown has been improving through 2025-2026. Pioneer Courthouse Square, the Portland Art Museum, and the south end of downtown (near PSU and the South Park Blocks) feel active and safe. If you need to be near the Convention Center, Moda Center, or want the easiest airport MAX connection, downtown delivers.",
      },
      {
        type: "text",
        text: "Downtown also has the highest concentration of Portland hotels — this is where the boutique properties (Sentinel, Hotel deLuxe, Heathman) and major chains (Hilton, Marriott, Hyatt) cluster. For visitors who prefer a traditional hotel experience with a concierge, valet parking, and room service, downtown is the most practical base. Just know that Portland's best restaurants and nightlife are across the river in SE and NE — you'll Uber to dinner most nights.",
      },
      {
        type: "best-for",
        tags: [
          "Convention Attendees",
          "Hotel Lovers",
          "Short Stays",
          "Airport Access",
        ],
      },
      {
        type: "pros-cons",
        pros: [
          "Best hotel selection in Portland",
          "Direct MAX to airport (40 min, $2.80)",
          "Walking distance to Portland Art Museum, Pioneer Square, waterfront",
          "PSU Farmers' Market (Saturdays, Mar-Dec) is one of the best in America",
          "Convention Center and Moda Center nearby (MAX or short Uber)",
        ],
        cons: [
          "Visible homelessness, particularly in Old Town and northern blocks",
          "Restaurant and bar scene is weaker than SE, NE, or NW",
          "Hotel parking runs $35-50/night",
          "Can feel quiet at night outside of event times",
          "Most downtown hotels charge $25-40 daily amenity fees",
        ],
      },
      {
        type: "tip",
        text: "If you stay downtown, stick to the southern half — between Pioneer Courthouse Square and Portland State University. Avoid Old Town/Chinatown for lodging. And consider whether a vacation rental in Hawthorne or NW (15 min away) might give you a better Portland experience for the same price.",
      },

      // ── 10. Northeast Portland (Lloyd, Hollywood, Irvington) ───────
      {
        type: "heading",
        text: "Northeast Portland: Lloyd District, Hollywood & Irvington",
      },
      {
        type: "text",
        text: "Beyond Alberta and Mississippi, the broader Northeast Portland area includes several neighborhoods worth considering. The **Lloyd District** is Portland's secondary commercial center — home to the Moda Center (Trail Blazers, concerts), Lloyd Center, and the Oregon Convention Center. It has direct MAX access and is the most transit-connected neighborhood after downtown. **Hollywood** has the iconic Hollywood Theatre (a 1926 movie palace showing indie and classic films) and a walkable commercial strip. **Irvington** is one of Portland's most beautiful residential neighborhoods — Craftsman homes from the early 1900s on tree-lined streets, with easy access to both Alberta and Broadway.",
      },
      {
        type: "text",
        text: "NE Portland's biggest advantage is connectivity. The MAX has multiple stops throughout the area, and I-5 and I-84 access make it the easiest base for day trips to the Columbia River Gorge, Mt. Hood, and the Oregon Coast. If you're planning to explore beyond Portland, NE is strategically well-positioned.",
      },
      {
        type: "best-for",
        tags: [
          "Concert & Sports Fans",
          "Day Trippers",
          "Transit Riders",
          "Families",
        ],
      },
      {
        type: "pros-cons",
        pros: [
          "Best transit connections on the east side (multiple MAX lines)",
          "Closest to Moda Center, Convention Center, and Lloyd Center",
          "Easy freeway access for day trips (Gorge, Coast, Mt. Hood)",
          "Irvington has some of Portland's most beautiful homes",
          "More affordable than NW or Pearl, better connected than North",
        ],
        cons: [
          "Lloyd District is commercial — less neighborhood charm",
          "Hollywood has fewer dining options than other NE areas",
          "Further from SE Portland's restaurant corridor",
        ],
      },
      {
        type: "tip",
        text: "If you're attending an event at Moda Center or the Convention Center, staying in NE Portland is far more practical than downtown — and usually half the price. Browse [Northeast Portland rentals](/neighborhoods/ne-portland).",
      },
      {
        type: "neighborhood-listings",
        tag: "Northeast",
        limit: 4,
        browseUrl: "/neighborhoods/ne-portland",
        browseLabel: "Browse all Northeast Portland rentals",
      },

      // ── Hotels vs. Vacation Rentals ────────────────────────────────
      {
        type: "heading",
        text: "Portland Hotels vs. Vacation Rentals: How to Choose",
      },
      {
        type: "text",
        text: "Portland has solid boutique hotels downtown and in the Pearl, but the city's best experiences are in its residential neighborhoods — places most hotels haven't reached. A vacation rental puts you on a real Portland street, with a full kitchen, laundry, outdoor space, and room for your group. Book Traverse properties offer hotel-quality linens, professional cleaning, and 24/7 guest support — with the neighborhood immersion and space that hotels can't match.",
      },
      {
        type: "image",
        src: "/images/home/apt-pomeroy-living.jpg",
        alt: "Modern living room in a Book Traverse vacation rental",
        caption:
          "Hotel-quality design with the space and privacy of a real home",
      },
      {
        type: "text",
        text: "The price comparison often surprises visitors. For the cost of a single downtown hotel room ($200-350/night plus $35-50 parking and $25-40 amenity fees), you can typically book a full two-bedroom house in Hawthorne or Alberta — with a backyard, free parking, and a kitchen that saves you from eating every meal out. For larger groups, the math is even more compelling: a 4-bedroom Portland vacation rental can sleep 8-10 guests for the price of 2 hotel rooms.",
      },
      {
        type: "text",
        text: "Hotels make sense for one-night stays, business travel where the company is paying, or if you specifically want concierge services and valet parking. For everything else — families, friend groups, extended stays, couples who want to cook — a vacation rental wins on value, space, and location.",
      },

      // ── Getting Around ─────────────────────────────────────────────
      { type: "heading", text: "Getting Around Portland" },
      {
        type: "text",
        text: "Portland is one of the most walkable and bikeable cities in America. Once you're in your neighborhood, you probably won't need a car. The MAX light rail runs from the airport through downtown, the Pearl, Lloyd District, and into east Portland. The Portland Streetcar loops through NW Portland and the Pearl. TriMet buses cover the rest — the #14 Hawthorne and #72 Killingsworth are two of the most useful routes for visitors. Ride-sharing (Uber and Lyft) is affordable — a ride from SE to NW rarely costs more than $15.",
      },
      {
        type: "text",
        text: "If you're flying in, a rental car is useful for day trips to the Columbia River Gorge, Mt. Hood, or the Oregon Coast — but it's unnecessary for exploring the city itself. The MAX Red Line runs directly from PDX airport to downtown in about 40 minutes for $2.80.",
      },

      // ── When to Visit ──────────────────────────────────────────────
      { type: "heading", text: "When to Visit Portland" },
      {
        type: "text",
        text: "Portland's peak season runs June through September, when the weather is warm, dry, and reliably sunny. This is when nightly rates are highest and properties book furthest in advance. **July and August** are the busiest — expect to book 2-3 months ahead for popular neighborhoods. The Rose Festival (late May through mid-June) and Oregon Brewers Festival (late July) also drive demand.",
      },
      {
        type: "text",
        text: "The **shoulder seasons** (April-May, September-October) are our favorite time to recommend Portland. The city is green and vibrant, nightly rates drop 20-30%, and you'll have restaurants to yourself. **Winter** (November-March) is Portland's rainy season — gray and drizzly, but also when nightly rates are lowest and the food and drink scene is just as strong. Portland is fundamentally an indoor city in winter: coffee shops, breweries, restaurants, bookstores, and live music venues thrive year-round.",
      },

      // ── Book Direct CTA ────────────────────────────────────────────
      {
        type: "tip",
        text: "Book direct with Book Traverse to save up to 15.5% vs. Airbnb or VRBO. Same properties, no service fees, local support 24/7. [Browse all 275+ properties](/properties).",
      },
      {
        type: "tip",
        text: "Want to see these neighborhoods in action? Our [Portland neighborhoods tour](/plan/portland-neighborhoods-tour) is a 2-day itinerary across Alberta, Hawthorne, Mississippi, and the Pearl with a map, real places, and matching rentals. First-time visitors may prefer our [Portland weekend itinerary](/plan/portland-weekend-itinerary) — the city's greatest hits in two nights — and families should start with [Portland with kids](/plan/portland-with-kids-itinerary).",
      },

      // ── FAQ ────────────────────────────────────────────────────────
      { type: "heading", text: "Frequently Asked Questions" },
      {
        type: "faq",
        items: [
          {
            question: "Is downtown Portland safe for tourists?",
            answer:
              "Most of Portland is safe for visitors. Downtown has visible homelessness concentrated in Old Town/Chinatown and northern blocks, but the area around Pioneer Courthouse Square, the South Park Blocks, and the Pearl District is active and safe. The east side neighborhoods (Hawthorne, Alberta, Mississippi) feel very safe and walkable. Use the same common sense you'd apply in any city — don't leave valuables in your car, stay aware of your surroundings, and stick to well-lit commercial streets at night.",
          },
          {
            question: "What is the best neighborhood in Portland for families?",
            answer:
              "Sellwood-Moreland and NW Portland (Nob Hill) are our top picks for families. Sellwood has a quiet, small-town feel with riverfront parks, trails, and fenced-yard rentals. NW Portland puts you near Forest Park and the walkable NW 23rd corridor. Hawthorne is also great for families who want walkable dining — the residential side streets are quiet and safe. We have many family-friendly rentals with cribs, high chairs, and kid-proofed spaces.",
          },
          {
            question: "Where should I stay in Portland without a car?",
            answer:
              "The Pearl District and NW Portland are the most walkable neighborhoods with streetcar and MAX access. On the east side, the Lloyd District and neighborhoods near MAX stops (Hollywood, Alberta/Mississippi via bus) are well-connected. Hawthorne and Division are fully walkable once you're there. The MAX Red Line runs from the airport to downtown in 40 minutes for $2.80, so you can arrive car-free. Uber and Lyft fill any gaps — cross-town rides rarely exceed $15.",
          },
          {
            question: "How much do vacation rentals cost in Portland?",
            answer:
              "Nightly rates vary by neighborhood, size, and season. Studios and 1-bedrooms start around $89-130/night. Two-bedroom houses in popular neighborhoods like Hawthorne or Alberta typically run $150-250/night. Luxury properties and large group homes (4-8 bedrooms) range from $300-700/night. Summer (June-August) rates are 20-40% higher than winter. Booking direct with Book Traverse saves up to 15.5% compared to Airbnb.",
          },
          {
            question: "Are Airbnbs legal in Portland?",
            answer:
              "Yes, with regulations. Portland requires short-term rental permits and limits some types of whole-home rentals in certain zones. All Book Traverse properties are fully permitted and compliant with city regulations. We handle all permitting, taxes, and compliance — guests don't need to worry about legality when booking through us.",
          },
          {
            question: "What neighborhoods in Portland are the most walkable?",
            answer:
              "NW 23rd/Nob Hill, the Pearl District, and Hawthorne/Division are the most walkable neighborhoods in Portland. All three have dense commercial corridors where you can walk to restaurants, shops, and coffee without needing a car. Alberta and Mississippi are also walkable along their main strips. Walk Scores for Book Traverse properties in these neighborhoods typically range from 85-98 out of 100.",
          },
        ],
      },
    ],
  },

  // ─── 2. BEST RESTAURANTS ────────────────────────────────────────────
  {
    slug: "best-restaurants-portland",
    title: "Best Restaurants in Portland: A Local's Foodie Guide",
    metaTitle: "Best Restaurants in Portland | Local's Food Guide",
    metaDescription:
      "Portland's best restaurants — James Beard winners, legendary food carts, brunch spots, and international cuisine. A local's guide.",
    category: "food-drink",
    categoryLabel: "Food & Drink",
    author: "The Book Traverse Team",
    authorBio:
      "We host thousands of guests each year and always get asked: where should we eat? These are the restaurants we actually send people to.",
    publishedAt: "2026-02-24",
    updatedAt: "2026-03-08",
    heroImage: "/images/home/poi-hawthorne.jpg",
    heroAlt: "Hawthorne District restaurant street in Portland",
    excerpt:
      "Portland has more James Beard winners per capita than any city in America, a food cart culture unlike anywhere else, and farm-to-table that isn't a marketing slogan. Here's where to eat.",
    relatedSlugs: [
      "best-breweries-portland",
      "where-to-stay-in-portland",
      "portland-small-businesses",
    ],
    relatedLandingPages: ["southeast-portland", "northeast-portland"],
    content: [
      {
        type: "text",
        text: "Portland's food scene punches well above its weight. The city has more James Beard Award winners per capita than any city in the country, a food cart culture unlike anywhere else in America, and a farm-to-table philosophy that isn't a marketing slogan — it's how restaurants here actually operate. Oregon's Willamette Valley provides world-class produce, wine, and dairy within an hour's drive, and Portland's chefs take full advantage. Whether you're here for a weekend or a month, you won't run out of great places to eat.",
      },
      {
        type: "text",
        text: "What makes Portland's food scene different from other cities isn't just the quality — it's the accessibility. Portland's best restaurants are rarely pretentious. You can eat a James Beard-caliber meal in jeans and a T-shirt, and the price point is significantly lower than comparable food in San Francisco, Seattle, or New York. The city's size also means that most of the best restaurants are clustered in a few walkable neighborhoods, making it possible to hit three or four incredible spots in a single evening.",
      },
      { type: "heading", text: "Fine Dining & Special Occasions" },
      {
        type: "text",
        text: "These are Portland's destination restaurants — the ones worth building a trip around. Reservations recommended for all of them, especially on weekends. Most are in [Southeast Portland](/s/southeast-portland) and [Northeast Portland](/s/northeast-portland), Portland's two densest dining corridors.",
      },
      {
        type: "places",
        items: [
          {
            name: "Kann",
            detail:
              "Gregory Gourdet's James Beard-winning Haitian restaurant on SE MLK Jr. Blvd. The multicourse tasting menu is extraordinary — bold flavors, impeccable technique, warm service. Gourdet won Outstanding Chef in 2024.",
            url: "https://kannrestaurant.com",
          },
          {
            name: "Le Pigeon",
            detail:
              "Creative French-American cuisine in an intimate E Burnside setting. The burger and foie gras profiteroles are legendary. One of Portland's most celebrated restaurants for over a decade.",
            url: "https://lepigeon.com",
          },
          {
            name: "Eem",
            detail:
              "Thai-meets-Texas-BBQ in NE Portland. The brisket curry started as a joke between the chefs and became the best thing on the menu. Casual atmosphere, serious food.",
            url: "https://eempdx.com",
          },
          {
            name: "Ox",
            detail:
              "Wood-fired Argentine grill on NE MLK Jr. Blvd. Go hungry — the bone marrow and asado-style steak are enormous and worth every bite.",
            url: "https://oxpdx.com",
          },
          {
            name: "Ava Gene's",
            detail:
              "Italian and vegetable-forward with handmade pasta on SE Division. The seasonal tasting menu is the move — it changes constantly and always surprises.",
            url: "https://avagenes.com",
          },
          {
            name: "Canard",
            detail:
              "Le Pigeon's sibling next door — smaller, more casual, walk-in only. The wine list is excellent and the burger rivals any fine dining spot in the city. Perfect for a spontaneous great meal.",
            url: "https://canardpdx.com",
          },
        ],
      },
      {
        type: "text",
        text: "A note on reservations: Portland's fine dining scene is busy but not impossible. Most restaurants release reservations on Resy or OpenTable 2-4 weeks out. Weeknight tables (Tuesday through Thursday) are significantly easier to get than Friday or Saturday. If you're flexible on timing, late seatings (after 8:30 PM) often have availability even on weekends.",
      },
      {
        type: "image",
        src: "/images/home/poi-pearl.jpg",
        alt: "Pearl District dining area in Portland",
        caption:
          "The Pearl District — home to some of Portland's most celebrated restaurants and galleries",
      },
      { type: "heading", text: "Portland's Best Brunch" },
      {
        type: "text",
        text: "Portland takes brunch more seriously than most cities take dinner. Weekend waits at the popular spots can be brutal — 60 to 90 minutes at the biggest names — but they're worth it. Weekday mornings are the secret: most of these spots are walk-in friendly before 10 AM on Tuesday through Friday, and the food is identical.",
      },
      {
        type: "places",
        items: [
          {
            name: "Screen Door",
            detail:
              "The fried chicken and waffles are iconic Portland brunch. Expect a 60-90 minute weekend wait. E Burnside location. They take weekend reservations through Resy now — book if you can.",
            url: "https://screendoorrestaurant.com",
          },
          {
            name: "Gravy",
            detail:
              "Biscuits and gravy that justify the hype. Mississippi Avenue location with a laid-back neighborhood feel. Everything is made from scratch, and the hash options are some of the best in the city.",
            url: "https://gravyrestaurant.com",
          },
          {
            name: "Tasty n Alder",
            detail:
              "Downtown Portland's best brunch. The chocolate potato doughnut and steak and eggs are both perfect. Smaller space, shorter wait than Screen Door.",
            url: "https://tastynalder.com",
          },
          {
            name: "Pine State Biscuits",
            detail:
              "Southern-style biscuit sandwiches in NE Portland. The Reggie Deluxe (fried chicken, bacon, gravy) is a Portland institution. Cash only at some locations.",
            url: "https://pinestatebiscuits.com",
          },
          {
            name: "Sweedeedee",
            detail:
              "North Portland's best-kept breakfast secret. Small, seasonal, and always excellent. The baked goods alone are worth the trip.",
          },
          {
            name: "Proud Mary",
            detail:
              "Australian-style brunch on SE Division. The avocado toast and specialty coffee are world-class — the Melbourne coffee scene, transplanted to Portland.",
            url: "https://proudmarycoffee.com",
          },
        ],
      },
      {
        type: "tip",
        text: "Portland brunch runs late. Most spots serve until 2 or 3 PM, and some do brunch all day. If you're not a morning person, you can still get fried chicken and waffles at 1 PM on a Tuesday with zero wait.",
      },
      { type: "heading", text: "Casual & Neighborhood Dining" },
      {
        type: "text",
        text: "Not every great meal needs to be a destination. Portland's neighborhood restaurants are where locals eat most nights — unpretentious, reasonably priced, and consistently excellent. These are the spots you walk to when you don't feel like cooking but don't want to make a production of dinner.",
      },
      {
        type: "places",
        items: [
          {
            name: "Lardo",
            detail:
              "Pork-focused sandwiches and sides on SE Hawthorne. The dirty fries (pork scraps, marinated peppers, herbs) are legendary. Perfect lunch or casual dinner.",
            url: "https://lardosandwiches.com",
          },
          {
            name: "Tusk",
            detail:
              "Middle Eastern-inspired, vegetable-forward cooking on NE Glisan. Beautiful space, approachable menu, one of the best date-night spots in Portland.",
            url: "https://tuskpdx.com",
          },
          {
            name: "Scotch Lodge",
            detail:
              "Intimate cocktail bar and restaurant on SE Morrison. The food menu is small but every item is perfect. The whisky selection is among the deepest in the Pacific Northwest.",
          },
          {
            name: "Expatriate",
            detail:
              "Asian-influenced cocktail bar and small plates on NE Prescott. Tiny, intimate, and always surprising. The drinks are as good as the food.",
          },
        ],
      },
      { type: "heading", text: "Food Carts & Street Food" },
      {
        type: "image",
        src: "/images/home/poi-alberta.jpg",
        alt: "Alberta Arts District in Portland",
        caption:
          "Alberta Street — food carts, murals, and some of Portland's most eclectic dining",
      },
      {
        type: "text",
        text: "Portland's food cart pods are more than a novelty — many of the city's best meals come from 200-square-foot kitchens on wheels. There are 500+ food carts across the city, clustered in \"pods\" with communal seating, string lights, and a community atmosphere you won't find in a restaurant. Most carts are cash-friendly and open for lunch and dinner. The cart scene is also where Portland's most innovative cooking happens — chefs test concepts here before opening brick-and-mortar restaurants, and some never leave because the format works so well.",
      },
      {
        type: "places",
        items: [
          {
            name: "Cartopia",
            detail:
              "SE 12th and Hawthorne. Open late — Potato Champion's poutine is essential after midnight. One of Portland's original food cart pods and still one of the best.",
          },
          {
            name: "Portland Mercado",
            detail:
              "Latino food hall and cart pod on SE Foster. Que Bola? for Cuban sandwiches, Tierra del Sol for Venezuelan arepas. It's a cultural hub as much as a food destination.",
          },
          {
            name: "Matt's BBQ Tacos",
            detail:
              "Brisket tacos that rival any sit-down barbecue restaurant in the city. Multiple locations across Portland. The brisket birria taco is a must.",
          },
          {
            name: "Nong's Khao Man Gai",
            detail:
              "Thai chicken and rice that launched a Portland food empire. Simple, perfect, and available at multiple locations including a brick-and-mortar spot downtown.",
          },
          {
            name: "Güero",
            detail:
              "Mexican comfort food in a cart on SE Hawthorne. The al pastor and carnitas are on point, and the horchata is homemade. Always a line at lunch — for good reason.",
          },
        ],
      },
      {
        type: "text",
        text: "A few tips for the food cart experience: most pods have covered seating, so rain doesn't stop Portland food cart culture. Hours can be irregular — check Instagram or Google Maps for real-time status. And don't skip the drink carts: several pods have dedicated cocktail or coffee carts alongside the food.",
      },
      { type: "heading", text: "International Cuisine" },
      {
        type: "text",
        text: "Portland's immigrant communities have built some of the best international dining on the West Coast. These restaurants go well beyond the usual suspects — expect depth, authenticity, and flavors you won't find in most American cities. Portland's relative affordability has attracted chefs from around the world, and the city's openness to unusual food means that niche cuisines thrive here.",
      },
      {
        type: "places",
        items: [
          {
            name: "Afuri Ramen",
            detail:
              "This Japanese chain chose Portland for its only US outpost. The yuzu shio ramen is light, clean, and unlike any ramen you've had. The reason they picked Portland: water quality.",
            url: "https://afuri.us",
          },
          {
            name: "Kachka",
            detail:
              "Russian-inspired small plates, infused vodkas, and a cozy SE Grand atmosphere. The pelmeni and zakuski are fantastic. The vodka flights are an experience.",
            url: "https://kachkapdx.com",
          },
          {
            name: "Hat Yai",
            detail:
              "Southern Thai fried chicken in NE Portland. The namesake fried chicken has a crispy, turmeric-spiced coating you'll dream about. Named after a city in southern Thailand.",
            url: "https://hatyaipdx.com",
          },
          {
            name: "Langbaan",
            detail:
              "A 24-seat Thai tasting menu hidden behind PaaDee restaurant. Book weeks in advance — it's worth every bit of planning.",
            url: "https://langbaanpdx.com",
          },
          {
            name: "Bollywood Theater",
            detail:
              "Accessible, vibrant Indian street food on Alberta and Division. Great for groups and casual neighborhood dining.",
            url: "https://bollywoodtheaterpdx.com",
          },
          {
            name: "Basilisk",
            detail:
              "Filipino-inspired fried chicken and rice bowls in SE Portland. The garlic rice and vinegar-based sauces are addictive. One of the city's best casual lunch spots.",
          },
        ],
      },
      { type: "heading", text: "Coffee & Bakeries" },
      {
        type: "text",
        text: "Portland's coffee scene is among the best in the country — it helped define the \"third wave\" coffee movement alongside San Francisco and Melbourne. Most neighborhoods have at least one excellent roaster within walking distance, and the quality gap between Portland's average coffee shop and its best is remarkably small.",
      },
      {
        type: "places",
        items: [
          {
            name: "Stumptown Coffee",
            detail:
              "The original Portland third-wave roaster, founded in 1999. The SE Division location is the flagship. Hair Bender blend is the classic.",
            url: "https://stumptowncoffee.com",
          },
          {
            name: "Coava Coffee",
            detail:
              "Single-origin pour-over in a stunning SE Grand warehouse space. The brewing is meticulous and the space itself is worth the visit.",
            url: "https://coavacoffee.com",
          },
          {
            name: "Heart Coffee",
            detail:
              "Minimalist, precision-focused roaster in SE Portland. The espresso is among the best in the city, and the woodblock chocolate pairing is a Portland specialty.",
            url: "https://heartcoffee.com",
          },
          {
            name: "Ken's Artisan Bakery",
            detail:
              "The best bread in Portland, hands down. The Monday-night baguettes sell out fast. The pastries and croissants are also exceptional. NW Portland location.",
            url: "https://kensartisan.com",
          },
        ],
      },
      {
        type: "image",
        src: "/images/home/poi-sellwood.jpg",
        alt: "Sellwood neighborhood street in Portland",
        caption:
          "Sellwood — a quieter neighborhood with excellent bakeries and brunch spots",
      },
      { type: "heading", text: "Where to Eat by Neighborhood" },
      {
        type: "text",
        text: "If you're staying in a specific Portland neighborhood, here's a quick guide to what's within walking distance. **SE Portland** (Hawthorne/Division/Belmont): The densest restaurant scene in the city — fine dining, brunch, food carts, and international all within a few blocks. **NE Portland** (Alberta/Mississippi): Creative, eclectic dining with the city's best brunch concentration. **NW Portland/Pearl**: Upscale dining, excellent bakeries, and Portland's best coffee shops. **North Portland** (St. Johns/Kenton): Fewer options but growing fast — great for a low-key, local-feeling meal. **Sellwood**: Charming bakeries, brunch spots, and a few standout dinner restaurants.",
      },
      {
        type: "tip",
        text: "Most Portland restaurants change their menus seasonally. Summer unlocks the best patio dining and peak produce. For fine dining, book on Resy or OpenTable at least a week ahead.",
      },
      {
        type: "tip",
        text: "Stay in [Southeast Portland](/s/southeast-portland) to be walking distance from the highest concentration of restaurants in the city. A vacation rental with a kitchen also means you can hit the Portland Farmers Market (PSU, Saturdays year-round) and cook with incredible local produce.",
      },
      {
        type: "tip",
        text: "Want a ready-made restaurant-led itinerary? Our [Portland food itinerary](/plan/portland-food-itinerary) is a 2-day plan built around the kitchens, food carts, and coffee shops locals actually go to — with a map and matching vacation rentals. Or try our classic [Portland weekend itinerary](/plan/portland-weekend-itinerary) if you want the food scene mixed with the greatest hits.",
      },
    ],
  },

  // ─── 3. BEST BREWERIES ──────────────────────────────────────────────
  {
    slug: "best-breweries-portland",
    title: "The Best Breweries in Portland, Oregon",
    metaTitle: "12 Best Breweries in Portland (2026)",
    metaDescription:
      "70+ breweries, 12 worth the trip — from Wayfinder's lagers to Great Notion's hazy IPAs. Organized by neighborhood with food menus and outdoor seating noted.",
    category: "food-drink",
    categoryLabel: "Food & Drink",
    author: "The Book Traverse Team",
    authorBio:
      "Portland locals who have visited every brewery on this list — most of them more than once. We know which taprooms have the best patios, food, and pours.",
    publishedAt: "2026-02-25",
    updatedAt: "2026-03-07",
    heroImage: "/images/home/poi-mississippi.jpg",
    heroAlt: "Mississippi Avenue brewery district in Portland",
    excerpt:
      'Portland is "Beervana" — 70+ breweries, a beer culture that treats craft brewing like winemaking, and world-class pours in every neighborhood. Here\'s where to drink.',
    relatedSlugs: [
      "best-restaurants-portland",
      "where-to-stay-in-portland",
      "day-trips-from-portland",
    ],
    relatedLandingPages: [
      "northeast-portland",
      "southeast-portland",
      "north-portland",
    ],
    content: [
      {
        type: "text",
        text: 'Portland is "Beervana" — a city with more than 70 breweries and a beer culture that treats craft brewing the way wine country treats winemaking. Every neighborhood has at least one brewery worth visiting, and most have three or four. The scene ranges from experimental sour houses to old-school German-style lagerschenkes, with everything in between. You don\'t need a guided tour — just walk into any neighborhood and follow your nose.',
      },
      {
        type: "text",
        text: "What sets Portland apart from other beer cities isn't just the quantity — it's the variety and the quality floor. Even the \"average\" Portland brewery is making beer that would be the best option in most cities. The brewing community is collaborative, too: brewers share techniques, host collaboration brews, and genuinely root for each other. The result is a scene where innovation is constant, quality is high, and the atmosphere is welcoming whether you're a beer geek or someone who just wants something cold and good.",
      },
      { type: "heading", text: "Inner Southeast Breweries" },
      {
        type: "text",
        text: "Southeast Portland's inner neighborhoods — Buckman, Industrial, and the Central Eastside — have the highest brewery density in the city. You can hit four or five world-class taprooms without driving. Pair a [SE Portland brewery crawl](/s/southeast-portland) with dinner at one of the city's [best restaurants](/guide/best-restaurants-portland) nearby.",
      },
      {
        type: "image",
        src: "/images/home/poi-hawthorne.jpg",
        alt: "Hawthorne District in Southeast Portland",
        caption:
          "Southeast Portland — the epicenter of Portland's brewery and restaurant scene",
      },
      {
        type: "places",
        items: [
          {
            name: "Wayfinder Beer",
            detail:
              "The best lagers in Portland, hands down. The Czech-style pilsner and Japanese rice lager are impeccable. The food menu is excellent too — house-made sausages, pretzels, and a burger that rivals dedicated restaurants.",
            url: "https://wayfinder.beer",
          },
          {
            name: "Cascade Brewing",
            detail:
              "The original American sour brewery. The Barrel House on SE Belmont is a must for sour and wild ale fans — barrel-aged blends you won't find anywhere else. Some vintages are aged for years.",
            url: "https://cascadebrewing.com",
          },
          {
            name: "Hair of the Dog",
            detail:
              "One of Portland's originals, brewing since 1993. Strong ales and barleywines in an industrial-chic space. Adam and Fred are iconic. Not for the faint of ABV — most beers are 7-12%.",
          },
          {
            name: "Baerlic Brewing",
            detail:
              "Neighborhood brewery with unfussy, well-made beers and a great outdoor patio. Exactly what a local taproom should be. The Eastside Oatmeal Stout is a year-round favorite.",
          },
          {
            name: "Ruse Brewing",
            detail:
              "Small-batch, rotating taps in the Central Eastside industrial district. Every visit is different, and the quality is consistently high. A favorite among Portland's beer community.",
          },
        ],
      },
      {
        type: "text",
        text: "The Central Eastside Industrial District deserves special mention. This area south of Burnside has transformed from warehouses into one of Portland's most dynamic neighborhoods, with breweries, distilleries, and restaurants packed into former industrial spaces. You can walk from Wayfinder to Cascade to Ruse in under 15 minutes, with a dozen other options along the way.",
      },
      { type: "heading", text: "Northeast Portland Breweries" },
      {
        type: "text",
        text: "Northeast has some of Portland's most popular and inventive breweries, with taprooms spread across Alberta, Mississippi, and the Hollywood neighborhoods. The vibe here is a bit more neighborhood-focused than SE — you'll be drinking alongside locals rather than tourists.",
      },
      {
        type: "image",
        src: "/images/home/poi-alberta.jpg",
        alt: "Alberta Arts District in Northeast Portland",
        caption:
          "Alberta Arts District — home to Great Notion and some of Portland's most creative taprooms",
      },
      {
        type: "places",
        items: [
          {
            name: "Great Notion Brewing",
            detail:
              "Hazy IPAs, fruited sours, and pastry stouts with a cult following. The Alberta taproom has excellent food and is always buzzing. Double Stack and Blueberry Muffin are staples. Can releases regularly sell out in hours.",
            url: "https://greatnotion.com",
          },
          {
            name: "Breakside Brewery",
            detail:
              "Award-winning IPA and a constant rotation of experimental releases. Their IPA won the GABF gold medal and put Portland hazy IPAs on the national map. The Slabtown location has a full food menu.",
            url: "https://breakside.com",
          },
          {
            name: "Ex Novo Brewing",
            detail:
              "Portland's first nonprofit brewery — every pint supports a charitable cause. The beer is genuinely great, too. The Eliot location is the original and has a chill patio.",
            url: "https://exnovobrewing.com",
          },
          {
            name: "StormBreaker Brewing",
            detail:
              "Solid, dependable beers and a big patio in the Mississippi neighborhood. A good spot to start or end a Mississippi Ave crawl. The Triple IPA is not for beginners.",
          },
          {
            name: "Boneyard Beer",
            detail:
              "Originally from Bend, their NE Portland taproom brings central Oregon brewing energy to the city. RPM IPA is one of the best West Coast IPAs in the state.",
          },
        ],
      },
      { type: "heading", text: "North Portland Breweries" },
      {
        type: "text",
        text: "North Portland's brewery scene is quietly excellent and significantly less crowded than SE or NE on weekends. If you're staying in North Portland — [St. Johns, Kenton, or Overlook](/s/north-portland) — you have several excellent options within a short drive or bike ride.",
      },
      {
        type: "places",
        items: [
          {
            name: "Ecliptic Brewing",
            detail:
              "Founded by a former Deschutes brewer who also builds telescopes. Space-themed beers that are genuinely stellar. The Starburst IPA and Phaser Hazy are standouts. The patio has one of the best outdoor setups in the city.",
            url: "https://eclipticbrewing.com",
          },
          {
            name: "Occidental Brewing",
            detail:
              "German-style lagers and wheat beers done right. The Kolsch is crisp and perfect for a summer afternoon. The Cathedral Park location is a short walk from the St. Johns Bridge.",
            url: "https://occidentalbrewing.com",
          },
          {
            name: "Cathedral Park Brewing",
            detail:
              "A newer addition to the St. Johns brewery scene, right in the heart of the neighborhood. Good selection of approachable styles and a comfortable taproom. Walking distance from Cathedral Park itself.",
          },
        ],
      },
      { type: "heading", text: "Pearl District & Northwest" },
      {
        type: "image",
        src: "/images/home/poi-nw23rd.jpg",
        alt: "NW 23rd Avenue in Portland",
        caption:
          "The Pearl District and NW Portland — Portland's most walkable brewery-to-dinner corridor",
      },
      {
        type: "text",
        text: "The Pearl District has Portland's most tourist-visible breweries. Good beer, premium locations, bigger crowds. These work well if you're already in the area for [Powell's Books or NW 23rd shopping](/guide/portland-small-businesses), but don't make a special trip across town just for the beer — the east side has better options.",
      },
      {
        type: "places",
        items: [
          {
            name: "Deschutes Brewery",
            detail:
              "Bend's flagship Portland location. Mirror Pond and Fresh Squeezed are Oregon classics. The Pearl District taproom has a solid food menu and is a reliable option after a Powell's visit.",
            url: "https://deschutesbrewery.com",
          },
          {
            name: "10 Barrel Brewing",
            detail:
              "Rooftop bar with downtown views and a rotating tap list. Good for groups and people-watching. The rooftop is one of the best warm-weather drinking spots in the city.",
            url: "https://10barrel.com",
          },
        ],
      },
      { type: "heading", text: "Destination Breweries" },
      {
        type: "text",
        text: "These breweries are worth a trip for the setting alone — unusual spaces, ambitious food programs, or just something you won't find elsewhere.",
      },
      {
        type: "places",
        items: [
          {
            name: "Steeplejack Brewing",
            detail:
              "Set in a beautifully restored church with stained glass windows and soaring ceilings. The space alone is worth the trip. Wide range of styles on tap, and the atmosphere is unlike anything else in Portland.",
            url: "https://steeplejackbeer.com",
          },
          {
            name: "Culmination Brewing",
            detail:
              "NE Portland gem with adventurous seasonal releases, a strong food menu, and a big patio. One of Portland's most underrated breweries. The Belgian-style ales are especially good.",
          },
          {
            name: "Von Ebert Brewing",
            detail:
              "Two locations — one in the Pearl (inside a historic building), one at Glendoveer. Both have excellent chef-driven food programs alongside the beer. The Pearl location is in the old Henry Weinhard brewery building.",
          },
        ],
      },
      { type: "heading", text: "Beyond Beer: Cider, Wine & Spirits" },
      {
        type: "text",
        text: "Portland's craft beverage scene extends well beyond beer. If someone in your group isn't a beer drinker, they'll still have an excellent time. **Portland Cider Company** and **Reverend Nat's** offer cider taprooms with creative, food-friendly options. **Enso Winery** and **Southeast Wine Collective** are urban wineries in the Central Eastside, pouring Willamette Valley wines without the drive to wine country. For spirits, **House Spirits Distillery** (makers of Aviation Gin) and **New Deal Distillery** have tasting rooms in SE Portland. Several breweries also have cider and wine on tap for non-beer drinkers.",
      },
      { type: "heading", text: "Planning a Brewery Crawl" },
      {
        type: "text",
        text: "The best brewery crawls in Portland are walkable. Here are three routes that work without a car: **SE Industrial Crawl** — Wayfinder → Cascade → Hair of the Dog → Ruse (all within 1 mile). **Alberta/Mississippi Crawl** — Great Notion → StormBreaker → Ex Novo (about 1.5 miles total, with food carts and shops between stops). **St. Johns Crawl** — Occidental → Cathedral Park Brewing, then dinner on the St. Johns main street. Each route takes 3-4 hours at a relaxed pace with a flight or pint at each stop.",
      },
      {
        type: "tip",
        text: "Skip the Pearl District if you're short on time — the best beer is in the neighborhoods. SE and NE Portland have 20+ breweries within biking distance of each other. If you're visiting in summer, check our [Portland summer events guide](/guide/portland-summer-events-2026) for beer festivals and outdoor concerts to pair with your brewery crawl.",
      },
      {
        type: "tip",
        text: "Portland is one of the most bike-friendly cities in America. Rent a bike and brewery-hop — it's how locals do it, and it solves the designated-driver problem. Stay in a [Northeast Portland rental](/s/northeast-portland) to be walking distance from Great Notion, Breakside, and Ex Novo.",
      },
      {
        type: "tip",
        text: "Want to work a brewery crawl into a full weekend? Our [Portland food itinerary](/plan/portland-food-itinerary) weaves craft beer into a two-day plan anchored in inner SE, and the [Portland weekend itinerary](/plan/portland-weekend-itinerary) adds one brewery to the classic two-night greatest-hits loop. Both include a map and matching vacation rentals.",
      },
    ],
  },

  // ─── 4. BEST PARKS ──────────────────────────────────────────────────
  {
    slug: "best-parks-portland",
    title: "The Best Parks in Portland, Oregon",
    metaTitle: "15 Best Parks in Portland — A Local's Guide",
    metaDescription:
      "280+ parks and 11,000 acres of green space. From Forest Park's 80 miles of trails to an extinct volcano with skyline views — directions, parking, and highlights.",
    category: "outdoors",
    categoryLabel: "Outdoors & Nature",
    author: "The Book Traverse Team",
    authorBio:
      "We manage properties near every major park in Portland. Our guests hike Forest Park, picnic at Mt. Tabor, and walk their dogs at Sellwood — we know the trails and the shortcuts.",
    publishedAt: "2026-02-26",
    updatedAt: "2026-03-06",
    heroImage: "/images/home/photo-1645934430496-6cae81215bf9.jpeg",
    heroAlt: "Green park space in Portland, Oregon",
    excerpt:
      "Portland has 280+ parks covering 11,000 acres. From a 5,200-acre urban forest to an extinct volcano summit, here are the parks worth visiting.",
    relatedSlugs: [
      "day-trips-from-portland",
      "where-to-stay-in-portland",
      "portland-events-festivals",
    ],
    relatedLandingPages: ["pet-friendly", "family-friendly"],
    content: [
      {
        type: "text",
        text: "Portland is one of the greenest cities in America — literally. With more than 280 parks covering over 11,000 acres, nature is never more than a few blocks away, no matter [where you stay](/guide/where-to-stay-in-portland). From a 5,200-acre temperate rainforest to extinct volcanic peaks, riverside trails, and formal rose gardens, Portland's parks are a major reason people fall in love with this city.",
      },
      {
        type: "text",
        text: "What makes Portland's park system exceptional isn't just the headline parks — it's that even the small neighborhood parks are well-maintained, beautiful, and genuinely used by locals. Portland's mild climate means parks are usable year-round. Winter hikes in Forest Park are moody and quiet, spring brings cherry blossoms and rhododendrons, summer opens outdoor concerts and festival grounds, and fall foliage rivals the Northeast. If you want even more outdoor adventure, the [best day trips from Portland](/guide/day-trips-from-portland) are all within 90 minutes.",
      },
      { type: "heading", text: "Forest Park" },
      {
        type: "text",
        text: "Forest Park is Portland's crown jewel — 5,200 acres of temperate rainforest within city limits, making it one of the largest urban forests in the world. The Wildwood Trail runs 30+ miles through the park, but you don't need to commit to a full day. The Lower Macleay Trail is a popular 2.5-mile out-and-back that passes the Stone House (locals call it the Witch's Castle) — a moss-covered ruin deep in the forest. The trailhead is in NW Portland, minutes from the Pearl District. In the mornings, it's quiet enough that you'll forget you're inside a city of 650,000 people.",
      },
      {
        type: "text",
        text: "For a longer adventure, the **Leif Erikson Drive** trail is an 11-mile gravel road through the park's interior — flat, wide, and perfect for running or mountain biking. The **Firelane trails** branch off Leif Erikson into steeper, less-traveled forest. Serious hikers can connect Wildwood Trail to Pittock Mansion, a 1914 French Renaissance mansion with panoramic views of the city, the Willamette River, and five Cascade peaks. The mansion grounds are free to visit; the interior is a small museum with a modest admission fee.",
      },
      { type: "heading", text: "Washington Park" },
      {
        type: "text",
        text: "Washington Park packs several of Portland's biggest attractions into one hillside. The [International Rose Test Garden](https://www.travelportland.com/attractions/international-rose-test-garden/) (free admission, 10,000+ rose bushes) offers stunning views of Mt. Hood on clear days — peak bloom is June through September. The [Portland Japanese Garden](https://japanesegarden.org/) is considered one of the most authentic outside Japan — peaceful, immaculate, and worth the admission price. The Oregon Zoo and the Portland Children's Museum are also here. Connected trails lead directly into Forest Park, so you can start with roses and end with a forest hike.",
      },
      {
        type: "text",
        text: "Getting to Washington Park is easy: the MAX Blue Line has a stop deep inside the park (Washington Park station is 260 feet underground — the deepest transit station in North America). By car, parking is free but fills up on summer weekends. The most scenic approach is walking up from NW Portland through the park's winding paths.",
      },
      { type: "heading", text: "Mt. Tabor Park" },
      {
        type: "image",
        src: "/images/home/portland-sunset-skyline.jpg",
        alt: "Portland skyline at sunset",
        caption:
          "The view from Mt. Tabor at sunset — Mt. Hood and the Portland skyline",
      },
      {
        type: "text",
        text: "Mt. Tabor sits on top of an extinct cinder cone volcano — one of only a few city parks in the world built on a volcano. The summit offers 360-degree views of Portland, Mt. Hood, Mt. St. Helens, and the Willamette Valley. It's the best sunset spot in the city, bar none. Locals come here to run the stairs, walk the reservoir loops, and catch free summer concerts in the amphitheater. Located in SE Portland, it's walkable from many of our vacation rentals.",
      },
      {
        type: "text",
        text: "The park has multiple entrances and trails at different grades. The main road to the summit is paved and accessible. The south side has steeper trails and more tree cover. The open reservoirs on the west side are iconic Portland — geometric concrete pools reflecting the sky, surrounded by old-growth Douglas firs. On summer evenings, the summit meadow fills with picnickers, dog walkers, and people watching the sun set behind the West Hills.",
      },
      { type: "heading", text: "Cathedral Park" },
      {
        type: "text",
        text: "Cathedral Park sits beneath the gothic arches of the St. Johns Bridge — one of the most photogenic spots in Oregon. The bridge's soaring columns frame the park's riverside lawns like a cathedral nave. It's a popular location for weddings, portrait photography, and summer concerts. Visit during golden hour for the best light. The St. Johns neighborhood around the park is worth exploring for its small-town feel, local shops, and [brewery scene](/guide/best-breweries-portland).",
      },
      {
        type: "text",
        text: "The park also has river access for kayaking and canoeing, a paved path along the water, and picnic areas under the bridge. On summer weekends, the annual Cathedral Park Jazz Festival fills the grounds with music. The St. Johns Bridge itself is worth walking across — the sidewalks are wide, and the views of the Willamette River and Forest Park's tree canopy are some of the best in the city.",
      },
      { type: "heading", text: "Tom McCall Waterfront Park" },
      {
        type: "text",
        text: "This 36-acre riverside park stretches along the Willamette River through downtown Portland. It's the venue for the city's biggest events — [Rose Festival](/guide/portland-summer-events-2026), Saturday Market, [Blues Festival](/guide/portland-summer-events-2026), and the 4th of July fireworks. The paved path is ideal for running, biking, and walking, with views of Portland's distinctive bridges and the downtown skyline. The Hawthorne Bridge end connects to SE Portland's restaurant district, and the Steel Bridge's lower deck has a pedestrian walkway right at water level.",
      },
      { type: "heading", text: "More Parks Worth Visiting" },
      {
        type: "image",
        src: "/images/home/poi-sellwood.jpg",
        alt: "Sellwood neighborhood near the riverfront parks",
        caption:
          "Sellwood — walkable to Sellwood Riverfront Park and Oaks Bottom Wildlife Refuge",
      },
      {
        type: "places",
        items: [
          {
            name: "Laurelhurst Park",
            detail:
              "Designed by the firm behind Central Park. Beautiful duck pond, old-growth trees, and a popular off-leash dog area. A perfect SE Portland afternoon. Free summer concerts on the lawn.",
            url: "https://www.portland.gov/parks/laurelhurst-park",
          },
          {
            name: "Peninsula Park",
            detail:
              "North Portland gem with Portland's first public rose garden, a stunning central fountain, and formal symmetrical gardens. Best in summer when the roses are in full bloom. The adjacent community center has an indoor pool.",
          },
          {
            name: "Sellwood Riverfront Park",
            detail:
              "Large off-leash dog area, river access, and trails connecting to Oaks Bottom Wildlife Refuge. The most dog-friendly park in Portland. The adjacent Oaks Amusement Park is a charming, old-fashioned theme park and roller rink.",
          },
          {
            name: "Oaks Bottom Wildlife Refuge",
            detail:
              "163-acre wetland in the middle of SE Portland. Excellent birding (herons, hawks, songbirds), peaceful trails, and a surprising sense of wildness for a park surrounded by neighborhoods.",
          },
          {
            name: "Kelley Point Park",
            detail:
              "Where the Willamette River meets the Columbia River at Portland's northernmost tip. Sandy beaches, river swimming in summer, and a remote feel despite being inside the city. Bring a picnic.",
          },
          {
            name: "Powell Butte Nature Park",
            detail:
              "East Portland's hidden gem — a 600-acre extinct volcano with meadow trails, mountain views, and equestrian paths. Less crowded than Mt. Tabor with similar views. Great for trail running.",
          },
        ],
      },
      { type: "heading", text: "Seasonal Guide" },
      {
        type: "text",
        text: "**Spring (March-May)**: Cherry blossoms at Tom McCall Waterfront Park and Peninsula Park. Rhododendrons in Crystal Springs Garden. Wildflowers on Powell Butte. Waterfalls at peak flow in Forest Park. **Summer (June-September)**: Peak rose bloom at Washington Park. Free concerts at Mt. Tabor and Cathedral Park. River swimming at Kelley Point and Sellwood. Long evenings on every patio and lawn in the city. **Fall (October-November)**: Spectacular foliage at Laurelhurst Park and Mt. Tabor. Mushroom foraging in Forest Park (with a guide). Moody, atmospheric walks along the Wildwood Trail. **Winter (December-February)**: Quiet Forest Park hikes through moss-draped canopy. ZooLights at the Oregon Zoo. Crisp reservoir walks at Mt. Tabor after a frost.",
      },
      {
        type: "tip",
        text: "Forest Park's Lower Macleay Trail is a 2.5-mile out-and-back — perfect for a morning hike before brunch. Start at the NW Upshur trailhead and reward yourself with breakfast at one of Portland's [best restaurants](/guide/best-restaurants-portland). For Mt. Tabor, go at sunset — the views east to Mt. Hood are unforgettable.",
      },
      {
        type: "tip",
        text: "Traveling with a dog? Portland is extremely dog-friendly — the city has more off-leash dog parks per capita than almost anywhere in the US. Several of our [pet-friendly rentals](/s/pet-friendly) have fenced yards and are walking distance to off-leash areas. Laurelhurst, Sellwood Riverfront, and Gabriel Park all have dedicated off-leash zones.",
      },
      {
        type: "tip",
        text: "Want a parks-led itinerary? Our [Portland outdoors itinerary](/plan/portland-outdoors-itinerary) is a 3-day plan that pairs Forest Park and in-city parks with Gorge and Mt. Hood day trips. Families should start with [Portland with kids](/plan/portland-with-kids-itinerary) — the plan anchors around parks, playgrounds, and kid-friendly food.",
      },
    ],
  },

  // ─── 5. DAY TRIPS ───────────────────────────────────────────────────
  {
    slug: "day-trips-from-portland",
    title: "Best Day Trips from Portland, Oregon",
    metaTitle: "10 Best Day Trips from Portland (2026)",
    metaDescription:
      "Day trips from Portland ranked by a local — Columbia River Gorge, Oregon Coast, wine country, Mt. Hood, Hood River. Drive times, best seasons, what to do.",
    category: "outdoors",
    categoryLabel: "Outdoors & Nature",
    author: "The Book Traverse Team",
    authorBio:
      "We send guests on day trips every week. These are the exact recommendations we give — tested routes, timing tips, and the stops most visitors miss.",
    publishedAt: "2026-02-27",
    updatedAt: "2026-03-09",
    heroImage: "/images/home/photo-1656975188530-44ac2e9446f7.jpeg",
    heroAlt: "Scenic landscape near Portland, Oregon",
    excerpt:
      "Within 90 minutes of Portland you can stand beneath a 620-foot waterfall, walk an ocean beach, taste world-class Pinot Noir, or ski a glaciated volcano. Here are the best day trips.",
    relatedSlugs: [
      "best-parks-portland",
      "portland-events-festivals",
      "where-to-stay-in-portland",
    ],
    relatedLandingPages: ["mt-hood", "family-friendly"],
    content: [
      {
        type: "text",
        text: "Portland's location is one of its biggest advantages. Within 90 minutes, you can be standing at the base of a 620-foot waterfall, walking on an ocean beach, tasting Pinot Noir at a world-class winery, or skiing on a glaciated volcano. Oregon's diversity is remarkable, and Portland sits right at the center of it. Use Portland as your home base — [choose the right neighborhood](/guide/where-to-stay-in-portland) and take day trips from a comfortable [vacation rental](/properties).",
      },
      {
        type: "text",
        text: "All of these day trips are doable in a single day with time to spare. A rental car is recommended for most (Portland's transit system is great for the city but doesn't reach the coast or wine country). If you're here for a week, you could easily fill four or five days with day trips and still have time to explore Portland's [restaurants](/guide/best-restaurants-portland), [breweries](/guide/best-breweries-portland), and [parks](/guide/best-parks-portland). Here are the best day trips, roughly in order of how frequently our guests do them.",
      },
      { type: "heading", text: "Columbia River Gorge" },
      {
        type: "text",
        text: "The Gorge is Portland's backyard — a 4,000-foot-deep canyon carved by the Columbia River, lined with more than 90 waterfalls. Multnomah Falls (620 feet, the tallest in Oregon) is the iconic stop, but locals know to head to Latourell Falls instead — it's 10 minutes closer to Portland, just as stunning, and has a fraction of the crowds. For a longer hike, Eagle Creek Trail winds past Punchbowl Falls and Tunnel Falls through moss-draped canyon walls. The Historic Columbia River Highway, America's first scenic highway, connects the major viewpoints and trailheads with gorgeous stone bridges and vista houses.",
      },
      {
        type: "image",
        src: "/images/home/portland-sunset-skyline.jpg",
        alt: "Portland skyline with mountains in the distance",
        caption:
          "On clear days, the Cascade peaks are visible from Portland — the Gorge and Mt. Hood are closer than they look",
      },
      {
        type: "text",
        text: "**Suggested Gorge itinerary**: Leave Portland by 8:30 AM. Stop at Vista House at Crown Point for panoramic Gorge views. Continue to Latourell Falls (short, easy walk), then Wahkeena Falls or Bridal Veil. End at Multnomah Falls for the obligatory photo. If you're up for a real hike, skip the quick stops and head straight to Eagle Creek (7.8 miles round trip to Tunnel Falls). On the way back, stop in Troutdale for a beer at McMenamins Edgefield — a 74-acre former poor farm turned hotel, brewery, winery, and concert venue.",
      },
      {
        type: "tip",
        text: "30 miles east, 45 minutes. Go on a weekday — weekend traffic on I-84 can add an hour. Arrive by 9 AM to beat the crowds at Multnomah Falls. The falls parking lot requires a timed reservation May through September.",
      },
      { type: "heading", text: "Oregon Coast" },
      {
        type: "text",
        text: "The Oregon Coast is 90 minutes west and feels like another world. Cannon Beach is the postcard — Haystack Rock rising from the sand, tide pools at its base, art galleries and seafood restaurants in town. Seaside has a classic boardwalk, saltwater taffy shops, and the Seaside Aquarium. For something less touristy, drive north to Astoria — the oldest American settlement west of the Rockies, with Victorian architecture, excellent breweries (Buoy Beer and Fort George), and views of the Columbia River meeting the Pacific. The entire Oregon coastline is public by law — no private beaches, ever.",
      },
      {
        type: "text",
        text: "**Suggested coast itinerary**: Take Highway 26 to Cannon Beach (fastest route, 90 min). Walk the beach at low tide to explore Haystack Rock tide pools. Have lunch at Driftwood Restaurant or The Wayfarer. Drive 20 minutes south to Manzanita for a quieter beach town feel. Or drive north to Astoria (30 min from Cannon Beach), walk the Astoria Column for 360-degree views, then have beers at Fort George Brewery. Return to Portland via Highway 30 along the Columbia River for a different scenic route. The whole loop takes about 8 hours with stops.",
      },
      {
        type: "tip",
        text: "80 miles, 90 minutes. For a scenic route, take Highway 30 through St. Helens to Astoria, then drive south along the coast to Cannon Beach, and return via Highway 26. Less congested than the reverse and gives you two different landscapes.",
      },
      { type: "heading", text: "Willamette Valley Wine Country" },
      {
        type: "text",
        text: "Oregon's Willamette Valley is one of the world's premier Pinot Noir regions, and it starts just 40 minutes south of Portland. The Dundee Hills are the easiest first stop — Domaine Drouhin, Sokol Blosser, and Erath are all within a few miles of each other, with stunning valley views from their tasting rooms. Most charge $15-25 for a tasting and waive the fee with a bottle purchase. For a more intimate experience, explore the smaller producers in the Eola-Amity Hills or around McMinnville.",
      },
      {
        type: "text",
        text: "**Suggested wine itinerary**: Start in Dundee Hills by 11 AM. Hit two or three wineries before lunch — **Domaine Drouhin** for classic Burgundian-style Pinot, **Sokol Blosser** for the views and sustainable farming story, and **Archery Summit** for the cave tour. Have lunch at **Red Hills Market** in Dundee (excellent sandwiches and pizza) or drive 20 minutes to **McMinnville** for a proper sit-down meal — Nick's Italian Cafe or Thistle are both outstanding. Afternoon visit to one more winery on the way back. You'll be home by 5 or 6 PM.",
      },
      {
        type: "tip",
        text: "40 miles south, 50 minutes. Most tasting rooms are open 11 AM-5 PM and don't require reservations on weekdays. Weekend appointments recommended for popular wineries. Designate a driver or book a tour — Oregon wine country tours run from Portland daily.",
      },
      { type: "heading", text: "Mt. Hood" },
      {
        type: "text",
        text: "Mt. Hood is Oregon's tallest peak (11,249 feet) and Portland's year-round outdoor playground — visible on clear days from all over the city. Timberline Lodge, a stunning 1930s WPA masterpiece, offers skiing and snowboarding 12 months a year on the Palmer Glacier. In summer, the Timberline Trail and Mirror Lake hike are accessible to most fitness levels and reward you with alpine meadows and glacial views. The village of Government Camp at the mountain's base has gear shops, restaurants, and the Mt. Hood Brewing Company.",
      },
      {
        type: "text",
        text: "**Summer on Mt. Hood**: The Mirror Lake hike (3.2 miles round trip) is the most accessible alpine experience — a forested trail opening to a mountain lake with Hood's peak reflected in the water. The Timberline Trail circumnavigates the entire mountain (41 miles), but you can hike beautiful sections as day trips. Ramona Falls (7.1 miles round trip) is a stunning 120-foot cascade that fans across a mossy basalt cliff. **Winter on Mt. Hood**: Timberline, Mt. Hood Meadows, and Skibowl offer skiing and snowboarding from November through May (and summer glacier skiing at Timberline).",
      },
      {
        type: "tip",
        text: "60 miles east, 75 minutes. Timberline Lodge is a National Historic Landmark and worth visiting even if you don't ski — the architecture and WPA murals are incredible. Browse our [Mt. Hood rentals](/s/mt-hood) for stays closer to the mountain.",
      },
      { type: "heading", text: "Hood River" },
      {
        type: "text",
        text: "If Mt. Hood is Portland's playground, Hood River is its adventure resort town. This small Gorge community is the windsurfing and kiteboarding capital of North America, with consistent winds funneling through the Columbia River Gorge. Even if wind sports aren't your thing, Hood River has excellent breweries (pFriem Family Brewers and Double Mountain are both outstanding — see our [Portland brewery guide](/guide/best-breweries-portland) for more), orchards, cideries, and the famous Fruit Loop — a 35-mile scenic drive through apple and pear orchards with farm stands, tasting rooms, and alpaca farms along the way.",
      },
      {
        type: "text",
        text: "**Combine Hood River + Gorge**: The most efficient day trip combines the Gorge and Hood River. Drive I-84 east, stopping at Gorge waterfalls along the way. Continue to Hood River for lunch (pFriem's riverside patio is the move) and a Fruit Loop drive in the afternoon. Return via I-84 or loop back through Mt. Hood for a totally different landscape. This makes for a full day but covers two of Oregon's best attractions.",
      },
      {
        type: "tip",
        text: "60 miles east, 65 minutes via I-84. Visit in fall for peak orchard season and harvest festivals. The Fruit Loop drive takes 2-3 hours with stops.",
      },
      { type: "heading", text: "Silver Falls State Park" },
      {
        type: "text",
        text: "Oregon's largest state park features the Trail of Ten Falls — an 8.7-mile loop that passes behind, beside, and below 10 separate waterfalls. It's the most waterfall-dense hike in the Pacific Northwest. The trail is well-maintained and moderate in difficulty, with the option to shorten it by turning around at South Falls (a 2-mile out-and-back that still gives you the park's most dramatic waterfall — a 177-foot curtain you can walk behind). Go in spring when snowmelt pushes the falls to peak flow.",
      },
      {
        type: "text",
        text: "The full loop takes most people 4-5 hours at a moderate pace with photo stops. The trail has some elevation change but nothing technical — sturdy shoes are fine, hiking boots aren't required. There's a lodge at the main entrance with food and restrooms, and the park has camping if you want to extend the trip. Silver Falls is also just 30 minutes from the Willamette Valley wine region, making it possible to combine a morning hike with an afternoon wine tasting.",
      },
      {
        type: "tip",
        text: "65 miles south, 75 minutes. Bring layers and a rain jacket — the trail passes through forest and behind waterfalls, so you will get misted. There's a $5 parking fee. Go clockwise from South Falls for the best waterfall progression.",
      },
      { type: "heading", text: "Planning Your Day Trips" },
      {
        type: "text",
        text: "If you have limited time, prioritize the **Columbia River Gorge** (closest, most dramatic, easiest logistics) and **Willamette Valley wine country** (closest, most relaxing). If you have a full week, add the **Oregon Coast** (best for a full-day adventure), **Mt. Hood** (best for active travelers), and **Hood River** (best combined with the Gorge). Silver Falls is ideal for hikers who want something more ambitious than Forest Park. All of these trips benefit from an early start — Oregon mornings are beautiful, and you'll avoid crowds and traffic.",
      },
      {
        type: "tip",
        text: "Want a ready-made itinerary that includes a day trip? Browse our [Portland outdoors itinerary](/plan/portland-outdoors-itinerary) — three nights anchored in the city with Gorge and Mt. Hood days built in — or the [Portland weekend itinerary](/plan/portland-weekend-itinerary). Each is a day-by-day plan with a map and matching vacation rentals.",
      },
    ],
  },

  // ─── 6. EVENTS & FESTIVALS ─────────────────────────────────────────
  {
    slug: "portland-events-festivals",
    title: "Annual Events & Festivals in Portland You Can't Miss",
    metaTitle: "Portland Events & Festivals 2026 — Full Calendar",
    metaDescription:
      "Every major Portland event in 2026 by season — Rose Festival, Feast Portland, Blues Fest, Holiday Ale Fest, and First Thursday art walks. Dates and tickets.",
    category: "events",
    categoryLabel: "Events & Festivals",
    author: "The Book Traverse Team",
    authorBio:
      "Our busiest weeks align with Portland's biggest events. We know which festivals sell out our properties months in advance — and which hidden gems still have availability.",
    publishedAt: "2026-02-28",
    updatedAt: "2026-03-12",
    heroImage: "/images/home/poi-alberta.jpg",
    heroAlt: "Alberta Arts District street scene in Portland",
    excerpt:
      "Portland's festival calendar is creative, community-driven, and deeply seasonal. From the century-old Rose Festival to world-class food and film events, here's what's worth planning around.",
    relatedSlugs: [
      "portland-summer-events-2026",
      "portland-concerts-2026",
      "where-to-stay-in-portland",
    ],
    relatedLandingPages: ["luxury", "large-groups"],
    content: [
      {
        type: "text",
        text: "Portland's festival calendar reflects the city's character — creative, community-driven, and deeply seasonal. From the century-old Rose Festival to world-class food and film events, there's always something happening worth planning a trip around. For summer 2026 specifics including concerts, soccer matches, and the FIFA World Cup, see our [Summer 2026 events guide](/guide/portland-summer-events-2026). Book your stay early during peak festival weekends — the city fills up fast, especially in summer.",
      },
      {
        type: "text",
        text: "One thing that sets Portland's events apart from other cities: most of them are community-produced, not corporate-sponsored spectacles. The Rose Festival has been running since 1907. Saturday Market has been artist-run since 1974. Even the newer events — Feast Portland, the Holiday Ale Festival — feel grassroots and authentic. This is a city where the events reflect the people, not the sponsors.",
      },
      { type: "heading", text: "Spring (March - May)" },
      {
        type: "text",
        text: "The Portland International Film Festival (PIFF) kicks off late February into March with 100+ films from 50+ countries screened at venues across the city — it's one of the largest film festivals in the US and a serious cinephile draw. The Portland Saturday Market moves outdoors along the waterfront in March — it's the largest continuously operating open-air arts and crafts market in the United States, running every weekend through Christmas with 250+ local artisans.",
      },
      {
        type: "text",
        text: "The Portland Rose Festival begins in late May and runs into June, featuring the Grand Floral Parade (one of the country's largest, with floats covered entirely in flowers), dragon boat races on the Willamette, CityFair (a multi-weekend waterfront carnival), and the Starlight Parade — an illuminated night parade through downtown. The Rose Festival is Portland's signature event and has been since 1907. It's also the start of the city's busy season — book early. Spring also brings the [Portland Farmers Market](https://portlandfarmersmarket.org/) into full swing at PSU, with peak produce starting in May.",
      },
      { type: "heading", text: "Summer (June - August)" },
      {
        type: "image",
        src: "/images/home/poi-pearl.jpg",
        alt: "Pearl District street in Portland",
        caption:
          "Summer in Portland — long days, outdoor dining, and festivals nearly every weekend",
      },
      {
        type: "text",
        text: "Summer is Portland's peak season and the events calendar shows it. Portland Pride fills the waterfront in June with one of the West Coast's largest celebrations. The Waterfront Blues Festival over July 4th weekend is the largest blues festival on the West Coast, doubling as a fundraiser for the Oregon Food Bank — over 100 acts across three stages, fireworks over the Willamette, and blues river cruises. Oregon Brewers Festival in late July brings 80+ breweries to the waterfront. Cathedral Park Jazz Festival fills the area beneath the St. Johns Bridge with free jazz over a weekend. And the Bite of Oregon celebrates the city's food scene with restaurant pop-ups and live cooking demonstrations.",
      },
      {
        type: "text",
        text: "Portland's summer concert season is also in full swing — Providence Park, McMenamins Edgefield, and Moda Center host major tours throughout the season. See our [Portland concert guide](/guide/portland-concerts-2026) for the full 2026 lineup. The Portland Timbers (MLS) and Thorns (NWSL) play at Providence Park, and game-day atmosphere in the Timbers Army supporters section is unlike anything else in American sports — standing, singing, and smoke from the opening whistle.",
      },
      { type: "heading", text: "Fall (September - November)" },
      {
        type: "text",
        text: "Feast Portland in September is one of the country's premier food and drink festivals — cooking demos, the Night Market (an outdoor food bazaar with Portland's top chefs), themed dinners with James Beard-winning chefs from across the country, and Smoked!, an outdoor barbecue and cocktail event. It draws serious food lovers and sells out fast — tickets go on sale months in advance.",
      },
      {
        type: "text",
        text: "Fall is also harvest season in the Willamette Valley, when most wineries host harvest events and the [Hood River Fruit Loop](/guide/day-trips-from-portland) is at peak apple season. The Portland Marathon runs through the city in early October. And the weather stays mild through October — crisp mornings, warm afternoons, and the best foliage colors at [Mt. Tabor, Laurelhurst, and Forest Park](/guide/best-parks-portland). November brings the return of Portland's cozy indoor season: fireplace bars, bookstore readings at Powell's, and the opening of holiday markets.",
      },
      { type: "heading", text: "Winter (December - February)" },
      {
        type: "text",
        text: "Portland embraces its rainy season with cozy indoor events. The Holiday Ale Festival in December is a craft beer highlight — dozens of [Portland's best breweries](/guide/best-breweries-portland) release special winter ales under heated tents at Pioneer Courthouse Square. ZooLights transforms the Oregon Zoo into a massive holiday light display with a million lights. Peacock Lane, a residential street in SE Portland, becomes a free walk-through holiday light attraction every December — a Portland tradition since 1929.",
      },
      {
        type: "text",
        text: "Portland Saturday Market runs a holiday edition indoors at the Oregon Convention Center in December — perfect for unique, locally made gifts. The Portland Winter Light Festival in February transforms outdoor spaces with large-scale light installations. And Portland's bar and restaurant scene is arguably at its coziest in winter: fireplace cocktail bars, rich stews and ramen, and the city's famous coffee culture at its most appealing. Rainy-day Portland has a charm that surprises most visitors.",
      },
      { type: "heading", text: "Year-Round" },
      {
        type: "image",
        src: "/images/home/poi-mississippi.jpg",
        alt: "Mississippi Avenue in Portland",
        caption:
          "Mississippi Avenue — live music at Mississippi Studios runs year-round",
      },
      {
        type: "text",
        text: "**First Thursday Art Walk** in the Pearl District happens every month — galleries open late with free admission and wine. It's the best free cultural event in Portland and a great way to see the Pearl District's gallery scene. **Last Thursday on Alberta Street** is the neighborhood's monthly street party with food, art, and live music (outdoor season runs May through September; indoor gallery-only version in winter). **Portland Saturday Market** runs every weekend from March through Christmas Eve at Tom McCall Waterfront Park — 250+ local artisans and food vendors.",
      },
      {
        type: "text",
        text: "Portland's live music scene runs deep year-round. The **Crystal Ballroom** (1,500 capacity, downtown, famous floating floor), **Revolution Hall** (850, SE, converted high school), **Doug Fir Lounge** (350, E Burnside, log-cabin aesthetic), and **Mississippi Studios** (200, North Portland, intimate and excellent sound) host touring and local acts almost every night of the week. For bigger shows, see our [concert guide](/guide/portland-concerts-2026). And Portland's comedy scene is thriving — Helium Comedy Club and Curious Comedy Theater host national and local acts regularly.",
      },
      {
        type: "tip",
        text: "Book your stay 4-6 weeks early for Rose Festival (June), July 4th weekend, and Feast Portland (September). These are Portland's highest-demand periods and hotels and vacation rentals fill up fast. Midweek arrivals are significantly easier to book than weekends.",
      },
      {
        type: "tip",
        text: "For group trips around festivals, a [large-group vacation rental](/s/large-groups) is significantly more affordable than booking multiple hotel rooms — and you get a shared living space to gather between events. A 4-bedroom house sleeping 8-10 people often costs less per person than two hotel rooms.",
      },
      {
        type: "tip",
        text: "Building a trip around an event? Start with a ready-made itinerary and adjust dates to match: our [Portland weekend itinerary](/plan/portland-weekend-itinerary) (the city's greatest hits in two nights) or the [Portland food itinerary](/plan/portland-food-itinerary) (coffee, food carts, James Beard kitchens). Each has a map, real places, and matching rentals.",
      },
    ],
  },

  // ─── 7. SMALL BUSINESSES ───────────────────────────────────────────
  {
    slug: "portland-small-businesses",
    title: "Portland's Best Small Businesses & Local Shops",
    metaTitle: "Portland's Best Local Shops & Small Businesses",
    metaDescription:
      "Portland's best independent bookstores, coffee roasters, makers, and vintage shops. Local originals worth seeking out.",
    category: "travel-tips",
    categoryLabel: "Travel Tips",
    author: "The Book Traverse Team",
    authorBio:
      "Portland's independent businesses are why people love this city. We shop at these stores, drink this coffee, and recommend these spots to every guest.",
    publishedAt: "2026-03-01",
    updatedAt: "2026-03-05",
    heroImage: "/images/home/poi-nw23rd.jpg",
    heroAlt: "NW 23rd Avenue shops in Portland, Oregon",
    excerpt:
      "Portland's identity is built on independent businesses. More local bookstores, roasters, and makers per capita than almost any city in America. Here are the originals worth seeking out.",
    relatedSlugs: [
      "best-restaurants-portland",
      "where-to-stay-in-portland",
      "best-breweries-portland",
    ],
    relatedLandingPages: [
      "southeast-portland",
      "northeast-portland",
      "northwest-portland",
    ],
    content: [
      {
        type: "text",
        text: "Portland's identity is built on independent businesses. The city has more local bookstores, coffee roasters, craft makers, and independently owned shops per capita than almost any city in America. \"Keep Portland Weird\" isn't just a bumper sticker — it's a business philosophy. Shopping local here isn't performative; it's how the city works.",
      },
      {
        type: "text",
        text: "What makes Portland's small business scene special is that these aren't struggling holdouts against corporate retail — they're thriving because Portlanders genuinely choose to shop local. The city's relatively affordable rent (compared to Seattle or San Francisco) has allowed creative entrepreneurs to take risks on unusual concepts that wouldn't survive in more expensive markets. Pair a shopping day with meals from our [restaurant guide](/guide/best-restaurants-portland) and stay in one of the city's [best neighborhoods](/guide/where-to-stay-in-portland). Here are the Portland originals worth seeking out.",
      },
      { type: "heading", text: "Books & Culture" },
      {
        type: "image",
        src: "/images/home/poi-pearl.jpg",
        alt: "Pearl District in Portland",
        caption:
          "The Pearl District — home to Powell's City of Books and dozens of galleries",
      },
      {
        type: "places",
        items: [
          {
            name: "Powell's City of Books",
            detail:
              "The world's largest independent bookstore occupies an entire city block in the Pearl District. New, used, and rare books across four floors with color-coded rooms. You can — and will — get lost here. The Rare Book Room is worth a visit even if you're not buying. Grab a Powell's tote bag — it's the best Portland souvenir.",
            url: "https://powells.com",
          },
          {
            name: "Floating World Comics",
            detail:
              "Independent comic and graphic novel shop on NW Couch with a carefully curated selection. Passionate staff who actually read what they sell. If you're into graphic novels, indie comics, or zines, this is a pilgrimage stop.",
          },
          {
            name: "Clinton Street Video",
            detail:
              "One of the last video rental stores in America, in SE Portland's Clinton neighborhood. Part community gathering spot, part time capsule, entirely Portland.",
          },
          {
            name: "Movie Madness",
            detail:
              "More than a video rental store — this SE Belmont institution has a museum of film memorabilia including actual props and costumes from famous movies. Even if you don't rent anything, the museum alone is worth a visit.",
            url: "https://moviemadness.org",
          },
        ],
      },
      { type: "heading", text: "Coffee & Treats" },
      {
        type: "text",
        text: "Portland helped define America's third-wave coffee movement. The roasters here take their craft as seriously as winemakers — single-origin sourcing, light roasts that emphasize flavor complexity, and baristas who can explain the difference between a washed and natural process. For a deeper dive, see the coffee section of our [restaurant guide](/guide/best-restaurants-portland).",
      },
      {
        type: "places",
        items: [
          {
            name: "Stumptown Coffee Roasters",
            detail:
              "Portland's original third-wave roaster, founded here in 1999. Multiple locations — the SE Division cafe is the original and still the best for a quiet pour-over. Hair Bender is the classic blend.",
            url: "https://stumptowncoffee.com",
          },
          {
            name: "Coava Coffee Roasters",
            detail:
              "Single-origin pour-overs in a converted warehouse on SE Grand. If you care about the difference between a washed Ethiopian and a natural-process Colombian, this is your spot.",
            url: "https://coavacoffee.com",
          },
          {
            name: "Heart Coffee Roasters",
            detail:
              "Precision-focused roasting in a minimalist SE Portland space. The espresso is among the best in the city. Often paired with woodblock chocolate for a Portland-specific tasting experience.",
            url: "https://heartcoffee.com",
          },
          {
            name: "Salt & Straw",
            detail:
              "Portland's cult ice cream with seasonal, locally sourced flavors that push boundaries — honey lavender, pear and blue cheese, bone marrow and smoked cherries. Lines are long but move fast. SE Division and NW 23rd are the originals.",
            url: "https://saltandstraw.com",
          },
          {
            name: "Jacobsen Salt Co.",
            detail:
              "Artisan salt hand-harvested from Oregon's Netarts Bay. The factory and tasting room on SE Naito offer tours, tastings, and a surprisingly fascinating lesson in salt. Their gift sets make excellent Portland souvenirs.",
            url: "https://jacobsensalt.com",
          },
        ],
      },
      { type: "heading", text: "Shopping & Local Makers" },
      {
        type: "image",
        src: "/images/home/poi-hawthorne.jpg",
        alt: "Hawthorne District shopping in Portland",
        caption:
          "Hawthorne Boulevard — vintage shops, record stores, and independently owned everything",
      },
      {
        type: "places",
        items: [
          {
            name: "Portland Leather Goods",
            detail:
              "Handmade bags, wallets, and accessories from premium leather. Their factory store on SE Grand has seconds at steep discounts — the imperfections are barely noticeable. Watch the craftspeople work while you shop.",
            url: "https://portlandleathergoods.com",
          },
          {
            name: "Portland Gear",
            detail:
              "Portland-pride apparel designed and printed locally. Collaborations with local artists. Great for souvenirs that don't feel like tourist souvenirs — the designs are things locals actually wear.",
            url: "https://portlandgear.com",
          },
          {
            name: "Kiriko Made",
            detail:
              "Japanese-inspired textiles and accessories handmade in NE Portland from vintage Japanese fabrics. Beautiful, unique pieces you won't find anywhere else. Each item uses fabric from a different vintage source.",
            url: "https://kirikomade.com",
          },
          {
            name: "What's New Furniture",
            detail:
              "A Portland showroom for custom-made sofas, sectionals, and home furnishings. Hundreds of fabric options and knowledgeable design consultants who help you build exactly what you want.",
            url: "https://whatsnewfurniture.com",
          },
          {
            name: "Orox Leather",
            detail:
              "Handcrafted leather goods made in Portland from locally sourced materials. Bags, belts, and wallets built to last decades. The SE workshop offers tours by appointment.",
            url: "https://oroxleather.com",
          },
        ],
      },
      { type: "heading", text: "Record Stores" },
      {
        type: "text",
        text: "Portland has one of the best independent record store scenes in the country. Vinyl isn't a nostalgic novelty here — it's how a lot of Portlanders actually listen to music.",
      },
      {
        type: "places",
        items: [
          {
            name: "Music Millennium",
            detail:
              "Portland's oldest record store, open since 1969. New and used vinyl, CDs, and a staff that knows more about obscure releases than the internet. An institution.",
            url: "https://musicmillennium.com",
          },
          {
            name: "Jackpot Records",
            detail:
              "SE Hawthorne's beloved record shop — well-curated new and used vinyl, local releases, and a knowledgeable, non-pretentious staff. Exactly what a record store should be.",
          },
          {
            name: "Everyday Music",
            detail:
              "Multiple Portland locations with a massive used selection. The buy/sell/trade model means the inventory is constantly changing. Good for digging and finding unexpected gems.",
          },
        ],
      },
      { type: "heading", text: "Vintage & Antiques" },
      {
        type: "image",
        src: "/images/home/poi-sellwood.jpg",
        alt: "Sellwood neighborhood antique district",
        caption: "Sellwood Antique Row — a dozen shops along SE 13th Avenue",
      },
      {
        type: "places",
        items: [
          {
            name: "Red Light Clothing Exchange",
            detail:
              "Hawthorne's legendary vintage shop — three floors of curated vintage clothing, accessories, and costumes. A Portland institution since 1996. The costume section on the top floor is worth visiting even if you're not shopping.",
          },
          {
            name: "House of Vintage",
            detail:
              "Over 60 vintage dealers under one roof on SE Hawthorne. It's enormous, a bit chaotic, and you'll always find something unexpected. Budget at least an hour.",
          },
          {
            name: "Sellwood Antique Row",
            detail:
              "SE 13th Avenue in the Sellwood neighborhood is lined with antique shops, vintage stores, and curiosity dealers. Plan for at least an hour of browsing. The neighborhood also has excellent bakeries and brunch spots for refueling.",
          },
          {
            name: "Hoodoo Antiques & Design",
            detail:
              "A large, well-curated antique mall in the Central Eastside with mid-century modern furniture, vintage lighting, and architectural salvage. More design-focused than most Portland vintage spots.",
          },
        ],
      },
      { type: "heading", text: "Best Shopping Streets" },
      {
        type: "text",
        text: "Portland's independent businesses cluster along specific commercial streets. Each has a distinct character: **Hawthorne Boulevard** (SE) — the classic, with vintage shops, record stores, bookstores, and restaurants for 20+ blocks. **Alberta Street** (NE) — the most creative, with murals, galleries, and eclectic shops. Last Thursday street fair May through September. **Mississippi Avenue** (NE) — smaller and more curated, with boutiques, food carts, and Mississippi Studios. **NW 23rd Avenue** — the most polished, with upscale boutiques, Salt & Straw, and excellent brunch spots. **Sellwood** (SE 13th) — antiques, vintage, and the charm of a small-town shopping street.",
      },
      {
        type: "tip",
        text: "Portland's best independent shopping streets are walkable and pair perfectly with meals and coffee stops. Stay in a nearby [vacation rental](/properties), walk to the shops, and experience Portland like a local — no car needed for the best shopping days.",
      },
    ],
  },

  // ─── 8. BOOK DIRECT & SAVE ─────────────────────────────────────────
  {
    slug: "book-direct-save",
    title:
      "Book Direct vs. Airbnb: Why Booking Direct Saves You Money in Portland",
    metaTitle: "Book Direct vs Airbnb | Save on Portland Rentals",
    metaDescription:
      "Every Book Traverse property on Airbnb and VRBO is available cheaper when you book direct. No service fees, same homes.",
    category: "travel-tips",
    categoryLabel: "Travel Tips",
    author: "The Book Traverse Team",
    authorBio:
      "We manage every property on our site — the same homes listed on Airbnb and VRBO, just without the platform fees. We built this guide to show you exactly how much you save.",
    publishedAt: "2026-03-02",
    updatedAt: "2026-03-11",
    heroImage: "/images/home/7b564b83-b3dd-49dd-9977-0f51e3d583b9.jpg",
    heroAlt:
      "Beautifully designed living room in a Book Traverse vacation rental",
    excerpt:
      "Every Book Traverse property on Airbnb or VRBO is available at a lower price on our site. No service fees, local support, same homes. Here's the math.",
    relatedSlugs: ["where-to-stay-in-portland", "best-restaurants-portland"],
    relatedLandingPages: ["luxury", "pet-friendly", "extended-stay"],
    content: [
      {
        type: "text",
        text: "If you've found a vacation rental you love on Airbnb or VRBO, there's a good chance you're paying 12-18% more than you need to. Third-party booking platforms charge service fees on every reservation — fees that go to the platform, not to the property or to you. At Book Traverse, every property listed on Airbnb and VRBO is also available directly on our site at a lower price. No service fees. No hidden costs. Same property, better deal.",
      },
      {
        type: "heading",
        text: "The Math: What Third-Party Fees Really Cost You",
      },
      {
        type: "text",
        text: "On a typical $1,500 Airbnb booking, the platform's service fee runs $150-270 — charged on top of the nightly rate. That money doesn't go to cleaning, doesn't improve the property, and doesn't benefit you in any way. It's a toll for using the platform's search engine. When you book the same property directly through Book Traverse, that fee disappears entirely. On a typical Portland vacation rental stay, you'll save $100-250 by booking direct. For a weeklong stay or a larger property, the savings can approach $500.",
      },
      {
        type: "text",
        text: "Here's a real example: a 3-bedroom house in the Hawthorne neighborhood for 5 nights at $200/night. On Airbnb, you'd pay the $1,000 base rate plus a ~$140 service fee plus cleaning, totaling around $1,290. On BookTraverse.com, the same property for the same dates costs $1,000 plus cleaning — no service fee. That's $140 back in your pocket, which covers two nice dinners out at Portland's [best restaurants](/guide/best-restaurants-portland).",
      },
      { type: "heading", text: "What You Get When You Book Direct" },
      {
        type: "text",
        text: "Booking direct isn't just about price — though the price alone makes it worth it. When you book through Book Traverse, you're working directly with the team that manages every property in our portfolio. That means:",
      },
      {
        type: "text",
        text: "**Local guest support** from people who live in Portland — not a call center in another state. **Flexible check-in and check-out** when availability allows — we can often accommodate early arrivals or late departures that platforms can't. **Personalized neighborhood recommendations** based on what you actually want to do. **Priority access** to last-minute openings and new listings. **Direct communication** before, during, and after your stay. If something comes up, you're reaching someone who can actually fix it — not filing a ticket.",
      },
      {
        type: "image",
        src: "/images/home/home-kearney-cover.jpg",
        alt: "Book Traverse vacation rental exterior",
        caption:
          "A Book Traverse home in NW Portland — available on Airbnb, but cheaper when you book direct",
      },
      { type: "heading", text: "Same Properties, Lower Price" },
      {
        type: "text",
        text: "This is the part most guests don't realize: the properties you see on Airbnb, VRBO, and Booking.com are the same properties available on booktraverse.com. Same homes, same professional cleaning, same amenities, same quality. The only differences are the price and who helps you when you need it. We list on third-party platforms because that's where many travelers start their search — but we'd rather you book with us directly, and we pass the fee savings on to you to make that decision easy.",
      },
      {
        type: "text",
        text: "If you've already found a specific property on Airbnb that you love, you can search for it on our site by neighborhood, bedroom count, or amenities. Can't find it? Send us a message — our team can look it up and confirm availability directly. We manage every property in our portfolio, so there's no middleman.",
      },
      { type: "heading", text: "A Local Company, Not a Platform" },
      {
        type: "text",
        text: "Book Traverse isn't a tech platform — we're a Portland-based property management company. We manage 275+ homes across Portland's best neighborhoods. We know which street has the best taco cart, which [park is ideal for dogs](/s/pet-friendly), and which route avoids bridge traffic at rush hour. Need help [choosing a neighborhood](/guide/where-to-stay-in-portland)? Our team has real recommendations based on what you want from your trip. When you book direct, you get a team that cares about Portland and cares about your experience here.",
      },
      {
        type: "image",
        src: "/images/home/apt-pomeroy-living.jpg",
        alt: "Modern living room in a Book Traverse vacation rental",
        caption:
          "Professionally designed interiors, hotel-quality linens, and a full kitchen in every property",
      },
      {
        type: "heading",
        text: "Portland Hotels vs. Vacation Rentals: The Value Equation",
      },
      {
        type: "text",
        text: "For travelers comparing Portland hotels with vacation rentals, the value is clear. A downtown hotel room averages $200-350/night for a single room with no kitchen or outdoor space. A Book Traverse vacation rental — a full house or apartment with a kitchen, laundry, parking, and a real neighborhood — starts around the same price but delivers dramatically more space, privacy, and local character. Our professionally managed properties include hotel-quality linens, thorough cleaning between every stay, and responsive 24/7 guest support.",
      },
      {
        type: "text",
        text: "For families and groups, the math gets even better. A 3-bedroom Portland vacation rental that sleeps 6-8 costs roughly what 2 hotel rooms would — and you get a shared living room, a full kitchen for breakfasts, and bedrooms with actual doors. Our [family-friendly rentals](/s/family-friendly) include cribs, high chairs, and kid-proof spaces. For extended stays (a week or more), the kitchen alone saves hundreds compared to eating every meal out.",
      },
      { type: "heading", text: "Frequently Asked Questions" },
      {
        type: "text",
        text: "**Is booking direct safe?** Yes. We use Stripe for secure payment processing — the same system used by Airbnb, Lyft, and thousands of other major companies. Your payment information is encrypted and never stored on our servers.",
      },
      {
        type: "text",
        text: "**What's the cancellation policy?** Each property has its own cancellation policy, clearly displayed before you book. Most offer free cancellation up to a set number of days before check-in. The specific terms are shown on the property page and in your booking confirmation.",
      },
      {
        type: "text",
        text: "**What if something goes wrong during my stay?** You'll have a direct line to our local team. We respond within minutes during business hours and have 24/7 emergency support. Unlike platform-mediated communication, you're talking to the people who actually manage the property.",
      },
      {
        type: "tip",
        text: "Every Book Traverse property you see on Airbnb or VRBO is available at a lower price on booktraverse.com. [Search your dates and compare](/properties). No fees, no markups — just the lowest price, guaranteed.",
      },
    ],
  },

  // ─── 9. NCAA MARCH MADNESS PORTLAND 2026 ───────────────────────────
  {
    slug: "ncaa-march-madness-portland-2026",
    title: "NCAA March Madness in Portland 2026: Where to Stay, Eat & Watch",
    metaTitle: "NCAA March Madness Portland 2026 | Local Guide",
    metaDescription:
      "NCAA Tournament at Moda Center March 19-21, 2026. Where to stay, eat, drink, and what to do in Portland.",
    category: "events",
    categoryLabel: "Events & Festivals",
    author: "The Book Traverse Team",
    authorBio:
      "We've hosted NCAA fans, concert-goers, and tournament visitors at our properties near Moda Center for years. Here's our local playbook for March Madness weekend.",
    publishedAt: "2026-03-03",
    updatedAt: "2026-03-14",
    heroImage: "/images/home/photo-1615621734603-04c156e22380.jpeg",
    heroAlt: "Moda Center at the Rose Quarter in Portland, Oregon",
    excerpt:
      "The NCAA Men's Basketball Tournament First & Second Rounds come to Portland's Moda Center on March 19 & 21, 2026. Here's everything you need to know — where to stay, eat, and what else to do.",
    relatedSlugs: [
      "where-to-stay-in-portland",
      "best-restaurants-portland",
      "best-breweries-portland",
    ],
    relatedLandingPages: [
      "northeast-portland",
      "southeast-portland",
      "large-groups",
    ],
    content: [
      {
        type: "text",
        text: "March Madness is coming to Portland. The NCAA Division I Men's Basketball Championship First and Second Rounds will be played at Moda Center on March 19 and 21, 2026, with Oregon State University serving as the host school. For basketball fans traveling to Portland for the tournament, you're in for a treat — the city is walkable, the food scene is world-class, and Moda Center is one of the most accessible arenas in the country.",
      },
      {
        type: "text",
        text: "Portland has hosted NCAA Tournament games before and the city handles it well. The Rose Quarter area around Moda Center is designed for events, transit connections are strong, and the city's restaurant and bar scene gives you far more options than a typical tournament city. This guide covers everything you need to plan your trip.",
      },
      { type: "heading", text: "Tournament Schedule & Venue" },
      {
        type: "text",
        text: "Moda Center at the Rose Quarter seats just under 20,000 for basketball and hosts multiple sessions across the two game days. The First Round tips off Thursday, March 19, with the Second Round on Saturday, March 21. Each session features two games, so expect to be at the arena for 4-5 hours per session. Moda Center is located in the Rose Quarter district on the east side of the Willamette River, directly served by the MAX Light Rail — a single ride from the airport or any downtown hotel takes less than 20 minutes.",
      },
      {
        type: "text",
        text: "The arena itself is modern and well-appointed — it's the home of the Portland Trail Blazers and hosts major concerts year-round. Sightlines are good from most sections, and the concourse has solid food and drink options (though we'd recommend eating before the game at one of the spots below). The Rose Quarter Commons outside the arena fills with fan activities on game days.",
      },
      {
        type: "tip",
        text: "Take the MAX to Moda Center — the Rose Quarter Transit Center stop is directly outside the arena. Parking is limited and expensive ($20-40). Your game ticket may include a TriMet pass — check before you drive.",
      },
      { type: "heading", text: "Where to Stay for March Madness in Portland" },
      {
        type: "text",
        text: "Portland hotels near the Rose Quarter fill up fast during March Madness, and rates spike. A vacation rental in a nearby neighborhood gives you more space, a kitchen for pregame meals, and a real Portland experience — all at a better price than a tournament-rate hotel room. The best neighborhoods for tournament visitors:",
      },
      {
        type: "text",
        text: "**Northeast Portland** (10-15 minutes from Moda Center by car or MAX) — packed with [restaurants](/guide/best-restaurants-portland) and [breweries](/guide/best-breweries-portland), with direct MAX access to the Rose Quarter. Alberta and Mississippi are the best streets for food and nightlife. **Southeast Portland** (walkable to the arena via the Hawthorne or Morrison bridges) — the city's best food scene and most walkable neighborhoods. A 20-minute walk across the Morrison Bridge gets you to Moda Center. **Lloyd District** (the closest neighborhood to Moda Center) — restaurants and shops within walking distance, major hotel cluster.",
      },
      {
        type: "image",
        src: "/images/home/poi-hawthorne.jpg",
        alt: "Hawthorne District restaurants near Moda Center",
        caption:
          "SE Portland — Portland's restaurant district, a 20-minute walk from Moda Center",
      },
      {
        type: "text",
        text: "For groups traveling together — and March Madness draws a lot of friend groups — a 3 or 4-bedroom vacation rental is dramatically cheaper than booking multiple hotel rooms, and you get a living room to gather for bracket-watching between sessions. A group of 6 in a 3-bedroom house pays roughly $50-75/person per night, versus $200+/person for two hotel rooms.",
      },
      {
        type: "tip",
        text: "Book early — Portland accommodations fill up weeks before March Madness. Browse [large-group rentals](/s/large-groups) or [all properties](/properties) and filter by dates. [Book direct to save](/guide/book-direct-save) vs. Airbnb.",
      },
      { type: "heading", text: "Where to Eat & Drink Near Moda Center" },
      {
        type: "text",
        text: "The Rose Quarter itself has limited dining options, but Portland's best food and drink are minutes away. The Lloyd District (walkable from Moda Center) has solid options, and a quick MAX ride or short walk across the river puts you in the heart of Portland's restaurant scene. For the full list, see our [Portland restaurant guide](/guide/best-restaurants-portland).",
      },
      { type: "subheading", text: "Pregame Spots (Walking Distance)" },
      {
        type: "places",
        items: [
          {
            name: "Loyal Legion",
            detail:
              "99 beers on tap — all Oregon-brewed — plus a solid food menu. Walking distance from Moda Center on SE Alder. Perfect for pregame. Gets loud and packed on event nights.",
            url: "https://loyallegionpdx.com",
          },
          {
            name: "Ex Novo Brewing",
            detail:
              "Portland's nonprofit brewery, a quick drive or bus ride north on N Flint. Great beer, great food, great cause. More relaxed vibe than the spots closer to the arena.",
            url: "https://exnovobrewing.com",
          },
          {
            name: "Wayfinder Beer",
            detail:
              "Best lagers in Portland, on SE 9th — a 10-minute walk from Moda Center. Czech pilsner and Japanese rice lager on tap. The food menu is legit.",
            url: "https://wayfinder.beer",
          },
        ],
      },
      { type: "subheading", text: "Game-Day Brunch & Dinner" },
      {
        type: "places",
        items: [
          {
            name: "Screen Door",
            detail:
              "Portland's most famous brunch, on E Burnside — a short walk from the Rose Quarter. Go the morning of game day. The fried chicken and waffles are iconic.",
            url: "https://screendoorrestaurant.com",
          },
          {
            name: "Kachka",
            detail:
              "Russian-inspired small plates and vodka flights on SE Grand, 10 minutes south of Moda Center. A unique pregame dinner option that's unlike anything in most cities.",
            url: "https://kachkapdx.com",
          },
          {
            name: "Canard",
            detail:
              "Walk-in only, no reservations — perfect for a spontaneous pregame meal. Next door to Le Pigeon on E Burnside. The wine list is excellent and the food is world-class casual.",
            url: "https://canardpdx.com",
          },
        ],
      },
      { type: "subheading", text: "Post-Game & Late Night" },
      {
        type: "places",
        items: [
          {
            name: "Cartopia",
            detail:
              "SE Hawthorne food cart pod, open late. Potato Champion's poutine after a night game is a Portland rite of passage.",
          },
          {
            name: "Doug Fir Lounge",
            detail:
              "Live music venue and restaurant on E Burnside with a late-night menu. Good chance there's a show happening after the game.",
          },
        ],
      },
      { type: "heading", text: "Where to Watch Games You're Not Attending" },
      {
        type: "text",
        text: "If you're in Portland for the tournament weekend but don't have tickets to every session — or you want to watch other regional games — Portland has excellent sports bars. **Spirit of 77** (NE Portland) is the city's best basketball bar, with massive screens and a hoops-obsessed atmosphere. **On Deck Sports Bar** (Pearl District) has dozens of TVs and good food. **Claudia's** (SE Hawthorne) is a beloved neighborhood bar with solid screens and no attitude. Most [Portland breweries](/guide/best-breweries-portland) will also have games on — Great Notion's Alberta taproom is a particularly good spot.",
      },
      {
        type: "image",
        src: "/images/home/poi-mississippi.jpg",
        alt: "Mississippi Avenue nightlife in Portland",
        caption:
          "Mississippi Avenue — breweries and bars within walking distance of many NE Portland rentals",
      },
      {
        type: "heading",
        text: "What Else to Do in Portland During the Tournament",
      },
      {
        type: "text",
        text: "March Madness sessions don't fill your entire day, and Portland rewards exploration. Between games, check out Powell's City of Books (the world's largest independent bookstore, 15 minutes from Moda Center), walk the waterfront along Tom McCall Park, or explore the Pearl District galleries. If you have a day without games, the [Columbia River Gorge and Multnomah Falls](/guide/day-trips-from-portland) are a 45-minute drive east. Portland's brewery scene is deep — you could visit a different taproom for every session of the tournament and not repeat.",
      },
      {
        type: "text",
        text: "March in Portland is early spring — expect temperatures in the 50s, occasional rain, and the city's famous cherry blossoms starting to bloom along the waterfront. It's a great walking city even in the rain (Portlanders don't use umbrellas — just a good jacket). And if you're here on Friday, the Portland Thorns open their 2026 NWSL season at Providence Park on March 20 — right between the First and Second Round games.",
      },
      {
        type: "tip",
        text: "The Portland Thorns' 2026 home opener is Friday, March 20 — the day between NCAA First and Second Round games. Catch college hoops and professional soccer in the same weekend. [Browse properties near both venues](/properties).",
      },
      { type: "heading", text: "Getting Around Portland" },
      {
        type: "text",
        text: "Portland is one of the most transit-friendly cities in the country. The MAX Light Rail connects the airport (PDX) to downtown and the Rose Quarter in about 40 minutes for $2.50. TriMet buses run frequently across all neighborhoods. Ride-share apps work well too, but the MAX is faster during event traffic. Portland is also extremely walkable — you can walk from Moda Center to SE Portland's restaurant district in 20 minutes across the Morrison Bridge. If you're staying in a vacation rental in NE or SE Portland, you likely won't need a car at all.",
      },
      {
        type: "text",
        text: "**From PDX Airport**: MAX Red Line to Rose Quarter Transit Center (40 min, $2.50). **From Downtown**: MAX to Rose Quarter (5 min). **From SE Portland**: Walk across Morrison Bridge (20 min) or MAX from Lloyd Center (5 min). **From NE Portland**: MAX Yellow/Green line or bus (10-15 min). **Ride-share**: Expect surge pricing after games let out. The MAX is faster and cheaper post-game.",
      },
    ],
  },

  // ─── 10. PORTLAND CONCERT GUIDE SPRING & SUMMER 2026 ──────────────
  {
    slug: "portland-concerts-2026",
    title: "Portland Concert Guide: Spring & Summer 2026",
    metaTitle: "Portland Concerts 2026 | Full Schedule & Guide",
    metaDescription:
      "Every major concert in Portland 2026 — Springsteen, Florence, Black Keys, Tame Impala, Doja Cat, Gorillaz at Moda Center and Edgefield.",
    category: "events",
    categoryLabel: "Events & Festivals",
    author: "The Book Traverse Team",
    authorBio:
      "Portland's live music scene is one of the best reasons to visit. We track every major show and help guests find the best places to stay near each venue.",
    publishedAt: "2026-03-04",
    updatedAt: "2026-03-13",
    heroImage: "/images/home/poi-sellwood.jpg",
    heroAlt: "Portland neighborhood street at dusk",
    excerpt:
      "Springsteen, Florence + The Machine, Black Keys, Chris Stapleton, Tame Impala, Doja Cat, Gorillaz — every major concert coming to Portland in 2026, with dates, venues, and where to stay.",
    relatedSlugs: [
      "where-to-stay-in-portland",
      "best-restaurants-portland",
      "portland-summer-events-2026",
    ],
    relatedLandingPages: [
      "southeast-portland",
      "northeast-portland",
      "northwest-portland",
    ],
    content: [
      {
        type: "text",
        text: "Portland's 2026 concert season is stacked. From arena-scale tours at Moda Center to outdoor shows at the legendary McMenamins Edgefield amphitheater, this year's lineup spans Bruce Springsteen, Florence + The Machine, The Black Keys, Chris Stapleton, Tame Impala, Doja Cat, Gorillaz, and more. Here's every major show worth planning a trip around — organized by venue with dates, tips, and where to stay.",
      },
      {
        type: "text",
        text: "Portland punches above its weight as a concert city. The venues are excellent — from a 20,000-seat arena to a converted church-turned-brewery and a former poor farm with an amphitheater — and the city's compact size means you can have dinner at a world-class restaurant and walk to the show. Most artists agree: Portland audiences are among the best in the country. The city's music-obsessed culture means crowds are engaged, knowledgeable, and enthusiastic.",
      },
      { type: "heading", text: "Moda Center (Rose Quarter)" },
      {
        type: "text",
        text: "Portland's 20,000-seat arena hosts the biggest tours. Located in the Rose Quarter, it's directly on the MAX Light Rail line — take transit, skip the parking. The arena has good sound and sightlines, and the surrounding area has several [pregame food and drink options](/guide/ncaa-march-madness-portland-2026). Here's the 2026 lineup:",
      },
      {
        type: "places",
        items: [
          {
            name: "Lamb of God (Mar 30)",
            detail:
              "Into Oblivion Tour with Kublai Khan TX and Fit For An Autopsy. Doors 7 PM.",
          },
          {
            name: "Bruce Springsteen & The E Street Band (Apr 3)",
            detail:
              "Land of Hope & Dreams American Tour. The Boss at Moda Center — this will sell out. 7:30 PM.",
          },
          {
            name: "FKA twigs (Apr 4)",
            detail:
              "Body High Tour. One of the most visually stunning live performers working today. 8 PM.",
          },
          {
            name: "Bush + Mammoth WVH (Apr 28)",
            detail:
              "Bush with Wolfgang Van Halen's Mammoth WVH and James and the Cold Gun. 7 PM.",
          },
          {
            name: "Puscifer (May 8)",
            detail:
              "Maynard James Keenan's multimedia project. Expect visuals as wild as the music. 8 PM.",
          },
          {
            name: "Florence + The Machine (May 13)",
            detail:
              "One of the most powerful live performers in music. Moda Center will feel like a cathedral. 7:30 PM.",
          },
          { name: "Yungblud (May 16)", detail: "High-energy punk-pop. 8 PM." },
          {
            name: "5 Seconds of Summer (Jun 30)",
            detail: "Arena pop-rock. 8 PM.",
          },
          {
            name: "Joji (Jul 18)",
            detail: "Atmospheric, emotional R&B. 6:30 PM.",
          },
          {
            name: "Megan Moroney (Aug 1)",
            detail: "Country's rising star. 7 PM.",
          },
          {
            name: "Tame Impala (Sep 8)",
            detail:
              "Kevin Parker's psychedelic sound in an arena setting is an experience. One of the can't-miss shows of the year. 7 PM.",
          },
          { name: "Andrea Bocelli (Sep 9)", detail: "The iconic tenor. 8 PM." },
          {
            name: "Tyler Childers (Oct 3)",
            detail:
              "Appalachian country-folk with a fervent fanbase. Will sell fast. 6:30 PM.",
          },
          { name: "Doja Cat (Oct 17)", detail: "Pop spectacle. 7:30 PM." },
          {
            name: "Gorillaz (Oct 30)",
            detail:
              "Damon Albarn's animated supergroup, live. A Halloween-week show to remember. 7 PM.",
          },
        ],
      },
      {
        type: "tip",
        text: "Moda Center is on the MAX Light Rail — the Rose Quarter Transit Center stop is right outside. Stay in [NE Portland](/s/northeast-portland) or [SE Portland](/s/southeast-portland) and take the train to the show.",
      },
      { type: "heading", text: "McMenamins Edgefield Amphitheater" },
      {
        type: "text",
        text: "Edgefield is Portland's most beloved outdoor concert venue — a sprawling 74-acre estate in Troutdale (20 minutes east of downtown) with a 4,000-capacity amphitheater, multiple bars, a winery, a distillery, and gardens. Shows are all-ages with 5 PM doors and 6:30 PM start times. Bring a blanket, arrive early, and explore the grounds before the music starts. There is no bad spot in the house.",
      },
      {
        type: "places",
        items: [
          {
            name: "The Black Keys (May 27)",
            detail:
              "Peaches 'N Kream tour. Dan Auerbach and Patrick Carney in an intimate outdoor setting — this is a special one.",
          },
          {
            name: "Sierra Ferrell (May 30)",
            detail:
              "Heavy Petal Tour. SOLD OUT — but worth checking for resale.",
          },
          {
            name: "The Dead South (Jun 11)",
            detail:
              "Canadian folk-bluegrass with Amigo The Devil. Expect a rowdy, joyful crowd.",
          },
          {
            name: "Charley Crockett (Jul 14)",
            detail:
              "Age of the Ram Tour. Texas country with vintage soul. On sale March 6.",
          },
          {
            name: "Rainbow Kitten Surprise (Jul 12)",
            detail: "Indie rock with Spacey Jane. Perfect summer evening show.",
          },
          {
            name: "CAKE (Jul 24 & 25)",
            detail:
              'Two nights at Edgefield. "Short Skirt / Long Jacket" and "The Distance" live, under the stars.',
          },
          {
            name: "Young the Giant + Cold War Kids (Jul 26)",
            detail:
              "Victory Garden Tour with Common People. A triple bill of indie favorites.",
          },
          {
            name: "Tedeschi Trucks Band (Aug 7)",
            detail:
              "With Lukas Nelson. Blues-rock perfection in an outdoor amphitheater. Don't miss this one.",
          },
          {
            name: "Earth, Wind & Fire (Sep 5)",
            detail:
              "Legends. If you've never seen them live, this is your chance.",
          },
          {
            name: "Jack Johnson (Sep 28)",
            detail: "SurfILMUSIC Tour with G. Love. SOLD OUT.",
          },
        ],
      },
      {
        type: "tip",
        text: "Edgefield is 20 minutes east of Portland — you'll need a car or ride-share. Arrive by 4:30 PM to park, explore the grounds, and grab a drink at the on-site brewery before doors. Stay in [SE Portland](/s/southeast-portland) for the easiest drive out.",
      },
      { type: "heading", text: "Providence Park" },
      {
        type: "text",
        text: "Providence Park is Portland's 25,000-seat outdoor stadium, home to the Timbers and Thorns. When it hosts concerts, the atmosphere is electric — open air, downtown-adjacent, with the West Hills as a backdrop. Concert tickets double as TriMet passes for free transit to and from the venue.",
      },
      {
        type: "places",
        items: [
          {
            name: "Chris Stapleton + Grace Potter (Jul 17)",
            detail:
              'Providence Park\'s 2026 headliner. Stapleton is one of the best live voices in music, and 25,000 fans singing along to "Tennessee Whiskey" outdoors is going to be massive. Previous PP shows (Foo Fighters, Green Day, Post Malone) sold out — buy tickets early.',
          },
        ],
      },
      {
        type: "tip",
        text: "Providence Park is in the Goose Hollow neighborhood, walkable from downtown and NW Portland. The MAX stops right at the stadium. Stay in [NW Portland](/s/northwest-portland) to walk to the show.",
      },
      { type: "heading", text: "More Venues Worth Knowing" },
      {
        type: "image",
        src: "/images/home/poi-alberta.jpg",
        alt: "Alberta Arts District nightlife in Portland",
        caption:
          "Alberta Arts District — home to intimate venues and Portland's creative live music scene",
      },
      {
        type: "text",
        text: "Portland's mid-size and small venues punch above their weight. These rooms have better sound, more character, and cheaper tickets than any arena — and they book artists that are just as talented. If you're a music lover, check these calendars alongside the big shows.",
      },
      {
        type: "places",
        items: [
          {
            name: "Crystal Ballroom",
            detail:
              "Downtown Portland, 1,500 capacity. The floating dance floor (it literally bounces) is a Portland legend. Indie, rock, electronic, hip-hop — the booking is eclectic and always interesting. The Lola's Room upstairs hosts smaller shows.",
            url: "https://crystalballroompdx.com",
          },
          {
            name: "Revolution Hall",
            detail:
              "SE Portland, 850 capacity. A converted 1924 high school auditorium with impeccable sound and a stunning art-deco interior. The rooftop bar has one of the best views in Portland.",
            url: "https://revolutionhall.com",
          },
          {
            name: "Doug Fir Lounge",
            detail:
              "E Burnside, 350 capacity. Log-cabin-meets-modern-design with a full restaurant and bar attached. Some of the best emerging and indie acts in the country play here. Great food before the show.",
            url: "https://dougfirlounge.com",
          },
          {
            name: "Mississippi Studios",
            detail:
              "North Portland, 200 capacity. A tiny gem for singer-songwriters, jazz, and emerging artists. The intimacy makes every show feel like a private concert. Bar Bar next door for pre-show drinks.",
            url: "https://mississippistudios.com",
          },
          {
            name: "Wonder Ballroom",
            detail:
              "NE Portland, 800 capacity. A restored 1914 building with high ceilings and good vibes. Hosts a solid mix of indie rock, hip-hop, and electronic acts.",
          },
        ],
      },
      { type: "heading", text: "Ticket Tips" },
      {
        type: "text",
        text: "For Moda Center shows, tickets go through Ticketmaster. For Edgefield, buy through the McMenamins website. For smaller venues, most use DICE or Eventbrite — check the venue's website directly. **Sold-out shows**: Check the venue's official resale/exchange programs before third-party resellers. **Best value**: The small venues (Doug Fir, Mississippi Studios, Revolution Hall) rarely charge more than $20-40 and the artist quality is exceptional. **Pro tip**: Follow Portland venues on Instagram — they often announce surprise shows and last-minute additions that sell out in hours.",
      },
      { type: "heading", text: "Where to Stay for Portland Concerts" },
      {
        type: "image",
        src: "/images/home/poi-nw23rd.jpg",
        alt: "NW 23rd Avenue near Providence Park",
        caption:
          "NW Portland — walkable to Providence Park for the Stapleton show",
      },
      {
        type: "text",
        text: "Concert venues are spread across Portland, but the city is compact enough that staying in any central neighborhood works. Here's the best neighborhood for each venue: **Moda Center** → [NE Portland](/s/northeast-portland) or [SE Portland](/s/southeast-portland) (on the MAX line, near great post-show restaurants). **Edgefield** → [SE Portland](/s/southeast-portland) (closest, easiest drive east on I-84). **Providence Park** → [NW Portland](/s/northwest-portland) (walk to the stadium, walk home). **Crystal Ballroom** → NW Portland or Pearl District (downtown, walkable). **Revolution Hall / Doug Fir** → [SE Portland](/s/southeast-portland) (both are in SE). **Mississippi Studios** → [North Portland](/s/north-portland) or [NE Portland](/s/northeast-portland).",
      },
      {
        type: "text",
        text: "A vacation rental gives you a home base to cook dinner before the show, crash afterward without a long drive, and experience Portland's neighborhoods between events. For concerts that run late, having a rental in the same neighborhood as the venue means a short walk home instead of a surge-priced ride.",
      },
      {
        type: "tip",
        text: "Planning a trip around a show? Book a vacation rental direct with Book Traverse — no service fees, lower than Airbnb, and local tips on the best pre-show dinner near your venue. [Search your concert dates](/properties). No service fees — always the lowest price.",
      },
      {
        type: "tip",
        text: "Want a full itinerary to wrap around your concert weekend? The [Portland weekend itinerary](/plan/portland-weekend-itinerary) pairs the classic Portland greatest-hits with dinner and coffee picks near the major venues. Foodie travelers should grab the [Portland food itinerary](/plan/portland-food-itinerary) instead.",
      },
    ],
  },

  // ─── 11. PORTLAND SUMMER EVENTS 2026 ──────────────────────────────
  {
    slug: "portland-summer-events-2026",
    title: "Portland Summer 2026: Rose Festival, Blues Fest, World Cup & More",
    metaTitle: "Portland Summer Events 2026 | Festivals & Concerts",
    metaDescription:
      "Portland summer 2026 — Rose Festival, Waterfront Blues Fest, FIFA World Cup, Timbers & Thorns soccer, and outdoor concerts.",
    category: "events",
    categoryLabel: "Events & Festivals",
    author: "The Book Traverse Team",
    authorBio:
      "Summer is our busiest season. We've seen every Rose Festival parade, attended Blues Fest, and cheered at Providence Park. This is our insider guide to Portland's best summer.",
    publishedAt: "2026-03-05",
    updatedAt: "2026-03-12",
    heroImage: "/images/home/photo-1672430172282-fd2167ba8067.jpeg",
    heroAlt: "Portland waterfront in summer",
    excerpt:
      "Summer 2026 in Portland is packed — Rose Festival, Waterfront Blues Fest, FIFA World Cup watch parties, Timbers & Thorns soccer, and outdoor concerts at Edgefield and Providence Park.",
    relatedSlugs: [
      "portland-concerts-2026",
      "where-to-stay-in-portland",
      "best-restaurants-portland",
    ],
    relatedLandingPages: ["luxury", "family-friendly", "large-groups"],
    content: [
      {
        type: "text",
        text: "Portland's summers are legendary — warm, dry, long, and packed with events. Summer 2026 is shaping up to be one of the biggest yet: the Rose Festival returns, the Waterfront Blues Festival takes over the July 4th weekend, the FIFA World Cup will consume Soccer City USA, and Portland's professional soccer teams have some of the year's biggest home matches. Here's everything worth planning around, from late May through September.",
      },
      {
        type: "text",
        text: "A word about Portland summers: if you've only heard about Portland's rain, you're missing the best part. From late June through September, Portland averages less than an inch of rain per month. Temperatures sit in the 70s and 80s, daylight lasts until 9 PM, and the entire city moves outdoors. Brewery patios fill up, [parks](/guide/best-parks-portland) come alive with picnickers and hikers, and outdoor dining becomes the default. It's genuinely one of the best summer cities in America — and 2026 has one of the best event calendars in recent memory.",
      },
      {
        type: "image",
        src: "/images/home/poi-pearl.jpg",
        alt: "Pearl District in summer",
        caption:
          "Portland transforms in summer — dry skies, long evenings, and the city moves outdoors",
      },
      { type: "heading", text: "Portland Rose Festival (Late May - Mid June)" },
      {
        type: "text",
        text: "Portland's signature event since 1907, the Rose Festival is a multi-week celebration that defines early summer. The highlight is the Grand Floral Parade — one of the largest floral parades in the country — which winds through downtown Portland with flower-covered floats, marching bands, and equestrian units. CityFair takes over Tom McCall Waterfront Park for multiple weekends with carnival rides, live music stages, and food vendors. Dragon Boat Races bring colorful boats and competitive racing to the Willamette River. The International Rose Test Garden in Washington Park (free admission, 10,000+ rose bushes) is at peak bloom during the festival and offers panoramic views of Mt. Hood.",
      },
      {
        type: "tip",
        text: "The Grand Floral Parade draws huge crowds — arrive early for a good viewing spot along the route, or watch from the elevated vantage points on the Morrison or Burnside bridges. Rose Festival weekends are Portland's busiest — [book your stay early](/properties).",
      },
      { type: "heading", text: "Waterfront Blues Festival (July 2-4)" },
      {
        type: "text",
        text: "The largest blues festival on the West Coast returns to Tom McCall Waterfront Park for July 4th weekend, with three days of live music across three stages. Over 100 acts from across the country and around the world perform against the backdrop of Portland's bridges and river. The festival doubles as a fundraiser for the Oregon Food Bank — bring a canned food donation for discounted admission. On the 4th, stay for the fireworks display over the Willamette River, visible from the festival grounds. The festival is walking distance from downtown, the Pearl District, and SE Portland via the Hawthorne Bridge.",
      },
      {
        type: "tip",
        text: "July 4th weekend is Portland's peak accommodation demand. Hotels and vacation rentals fill up weeks in advance. Book your [Book Traverse rental](/properties) as early as possible — and remember, booking direct saves you 10-15% vs. Airbnb.",
      },
      {
        type: "heading",
        text: "FIFA World Cup 2026 in Soccer City USA (June 11 - July 19)",
      },
      {
        type: "text",
        text: "The 2026 FIFA World Cup — the biggest sporting event on earth — comes to the US, Canada, and Mexico from June 11 through July 19. Portland isn't a host city, but as the home of Nike, Adidas, the Timbers, and the Thorns, it's arguably America's most passionate soccer city. Expect watch parties at sports bars across Portland, outdoor screenings in parks and plazas, and a citywide energy that builds through the tournament. The 4 Pines at Providence Park, Thirsty Lion, and Spirit of 77 are reliable large-screen watch party venues. The Timbers go on a schedule break during the World Cup, so the city's soccer energy will channel directly into the tournament.",
      },
      {
        type: "tip",
        text: "Portland's MLS schedule breaks for the World Cup from late May to mid-July. But the Thorns keep playing through June and July — catch professional soccer live while watching World Cup matches at bars. Peak soccer energy in Soccer City USA.",
      },
      {
        type: "heading",
        text: "Portland Timbers & Thorns — Summer Home Games",
      },
      {
        type: "text",
        text: "Providence Park is one of the best stadiums in American soccer — compact, loud, and full of character. The Timbers Army supporters section creates an atmosphere that rivals anything in European football. Summer 2026 has some marquee home matches worth building a trip around.",
      },
      {
        type: "subheading",
        text: "Key Timbers Home Games",
      },
      {
        type: "places",
        items: [
          {
            name: "Jul 22 vs. FC Dallas (7:30 PM)",
            detail:
              "First home match after the World Cup break. The energy will be electric as fans return to Providence Park.",
          },
          {
            name: "Jul 25 vs. Real Salt Lake (7:30 PM)",
            detail: "Hispanic Heritage Celebration theme night.",
          },
          {
            name: "Aug 1 vs. Seattle Sounders (7:30 PM)",
            detail:
              "The Cascadia Derby — Portland vs. Seattle is the fiercest rivalry in MLS. Don't miss this one.",
          },
          {
            name: "Sep 19 vs. Atlanta United (7:30 PM)",
            detail:
              "Hispanic Heritage Celebration. Late-season match with playoff implications.",
          },
        ],
      },
      {
        type: "subheading",
        text: "Key Thorns Home Games",
      },
      {
        type: "places",
        items: [
          {
            name: "Jul 5 vs. Racing Louisville (4 PM)",
            detail:
              "Summer Block Party theme. July 4th weekend — combine the Blues Fest with a Thorns match.",
          },
          {
            name: "Jul 24 vs. NJ/NY Gotham FC (7 PM)",
            detail:
              "Pride Celebration night. Thorns fans are among the most passionate in NWSL.",
          },
          {
            name: "Aug 15 vs. Orlando Pride (5:45 PM)",
            detail:
              "Rock the Runway night. Orlando is consistently one of the top NWSL teams.",
          },
          {
            name: "Oct 3 vs. Boston Legacy FC (5:45 PM)",
            detail: "Keep Portland Weird night. Late-season atmosphere.",
          },
        ],
      },
      {
        type: "tip",
        text: "Timbers and Thorns tickets double as TriMet passes — free transit to and from the match. Providence Park is walkable from NW Portland and downtown. Stay in a [Northwest Portland rental](/s/northwest-portland) and walk to the stadium.",
      },
      {
        type: "heading",
        text: "Outdoor Concerts at Edgefield & Providence Park",
      },
      {
        type: "text",
        text: "Summer is outdoor concert season in Portland. The marquee shows include Chris Stapleton at Providence Park (July 17), CAKE for two nights at Edgefield (July 24-25), Young the Giant with Cold War Kids at Edgefield (July 26), Tedeschi Trucks Band at Edgefield (August 7), and Earth, Wind & Fire at Edgefield (September 5). For the full concert calendar with all dates and venues, see our [Portland Concert Guide: Spring & Summer 2026](/guide/portland-concerts-2026).",
      },
      {
        type: "text",
        text: "McMenamins Edgefield is Portland's most unique outdoor venue — a 74-acre former county poor farm in Troutdale (20 minutes east) that McMenamins has transformed into a sprawling complex with a winery, brewery, distillery, gardens, and a 4,000-person amphitheater. Arrive early, explore the grounds, grab a drink from one of the on-site bars, and settle into the lawn with a blanket. There is no bad spot — the sloped amphitheater means everyone has a clear view. It's the Portland concert experience, and it's unlike anything else in the country.",
      },
      { type: "heading", text: "More Summer Events" },
      {
        type: "image",
        src: "/images/home/poi-alberta.jpg",
        alt: "Alberta Arts District street scene",
        caption:
          "Last Thursday on Alberta — Portland's best monthly street party runs May through September",
      },
      {
        type: "text",
        text: "**Portland Saturday Market** runs every weekend through the summer at Tom McCall Waterfront Park — 250+ local artisans and food vendors selling handmade goods. It's the largest continuously operating open-air craft market in the US. **Last Thursday on Alberta Street** (May through September) is a monthly neighborhood street party that fills blocks with art installations, food carts, live music, and thousands of people. It's the best free event in Portland. **First Thursday in the Pearl District** opens galleries late with free admission and wine — a cultural highlight every month.",
      },
      {
        type: "text",
        text: "**Oregon Brewers Festival** (late July) takes over Tom McCall Waterfront Park with 80+ [craft breweries](/guide/best-breweries-portland) pouring in the summer sun. **Feast Portland** (September) is one of the country's premier food festivals with James Beard-winning chefs, the Night Market, and Smoked! barbecue event. **Cathedral Park Jazz Festival** fills the area beneath the St. Johns Bridge with free jazz over a weekend. And Portland's [food cart pods](/guide/best-restaurants-portland), brewery patios, and rooftop bars are at their best from June through September — the city is designed for warm-weather outdoor living.",
      },
      { type: "heading", text: "Summer Day Trips" },
      {
        type: "text",
        text: "Portland's summer is also the best season for [day trips](/guide/day-trips-from-portland). The Columbia River Gorge waterfalls are at their most accessible (though spring has the best flow). The Oregon Coast is warm enough for beach walks and tide pool exploration. Willamette Valley wine country is at peak beauty with green vineyards and outdoor tastings. Mt. Hood offers summer hiking, glacier skiing, and alpine wildflower meadows. And Hood River's Fruit Loop has peak cherry and berry season in July. Use Portland as your base — a [vacation rental with a kitchen](/properties) lets you pack picnic supplies from the farmers market and head out for the day.",
      },
      { type: "heading", text: "Planning Your Portland Summer" },
      {
        type: "text",
        text: "Summer is Portland's busiest season for both events and accommodation. Book as early as possible — Rose Festival (late May-early June), July 4th weekend (Blues Fest), and Labor Day weekend are the hardest dates to find availability. Midweek stays are significantly easier to book and often cheaper. For the best summer experience, look for a rental with outdoor space — a patio, backyard, or deck makes all the difference when the weather is perfect and the sun sets at 9 PM.",
      },
      {
        type: "image",
        src: "/images/home/portland-sunset-skyline.jpg",
        alt: "Portland sunset skyline in summer",
        caption:
          "Portland summer sunsets — golden light over the city until 9 PM",
      },
      {
        type: "tip",
        text: "Portland summers are dry and warm (70s-80s) with long daylight hours. Book a vacation rental with outdoor space to get the full Portland summer experience. Browse [properties with backyards](/s/backyard) or [hot tubs](/s/hot-tubs). And [book direct](/guide/book-direct-save) to save 10-15% vs. Airbnb.",
      },
      {
        type: "tip",
        text: "Building a summer trip around an event? Start from a ready-made itinerary and adjust dates: [Portland weekend itinerary](/plan/portland-weekend-itinerary) for first-timers, [Portland outdoors itinerary](/plan/portland-outdoors-itinerary) for hikers and Gorge day-trippers, or [Portland with kids](/plan/portland-with-kids-itinerary) for families. Each includes a map and matching vacation rentals.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getGuideArticle(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find((a) => a.slug === slug);
}

export function getAllGuideArticles(): GuideArticle[] {
  return GUIDE_ARTICLES;
}

export function getAllGuideSlugs(): string[] {
  return GUIDE_ARTICLES.map((a) => a.slug);
}

export function getArticlesByCategory(category: GuideCategory): GuideArticle[] {
  return GUIDE_ARTICLES.filter((a) => a.category === category);
}
