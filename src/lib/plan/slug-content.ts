// Long-form SEO body + FAQs per slug. Rendered at /plan/<slug> below the
// main itinerary block. Each slug has ~600 words of keyword-targeted context
// (best time to visit, where to stay, getting around, cost) plus 5 FAQs.
//
// Kept in a separate module from slug-map.ts so routing/metadata edits
// don't trip on long strings, and so this file can be edited independently
// when refreshing copy.

export interface PlanFaq {
  question: string;
  answer: string;
}

export interface PlanSlugContent {
  // Full markdown-ish body with `## Heading` blocks + paragraphs + [links](/url).
  // Rendered by <MarkdownContent />.
  body: string;
  faqs: PlanFaq[];
}

// Shared E-E-A-T line. Rendered once per slug page immediately below the
// hero CTAs. Google's Search Raters guidelines reward a visible author/org
// attribution paired with concrete credentials.
export const AUTHOR_BYLINE =
  "Written by the Book Traverse team — locals managing 275+ Portland vacation rentals since 2016. We've hosted 80,000+ guests and built this itinerary from the places we recommend to friends, family, and our own booked guests.";

export const SLUG_CONTENT: Record<string, PlanSlugContent> = {
  "portland-weekend-itinerary": {
    body: `## Best time for a Portland weekend itinerary

Portland's weather gate opens mid-May and stays dry through mid-October — blue skies, 70–80°F, long evenings. June through September is peak; expect busier restaurants and rental rates up to 20% higher than shoulder months. September is the locals' favorite — still warm, dinner patios open, tourist crowds thinning out. Spring (late April–May) is underrated: cherry blossoms at Waterfront Park, cheaper rates, the occasional rainy day. November through March target midweek and lean into coffee shops, breweries, indoor food halls, and Powell's. December has the best restaurant availability of the year for anyone who doesn't mind a drizzle.

## Where to stay for a Portland weekend

For a classic two-night trip, two neighborhoods cover most of this itinerary without a car. [Nob Hill / NW 23rd](/neighborhoods/nob-hill) puts you on Portland's most walkable dining corridor with Forest Park at your back. [Hawthorne and Belmont](/neighborhoods/hawthorne-belmont) puts you on inner SE's best food and coffee strip. The [Pearl District](/neighborhoods/pearl-district) is slicker, closer to Powell's and the streetcar, and a good fit if you want walkable downtown with less east-side energy. All three are serviced by Book Traverse's [full rental collection](/properties); we'd avoid Old Town/Chinatown for first-time visitors.

## How to get around on a Portland weekend

Portland is compact — 15–25 minute walks or $8–12 Lyft rides cover most of this itinerary. The streetcar and MAX light rail connect downtown, the Pearl, and the Lloyd District. Uber and Lyft fill any gap; wait times are typically under 5 minutes in core neighborhoods. A rental car is only worth it if you're adding a Mt. Hood or Oregon Coast day trip. Biking is excellent from spring through fall — Biketown covers downtown through inner SE and NE, $3 to unlock plus $0.20/minute. Skip driving downtown unless you enjoy paying $20+/day for a parking garage.

## How much does a Portland weekend cost?

For two adults, two nights, all-in: vacation rental at $140–220/night ($280–440 total), coffee and pastry mornings ~$20/day, food cart lunches $15–18/person, mid-range dinner $45/person with drinks, a cocktail nightcap $16 each. Total for a smart two-night weekend: $850–1,200 not counting flights. Booking direct with Book Traverse saves 10–15% compared to Airbnb or Vrbo — same properties, zero service fees, best-price guarantee. Splurge line: a tasting-menu dinner ($120–180/person) at Kann or Langbaan, or a floating-home rental on the Columbia River.`,
    faqs: [
      {
        question: "How many days do you need in Portland?",
        answer:
          "Two nights is the minimum to actually feel Portland — one night only gets you one neighborhood and one meal. Three nights is the sweet spot if you want a Gorge or coast day trip folded in. Anything less and you're sprinting past the best parts.",
      },
      {
        question: "Is downtown Portland safe to visit?",
        answer:
          "Most of downtown is safe — the Pearl District, SW Park Blocks, South Waterfront, and the PSU area feel active and walkable day and night. Old Town/Chinatown (a few blocks NW of Burnside) still has visible homelessness and is the one area we'd skip at night. East-side neighborhoods like Hawthorne, Alberta, and Mississippi feel entirely safe.",
      },
      {
        question:
          "What's the best neighborhood for first-time Portland visitors?",
        answer:
          "NW 23rd / Nob Hill. It's Portland's most walkable corridor (47 restaurants and cafés in a 20-block stretch), Forest Park is at your back, and you're 10 minutes to the Pearl and 15 to Hawthorne by Lyft. Ideal for a two-night weekend.",
      },
      {
        question: "Do I need a car for a Portland weekend?",
        answer:
          "No — unless you're adding a Mt. Hood or Oregon Coast day trip. Walking, Lyft, streetcar, and Biketown cover this itinerary. Parking downtown runs $20+/day and isn't worth it for most two-night trips.",
      },
      {
        question: "Can I book Portland vacation rentals without service fees?",
        answer:
          "Yes — Book Traverse charges no service fees when you book direct. These are the same properties listed on Airbnb and Vrbo, saving 10–15% off OTA pricing. Our 'Book direct. Always the lowest price' guarantee is real: if you find the same property cheaper elsewhere, we match it.",
      },
    ],
  },

  "portland-food-itinerary": {
    body: `## Best time for a Portland food weekend

Portland's food scene peaks from May through October — patio season, farmers-market produce at its best, food cart pods at maximum occupancy. July–August is Oregon's stone-fruit peak, and Feast Portland in September pulls every major local chef on stage. January and February are the quiet months when mid-tier restaurants run winter menus and booking a Saturday table is genuinely easy. Holiday weekends (Memorial Day, 4th of July, Labor Day) book 2–3 weeks out; shoulder-season weekdays almost always have space. The Portland Farmers Market at PSU runs year-round on Saturdays — anchor your Saturday around it.

## Where to stay for a Portland food itinerary

For food-first travelers, inner SE is the play. [Hawthorne and Belmont rentals](/neighborhoods/hawthorne-belmont) put you walking distance from Tusk, Langbaan, Pok Pok alumni restaurants, and a dozen top coffee shops. [Mississippi Avenue](/neighborhoods/mississippi-avenue) in North Portland has Lovely's Fifty Fifty, Mississippi Pizza, and a strong brewery scene. [NW 23rd / Nob Hill](/neighborhoods/nob-hill) works if you want the classic Portland mix plus walkable dinner. Skip the airport / Cascade Station cluster — you'll spend more on Lyfts to actual food than you'd save on the hotel rate.

## How to get between Portland food stops

Density helps — 60% of this itinerary is walkable within a single neighborhood. Between neighborhoods, Lyft runs $8–14. [Biketown bikes](https://biketownpdx.com) cover the inner-SE corridor well when weather allows. The Portland Food Cart Pod at Hawthorne & 12th or the Prost! pod on North Mississippi are both walkable hubs — plan one cart-pod lunch per day. Don't attempt reservations-only restaurants without booking 10–14 days ahead on Resy; Kann, Langbaan, Yaowarat, and Nodoguro routinely book out a week in advance for weekends.

## How much does a Portland food weekend cost?

Food-forward weekends run a bit higher than average. Two adults, two nights: vacation rental $160–240/night × 2, coffee + pastry $20/day, food cart or casual lunch $35 for two, mid-range dinner with drinks $110 for two, a tasting-menu splurge $300+ for two. All-in for a serious food weekend: $1,100–1,600 for two. Cheap angle: food carts for two meals per day (most around $12–15 per plate) plus one nice dinner. Splurge angle: a Kann tasting menu (~$120/person) plus a natural-wine bar nightcap. No sales tax in Oregon — menu price is what you pay before tip.`,
    faqs: [
      {
        question: "What are the must-try foods in Portland?",
        answer:
          "Food carts (the pods at Hawthorne & 12th and Cartopia on SE 12th are the classics), coffee from one of the four or five world-class roasters (Heart, Coava, Proud Mary, Stumptown), a wood-fired pizza from Ken's Artisan or Apizza Scholls, fresh Oregon produce in any market-driven restaurant, and something from the Mexican/Oaxacan side of the scene at Nuestra Cocina or Revolución.",
      },
      {
        question: "Do I need reservations at Portland restaurants?",
        answer:
          "At the destination restaurants, yes. Resy locks Kann, Langbaan, Nodoguro, République, Le Pigeon, and Gado Gado 10–14 days out for weekends. Casual spots, food carts, and breweries are walk-in. If you're flexible on timing (5:30pm or 9pm), you can usually find same-day tables at mid-tier restaurants.",
      },
      {
        question: "Where are the best Portland food carts?",
        answer:
          "Three pods locals keep coming back to: Cartopia on SE 12th and Hawthorne (late-night), Prost! Marketplace on N Mississippi (beer plus carts), and Hawthorne Asylum on SE 10th and Madison. Each has 10+ carts covering different cuisines. The downtown-square pods have thinned since 2020 — skip them unless you're already in the area.",
      },
      {
        question: "What's Portland's signature coffee?",
        answer:
          "Portland has four or five world-class roasters: Heart (light Scandinavian style), Coava (clean direct-trade), Stumptown (founded the city's third-wave scene), Proud Mary (Australian-influenced), and Never (small-batch, NE Portland). Coava's Buckman flagship and Heart's Burnside roastery are worth visiting as spaces, not just for the drink.",
      },
      {
        question: "Is tipping different in Portland?",
        answer:
          "Standard US rules apply — 18–22% at full-service restaurants, $1–2 per drink at bars. Counter-service spots and food carts increasingly have tip prompts at checkout; 10–15% is customary there. Oregon has no sales tax, so menu price is what you pay before tip — a rare break for out-of-state visitors.",
      },
    ],
  },

  "portland-outdoors-itinerary": {
    body: `## Best time for a Portland outdoors itinerary

Hike season opens mid-May and runs through mid-October — dry trails, long daylight, Gorge waterfalls at reasonable flow. Peak wildflower and green is May–June in the Columbia Gorge; peak color is mid-September through mid-October. July–August is warm (80s) and dry — bring water and go early. Winter transforms Mt. Hood into ski territory (November–April); Timberline Lodge opens for snowshoeing and the Palmer glacier is the only 12-month ski run in North America. The Columbia Gorge gets slippery in winter but Multnomah Falls is still worth the 20-minute walk.

## Where to stay for a Portland hiking weekend

[Nob Hill / NW Portland rentals](/neighborhoods/nob-hill) are the best in-city basecamp — Forest Park trailheads are a 10-minute walk from most NW 23rd properties. That gets you 80 miles of urban wilderness trail without a car. If you want direct mountain access, [Mt. Hood rentals](/s/mt-hood) in Government Camp or Welches put you on the slopes, but you trade a day of Portland's food scene for ski-town chill. Most outdoor travelers we host do two nights in the city plus one mountain or Gorge day out — the best of both.

## How to get to hikes from Portland

Forest Park and Washington Park are walkable or a $10 Lyft from NW 23rd. For the Columbia Gorge, Mt. Hood, and Silver Falls State Park, a rental car is essential — transit doesn't reach the trailheads. Half-day rentals run $40–60 from downtown locations. The Gorge is 30 minutes east on I-84; Mt. Hood is 60 minutes east on US-26; Silver Falls is 75 minutes south on I-5. Friends of the Gorge runs a weekend shuttle in summer. Trip tip: the Columbia River Historic Highway (old US-30) is slower but hits every Gorge waterfall in order, a better drive than the interstate.

## How much does a Portland outdoors weekend cost?

Two adults, three nights: vacation rental $140–200/night × 3 = $420–600. Rental car for 2 days: $80–120. Gas for Gorge and Mt. Hood runs: ~$30. Meals mostly mid-range ($35/person dinner, $15/person lunch): ~$300 total for the trip. Trail passes: free (most Oregon state parks are free; Silver Falls is a $5 parking fee). Add gear rental ($20–40/day for snowshoes, skis, or bikes) if needed. All-in outdoor weekend: $900–1,300 for two — competitive with a comparable national park trip.`,
    faqs: [
      {
        question: "What's the best hike near Portland?",
        answer:
          "In the city, the Forest Park Wildwood Trail (30 miles starting at Pittock Mansion) is hard to beat for urban hiking. For Gorge hikes, Dog Mountain in June (wildflower explosion) or Angel's Rest (2.4 miles round-trip with big Gorge views year-round). For Mt. Hood, Mirror Lake (3.2 miles round-trip to an alpine lake with Hood's peak reflected in the water) is the most accessible alpine hike.",
      },
      {
        question: "Do I need a car for Portland outdoors trips?",
        answer:
          "For in-city parks (Forest Park, Washington Park, Mt. Tabor) no — walking and Lyft work. For anything outside city limits (Columbia Gorge, Mt. Hood, Silver Falls, Oregon Coast) yes. Rental cars from PDX airport run $40–60/day; Turo or Zipcar are cheaper for a single day.",
      },
      {
        question: "Is Multnomah Falls worth visiting?",
        answer:
          "Yes — at 620 feet it's the tallest waterfall in Oregon and the state's most visited natural landmark. Arrive before 9 AM or after 4 PM to avoid tour-bus crowds. The short walk to Benson Bridge (0.4 miles round-trip) is the easy version; the full Larch Mountain trail continues 7+ miles for serious hikers.",
      },
      {
        question: "Can you ski near Portland in summer?",
        answer:
          "Yes — Timberline Lodge on Mt. Hood's south side is the only year-round lift-served skiing in North America. Summer skiing on the Palmer glacier runs June through August; it's worth the drive just to say you did it. National team athletes train there in summer.",
      },
      {
        question: "What should I pack for Portland outdoor weekends?",
        answer:
          "Layers — mornings start cool even in July. A waterproof shell for spring and fall. Hiking shoes (most trails don't need boots, but sturdy soles help on roots). Water bottle and trail snacks. Cash or card for state-park parking ($5 at Silver Falls). Sunscreen — Pacific Northwest summer sun at altitude hits harder than people expect.",
      },
    ],
  },

  "portland-neighborhoods-tour": {
    body: `## Best time for a Portland neighborhoods tour

Any season — this itinerary runs indoor-ish (coffee shops, galleries, bookstores, bars) with just enough outdoor walking to feel like a city tour. Spring and fall hit the sweet spot for weather. Summer turns the street fairs (Last Thursday on Alberta, First Thursday in the Pearl) into real events. Winter weekends are surprisingly good — shorter daylight, but the bar-and-bookstore mood matches the weather. Avoid the first rainy week of October — it's Portland's abrupt seasonal transition and no one warns you. May–September gives you the best patio scene; late November–February is the slow season with easier restaurant bookings.

## Where to stay for a Portland neighborhoods tour

Inner SE is the best homebase for this itinerary — you're walking distance from Hawthorne, Belmont, Division, and a short Lyft from Alberta, Mississippi, and the Pearl. [Hawthorne and Belmont rentals](/neighborhoods/hawthorne-belmont) put you on the densest commercial strip on the east side. [Alberta Arts District rentals](/neighborhoods/alberta-arts-district) work if you want to wake up on one of the city's best streets. For a more polished stay, the [Pearl District](/neighborhoods/pearl-district) is walkable to downtown, Powell's, and the Saturday Market. All three drop you 3–10 minutes from every stop on this plan.

## How to get between Portland neighborhoods

Portland's east-side neighborhoods are 3–7 minutes apart by Lyft ($8–12 each). Alberta to Mississippi is a 10-minute bike or 8-minute Lyft. Hawthorne to Division is walkable (15 minutes). Crossing the river east-side to the Pearl is 10–15 minutes by Lyft or a streetcar connection. Biketown bikes cover the east side well — grab one for any 1–3 mile hop. TriMet bus #14 runs Hawthorne; #4 runs Division; #72 runs Alberta/Killingsworth. A rental car is overkill and actually slows you down with parking.

## How much does a Portland neighborhoods weekend cost?

Two adults, two nights: vacation rental $140–220/night × 2 = $280–440. Coffee and pastry mornings ~$20/day. Lunch at a cart or café ~$30 for two. Dinner at a neighborhood spot $80–110 for two with drinks. Cocktail or natural-wine bar nightcap $25 for two. Shopping budget highly variable — budget $100+ if you're going to Powell's (you will buy books), a vintage shop on Hawthorne, and a bag of beans from a roaster. All-in for a neighborhoods weekend: $800–1,150 for two. No Oregon sales tax helps on retail.`,
    faqs: [
      {
        question: "Which Portland neighborhoods are the most walkable?",
        answer:
          "NW 23rd / Nob Hill (Walk Score 98), the Pearl District (WS 96), and Hawthorne/Belmont (WS 94) are the top three. Division (WS 91), Alberta (WS 88), and Mississippi (WS 86) are all walkable along their commercial strips but residential blocks get quieter. Sellwood's 13th Avenue strip is walkable within its immediate 4–5 blocks.",
      },
      {
        question:
          "What's the difference between NW 23rd, Alberta, and Hawthorne?",
        answer:
          "NW 23rd is Portland's polished walkable corridor — established restaurants, some national brands, walking distance to Forest Park. Alberta is artsy and gentrifying — galleries, tattoo parlors, Salt & Straw ice cream, the Last Thursday street party in summer. Hawthorne is the classic inner-SE mix — independent shops, vintage, food carts, the Bagdad Theater. All three are worth a half-day stop on this itinerary.",
      },
      {
        question: "Is Powell's Books worth visiting?",
        answer:
          "Yes, for a first-time visit. The Burnside flagship is a full city block across multiple floors — the largest independent bookstore in North America. Plan for 45–90 minutes. If you've been before, the smaller Hawthorne and Cedar Hills locations are easier to navigate. Don't miss the Rare Book Room upstairs at the flagship.",
      },
      {
        question: "What are Portland's best shopping neighborhoods?",
        answer:
          "NW 23rd for upscale and national brands. Alberta for vintage, handmade, and local art. Hawthorne for books and eclectic shops. Mississippi for plant shops, records, and zines. Division for newer independents. The Pearl for galleries and home goods. Oregon has no sales tax, which matters if you're coming from a state that does.",
      },
      {
        question: "Are Last Thursday and First Thursday worth planning around?",
        answer:
          "Yes — if your trip dates align. Last Thursday on Alberta (May–September, last Thursday of the month) is a full street fair with music, food carts, art vendors, and crowds in the tens of thousands. First Thursday in the Pearl (year-round, first Thursday) is galleries opening late with free wine — a calmer vibe. Neither runs on other Thursdays, so check dates before you build around them.",
      },
    ],
  },

  "portland-with-kids-itinerary": {
    body: `## Best time for a Portland family weekend

June through August is family peak — warm, dry, most outdoor kid attractions at full operation. Save OMSI for a rainy day (it's a 2–3 hour visit and better indoor use of bad weather). Portland Children's Museum and the Oregon Zoo in Washington Park run year-round. Thanksgiving through New Year's brings ZooLights, Peacock Lane light displays, and the Portland Christmas Market — all strong family draws in the low season. Spring Break week in late March is a decent off-peak choice — mild weather, shorter lines at Children's Museum and OMSI.

## Where to stay in Portland with kids

[Sellwood-Moreland rentals](/neighborhoods/sellwood) are the quiet-family favorite — Oaks Bottom Wildlife Refuge, Sellwood Park, and Oaks Amusement Park are all walkable. [NE Portland](/neighborhoods/ne-portland) — Laurelhurst and Irvington — puts you near Laurelhurst Park (ducks, playground, tennis) and a 15-minute Lyft to OMSI or the Zoo. Avoid Old Town and downtown Chinatown blocks with kids — visible street homelessness can be unsettling. Vacation rentals beat hotels for families in Portland: kitchen for kid meals, washer/dryer in-unit, and the space to spread out across 2–3 bedrooms for a price comparable to two hotel rooms. Browse [family-friendly rentals](/stays/family-friendly) curated for this.

## How to get around Portland with kids

A rental car helps if you're planning Zoo plus OMSI plus Oaks Park on different days — parking is free at the Zoo, $5 at OMSI, $3 at Oaks. Downtown Lyft or Uber is fine with kids; most Portland drivers have car seats (confirm when booking). The MAX light rail is kid-friendly and an attraction in its own right for train-loving kids — the Red Line from downtown to the airport is a 40-minute ride through the Gorge foothills. Biketown has kid trailers at some stations, though availability is inconsistent. TriMet buses are well-run but slower than Lyft for family stops.

## How much does a Portland family weekend cost?

Family of four, two nights: 2-bedroom vacation rental $180–280/night × 2 = $360–560 (hotels for four would run two rooms at similar price but without the kitchen or laundry). OMSI admission $22/adult + $17/child = $78 for family of four. Oregon Zoo $25/adult + $20/child = $90. Portland Children's Museum $13/person = $52. Food cart lunches $10–12/kid — cheaper and faster than sit-down restaurants with children. All-in for a family weekend: $900–1,400 for four, less if you skip one or two attractions. Book direct with Book Traverse to save 10–15% vs. Airbnb service fees.`,
    faqs: [
      {
        question: "What are the best Portland attractions for kids?",
        answer:
          "OMSI (science museum, ideal for ages 4–12, rainy-day perfect), the Oregon Zoo in Washington Park (the train ride around the zoo is a hit), Portland Children's Museum (ages 2–8), Oaks Amusement Park (classic midway rides, Sellwood), and the Japanese Garden in Washington Park (kid-friendly for older kids). Free option: any of Portland's 200+ parks — Jamison Square's splash fountain, Grant Park, and Laurelhurst Park all have excellent playgrounds.",
      },
      {
        question: "Is Portland kid-friendly?",
        answer:
          "Very — it's one of the most family-oriented mid-size US cities. Restaurants almost all welcome kids (high chairs are standard), sidewalks are wide, parks are plentiful, and the transit system is novel enough to entertain city kids. The one caveat: certain downtown blocks have visible homelessness that can be confronting for children; east-side neighborhoods and NW 23rd feel entirely comfortable.",
      },
      {
        question: "What are kid-friendly restaurants in Portland?",
        answer:
          "Food carts are ideal — low-pressure, huge variety, cheap per plate. Ken's Artisan Pizza and Lovely's Fifty Fifty do proper sit-down family pizza. Slappy Cakes lets kids make their own pancakes at the table (SE Belmont). Por Qué No is inexpensive Mexican with fast-casual seating. Screen Door does family brunch (expect weekend waits). Pine State Biscuits and Broder are strong for breakfast and lunch.",
      },
      {
        question: "Can you do Portland without a car with kids?",
        answer:
          "Mostly — if you stay east side or NW 23rd. Lyft with booked car seats handles longer hops. The only family attractions that are hard to reach by transit are the Oregon Zoo (Washington Park MAX stop plus a 10-minute uphill walk) and Oaks Park in Sellwood (a car or long Lyft). For a single-day visit to either, transit plus Lyft is workable.",
      },
      {
        question:
          "What's the best Portland vacation rental for a family of four?",
        answer:
          "Look for: 2+ bedrooms with a real kid bed (not just a pull-out sofa), walkable to a park and a grocery store, washer/dryer in-unit, and a fenced yard if your kid is young. Sellwood and Laurelhurst are our most booked family neighborhoods for exactly these reasons. Browse [our family-friendly collection](/stays/family-friendly) curated by the Book Traverse team.",
      },
    ],
  },
};

export function getSlugContent(slug: string): PlanSlugContent | null {
  return SLUG_CONTENT[slug] ?? null;
}
