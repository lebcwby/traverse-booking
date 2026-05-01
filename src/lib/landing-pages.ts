export interface LandingPageConfig {
  slug: string;
  title: string;
  tagline: string;
  metaDescription: string;
  heroImage: string;
  filters: {
    tags?: string[];
    amenities?: string[]; // BEAPI amenity codes like "HOT_TUB"
    amenityStrings?: string[]; // Full amenity text for post-filter (e.g., "Garden or backyard")
    petsAllowed?: boolean;
    minOccupancy?: number;
    minBedrooms?: number; // Post-filter: minimum bedroom count (inclusive)
    maxBedrooms?: number; // Post-filter: maximum bedroom count (inclusive)
    minLat?: number; // BEAPI geo bounding box
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  };
  introContent: string[]; // paragraphs
  bottomContent: { question: string; answer: string }[]; // FAQ items
  relatedSlugs: string[];
}

export const LANDING_PAGES: LandingPageConfig[] = [
  // ──────────────────────────────────────────────
  // TAG-BASED PAGES
  // ──────────────────────────────────────────────
  {
    slug: "pet-friendly",
    title: "Pet-Friendly Vacation Rentals in Portland",
    tagline: "Bring the whole pack to Portland",
    metaDescription:
      "Browse 275+ pet-friendly vacation rentals in Portland, Oregon. Dog-friendly homes with fenced yards, nearby parks, and no breed restrictions. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Pet Friendly"], petsAllowed: true },
    introContent: [
      "Portland is one of the most dog-friendly cities in the country, and we think your four-legged family members deserve a great vacation too. Our pet-friendly rentals welcome dogs of all sizes and breeds -- no weight limits, no extra hoops to jump through. Many of our homes feature fenced yards, dog-washing stations, and easy access to off-leash parks like Sellwood Riverfront or Normandale.",
      "Whether you're exploring the trails at Forest Park, grabbing a patio brunch on Alberta Street, or just lounging on the couch after a long day of sightseeing, your pup can be right there with you. We stock many of our pet-friendly homes with bowls, waste bags, and local recommendations for groomers, dog parks, and pet-friendly patios.",
      "Traveling with pets shouldn't mean compromising on style or comfort. Our pet-friendly collection spans every neighborhood and price point -- from cozy bungalows in North Portland to spacious craftsman homes in Southeast. Book direct and skip the surprise pet fees you'll find on other platforms.",
    ],
    bottomContent: [
      {
        question: "Is there an extra fee for bringing my pet?",
        answer:
          "Most of our pet-friendly properties include a modest pet fee that covers additional cleaning. The exact fee is listed on each property page before you book -- no hidden charges.",
      },
      {
        question: "Are there breed or size restrictions?",
        answer:
          "We do not impose breed or weight restrictions on our pet-friendly properties. We ask that all pets be house-trained and well-behaved. Please let us know how many pets you're bringing when you book.",
      },
      {
        question: "What dog parks are near your rentals?",
        answer:
          "Portland has over 30 off-leash dog parks. Popular ones near our properties include Sellwood Riverfront Park, Normandale Park, Alberta Park, and the expansive trails at Forest Park. We include a neighborhood guide with local favorites at check-in.",
      },
      {
        question: "Can I leave my pet at the rental while I go out?",
        answer:
          "We ask that pets not be left unattended for extended periods, especially if they tend to bark or become anxious. If you need a local pet sitter or doggy daycare, we're happy to share recommendations.",
      },
    ],
    relatedSlugs: ["family-friendly", "backyard", "budget-friendly"],
  },

  {
    slug: "luxury",
    title: "Luxury Vacation Rentals in Portland",
    tagline: "Elevated stays, Portland style",
    metaDescription:
      "Discover 100+ luxury vacation rentals in Portland, Oregon. Designer interiors, premium amenities, hot tubs, and prime locations. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Luxury Collection"] },
    introContent: [
      "Our Luxury Collection is for guests who want more than just a place to sleep. These are homes that make an impression -- thoughtfully designed spaces with high-end finishes, curated art, spa-like bathrooms, and chef's kitchens outfitted with everything you need to cook a proper meal. Many feature private hot tubs, fireplaces, and outdoor entertaining spaces that rival any boutique hotel.",
      "What sets our luxury rentals apart is that they still feel like Portland. You won't find generic corporate decor here. Every home in the collection reflects the city's design-forward spirit -- local woodwork, vintage finds, plants everywhere, and neighborhoods you'll actually want to explore on foot. These are homes in the Pearl District, Nob Hill, Hawthorne, and Division Street, steps from the restaurants and shops that make Portland worth visiting.",
      "Book direct with Book Traverse and enjoy complimentary welcome packages, priority concierge support, and local recommendations tailored to your trip. Our luxury homes are popular for anniversaries, milestone birthdays, and work retreats where you want to impress without feeling stuffy.",
    ],
    bottomContent: [
      {
        question: "What qualifies a property for the Luxury Collection?",
        answer:
          "Our Luxury Collection homes are hand-selected based on design quality, premium amenities (hot tubs, fireplaces, high-end appliances), location, and consistently high guest ratings. Each one is personally inspected by our team.",
      },
      {
        question: "Do luxury properties include any special perks?",
        answer:
          "Yes. Luxury Collection guests receive a complimentary welcome package with local treats, priority check-in flexibility, and access to our concierge team for restaurant reservations, activity planning, and local recommendations.",
      },
      {
        question: "Are luxury rentals suitable for events or gatherings?",
        answer:
          "Some of our luxury homes are well-suited for small gatherings and intimate celebrations. Please reach out before booking if you're planning an event so we can match you with the right property and go over any guidelines.",
      },
    ],
    relatedSlugs: ["hot-tubs", "fireplace", "southeast-portland"],
  },

  {
    slug: "large-groups",
    title: "Large Group Vacation Rentals in Portland",
    tagline: "Room for everyone, together under one roof",
    metaDescription:
      "Find 90+ large group vacation rentals in Portland sleeping 8+ guests. Spacious homes for reunions, retreats, and celebrations. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Group Getaways"], minOccupancy: 8 },
    introContent: [
      "Getting the whole crew together is the best part of any trip, and Portland is the perfect city to do it. Our group-friendly homes sleep eight or more guests comfortably, with open floor plans, multiple bathrooms, and communal spaces designed for hanging out -- not just sleeping. Think spacious living rooms, big dining tables, game rooms, and backyards with room to spread out.",
      "Whether you're planning a family reunion, a bachelor or bachelorette weekend, a corporate retreat, or just a long overdue friends' trip, our large group rentals keep everyone together without anyone feeling cramped. Many are in walkable neighborhoods close to Portland's best restaurants, breweries, and attractions, so you can split up during the day and reconvene for dinner.",
      "Booking one big house is almost always more affordable and more fun than splitting the group across hotel rooms. Our team can help you find the right fit based on your group size, budget, and must-have amenities. Just reach out -- we do this every day.",
    ],
    bottomContent: [
      {
        question: "What's the largest group you can accommodate?",
        answer:
          "Several of our properties sleep 12-16+ guests across multiple bedrooms. If your group is larger, we can coordinate bookings at nearby properties so everyone stays in the same neighborhood.",
      },
      {
        question: "Are your large group homes suitable for events?",
        answer:
          "Some properties welcome small celebrations and gatherings. Let us know what you're planning when you inquire and we'll match you with a property that fits. Quiet hours and neighbor courtesy policies apply to all bookings.",
      },
      {
        question: "Can we get an early check-in for a large group?",
        answer:
          "We do our best to accommodate early check-in requests, especially for large groups coordinating travel from different locations. Let us know your arrival plans and we'll confirm timing at least 48 hours before your stay.",
      },
      {
        question: "Is there a discount for longer group stays?",
        answer:
          "Yes, most of our properties offer weekly and monthly discounts that are automatically applied at checkout. For stays of a week or longer, reach out directly and we can often offer additional group pricing.",
      },
    ],
    relatedSlugs: ["family-friendly", "backyard", "northeast-portland"],
  },

  {
    slug: "family-friendly",
    title: "Family-Friendly Vacation Rentals in Portland",
    tagline: "Portland stays the whole family will love",
    metaDescription:
      "Browse 145+ family-friendly vacation rentals in Portland, Oregon. Kid-safe homes with cribs, high chairs, yards, and walkable neighborhoods. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Family Friendly"] },
    introContent: [
      "Portland is a fantastic city for families, and our family-friendly rentals make it even easier to enjoy. These homes are selected with parents in mind -- expect baby gates, cribs, high chairs, and kid-proof layouts that let you relax instead of worry. Many have fenced backyards, game closets, and streaming services to keep everyone entertained after a full day of exploring.",
      "The best part of staying in a vacation rental with kids is having space to breathe. No tiptoeing around hotel hallways at bedtime, no overpriced room service -- just a full kitchen, a comfortable living room, and the freedom to set your own schedule. Our family homes are in neighborhoods with easy access to playgrounds, ice cream shops, the Oregon Zoo, OMSI, and the waterfront.",
      "We know family travel can be stressful, so we try to take the logistics off your plate. Our team provides neighborhood guides with kid-approved restaurants, rainy-day activities, and playground recommendations. Many of our family homes also welcome pets, so the dog can come too.",
    ],
    bottomContent: [
      {
        question: "Do your family-friendly homes include baby gear?",
        answer:
          "Many of our family-friendly properties come stocked with cribs, pack-n-plays, high chairs, and baby gates. Check the amenities list on each property page, or reach out and we'll confirm what's available.",
      },
      {
        question: "What family activities are near your rentals?",
        answer:
          "Portland has no shortage of family fun. Top picks include OMSI (Oregon Museum of Science and Industry), the Oregon Zoo, Powell's Books, the Portland Children's Museum, Oaks Amusement Park, and dozens of parks and playgrounds throughout the city.",
      },
      {
        question: "Are your properties in safe, walkable neighborhoods?",
        answer:
          "Absolutely. We focus on Portland's most established, walkable neighborhoods -- places like Alberta, Hawthorne, Division, Mississippi, and the Pearl District. Each listing page includes neighborhood details so you know exactly what's nearby.",
      },
      {
        question: "Can I book a property with both kid and pet amenities?",
        answer:
          "Yes! Many of our family-friendly homes are also pet-friendly. Use our filters to find properties that welcome both kids and pets, or reach out and we'll help narrow down the options.",
      },
    ],
    relatedSlugs: ["pet-friendly", "backyard", "budget-friendly"],
  },

  {
    slug: "extended-stay",
    title: "Extended Stay Rentals in Portland, Oregon",
    tagline: "Make Portland home for a while",
    metaDescription:
      "310+ extended stay rentals in Portland with monthly discounts. Full kitchens, laundry, and workspaces — real homes, not hotel rooms. No lease, no deposit.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Extended Stay"] },
    introContent: [
      "Whether you're relocating to Portland, working remotely for a few weeks, or in between homes, our extended stay rentals give you everything you need to live comfortably -- not just visit. Every property comes fully furnished with fast WiFi, a full kitchen, in-unit or in-home laundry, and a dedicated workspace. These aren't hotel rooms with a microwave; they're real homes in real neighborhoods.",
      "Staying longer means you get to experience Portland the way locals do. Shop the farmers markets, find your regular coffee spot, take evening walks through your neighborhood, and cook dinner with ingredients from the local grocery store. Our extended stay homes are in residential neighborhoods where you'll feel like a temporary Portlander, not a tourist.",
      "We offer significant weekly and monthly discounts, and our team handles everything from move-in coordination to maintenance requests. Many guests use our extended stay properties during home renovations, job relocations, travel nursing assignments, and sabbaticals. Reach out for custom pricing on stays of 30 days or longer.",
    ],
    bottomContent: [
      {
        question: "What discounts do you offer for extended stays?",
        answer:
          "Most properties offer automatic weekly (7+ nights) and monthly (28+ nights) discounts. For stays longer than a month, contact us directly for custom pricing that can save you significantly compared to nightly rates.",
      },
      {
        question: "Is there a minimum stay for extended stay properties?",
        answer:
          "Minimum stays vary by property. Some require just 2-3 nights, while others are set up specifically for weekly or monthly bookings. Filter by your dates and we'll show you what's available.",
      },
      {
        question: "Do extended stay rentals include utilities and WiFi?",
        answer:
          "Yes. All utilities, high-speed WiFi, and basic household supplies are included in the rental rate. For stays over 30 days, there may be a utility cap -- details are listed on each property page.",
      },
      {
        question: "Can I receive mail or packages at the rental?",
        answer:
          "Yes, extended stay guests can receive mail and packages at most of our properties. We'll provide the correct mailing address and any delivery instructions at check-in.",
      },
    ],
    relatedSlugs: [
      "budget-friendly",
      "northeast-portland",
      "southeast-portland",
    ],
  },

  {
    slug: "budget-friendly",
    title: "Budget-Friendly Vacation Rentals in Portland",
    tagline: "Great stays that don't break the bank",
    metaDescription:
      "Discover 70+ affordable vacation rentals in Portland, Oregon. Clean, stylish, budget-friendly homes from $75/night. No hidden fees. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Budget Friendly"] },
    introContent: [
      "A great Portland vacation doesn't require a huge budget. Our budget-friendly collection features clean, well-maintained homes and apartments at accessible price points -- without sacrificing the design and comfort Book Traverse is known for. These are real homes in walkable neighborhoods, not basement apartments or rooms in someone else's house.",
      "Every budget-friendly rental includes the same essentials: fast WiFi, a fully stocked kitchen, quality linens, and thoughtful touches that make your stay feel special. Many are compact studios and one-bedrooms that are ideal for solo travelers, couples, and small families who'd rather spend their money on Portland's incredible food, drink, and culture scene.",
      "Booking direct with Book Traverse means you avoid the service fees and hidden charges that inflate prices on listing platforms. What you see is what you pay. And because we manage all of our properties ourselves, you get responsive local support if you need anything during your stay.",
    ],
    bottomContent: [
      {
        question:
          "What's the average nightly rate for budget-friendly properties?",
        answer:
          "Our budget-friendly properties typically range from $75-$150 per night depending on the season, location, and size. Weekly and monthly discounts bring the effective nightly rate even lower.",
      },
      {
        question: "Are there any hidden fees?",
        answer:
          "No. When you book direct with Book Traverse, the price you see includes cleaning fees and all charges. There are no surprise service fees, booking fees, or resort fees. Taxes are clearly itemized at checkout.",
      },
      {
        question: "Are budget-friendly properties still in good neighborhoods?",
        answer:
          "Absolutely. Our budget-friendly homes are in the same established, walkable neighborhoods as our other properties -- places like North Portland, Foster-Powell, Montavilla, and St. Johns. We never compromise on location or safety.",
      },
    ],
    relatedSlugs: ["extended-stay", "pet-friendly", "north-portland"],
  },

  {
    slug: "short-term-rentals",
    title: "275+ Short-Term Rentals in Portland, Oregon",
    tagline: "Fully furnished homes for stays of a week or more",
    metaDescription:
      "275+ furnished short-term rentals in Portland — one week to several months, no lease. Full kitchens and laundry in walkable neighborhoods. Less than a hotel.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Extended Stay"] },
    introContent: [
      "Whether you're in Portland for a work assignment, a relocation, a home renovation, or just an extended visit, a short-term rental gives you everything a hotel can't — space, privacy, a full kitchen, and the feeling of living in a real neighborhood. Our short-term rentals are fully furnished homes and apartments available for stays of one week to several months, all in Portland's most walkable and desirable neighborhoods.",
      "Short-term rentals are the fastest-growing segment of the Portland housing market for good reason. They cost significantly less per night than hotels, especially for stays longer than a week. You get a full kitchen (saving hundreds on dining out), in-unit laundry, dedicated workspace, and the kind of personal space that lets you maintain your routine — whether that means morning yoga in the living room, cooking dinner at home, or working from the couch in your pajamas.",
      "Our team handles everything from move-in coordination to maintenance requests. Many of our short-term rental guests are travel nurses, remote workers, corporate relocators, visiting professors, and families in between homes. We offer weekly and monthly discounts that make our nightly rates comparable to — or better than — traditional furnished apartments, with none of the lease commitment.",
    ],
    bottomContent: [
      {
        question: "What's the minimum stay for a short-term rental?",
        answer:
          "Most of our properties are available for stays as short as 2-3 nights, with significant discounts kicking in at 7 nights and 28+ nights. Some properties are specifically set up for weekly and monthly stays with additional amenities like extra storage and workspace.",
      },
      {
        question: "How do short-term rentals compare to hotels in Portland?",
        answer:
          "Short-term rentals typically offer 2-3x the space of a hotel room at a comparable or lower nightly rate — especially for stays longer than a week. You also get a full kitchen, laundry, and a real neighborhood experience. For stays of a month or more, the savings compared to hotels are substantial.",
      },
      {
        question: "Are utilities and WiFi included?",
        answer:
          "Yes. All utilities, high-speed WiFi, and basic household supplies are included in the rental rate for most properties. For stays over 30 days, some properties may have a utility cap — details are listed on each property page.",
      },
      {
        question: "Can I receive mail at a short-term rental?",
        answer:
          "Yes, most of our short-term rental properties can receive mail and packages. We'll provide the correct mailing address and any delivery instructions at check-in. This is especially helpful for guests on work assignments or relocations.",
      },
    ],
    relatedSlugs: ["extended-stay", "budget-friendly", "southeast-portland"],
  },

  {
    slug: "airbnb-alternative",
    title: "Portland Vacation Rentals — Book Direct & Skip the Fees",
    tagline: "Same homes you love on Airbnb, without the service fees",
    metaDescription:
      "Looking for Airbnb Portland alternatives? Book direct with Book Traverse and save 10-15%. Same homes, no service fees, no booking fees. 275+ vacation rentals in Portland, Oregon.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "If you've been searching Airbnb for vacation rentals in Portland, you've probably noticed the fees. Airbnb charges a service fee of 14-20% on top of the nightly rate — which can add hundreds of dollars to a week-long stay. When you book the same Portland homes directly with Book Traverse, those fees disappear. Our prices are the lowest you'll find anywhere, guaranteed.",
      "We manage 275+ vacation rentals across Portland's best neighborhoods — many of the same properties you'll find listed on Airbnb, VRBO, and Booking.com. The difference is that when you book direct, you're dealing with a local Portland team, not a faceless platform. You get faster responses, better local recommendations, and a dedicated point of contact for your entire stay.",
      "Booking direct also means more flexibility. Need to adjust your dates? Add a pet? Extend your stay? Our team can make changes quickly without the back-and-forth of a third-party platform. And because we're not paying platform commissions, we can pass those savings directly to you.",
    ],
    bottomContent: [
      {
        question: "Are these the same properties listed on Airbnb?",
        answer:
          "Yes — many of our 275+ Portland vacation rentals are also listed on Airbnb, VRBO, and Booking.com. When you book direct with Book Traverse, you get the same property at a lower price because we don't charge the 14-20% service fee that platforms add.",
      },
      {
        question: "How much do I save by booking direct vs. Airbnb?",
        answer:
          "On average, guests save 10-15% by booking direct with Book Traverse compared to Airbnb. For a 5-night stay, that's typically $100-200+ in savings. We offer a lowest price guarantee — if you find a lower rate elsewhere, we'll match it.",
      },
      {
        question: "Is booking direct safe and secure?",
        answer:
          "Absolutely. We use Stripe for secure payment processing with full fraud protection. You'll receive instant booking confirmation, detailed check-in instructions, and our local team's direct contact information. We've hosted thousands of guests since launching in Portland.",
      },
      {
        question: "What if I need to cancel or change my reservation?",
        answer:
          "Each property has a cancellation policy clearly listed before you book. Our team can process changes quickly — often faster than going through a third-party platform. Contact us directly and we'll take care of it.",
      },
    ],
    relatedSlugs: [
      "pet-friendly",
      "luxury",
      "family-friendly",
      "southeast-portland",
    ],
  },

  {
    slug: "top-rated",
    title: "Best Vacation Rentals in Portland, Oregon",
    tagline: "Our highest-rated homes, loved by thousands of guests",
    metaDescription:
      "Discover the best vacation rentals in Portland, Oregon. Top-rated homes with 4.8+ star reviews, premium amenities, and prime locations. Book direct with Book Traverse and save.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Luxury Collection"] },
    introContent: [
      "These are our best vacation rentals in Portland — the homes guests rave about, rebook year after year, and recommend to their friends. Every property on this page has earned consistently high ratings from real guests, with thoughtful design, premium amenities, and locations in Portland's most desirable neighborhoods.",
      "What makes a Portland vacation rental 'the best' isn't just thread count and square footage — it's the details that make your stay feel effortless. Fast WiFi that actually works for video calls. A kitchen stocked with real cookware, not just the basics. A location where you can walk to coffee, dinner, and a park without getting in a car. These homes deliver on all of that.",
      "Our top-rated properties span every Portland neighborhood and style — from modern Pearl District lofts to craftsman bungalows in Hawthorne, spacious family homes in Alberta, and sleek townhomes in the Mississippi District. What they all share is a standard of quality that turns first-time visitors into repeat guests.",
    ],
    bottomContent: [
      {
        question: "How do you determine the 'best' vacation rentals?",
        answer:
          "Our top-rated collection features properties with consistently high guest reviews (4.8+ stars), premium amenities, thoughtful design, and prime locations. These are the homes that guests rebook and recommend most often.",
      },
      {
        question: "Are the best Portland vacation rentals more expensive?",
        answer:
          "Not necessarily. While our luxury collection tends to be at the higher end, many of our top-rated homes are priced competitively. Great design and a perfect location don't always come with a premium price tag — especially when you book direct and skip the platform fees.",
      },
      {
        question: "What neighborhoods have the best vacation rentals?",
        answer:
          "Our highest-rated properties are spread across Portland's top neighborhoods: Hawthorne-Belmont, Alberta Arts District, Pearl District, Mississippi, NW 23rd, and Sellwood-Moreland. Each offers a unique Portland experience with walkable dining, shopping, and parks.",
      },
    ],
    relatedSlugs: [
      "luxury",
      "southeast-portland",
      "northeast-portland",
      "pearl-district",
    ],
  },

  {
    slug: "monthly-rentals",
    title: "Monthly Rentals in Portland, Oregon",
    tagline: "Furnished homes for stays of 30 days or more",
    metaDescription:
      "Find furnished monthly rentals in Portland, Oregon. Fully equipped homes with WiFi, kitchens, and laundry for 30+ day stays. Lower monthly rates. Book direct with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Extended Stay"] },
    introContent: [
      "Need a place in Portland for a month or longer? Our monthly rentals are fully furnished homes and apartments designed for extended stays — no lease, no furniture shopping, no utility setup. Just move in with your suitcase and start living. Every home comes with fast WiFi, a full kitchen, in-unit laundry, and everything you need to feel at home from day one.",
      "Monthly rentals in Portland make financial sense. Our 30+ day rates are significantly lower per night than short-term stays, and when you factor in the full kitchen (no restaurant bills), in-unit laundry (no laundromat), and included utilities, the total cost of living is often comparable to or less than a traditional furnished apartment — without the 12-month lease.",
      "Our monthly renters include travel nurses at OHSU and Providence, remote workers exploring Portland, corporate relocators, visiting professors at PSU and Reed College, families in between homes during renovations, and snowbirds escaping winter. Whatever brings you to Portland for a month or more, we'll make it easy.",
    ],
    bottomContent: [
      {
        question: "What's included in a monthly rental?",
        answer:
          "Everything you need for daily life: furniture, kitchenware, linens, towels, WiFi, streaming services, washer/dryer, and basic household supplies. Most utilities are included in the monthly rate. You just bring your personal belongings.",
      },
      {
        question: "How much cheaper are monthly rates vs. nightly rates?",
        answer:
          "Monthly stays (28+ nights) typically receive 20-40% off the standard nightly rate. The exact discount varies by property and season. Contact us for a custom monthly quote — we can often offer additional savings for multi-month commitments.",
      },
      {
        question: "Do I need to sign a lease?",
        answer:
          "No. Our monthly rentals are vacation rental agreements, not traditional leases. There's no credit check, no security deposit (beyond the standard booking deposit), and no long-term commitment. You can extend or shorten your stay with reasonable notice.",
      },
      {
        question: "Can I receive mail and packages at my monthly rental?",
        answer:
          "Yes. We provide the property's mailing address and any special delivery instructions at check-in. Most properties can receive USPS, UPS, and FedEx deliveries without issue.",
      },
    ],
    relatedSlugs: ["extended-stay", "short-term-rentals", "budget-friendly"],
  },

  // ──────────────────────────────────────────────
  // LOCATION-BASED PAGES
  // ──────────────────────────────────────────────
  {
    slug: "northeast-portland",
    title: "Vacation Rentals in Northeast Portland",
    tagline: "Creative energy, tree-lined streets, and Portland's best food",
    metaDescription:
      "Stay in Northeast Portland with 140+ vacation rentals near Alberta, Mississippi, and Hollywood. Walkable, vibrant neighborhoods. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Northeast"] },
    introContent: [
      "Northeast Portland is where the city's creative spirit hits its stride. This part of town stretches from the bustling Alberta Arts District and Mississippi Avenue -- two of Portland's most vibrant commercial streets -- to the quieter, tree-canopied residential blocks of Beaumont-Wilshire, Grant Park, and Hollywood. It's a neighborhood that feels alive without feeling hectic, and it's one of the best places to experience Portland as a local.",
      "The dining scene in NE Portland is exceptional. Alberta Street alone features everything from James Beard-nominated restaurants to casual taco spots, craft cocktail bars, and some of the city's best coffee roasters. Mississippi Avenue adds vintage shopping, independent bookstores, and a thriving brewery scene. And if you need a break from the action, you're minutes from the trails at Rocky Butte or the wide-open spaces of Grant Park.",
      "Our Northeast Portland rentals range from colorful craftsman bungalows on quiet side streets to modern townhomes within walking distance of restaurants and shops. It's the most popular neighborhood among our guests for good reason -- it's central, walkable, and endlessly interesting.",
    ],
    bottomContent: [
      {
        question: "What are the best streets to explore in NE Portland?",
        answer:
          "Alberta Street and Mississippi Avenue are the two main commercial corridors, both packed with restaurants, bars, shops, and galleries. Fremont Street and Broadway also have great neighborhood spots. The Hollywood District offers easy MAX light rail access to downtown.",
      },
      {
        question: "How far is NE Portland from downtown?",
        answer:
          "NE Portland is just 10-20 minutes from downtown by car or public transit. The Hollywood MAX station connects directly to downtown, the airport, and other parts of the city. Many of our NE properties are also very bikeable to the city center.",
      },
      {
        question: "Is NE Portland good for families?",
        answer:
          "Very much so. NE Portland has excellent parks (Grant Park, Alberta Park, Wilshire Park), family-friendly restaurants, and quiet residential streets. It's one of the most popular areas for families visiting Portland.",
      },
      {
        question: "What's parking like in NE Portland?",
        answer:
          "Most of our NE Portland rentals have dedicated off-street parking or easy street parking. Unlike downtown, parking is generally free and plentiful in residential NE neighborhoods.",
      },
    ],
    relatedSlugs: [
      "southeast-portland",
      "north-portland",
      "northwest-portland",
    ],
  },

  {
    slug: "southeast-portland",
    title: "Vacation Rentals in Southeast Portland",
    tagline: "Portland's most eclectic, walkable neighborhoods",
    metaDescription:
      "Explore 170+ vacation rentals in Southeast Portland near Hawthorne, Division, and Belmont. Eclectic neighborhoods, great food. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Southeast"] },
    introContent: [
      "Southeast Portland is the heart of the city's eclectic, independent spirit. This is where you'll find the neighborhoods that put Portland on the map -- Hawthorne, Division, Belmont, Clinton, and Foster-Powell -- each with its own personality but all sharing the same walkable, community-driven vibe. If you want to understand what makes Portland different from every other city, start here.",
      "Division Street has become one of Portland's premier dining destinations, with nationally recognized restaurants alongside neighborhood favorites. Hawthorne Boulevard is a treasure trove of vintage shops, bookstores, and cafes. Belmont has a quieter, residential charm with excellent neighborhood restaurants. And the eastside waterfront along the Esplanade is one of the best urban walks in the Pacific Northwest.",
      "Our SE Portland rentals include everything from mid-century modern homes on quiet streets to stylish apartments above the commercial corridors. Many guests love that they can walk to a dozen excellent restaurants, grab coffee at a world-class roaster, and still feel like they're staying in a real neighborhood -- not a tourist zone.",
    ],
    bottomContent: [
      {
        question: "What neighborhoods make up SE Portland?",
        answer:
          "SE Portland includes Hawthorne, Division, Belmont, Clinton, Sunnyside, Foster-Powell, Montavilla, Richmond, and Sellwood-Moreland, among others. Each has its own character and commercial strip with restaurants, shops, and cafes.",
      },
      {
        question: "What's the food scene like in SE Portland?",
        answer:
          "SE Portland is arguably the city's best food neighborhood. Division Street alone has multiple James Beard-recognized restaurants. Hawthorne and Belmont offer everything from Thai and Ethiopian to farm-to-table and wood-fired pizza. The food cart pods on Foster and Division are not to be missed.",
      },
      {
        question: "How do I get around SE Portland?",
        answer:
          "SE Portland is extremely bikeable and walkable. Multiple bus lines run along the main corridors, and the Orange MAX line connects Sellwood to downtown. Many of our guests explore entirely on foot and by bike -- Portland's bike share (Biketown) has stations throughout SE.",
      },
    ],
    relatedSlugs: ["northeast-portland", "northwest-portland", "luxury"],
  },

  {
    slug: "northwest-portland",
    title: "Vacation Rentals in Northwest Portland",
    tagline: "Upscale urban living at the edge of Forest Park",
    metaDescription:
      "Browse 55+ vacation rentals in Northwest Portland near Nob Hill, the Pearl District, and Forest Park. Upscale dining and nature trails. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Northwest"] },
    introContent: [
      "Northwest Portland combines urban sophistication with immediate access to nature in a way few neighborhoods anywhere can match. The Pearl District's converted warehouses house world-class galleries and restaurants, while NW 23rd Avenue (Nob Hill) is one of Portland's most beloved shopping and dining streets. And just a few blocks uphill, you're at the trailhead of Forest Park -- 5,200 acres of old-growth forest inside the city limits.",
      "This is Portland's most walkable urban neighborhood. You can spend a morning hiking Wildwood Trail, grab lunch at a sidewalk cafe on 23rd, browse Powell's Books (the largest independent bookstore in the world), and still be back at your rental in time for a nap. The architecture here is gorgeous too -- Victorian-era homes, stately apartment buildings, and converted industrial spaces give NW Portland a character that's distinctly its own.",
      "Our Northwest Portland rentals tend toward the polished and refined, fitting the neighborhood's aesthetic. Expect stylish interiors, excellent walkability scores, and proximity to some of the best dining in the city. It's an ideal base for first-time Portland visitors who want to be in the middle of everything.",
    ],
    bottomContent: [
      {
        question:
          "What's the difference between the Pearl District and Nob Hill?",
        answer:
          "The Pearl District is Portland's converted warehouse neighborhood, known for art galleries, upscale dining, and modern condos. Nob Hill (along NW 23rd and 21st Avenues) has a more residential, boutique feel with independent shops, cafes, and Victorian-era architecture. Both are in NW Portland and walkable to each other.",
      },
      {
        question: "Can I hike Forest Park from your NW rentals?",
        answer:
          "Yes! Several of our NW Portland properties are within walking distance of Forest Park trailheads. The Wildwood Trail, Leif Erikson Drive, and Lower Macleay Trail are popular starting points, all accessible from the neighborhood.",
      },
      {
        question: "Is parking difficult in NW Portland?",
        answer:
          "Street parking in NW Portland can be competitive, especially near 23rd Avenue and the Pearl District. Many of our properties include dedicated parking. If not, we'll provide detailed parking guidance for your specific location.",
      },
    ],
    relatedSlugs: ["northeast-portland", "north-portland", "luxury"],
  },

  {
    slug: "north-portland",
    title: "Vacation Rentals in North Portland",
    tagline: "Portland's up-and-coming creative district",
    metaDescription:
      "Find vacation rentals in North Portland near St. Johns, Kenton, and the University of Portland. Affordable, eclectic, and full of character. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["North"] },
    introContent: [
      "North Portland is the city's most dynamic emerging neighborhood -- a place where longtime residents, artists, young families, and small business owners are building something special. St. Johns, anchored by its iconic cathedral-style bridge, feels like a small town inside the city with its own downtown strip of shops, restaurants, and a vintage movie theater. Kenton, with its famous Paul Bunyan statue, has a growing food scene and a tight-knit community feel.",
      "What draws many visitors to North Portland is the sense of discovery. This isn't a neighborhood that's been covered in every travel magazine (yet). The restaurants are ambitious but unpretentious, the shops are one-of-a-kind, and the pace is a little slower than the east side. Cathedral Park, tucked beneath the soaring arches of the St. Johns Bridge, is one of Portland's most beautiful and underrated spots.",
      "Our North Portland rentals are some of our most affordable, making this a great option for budget-conscious travelers who still want a stylish, well-located home base. You're just 15 minutes from downtown and well-connected by bus and bike routes.",
    ],
    bottomContent: [
      {
        question: "What is there to do in North Portland?",
        answer:
          "North Portland highlights include Cathedral Park (beneath the stunning St. Johns Bridge), the St. Johns neighborhood shops and restaurants, Kenton's bars and food scene, the University of Portland campus, and Pier Park. It's also close to Sauvie Island for seasonal farm visits and beaches.",
      },
      {
        question: "How far is North Portland from the city center?",
        answer:
          "North Portland is about 15-20 minutes from downtown Portland by car. The Yellow MAX line serves the Kenton area, and frequent bus service connects St. Johns and other N Portland neighborhoods to the rest of the city.",
      },
      {
        question: "Is North Portland safe for visitors?",
        answer:
          "The neighborhoods where our rentals are located -- St. Johns, Kenton, Arbor Lodge, and the University Park area -- are established residential communities with active neighborhood associations, local businesses, and families. As with any city, we provide neighborhood-specific guidance at check-in.",
      },
    ],
    relatedSlugs: [
      "northeast-portland",
      "northwest-portland",
      "budget-friendly",
    ],
  },

  {
    slug: "mt-hood",
    title: "Vacation Rentals Near Mt. Hood, Oregon",
    tagline: "Mountain getaways an hour from Portland",
    metaDescription:
      "Book 25+ vacation rentals near Mt. Hood, Oregon. Cozy cabins, ski lodges, and mountain homes with fireplaces and hot tubs. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { tags: ["Mt.Hood"] },
    introContent: [
      "Mt. Hood is Portland's backyard mountain -- a year-round destination just 60-90 minutes from the city. In winter, it's all about skiing and snowboarding at Timberline, Mt. Hood Meadows, and Skibowl. In summer, the same slopes become hiking trails, wildflower meadows, and mountain biking terrain. Our Mt. Hood rentals put you right in the middle of it, with cozy cabins and mountain homes that feel like a proper retreat.",
      "There's something about arriving at a mountain cabin after a day on the slopes or trails -- kicking off your boots, starting a fire, and settling in for the evening with nowhere to be. Our Mt. Hood properties are designed for exactly that. Expect wood-burning fireplaces, hot tubs with mountain views, fully equipped kitchens for cooking hearty meals, and decks where you can watch the stars without a single city light in sight.",
      "The Mt. Hood corridor also includes the charming towns of Government Camp, Welches, Rhododendron, and Brightwood, each with their own restaurants, shops, and access points to the mountain. Whether you're planning a ski weekend, a summer hiking trip, or just need a few days of mountain air, our team can help you find the right cabin.",
    ],
    bottomContent: [
      {
        question: "How far is Mt. Hood from Portland?",
        answer:
          "Most of our Mt. Hood properties are 60-90 minutes from downtown Portland via US-26. The drive is scenic and straightforward. In winter, carry chains and check road conditions, especially above Government Camp.",
      },
      {
        question: "Do your Mt. Hood cabins have hot tubs and fireplaces?",
        answer:
          "Many of our Mt. Hood properties feature hot tubs, wood-burning or gas fireplaces, and other mountain amenities. Check each property listing for specific amenities, or let us know what's important to you and we'll match you with the right cabin.",
      },
      {
        question: "What's the best time to visit Mt. Hood?",
        answer:
          "Mt. Hood is a year-round destination. Ski season typically runs November through April (Timberline often has snow into summer). Summer and fall are ideal for hiking, mountain biking, and enjoying the wildflowers. Fall foliage along the Mt. Hood corridor is spectacular.",
      },
      {
        question: "Are Mt. Hood rentals good for groups and families?",
        answer:
          "Absolutely. Many of our mountain homes sleep 8-12+ guests and are popular for family reunions, ski trips with friends, and holiday gatherings. The combination of space, fireplaces, and hot tubs makes them ideal for group getaways.",
      },
    ],
    relatedSlugs: ["hot-tubs", "fireplace", "large-groups"],
  },

  // ──────────────────────────────────────────────
  // AMENITY-BASED PAGES
  // ──────────────────────────────────────────────
  {
    slug: "hot-tubs",
    title: "Vacation Rentals with Hot Tubs in Portland",
    tagline: "Soak in style after a day in the city",
    metaDescription:
      "Browse 20+ Portland vacation rentals with private hot tubs. Unwind after exploring the city in your own backyard spa. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { amenities: ["HOT_TUB"] },
    introContent: [
      "There are few better ways to end a day in Portland than sinking into a hot tub in your own private backyard. Whether it's a misty winter evening or a warm summer night, our hot tub rentals add a layer of relaxation that turns a good trip into an unforgettable one. These properties feature well-maintained, private hot tubs -- no shared hotel pools, no time limits, just you and the steam.",
      "Our hot tub homes range from sleek modern properties in SE Portland to rustic mountain cabins near Mt. Hood. Many pair the hot tub with other premium amenities like outdoor fire pits, string-lit patios, and Bluetooth speakers. They're a favorite for romantic getaways, bachelorette weekends, and winter stays when Portland's famous rain becomes part of the ambiance rather than an inconvenience.",
      "Every hot tub in our portfolio is professionally maintained and cleaned between guests. We provide clear instructions and keep water quality at the highest standards. Just pack your swimsuit -- or don't. It's your private tub.",
    ],
    bottomContent: [
      {
        question: "Are the hot tubs private?",
        answer:
          "Yes. All of our hot tub properties feature private hot tubs, typically located in fenced backyards or on private decks. They are not shared with other guests or neighbors.",
      },
      {
        question: "Are hot tubs available year-round?",
        answer:
          "Absolutely. Our hot tubs are maintained year-round. Many guests actually prefer them during Portland's cooler, rainy months -- there's nothing quite like soaking in a hot tub while rain patters around you.",
      },
      {
        question: "How often are the hot tubs cleaned?",
        answer:
          "Hot tubs are professionally serviced and the water is treated between every guest stay. We maintain strict water quality standards and provide usage instructions at each property.",
      },
    ],
    relatedSlugs: ["luxury", "fireplace", "mt-hood"],
  },

  {
    slug: "fireplace",
    title: "Vacation Rentals with Fireplaces in Portland",
    tagline: "Cozy up to the fire in Portland",
    metaDescription:
      "Find 30+ Portland vacation rentals with fireplaces. Wood-burning and gas fireplaces for cozy evenings. Perfect for rainy Portland nights. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { amenities: ["INDOOR_FIREPLACE"] },
    introContent: [
      "Portland's famously moody weather is a feature, not a bug -- especially when you have a fireplace to come home to. Our fireplace rentals range from craftsman homes with original wood-burning hearths to modern spaces with sleek gas fireplaces. Either way, there's something deeply satisfying about settling in on a drizzly Portland evening with the fire going, a good book, and nowhere you need to be.",
      "Many of our fireplace properties pair the hearth with other cozy touches -- plush blankets, well-stocked bookshelves, record players, and windows that frame the greenery Portland is known for. They're especially popular from October through April, when Portland's gray skies and gentle rain create the perfect excuse to stay in and enjoy the glow.",
      "A fireplace changes the entire mood of a stay. It turns a rental into a retreat. Whether you're visiting for a romantic weekend, a quiet writing retreat, or a family holiday gathering, our fireplace homes set the tone for a memorable trip.",
    ],
    bottomContent: [
      {
        question: "Are the fireplaces wood-burning or gas?",
        answer:
          "It varies by property. Some feature original wood-burning fireplaces (we provide firewood or instructions for purchasing it), while others have convenient gas fireplaces that start with the flip of a switch. Each property listing specifies the type.",
      },
      {
        question: "Can I use the fireplace during summer months?",
        answer:
          "Gas fireplaces can be used year-round. Wood-burning fireplaces may have seasonal restrictions during Oregon's dry summer months due to air quality regulations. We'll let you know the current status at check-in.",
      },
      {
        question: "Are fireplace properties good for romantic getaways?",
        answer:
          "Absolutely. Our fireplace rentals are among our most popular properties for anniversaries, honeymoons, and romantic weekends. Many are also in the Luxury Collection and feature additional touches like hot tubs, premium bedding, and curated interiors.",
      },
    ],
    relatedSlugs: ["luxury", "hot-tubs", "mt-hood"],
  },

  {
    slug: "backyard",
    title: "Vacation Rentals with Backyards in Portland",
    tagline: "Your own outdoor space in the Rose City",
    metaDescription:
      "Discover 85+ Portland vacation rentals with private backyards and gardens. Fenced yards, patios, outdoor dining, and green space. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { amenityStrings: ["Garden or backyard"] },
    introContent: [
      "One of the best things about staying in a Portland vacation rental instead of a hotel is the outdoor space. Our backyard properties give you a private garden, patio, or yard to enjoy -- whether that means morning coffee surrounded by greenery, afternoon barbecues, kids running through the grass, or simply sitting outside and listening to the birds. Portland's lush climate means even the smallest yards tend to be green and beautiful.",
      "Many of our backyard homes feature thoughtfully designed outdoor spaces with dining tables, string lights, fire pits, and mature landscaping. Some have fully fenced yards, making them ideal for families with young children or guests traveling with pets. In a city known for its gardens and urban greenery, having your own little patch of outdoor space makes your stay feel less like a vacation rental and more like home.",
      "Portland summers are legendary -- warm, dry, and long. From June through September, you'll want every minute of outdoor time you can get. But even in the shoulder seasons, a covered patio or sheltered garden extends your outdoor enjoyment well beyond the sunny months.",
    ],
    bottomContent: [
      {
        question: "Are the backyards fenced?",
        answer:
          "Many but not all of our backyard properties have fully fenced yards. If a fenced yard is important for your pets or children, check the property listing or ask us and we'll confirm before you book.",
      },
      {
        question: "Do backyard properties have outdoor furniture?",
        answer:
          "Yes. Most of our backyard properties include outdoor dining furniture, lounge seating, and sometimes extras like hammocks, fire pits, or barbecue grills. Specific outdoor amenities are listed on each property page.",
      },
      {
        question: "Are backyards usable in Portland's rainy season?",
        answer:
          "Many of our properties have covered patios or porches that let you enjoy the outdoors even when it's drizzling. Portland's rain is typically light and intermittent, and plenty of fall and winter days are dry and crisp -- perfect for a backyard fire pit evening.",
      },
      {
        question: "Can I host a barbecue or outdoor gathering?",
        answer:
          "Many of our backyard properties are great for casual outdoor dining and small gatherings. Please be mindful of neighbors and observe quiet hours (typically after 10 PM). If you're planning something larger, let us know and we'll help find the right property.",
      },
    ],
    relatedSlugs: ["pet-friendly", "family-friendly", "large-groups"],
  },

  // ──────────────────────────────────────────────
  // NEIGHBORHOOD PAGES
  // ──────────────────────────────────────────────
  {
    slug: "alberta",
    title: "Vacation Rentals in the Alberta Arts District, Portland",
    tagline: "Murals, brunch, and Portland's creative heartbeat",
    metaDescription:
      "Browse vacation rentals in Portland's Alberta Arts District. Stay steps from murals, independent shops, craft cocktails, and some of the city's best brunch. Book directly with Book Traverse.",
    heroImage: "/images/home/poi-alberta.jpg",
    filters: { tags: ["Alberta"] },
    introContent: [
      "The Alberta Arts District is Portland at its most creative and colorful. Stretching along Alberta Street in Northeast Portland, this neighborhood is a living gallery -- nearly every block features murals, public art installations, and independently owned shops and restaurants that reflect the community's fiercely independent spirit. It's the kind of place where a world-class brunch spot sits next to a vintage record store, and a craft cocktail bar shares a wall with a community bike shop.",
      "Staying on or near Alberta Street means you're walking distance from some of Portland's most beloved restaurants and cafes. Salt & Straw started here. Tin Shed Garden Cafe has been a brunch institution for decades. And the stretch between 15th and 30th Avenues packs in more personality per block than most cities manage in an entire downtown. On the last Thursday of each month (May through September), the street closes to traffic for Last Thursday -- a massive art walk with live music, food vendors, and pop-up galleries.",
      "Our Alberta Arts District rentals are in the residential streets just off the main corridor -- quiet enough to sleep well, close enough to walk everywhere. These are classic Portland homes: craftsman bungalows, colorful Victorians, and updated cottages on tree-lined blocks. You'll feel like a local from the moment you arrive.",
    ],
    bottomContent: [
      {
        question: "What is Last Thursday on Alberta?",
        answer:
          "Last Thursday is a free monthly art walk held on the last Thursday of each month from May through September. Alberta Street closes to traffic and fills with artists, musicians, food vendors, and thousands of locals. It's one of Portland's most beloved community events.",
      },
      {
        question: "What are the best restaurants on Alberta Street?",
        answer:
          "Alberta is packed with excellent dining. Highlights include Tin Shed Garden Cafe (brunch), Salt & Straw (ice cream), Bollywood Theater (Indian street food), Pine State Biscuits, and Proud Mary (Australian-style coffee and brunch). There are also outstanding food carts and casual spots on nearly every block.",
      },
      {
        question: "How far is Alberta from downtown Portland?",
        answer:
          "Alberta is about 15 minutes from downtown by car and well-served by the #72 bus line. Many guests find they don't need to leave the neighborhood much -- Alberta Street itself has everything you need for a full day of eating, shopping, and exploring.",
      },
      {
        question: "Is Alberta a good neighborhood for families?",
        answer:
          "Absolutely. Alberta Park has a great playground, the neighborhood is very walkable, and there are plenty of kid-friendly restaurants and ice cream shops. The residential streets off Alberta are quiet and safe, with a strong community feel.",
      },
    ],
    relatedSlugs: ["mississippi", "northeast-portland", "pet-friendly"],
  },

  {
    slug: "hawthorne-belmont",
    title: "Vacation Rentals in Hawthorne & Belmont, Portland",
    tagline: "Eclectic streets, vintage finds, and walkable dining",
    metaDescription:
      "Find vacation rentals in Portland's Hawthorne and Belmont neighborhoods. Vintage shops, eclectic restaurants, and walkable streets in the heart of SE Portland. Book directly with Book Traverse.",
    heroImage: "/images/home/poi-hawthorne.jpg",
    filters: { tags: ["Hawthorne Belmont"] },
    introContent: [
      "Hawthorne and Belmont are the twin heartbeats of Southeast Portland -- two parallel streets running east from the river, each lined with the kind of independently owned shops, cafes, and restaurants that define Portland's character. Hawthorne Boulevard is the louder, more eclectic of the two, with vintage clothing stores, comic book shops, food cart pods, and Powell's Books on Hawthorne (the second location of the world-famous bookstore). Belmont is quieter and more residential, with excellent neighborhood restaurants and a relaxed, lived-in feel.",
      "This part of SE Portland is one of the most walkable areas in the entire city. You can spend an entire day on foot -- browsing vintage shops on Hawthorne, grabbing lunch at one of the food cart pods, wandering through Ladd's Addition (Portland's only diagonal-street neighborhood with its own rose garden), and finishing with dinner and cocktails on Belmont. Mt. Tabor Park, an extinct volcanic cinder cone with hiking trails and panoramic city views, is just a short walk east.",
      "Our Hawthorne and Belmont rentals reflect the neighborhood's eclectic, creative energy. Expect colorful bungalows, mid-century modern homes, and cozy apartments on tree-lined residential streets. You're in the thick of Portland's most vibrant neighborhood while still enjoying the peace of a real residential block.",
    ],
    bottomContent: [
      {
        question: "What's the difference between Hawthorne and Belmont?",
        answer:
          "Hawthorne Boulevard is busier and more commercial, with larger vintage stores, a Powell's Books location, and more foot traffic. Belmont Street is a block north and has a quieter, more neighborhood feel with excellent restaurants and cafes. Both are within easy walking distance of each other.",
      },
      {
        question: "What vintage and thrift stores are in the area?",
        answer:
          "Hawthorne is a vintage shopping destination. Highlights include House of Vintage (a massive multi-vendor space), Red Light Clothing Exchange, Crossroads Trading, and numerous smaller boutiques. You could easily spend half a day browsing.",
      },
      {
        question: "Is there good public transit from Hawthorne and Belmont?",
        answer:
          "Yes. Both streets are served by frequent TriMet bus lines (#14 on Hawthorne, #15 on Belmont) that connect directly to downtown. The area is also extremely bikeable, and Biketown bike-share stations are plentiful throughout the neighborhood.",
      },
      {
        question: "What outdoor activities are nearby?",
        answer:
          "Mt. Tabor Park (hiking an extinct volcano with city views) is a short walk or bike ride east. The Springwater Corridor trail runs along the river for runners and cyclists. Ladd's Addition, with its rose gardens and diagonal streets, is a wonderful walking neighborhood just to the west.",
      },
    ],
    relatedSlugs: ["southeast-portland", "luxury", "pet-friendly"],
  },

  {
    slug: "pearl-district",
    title: "Pearl District Vacation Rentals, Portland",
    tagline: "Galleries, dining, and urban walkability",
    metaDescription:
      "Vacation rentals in Portland's most walkable neighborhood. Steps from Powell's Books, galleries, and the waterfront. Full homes with kitchens — not hotel rooms.",
    heroImage: "/images/home/poi-pearl.jpg",
    filters: { tags: ["Pearl District"] },
    introContent: [
      "The Pearl District is Portland's most polished urban neighborhood -- a former warehouse and rail yard district that's been transformed into a walkable grid of art galleries, upscale restaurants, boutique shops, and converted loft spaces. It's home to Powell's City of Books (the largest independent bookstore in the world), the Lan Su Chinese Garden, and some of the best dining in the Pacific Northwest. If you want to be in the center of everything with zero need for a car, the Pearl is your neighborhood.",
      "What makes the Pearl special is that it still feels distinctly Portland despite its urban polish. The converted warehouses retain their industrial character -- exposed brick, timber beams, oversized windows -- while the street-level shops and galleries are almost entirely independent. First Thursday art walks bring crowds to the neighborhood's many galleries on the first Thursday of every month. And the Willamette riverfront, with its parks, bridges, and the Saturday Market, is just a few blocks east.",
      "Our Pearl District rentals are stylish, modern, and exceptionally well-located. You're steps from restaurants, galleries, the streetcar, and the waterfront. These are ideal for first-time Portland visitors, couples, and anyone who prioritizes walkability and access to the city's cultural heart.",
    ],
    bottomContent: [
      {
        question: "What is First Thursday in the Pearl District?",
        answer:
          "First Thursday is a monthly art walk on the first Thursday of each month. Pearl District galleries open their doors for new exhibitions, often with complimentary wine and appetizers. It's free, very walkable, and one of Portland's best cultural traditions.",
      },
      {
        question: "Do I need a car to stay in the Pearl District?",
        answer:
          "Not at all. The Pearl is Portland's most walkable neighborhood, with a Walk Score typically above 95. The Portland Streetcar runs through the neighborhood, and downtown, Chinatown, and the waterfront are all within easy walking distance. Many guests go their entire stay without driving.",
      },
      {
        question: "What are the best restaurants in the Pearl District?",
        answer:
          "The Pearl has a dense concentration of excellent restaurants. Notable options include Andina (Peruvian), BakerMade (pastries and brunch), Deschutes Brewery (Pacific Northwest pub fare), and numerous high-end options. The neighborhood's proximity to downtown means even more dining options are a short walk away.",
      },
      {
        question: "Is the Pearl District good for families?",
        answer:
          "The Pearl is well-suited for families who enjoy an urban, walkable setting. Jamison Square (with its wading fountain) is a hit with kids, Powell's Books has an excellent children's section, and the waterfront parks are great for running around. It's more urban than some Portland neighborhoods but very safe and pedestrian-friendly.",
      },
    ],
    relatedSlugs: ["nw-23rd", "northwest-portland", "luxury"],
  },

  {
    slug: "mississippi",
    title: "Vacation Rentals on Mississippi Avenue, Portland",
    tagline: "Local artisans, string lights, and creative community",
    metaDescription:
      "Find vacation rentals near Portland's Mississippi Avenue. Independent shops, craft breweries, live music, and a creative neighborhood vibe. Book directly with Book Traverse.",
    heroImage: "/images/home/poi-mississippi.jpg",
    filters: { tags: ["Mississippi"] },
    introContent: [
      "Mississippi Avenue is one of Portland's most charming and walkable commercial streets -- a compact stretch of independent shops, restaurants, bars, and galleries that feels like a small creative village within the city. String lights crisscross above the sidewalks, vintage signs mark locally owned businesses, and the energy is laid-back but buzzing. It's the kind of neighborhood where you can browse a plant shop, grab a craft beer, eat incredible Thai food, and catch live music all within a few blocks.",
      "The dining and drinking scene on Mississippi punches well above its weight. Lovely's Fifty Fifty serves some of Portland's best pizza, Prost! is a communal beer hall with an enormous patio, and the food carts lining the street cover everything from Cambodian noodles to artisan doughnuts. Mississippi Studios, a beloved intimate music venue, hosts touring acts and local bands nearly every night. And the shopping is distinctly Portland -- vintage clothing, handmade jewelry, independent bookstores, and quirky gift shops.",
      "Our Mississippi Avenue rentals put you in a quintessential Portland neighborhood -- close enough to walk to everything on the strip, tucked into quiet residential streets with classic North Portland character. It's a neighborhood that rewards exploration and rewards staying local.",
    ],
    bottomContent: [
      {
        question: "What makes Mississippi Avenue special?",
        answer:
          "Mississippi is a compact, walkable street with an outsized concentration of independent businesses. The string lights, local art, and community feel make it one of Portland's most photogenic and enjoyable neighborhoods. It has the energy of a creative district without feeling trendy or overproduced.",
      },
      {
        question: "What live music venues are on Mississippi?",
        answer:
          "Mississippi Studios is the anchor -- an intimate, excellent-sounding venue that hosts touring indie acts, local bands, and comedy shows. Bar Bar, the attached patio bar, often has free live music as well. The neighborhood's creative energy extends to pop-up performances and buskers on the street.",
      },
      {
        question: "Is Mississippi Avenue close to Alberta Street?",
        answer:
          "Yes, Mississippi and Alberta are both in Northeast/North Portland and are about a 10-minute drive or bike ride apart. Many guests explore both during their stay. They have different personalities -- Mississippi is more compact and intimate, Alberta is longer and more sprawling -- but both are excellent.",
      },
      {
        question: "What's parking like near Mississippi Avenue?",
        answer:
          "Street parking is generally available on the residential side streets near Mississippi, though the commercial strip itself can be busy on weekends. Most of our nearby rentals have dedicated off-street parking or easy residential street parking.",
      },
    ],
    relatedSlugs: ["alberta", "north-portland", "northeast-portland"],
  },

  {
    slug: "nw-23rd",
    title: "Vacation Rentals on NW 23rd Avenue, Portland",
    tagline: "Boutique shopping, cozy restaurants, and tree-lined sidewalks",
    metaDescription:
      "Stay near Portland's NW 23rd Avenue in Nob Hill. Boutique shopping, cozy restaurants, Forest Park trails, and tree-lined Victorian streets. Book directly with Book Traverse.",
    heroImage: "/images/home/poi-nw23rd.jpg",
    filters: { tags: ["NW 23rd"] },
    introContent: [
      "NW 23rd Avenue -- the heart of Portland's Nob Hill neighborhood -- is one of the city's most beloved shopping and dining streets. Lined with mature trees, Victorian-era homes, and a mix of independent boutiques and neighborhood restaurants, it has the feel of a sophisticated small-town main street with big-city quality. This is where Portlanders go for a Saturday afternoon of browsing, eating, and people-watching, and it's one of the best neighborhoods for visitors who want walkability, beauty, and a refined urban experience.",
      "The dining on NW 23rd ranges from cozy neighborhood bistros to celebrated restaurants that draw from across the city. The shopping is a mix of local boutiques, vintage stores, and carefully curated specialty shops. And the streets themselves -- with their grand Victorian and Craftsman homes, garden-filled yards, and canopy of old-growth trees -- are worth strolling just for the architecture. Walk a few blocks west and you're at the edge of Forest Park, with over 80 miles of trails starting right from the neighborhood.",
      "Our NW 23rd rentals capture the neighborhood's refined, comfortable energy. These are well-appointed homes and apartments in one of Portland's most established residential areas -- close to everything on the avenue but set back on quiet, leafy streets. It's an ideal base for guests who want to walk everywhere and experience Portland's more polished side without losing the city's signature warmth.",
    ],
    bottomContent: [
      {
        question: "What kind of shopping is on NW 23rd?",
        answer:
          "NW 23rd has a mix of independent boutiques, home goods stores, vintage shops, and specialty retailers. You'll find everything from handmade jewelry and local ceramics to curated clothing and gift shops. It's the kind of street where you'll find things you won't see anywhere else.",
      },
      {
        question: "How close is Forest Park to NW 23rd?",
        answer:
          "Forest Park is remarkably close -- several trailheads are within a 10-minute walk from NW 23rd. The Lower Macleay Trail (which leads to the Witch's Castle, a popular Portland landmark) is one of the nearest access points. You can go from brunch on 23rd to hiking in old-growth forest in minutes.",
      },
      {
        question: "Is NW 23rd walkable to downtown and the Pearl District?",
        answer:
          "Yes. The Pearl District is about a 15-minute walk east, and downtown Portland is about 20 minutes on foot. The Portland Streetcar also runs nearby, connecting NW Portland to the Pearl District, downtown, and the South Waterfront.",
      },
      {
        question: "What's the dining scene like on NW 23rd?",
        answer:
          "NW 23rd has excellent dining options ranging from casual brunch spots and neighborhood cafes to upscale restaurants. The avenue and surrounding blocks include everything from Italian and Thai to farm-to-table and seafood. Many restaurants have outdoor seating during Portland's warm months.",
      },
    ],
    relatedSlugs: ["pearl-district", "northwest-portland", "luxury"],
  },

  {
    slug: "sellwood-moreland",
    title: "Vacation Rentals in Sellwood-Moreland, Portland",
    tagline: "Antique shops, leafy streets, and neighborhood charm",
    metaDescription:
      "Browse vacation rentals in Portland's Sellwood-Moreland neighborhood. Antique Row, riverfront parks, neighborhood restaurants, and a small-town feel in the city. Book directly with Book Traverse.",
    heroImage: "/images/home/poi-sellwood.jpg",
    filters: { tags: ["Sellwood Moreland"] },
    introContent: [
      "Sellwood-Moreland is Portland's charming southern neighborhood -- a community that feels like a small town while being just 15 minutes from downtown. The main commercial stretch along SE 13th Avenue is known as Antique Row, with over a dozen vintage and antique shops that draw collectors from across the region. But Sellwood is much more than antiques -- it's a walkable neighborhood with excellent restaurants, a beloved waterfront park, and some of the leafiest, most beautiful residential streets in the city.",
      "The Sellwood riverfront is one of Portland's hidden gems. Sellwood Riverfront Park stretches along the Willamette River with walking paths, picnic areas, and an off-leash dog park. The Springwater Corridor trail, a paved multi-use path, runs along the river and connects south to Milwaukie and north toward downtown. Oaks Amusement Park, a charming old-school amusement park that's been operating since 1905, sits right on the riverfront and is a favorite with families.",
      "Our Sellwood-Moreland rentals are in one of Portland's most established and livable residential areas. Think tree-canopied streets, well-kept bungalows and craftsman homes, and neighbors who wave hello. It's a perfect base for guests who want a quieter, more residential Portland experience while still having easy access to restaurants, shops, and the rest of the city.",
    ],
    bottomContent: [
      {
        question: "What is Antique Row in Sellwood?",
        answer:
          "Antique Row is a stretch of SE 13th Avenue in Sellwood lined with over a dozen antique and vintage shops, from large multi-dealer spaces to small specialty boutiques. It's one of the best antique shopping destinations in the Pacific Northwest and worth a full morning of browsing.",
      },
      {
        question: "What outdoor activities are in Sellwood-Moreland?",
        answer:
          "Sellwood Riverfront Park offers river access, walking paths, and an off-leash dog park. The Springwater Corridor trail is excellent for running and cycling. Oaks Bottom Wildlife Refuge is a 163-acre wetland with bird-watching trails. And Oaks Amusement Park has rides and roller skating for families.",
      },
      {
        question: "How far is Sellwood from downtown Portland?",
        answer:
          "Sellwood is about 15 minutes from downtown by car. The Orange MAX line has a Sellwood station, and the #70 bus runs frequently along SE 13th. Many cyclists ride the Springwater Corridor or waterfront path to commute downtown.",
      },
      {
        question: "What restaurants are in Sellwood-Moreland?",
        answer:
          "Sellwood has a growing restaurant scene with neighborhood favorites and destination-worthy spots. Look for excellent brunch, wood-fired pizza, craft cocktail bars, and casual neighborhood dining along SE 13th and Milwaukie avenues. The neighborhood also has great coffee shops and bakeries.",
      },
    ],
    relatedSlugs: ["southeast-portland", "family-friendly", "pet-friendly"],
  },

  // ──────────────────────────────────────────────
  // BEDROOM-COUNT PAGES
  // ──────────────────────────────────────────────
  {
    slug: "1-bedroom",
    title: "1-Bedroom Vacation Rentals in Portland",
    tagline: "Cozy retreats for couples and solo travelers",
    metaDescription:
      "Browse 1-bedroom vacation rentals in Portland, Oregon. Studios, lofts, and apartments perfect for couples and solo travelers. Book directly with Book Traverse and save.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minBedrooms: 0, maxBedrooms: 1 },
    introContent: [
      "Sometimes the best Portland trip starts with the simplest setup: a comfortable bed, a well-equipped kitchen, and a neighborhood worth exploring on foot. Our studios and one-bedroom rentals are designed for exactly that -- couples, solo travelers, and anyone who prefers quality over square footage.",
      "Every one-bedroom in our collection includes a full kitchen, fast WiFi, quality linens, and the little details that make a rental feel like home. Many feature private outdoor spaces, in-unit laundry, and walkable access to Portland's best restaurants, coffee shops, and bars.",
      "Booking direct means no service fees, the lowest price guaranteed, and a local team that actually knows the neighborhood. Whether you're here for a long weekend or an extended stay, our one-bedrooms offer better value and more space than any hotel room in the city.",
    ],
    bottomContent: [
      {
        question: "How much do 1-bedroom rentals cost in Portland?",
        answer:
          "Our 1-bedroom rentals typically range from $80 to $180 per night depending on the neighborhood, season, and amenities. Book directly with Book Traverse to get the lowest price -- we never charge service fees.",
      },
      {
        question: "Do 1-bedroom rentals have full kitchens?",
        answer:
          "Yes, all of our 1-bedroom rentals include a full kitchen with cookware, dishes, a coffee maker, and basic pantry items. Many also have dishwashers and quality appliances.",
      },
      {
        question: "Are studios included in the 1-bedroom category?",
        answer:
          "Yes, our 1-bedroom collection includes both studios (open-plan layouts) and traditional one-bedroom apartments with a separate bedroom. Each listing clearly shows the layout.",
      },
    ],
    relatedSlugs: [
      "2-bedroom",
      "budget-friendly",
      "extended-stay",
      "furnished-apartments",
    ],
  },
  {
    slug: "2-bedroom",
    title: "2-Bedroom Vacation Rentals in Portland",
    tagline: "Room to spread out in Portland's best neighborhoods",
    metaDescription:
      "Find 2-bedroom vacation rentals in Portland, Oregon. Perfect for small families and friends traveling together. Full kitchens, walkable neighborhoods. Book directly and save.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minBedrooms: 2, maxBedrooms: 2 },
    introContent: [
      "Two bedrooms changes everything. Suddenly you have space for the kids to sleep while you stay up late, a guest room for the friend who's joining you mid-trip, or simply room to spread out and live like a local. Our 2-bedroom rentals are Portland's sweet spot for small families and friend trips.",
      "Every property includes a full kitchen, living area, and the kind of thoughtful touches that hotels can't match -- board games, local coffee, neighborhood guides, and outdoor spaces. Most are in walkable neighborhoods near restaurants, parks, and transit.",
      "At roughly the price of a single hotel room, you get twice the space, actual privacy, and a kitchen that saves you $50 a day on dining out. Book direct with Book Traverse and skip the service fees entirely.",
    ],
    bottomContent: [
      {
        question: "How many guests can a 2-bedroom rental sleep?",
        answer:
          "Most of our 2-bedroom rentals comfortably sleep 4-6 guests. Many include a sofa bed or futon in the living area for additional guests. Check each listing for the exact maximum occupancy.",
      },
      {
        question: "Are 2-bedroom rentals good for families with kids?",
        answer:
          "Absolutely. Many of our 2-bedroom rentals are specifically set up for families with cribs, high chairs, kid-friendly games, and fenced yards. Filter by 'Family-Friendly' to see properties with extra kid amenities.",
      },
      {
        question: "What neighborhoods have the most 2-bedroom rentals?",
        answer:
          "Southeast and Northeast Portland have the largest selection of 2-bedroom rentals, particularly in the Hawthorne, Alberta, and Mississippi neighborhoods. These areas are walkable, family-friendly, and close to parks.",
      },
    ],
    relatedSlugs: ["1-bedroom", "3-bedroom", "family-friendly", "pet-friendly"],
  },
  {
    slug: "3-bedroom",
    title: "3-Bedroom Vacation Rentals in Portland",
    tagline: "Space for the whole family -- or the whole crew",
    metaDescription:
      "Browse 3-bedroom vacation rentals in Portland, Oregon. Ideal for families and groups of 6-8. Full homes with kitchens, yards, and parking. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minBedrooms: 3, maxBedrooms: 3 },
    introContent: [
      "Three bedrooms means everyone gets their own space. Parents in one room, kids in another, grandparents down the hall -- or three couples splitting a house for a fraction of what three hotel rooms would cost. Our 3-bedroom Portland rentals are full homes with real kitchens, living rooms, and often yards and off-street parking.",
      "This is where vacation rentals genuinely outperform hotels. A 3-bedroom home sleeping 6-8 costs roughly what two hotel rooms run, and you get a kitchen that saves $75+ a day on restaurant meals, a living room for movie nights, and a neighborhood to explore -- not a hotel hallway.",
      "Our 3-bedroom homes span every Portland neighborhood, from craftsman bungalows in Southeast to modern builds in North Portland. Book direct and save up to $95 compared to the same property on Airbnb or VRBO.",
    ],
    bottomContent: [
      {
        question: "How many guests can a 3-bedroom rental accommodate?",
        answer:
          "Our 3-bedroom rentals typically accommodate 6-8 guests comfortably. Many include additional sleeping options like sofa beds. The exact capacity is listed on each property page.",
      },
      {
        question: "Do 3-bedroom rentals have parking?",
        answer:
          "Most of our 3-bedroom homes include free off-street parking for at least one vehicle, and many have space for two or more. Street parking is also available and typically free in Portland's residential neighborhoods.",
      },
      {
        question: "Are 3-bedroom rentals cheaper than hotels for groups?",
        answer:
          "Significantly. A 3-bedroom rental averaging $200-300/night for 6-8 guests works out to $25-50 per person per night. Two or three hotel rooms at $150+ each would cost 2-3x as much, without a kitchen or shared living space.",
      },
    ],
    relatedSlugs: [
      "2-bedroom",
      "4-bedroom-plus",
      "family-friendly",
      "large-groups",
    ],
  },
  {
    slug: "4-bedroom-plus",
    title: "4+ Bedroom Vacation Rentals in Portland",
    tagline: "Big homes for big groups -- reunions, retreats, and celebrations",
    metaDescription:
      "Find 4, 5, 6, and 7-bedroom vacation rentals in Portland, Oregon. Large homes for family reunions, group trips, and retreats. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minBedrooms: 4 },
    introContent: [
      "When you need a place where everyone can be under one roof, our large Portland homes deliver. We manage 4, 5, 6, and even 7-bedroom properties that sleep 10 to 20+ guests -- perfect for family reunions, bachelor and bachelorette parties, corporate retreats, and holiday gatherings.",
      "These aren't just big -- they're designed for group travel. Multiple bathrooms so nobody's waiting in line, full-size kitchens with dining tables that seat the whole crew, outdoor spaces for hanging out, and entertainment like game rooms, hot tubs, and fire pits.",
      "Try booking that at a hotel. Even with group rates, you're looking at a hallway of separate rooms with no shared space. Our large homes give your group a headquarters -- a place to cook together, play games, and actually spend time in the same room. Book direct for the lowest price and a dedicated local team.",
    ],
    bottomContent: [
      {
        question: "What's the largest home you manage?",
        answer:
          "Our largest properties have 7 bedrooms and sleep 16+ guests. We also have several 5 and 6-bedroom homes that are popular for reunions and retreats. If your group is even larger, we can coordinate bookings at nearby properties.",
      },
      {
        question: "Can I host an event at a large rental?",
        answer:
          "Some of our larger properties allow small gatherings and celebrations. Please contact us before booking to discuss your plans -- we'll match you with the right property and make sure everything goes smoothly.",
      },
      {
        question: "Do large homes have enough bathrooms?",
        answer:
          "Yes, our 4+ bedroom homes typically have 2-4 bathrooms. We know that bathroom count matters as much as bedroom count for group travel. Check each listing for the exact bathroom count.",
      },
    ],
    relatedSlugs: ["3-bedroom", "large-groups", "luxury", "hot-tubs"],
  },

  // ──────────────────────────────────────────────
  // NEAR LANDMARK PAGES (geo bounding box ~2 mi)
  // ──────────────────────────────────────────────
  {
    slug: "near-ohsu",
    title: "Vacation Rentals Near OHSU in Portland",
    tagline: "Walk to Oregon Health & Science University",
    metaDescription:
      "Find vacation rentals near OHSU in Portland, Oregon. Short-term housing for patients, families, visiting researchers, and medical staff. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {
      minLat: 45.47,
      maxLat: 45.53,
      minLng: -122.73,
      maxLng: -122.645,
    },
    introContent: [
      "If you're visiting OHSU -- whether for a medical appointment, a family member's treatment, visiting a new graduate, or a research collaboration -- you need a comfortable place nearby that feels like home. Our vacation rentals near Oregon Health & Science University offer full kitchens, quiet bedrooms, and the space to rest and recover without the sterile feel of a hospital-adjacent hotel.",
      "OHSU sits on Marquam Hill in Southwest Portland, connected to the waterfront by the aerial tram. Our nearby rentals put you within easy reach by car, transit, or rideshare. Many are in the South Waterfront, Lair Hill, and Hillsdale neighborhoods -- all quiet, residential areas with grocery stores, restaurants, and parks.",
      "For extended medical stays, our rentals make even more sense. A full kitchen means you can prepare meals that meet dietary needs, laundry keeps you from packing for a month, and having a real living space helps families stay together during difficult times.",
    ],
    bottomContent: [
      {
        question: "How far are your rentals from OHSU?",
        answer:
          "Our closest properties are 5-15 minutes from OHSU's main campus by car. Several are near the South Waterfront aerial tram station, which connects directly to the hilltop campus in about 4 minutes.",
      },
      {
        question: "Do you offer weekly or monthly rates for medical stays?",
        answer:
          "Yes, many of our properties offer discounted weekly and monthly rates that are ideal for extended medical visits. Check out our extended stay and monthly rental options, or contact us for a custom quote.",
      },
      {
        question: "Is parking available near OHSU?",
        answer:
          "Most of our nearby rentals include free off-street parking. OHSU itself has paid parking garages, but having a car nearby is helpful for appointments and errands.",
      },
    ],
    relatedSlugs: [
      "extended-stay",
      "1-bedroom",
      "2-bedroom",
      "corporate-housing",
    ],
  },
  {
    slug: "near-moda-center",
    title: "Vacation Rentals Near Moda Center in Portland",
    tagline: "Stay steps from Portland's biggest events",
    metaDescription:
      "Book vacation rentals near Moda Center in Portland, Oregon. Walk to Trail Blazers games, concerts, and events. Save vs. hotels. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {
      minLat: 45.502,
      maxLat: 45.562,
      minLng: -122.71,
      maxLng: -122.628,
    },
    introContent: [
      "Moda Center is Portland's premier arena -- home to the Trail Blazers, major concerts, NCAA tournament games, and everything from comedy shows to ice skating. If you're coming to town for an event, our nearby vacation rentals beat arena-district hotels on price, space, and experience.",
      "The Rose Quarter area connects to some of Portland's best neighborhoods. Our rentals in nearby Northeast, the Lloyd District, and the Central Eastside put you within walking distance or a quick transit ride of the arena, with restaurants, bars, and local culture right outside your door.",
      "Skip the overpriced event-night hotel markup. Our rentals price consistently, include full kitchens and living spaces, and let you pre-game properly -- with a home-cooked meal, a comfortable couch, and room for the whole group.",
    ],
    bottomContent: [
      {
        question: "How close are your rentals to Moda Center?",
        answer:
          "Our closest properties are a 5-15 minute walk from Moda Center. Many more are a quick MAX light rail ride away -- the Rose Quarter Transit Center is right at the arena.",
      },
      {
        question: "Is there parking near Moda Center?",
        answer:
          "Most of our nearby rentals include free off-street parking. For events, you can drive to Moda Center (paid event parking) or take the MAX from your neighborhood. Many guests prefer to walk or use rideshare on event nights.",
      },
      {
        question: "Can I book for just one night for a concert?",
        answer:
          "Minimum stay requirements vary by property, but many of our rentals near Moda Center allow 1-2 night stays. Book early for major events -- properties near the arena fill up fast.",
      },
    ],
    relatedSlugs: [
      "near-convention-center",
      "downtown-portland",
      "northeast-portland",
      "large-groups",
    ],
  },
  {
    slug: "near-portland-airport",
    title: "Vacation Rentals Near Portland Airport (PDX)",
    tagline: "Land, unpack, and feel at home",
    metaDescription:
      "Find vacation rentals near Portland Airport (PDX). Better than airport hotels -- full kitchens, real neighborhoods, free parking. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minLat: 45.5, maxLat: 45.57, minLng: -122.64, maxLng: -122.555 },
    introContent: [
      "Portland International Airport has been rated the best airport in the US for years, and the neighborhoods around it are surprisingly livable. Our vacation rentals near PDX give you what airport hotels can't: a full kitchen, a quiet residential street, free parking, and an easy ride to the airport when it's time to fly.",
      "Properties in the Cully, Parkrose, and Gateway neighborhoods put you 10-20 minutes from the terminal with easy freeway access. For early morning flights or late arrivals, you'll appreciate having a real bed in a real home instead of a generic hotel room with thin walls and a vending machine dinner.",
      "Whether you're on a layover, arriving late and exploring Portland the next day, or need a comfortable base for a business trip, our airport-area rentals offer genuine value. Book direct and pay less than you would at the airport Marriott.",
    ],
    bottomContent: [
      {
        question: "How far are your rentals from PDX airport?",
        answer:
          "Our nearest properties are 10-20 minutes from PDX by car. Portland's MAX Red Line also connects the airport to several of our neighborhoods, with trains running every 15 minutes.",
      },
      {
        question: "Do your airport-area rentals have parking?",
        answer:
          "Yes, all of our rentals near the airport include free off-street parking. This is a major advantage over airport hotels, which typically charge $15-30/night for parking.",
      },
      {
        question: "Can I store luggage if I arrive early?",
        answer:
          "While early check-in depends on the property's schedule, we're often able to accommodate luggage drop-offs. Contact us before your trip and we'll do our best to help.",
      },
    ],
    relatedSlugs: [
      "near-convention-center",
      "1-bedroom",
      "budget-friendly",
      "extended-stay",
    ],
  },
  {
    slug: "near-providence-park",
    title: "Vacation Rentals Near Providence Park in Portland",
    tagline: "Walk to Timbers, Thorns, and stadium concerts",
    metaDescription:
      "Book vacation rentals near Providence Park in Portland, Oregon. Walking distance to Timbers, Thorns, and concerts. Better than hotels. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {
      minLat: 45.492,
      maxLat: 45.552,
      minLng: -122.733,
      maxLng: -122.651,
    },
    introContent: [
      "Providence Park sits in the heart of Portland's Goose Hollow neighborhood -- home to the Timbers, the Thorns, and some of the biggest concert events in the Pacific Northwest. Our nearby vacation rentals put you within walking distance of the stadium and Portland's best westside neighborhoods.",
      "The area around Providence Park includes Nob Hill, the Pearl District, and downtown -- packed with restaurants, bars, and things to do before and after the match. Our rentals in these neighborhoods give you a home base that's walkable to the stadium and everything else worth seeing.",
      "Game days in Portland are special, and they're even better when you're not fighting hotel checkout times or eating $20 arena nachos for dinner. Cook a pre-match meal in your kitchen, walk to the stadium, and come home to your own couch afterward.",
    ],
    bottomContent: [
      {
        question: "How close are your rentals to Providence Park?",
        answer:
          "Our closest properties are 5-20 minutes on foot from Providence Park. The Goose Hollow MAX station is right at the stadium, connecting to our rentals throughout the city.",
      },
      {
        question: "Are there good restaurants near Providence Park?",
        answer:
          "The area around Providence Park is one of Portland's best dining neighborhoods. NW 23rd Avenue, the Pearl District, and downtown are all within walking distance, with hundreds of restaurant options from casual to fine dining.",
      },
      {
        question: "Is parking available on game days?",
        answer:
          "Our nearby rentals include free parking at the property. For the stadium itself, most fans walk, bike, or take the MAX. Street parking near the stadium is limited on event days.",
      },
    ],
    relatedSlugs: [
      "near-moda-center",
      "northwest-portland",
      "nw-23rd",
      "pearl-district",
    ],
  },
  {
    slug: "near-convention-center",
    title: "Vacation Rentals Near the Oregon Convention Center",
    tagline: "More space, less cost -- right by the convention center",
    metaDescription:
      "Find vacation rentals near the Oregon Convention Center in Portland. Full kitchens, free parking, walkable neighborhoods. Book directly with Book Traverse and save.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {
      minLat: 45.502,
      maxLat: 45.562,
      minLng: -122.705,
      maxLng: -122.623,
    },
    introContent: [
      "The Oregon Convention Center hosts everything from trade shows and conferences to comic cons and home expos. If you're attending an event, our nearby vacation rentals offer more space, better value, and a real Portland neighborhood experience -- not a convention hotel hallway.",
      "Our rentals in the Lloyd District, Central Eastside, and Northeast Portland are walkable or a quick MAX ride from the convention center. You get a full kitchen for meals between sessions, a real living room for evening debriefs, and a comfortable bed that isn't separated from the next room by a thin wall.",
      "For multi-day conferences, the savings add up fast. A vacation rental with a kitchen eliminates $50-75/day in restaurant meals, free parking saves $25/night, and you'll actually want to come back to your place at the end of a long day on the convention floor.",
    ],
    bottomContent: [
      {
        question: "How far are your rentals from the convention center?",
        answer:
          "Our closest properties are 5-15 minutes from the Oregon Convention Center by foot or transit. The Convention Center MAX station connects to our rentals throughout Northeast and Southeast Portland.",
      },
      {
        question: "Do you offer group bookings for conference attendees?",
        answer:
          "Yes, we can coordinate multiple nearby rentals for conference groups, teams, and corporate retreats. Contact us for group pricing and availability.",
      },
      {
        question: "Is there public transit to the convention center?",
        answer:
          "The Oregon Convention Center has its own MAX light rail station served by multiple lines. It's one of the most transit-accessible venues in Portland.",
      },
    ],
    relatedSlugs: [
      "near-moda-center",
      "corporate-housing",
      "northeast-portland",
      "extended-stay",
    ],
  },

  // ──────────────────────────────────────────────
  // HIGH-INTENT PAGES
  // ──────────────────────────────────────────────
  {
    slug: "downtown-portland",
    title: "Vacation Rentals in Downtown Portland",
    tagline: "Stay in the heart of the city",
    metaDescription:
      "Browse vacation rentals in downtown Portland, Oregon. Walk to Pioneer Square, the waterfront, museums, and Portland's best dining. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {
      minLat: 45.505,
      maxLat: 45.535,
      minLng: -122.7,
      maxLng: -122.665,
    },
    introContent: [
      "Downtown Portland puts everything within walking distance -- Pioneer Courthouse Square, the waterfront, the Portland Art Museum, Lan Su Chinese Garden, and hundreds of restaurants, bars, and shops. Our vacation rentals in and around downtown give you a home base in the middle of it all.",
      "Unlike downtown hotels charging $200+ for a basic room, our rentals offer full kitchens, living spaces, and often balconies or patios with city views. You get more space for less money, plus the freedom to come and go on your schedule without hotel checkout pressure.",
      "Our downtown-adjacent properties span the Pearl District, Goose Hollow, the South Waterfront, and the Central Eastside -- all connected by the MAX light rail, streetcar, and Portland's excellent walkability. Book direct and save up to $95 compared to the same property on Airbnb.",
    ],
    bottomContent: [
      {
        question: "Is downtown Portland walkable?",
        answer:
          "Very. Portland's downtown core is compact and flat, with most attractions within a 15-minute walk. The city also has excellent transit (MAX light rail, streetcar, buses) and is one of the most bike-friendly cities in the US.",
      },
      {
        question: "Is downtown Portland safe for tourists?",
        answer:
          "Like any city, use common sense -- stick to well-lit areas at night and be aware of your surroundings. Portland's downtown has active nightlife, restaurants, and cultural venues that keep streets busy and welcoming.",
      },
      {
        question: "Do downtown rentals have parking?",
        answer:
          "Some downtown-area properties include parking, while others are best accessed by transit. Each listing shows parking availability. Street parking and nearby garages are also options.",
      },
    ],
    relatedSlugs: [
      "pearl-district",
      "northwest-portland",
      "near-providence-park",
      "luxury",
    ],
  },
  {
    slug: "corporate-housing",
    title: "Corporate Housing in Portland, Oregon",
    tagline: "Fully furnished homes for work stays and relocations",
    metaDescription:
      "Portland corporate housing — cheaper than extended-stay hotels. 275+ furnished homes with kitchens, WiFi, and workspaces. Monthly rates, no lease required.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "Relocating to Portland? On a 2-month project? Traveling for work and tired of hotel rooms? Our fully furnished vacation rentals double as premium corporate housing -- complete with kitchens, workspaces, high-speed WiFi, and the comfort of a real home in a real neighborhood.",
      "Corporate housing through Book Traverse costs less than extended-stay hotels, includes everything you need from day one (linens, cookware, coffee), and puts you in walkable neighborhoods where you can live like a local. No sterile lobbies, no overpriced room service, no tiny desk crammed next to the bed.",
      "We work with companies, relocation agencies, insurance firms, and individuals. Whether you need a 1-bedroom for a solo consultant or a 3-bedroom for a relocating family, we have the inventory and the flexibility. Monthly and extended stay discounts are available on most properties.",
    ],
    bottomContent: [
      {
        question: "Do you offer monthly rates for corporate housing?",
        answer:
          "Yes, most of our properties offer discounted monthly rates for stays of 30+ days. Contact us for a custom quote -- we can often accommodate specific budget requirements for corporate clients.",
      },
      {
        question: "Can you invoice our company directly?",
        answer:
          "We can work with corporate billing requirements. Contact our team to discuss invoicing, direct billing, and any documentation your company needs for expense reporting.",
      },
      {
        question: "What's included in a corporate rental?",
        answer:
          "Everything. Our rentals come fully furnished with quality linens, a stocked kitchen, high-speed WiFi, TV, washer/dryer (most units), and weekly housekeeping options. Just bring your suitcase.",
      },
      {
        question: "Do you work with relocation companies?",
        answer:
          "Yes, we regularly partner with relocation agencies and insurance companies for temporary housing needs. We provide the documentation, flexibility, and property quality that corporate relocations require.",
      },
    ],
    relatedSlugs: [
      "extended-stay",
      "monthly-rentals",
      "furnished-apartments",
      "1-bedroom",
    ],
  },
  {
    slug: "furnished-apartments",
    title: "275+ Furnished Apartments in Portland",
    tagline: "Move-in ready -- just bring your suitcase",
    metaDescription:
      "275+ furnished apartments in Portland's best neighborhoods. Full kitchens, laundry, and linens — move in with a suitcase. Weekly and monthly rates, no lease.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "A furnished apartment in Portland means you show up with a suitcase and everything else is handled -- bed made, kitchen stocked, WiFi connected, towels folded. Our furnished apartments range from efficient studios to spacious multi-bedroom units across Portland's best neighborhoods.",
      "Whether you're between leases, testing a neighborhood before committing to a long-term rental, here for a work project, or simply prefer an apartment-style stay over a hotel, our furnished units are ready from day one. No furniture shopping, no utility setup, no 12-month lease.",
      "Every furnished apartment includes high-speed WiFi, a full kitchen with cookware and dishes, quality bedding and linens, and in-unit or in-building laundry. Many include dedicated workspaces, parking, and private outdoor areas. Book direct for the lowest rates -- no service fees, no hidden charges.",
    ],
    bottomContent: [
      {
        question:
          "What's the difference between a furnished apartment and a vacation rental?",
        answer:
          "Functionally, they're the same -- fully furnished, fully equipped, ready to live in. 'Furnished apartment' typically implies a longer stay focus with monthly rates, while 'vacation rental' implies shorter leisure stays. Our properties accommodate both.",
      },
      {
        question: "Do you offer month-to-month leases?",
        answer:
          "We offer flexible stays from a few nights to several months. There's no traditional lease -- you book the dates you need, and monthly rates are available for stays of 30+ days.",
      },
      {
        question: "Are utilities included?",
        answer:
          "Yes, all utilities (electricity, water, gas, internet, trash) are included in your nightly or monthly rate. No surprise bills.",
      },
    ],
    relatedSlugs: [
      "corporate-housing",
      "extended-stay",
      "monthly-rentals",
      "1-bedroom",
    ],
  },

  // ──────────────────────────────────────────────
  // NEAR LANDMARKS (additional)
  // ──────────────────────────────────────────────
  {
    slug: "near-lloyd-center",
    title: "Vacation Rentals Near Lloyd District in Portland",
    tagline: "Shop, dine, and explore Portland's eastside hub",
    metaDescription:
      "Find vacation rentals near Lloyd Center and the Lloyd District in Portland. Walk to shopping, dining, and the MAX line. Book directly with Book Traverse and save.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {
      minLat: 45.518,
      maxLat: 45.548,
      minLng: -122.685,
      maxLng: -122.635,
    },
    introContent: [
      "The Lloyd District is one of Portland's most connected neighborhoods -- anchored by Lloyd Center, surrounded by restaurants and breweries, and served by multiple MAX light rail lines. Our vacation rentals in and around Lloyd put you in the middle of the eastside with easy access to everything.",
      "From here you're a short walk to the Oregon Convention Center, a quick MAX ride to downtown or the airport, and right next to the bustling Northeast Portland dining scene along Broadway and NE 28th. It's the kind of neighborhood where you can ditch the car and still do everything you came to Portland for.",
      "Our Lloyd District rentals offer what the nearby hotels can't: full kitchens, real living spaces, free parking, and residential quiet. Book direct with Book Traverse for the lowest price -- no Airbnb service fees, no hotel resort fees.",
    ],
    bottomContent: [
      {
        question: "How far is Lloyd District from downtown Portland?",
        answer:
          "Lloyd District is directly across the Willamette River from downtown -- about 10 minutes by MAX, 5 minutes by car, or a 20-minute walk across the Steel or Burnside Bridge. Multiple MAX lines stop at the Lloyd Center/NE 11th Ave station.",
      },
      {
        question: "What's within walking distance of Lloyd District?",
        answer:
          "Lloyd Center mall, the Oregon Convention Center, Moda Center (Trail Blazers, concerts), dozens of restaurants along NE Broadway and MLK, and the vibrant NE Portland neighborhoods of Irvington and Sullivan's Gulch.",
      },
      {
        question: "Is Lloyd District a good base for exploring Portland?",
        answer:
          "It's one of the best. Three MAX lines converge here, giving you direct access to downtown, the Pearl District, the airport, and eastside neighborhoods without needing a car. It's central without the premium pricing of downtown hotels.",
      },
    ],
    relatedSlugs: [
      "near-convention-center",
      "near-moda-center",
      "northeast-portland",
      "corporate-housing",
    ],
  },

  // ──────────────────────────────────────────────
  // STAY TYPES (additional)
  // ──────────────────────────────────────────────
  {
    slug: "travel-nurse-housing",
    title: "Travel Nurse Housing in Portland, Oregon",
    tagline:
      "Furnished homes near Portland hospitals -- ready for your assignment",
    metaDescription:
      "Furnished rentals near OHSU, Providence, and Legacy — built for 13-week contracts. Full kitchens, laundry, real bedrooms. Monthly rates, no middleman fees.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "Portland's hospitals run on travel nurses, and our furnished rentals are built for the way you actually live during a 13-week contract. Full kitchen for meal prepping between shifts, in-unit laundry so you're not hauling scrubs to a laundromat, high-speed WiFi for charting and video calls, and a real bedroom with a door that closes -- not a hotel room where the bed is three feet from the desk.",
      "We have properties near every major Portland hospital system: OHSU (Marquam Hill and the South Waterfront campus), Providence Portland, Legacy Emanuel, Legacy Good Samaritan, and Adventist Health Portland. Many of our rentals are a 10-20 minute commute by car, bike, or transit.",
      "Monthly rates are available on most properties, and you won't deal with the hassle of subleasing, furniture rental, or utility setup. Show up with your suitcase, everything else is handled. Book direct and skip the Furnished Finder markup -- same quality housing, lower price, no middleman.",
    ],
    bottomContent: [
      {
        question: "Do you offer 13-week rates for travel nurses?",
        answer:
          "Yes. Most of our properties offer discounted monthly rates for stays of 30+ days. A 13-week booking typically comes with our best pricing. Contact us for a custom quote for your assignment dates.",
      },
      {
        question: "Which hospitals are near your rentals?",
        answer:
          "We have properties near OHSU (Marquam Hill and South Waterfront), Providence Portland Medical Center, Legacy Emanuel, Legacy Good Samaritan, and Adventist Health Portland. Tell us which facility you're assigned to and we'll show you the closest options.",
      },
      {
        question: "What's included in a travel nurse rental?",
        answer:
          "Everything you need from day one: fully furnished bedroom and living room, equipped kitchen with cookware and dishes, linens and towels, high-speed WiFi, TV, and washer/dryer in most units. Utilities are included -- no surprise bills mid-contract.",
      },
      {
        question: "Can I bring a pet on my travel assignment?",
        answer:
          "Many of our properties are pet-friendly. Filter for pet-friendly listings or contact us with your pet details and we'll help you find a home that works for both of you.",
      },
    ],
    relatedSlugs: [
      "near-ohsu",
      "furnished-apartments",
      "monthly-rentals",
      "corporate-housing",
    ],
  },
  {
    slug: "relocation-housing",
    title: "Portland Relocation Housing — Furnished Temporary Rentals",
    tagline: "A home base while you find your forever home",
    metaDescription:
      "Find temporary relocation housing in Portland, Oregon. Fully furnished homes and apartments with flexible terms. No lease required. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "Moving to Portland is exciting. Signing a 12-month lease before you've spent a single day in a neighborhood is not. Our furnished relocation rentals give you a real home -- not a hotel room -- while you explore Portland's neighborhoods, close on a house, or start a new job without the pressure of making permanent housing decisions from out of state.",
      "Every rental comes move-in ready: furniture, kitchen, linens, WiFi, and usually a washer/dryer. You're living in an actual Portland neighborhood from day one, which means you'll learn the streets, find your coffee shop, and figure out your commute before signing anything long-term. That's worth more than any apartment tour.",
      "We work with individuals, families, corporate relocation departments, and insurance companies. Whether you need a 1-bedroom for a month or a 4-bedroom for three months while your house is renovated, we have the inventory and the flexibility. No lease, no furniture rental, no utility setup headaches.",
    ],
    bottomContent: [
      {
        question: "How long can I stay in relocation housing?",
        answer:
          "As long as you need. We offer flexible stays from a few weeks to several months. Most relocation guests stay 1-3 months. Monthly rates are available for stays of 30+ days.",
      },
      {
        question:
          "Do you work with relocation companies and insurance adjusters?",
        answer:
          "Yes. We regularly partner with corporate relocation firms, HR departments, and insurance companies for temporary housing placements. We can provide the documentation, direct billing, and property quality that these partners require.",
      },
      {
        question: "Can I tour a property before booking?",
        answer:
          "We can sometimes arrange a tour depending on the property's availability. For out-of-state relocations, our detailed photos, virtual tours, and responsive team help you choose confidently before you arrive.",
      },
      {
        question:
          "What Portland neighborhoods are best for relocating families?",
        answer:
          "It depends on your priorities -- schools, commute, lifestyle. Northeast Portland (Alberta, Irvington) and Southeast (Hawthorne, Division) are popular with families. We have properties across all of Portland's best neighborhoods and can help you match your needs to the right area.",
      },
    ],
    relatedSlugs: [
      "corporate-housing",
      "furnished-apartments",
      "family-friendly",
      "monthly-rentals",
    ],
  },
  {
    slug: "walkable",
    title: "Walkable Portland Vacation Rentals",
    tagline: "Leave the car -- Portland's best neighborhoods on foot",
    metaDescription:
      "Browse vacation rentals in Portland's most walkable neighborhoods. Near restaurants, shops, transit, and attractions. No car needed. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minLat: 45.5, maxLat: 45.555, minLng: -122.72, maxLng: -122.63 },
    introContent: [
      "Portland is one of the most walkable cities in the US, and our rentals in the inner neighborhoods put you within steps of restaurants, coffee shops, bars, parks, and transit -- no rental car required. These are the neighborhoods where locals live car-free by choice, not necessity.",
      "Our walkable rentals span the Pearl District, Northwest 23rd, Hawthorne, Division, Alberta, Mississippi, the Central Eastside, and downtown-adjacent neighborhoods. Each has its own personality, but they all share the same thing: you can step out your front door and be somewhere interesting within five minutes.",
      "Portland's MAX light rail, streetcar, and bus system connect these walkable neighborhoods to each other and to attractions further out. Combine that with the city's flat terrain, protected bike lanes, and compact blocks, and you've got a city that was practically designed for visitors who prefer to explore on foot.",
    ],
    bottomContent: [
      {
        question: "Which Portland neighborhoods are the most walkable?",
        answer:
          "The Pearl District, NW 23rd/Nob Hill, downtown, Hawthorne/Division, Alberta, and Mississippi consistently rank highest for walkability. All have dense restaurant and retail scenes within residential blocks, plus excellent transit access.",
      },
      {
        question: "Do I need a car in Portland?",
        answer:
          "Not if you stay in the inner neighborhoods. Portland's MAX light rail goes to the airport, and the streetcar, buses, and bikeshare (BIKETOWN) cover the core city. For day trips to the Gorge, coast, or wine country, a rental car or tour is helpful -- but for exploring Portland itself, walking and transit are all you need.",
      },
      {
        question: "Do walkable rentals still have parking?",
        answer:
          "Many do. Even in Portland's most walkable neighborhoods, most of our properties include free off-street parking or easy street parking. Check individual listings for parking details if you're driving in.",
      },
    ],
    relatedSlugs: [
      "downtown-portland",
      "pearl-district",
      "nw-23rd",
      "hawthorne-belmont",
    ],
  },
  {
    slug: "free-parking",
    title: "Portland Vacation Rentals with Free Parking",
    tagline: "Park free, save more -- no garage fees, no meters",
    metaDescription:
      "Find Portland vacation rentals with free parking included. No daily parking fees, no meters, no garages. Driveways and off-street parking. Book directly with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { amenityStrings: ["Free parking"] },
    introContent: [
      "Portland hotels charge $25-45 per night for parking. Our vacation rentals include it for free. Every property on this page comes with dedicated parking -- a driveway, garage, or off-street spot that's yours for the duration of your stay. No meters, no garages, no daily fees adding $200+ to a week-long trip.",
      "Free parking is especially valuable if you're using Portland as a base for day trips. The Columbia River Gorge, Oregon Coast, Mt. Hood, and Willamette Valley wine country are all 1-2 hours away by car. Having a car parked at your rental means you can leave early, come back late, and not worry about finding a spot or paying surge pricing at a hotel garage.",
      "Most of our free-parking properties are in Portland's residential neighborhoods -- Northeast, Southeast, North Portland, and beyond -- where street parking is also plentiful and free. You're trading a downtown hotel lobby for a real neighborhood, and keeping $25-45 per night in your pocket.",
    ],
    bottomContent: [
      {
        question: "Is parking really free at these rentals?",
        answer:
          "Yes. Every property on this page includes free on-site parking as a listed amenity -- typically a private driveway, garage, or dedicated off-street spot. There are no daily fees, no meters, and no surprises on your bill.",
      },
      {
        question: "How many vehicles can I park?",
        answer:
          "Most properties accommodate at least one vehicle, and many larger homes can park two or more. Check the individual listing for specific parking details. Street parking in Portland's residential neighborhoods is also generally free and available.",
      },
      {
        question: "Do I need a car in Portland?",
        answer:
          "It depends on your plans. Portland's core is very walkable and has great transit, but a car is helpful for day trips to the Gorge, Coast, Mt. Hood, and wine country. If you're bringing a car, these free-parking rentals save you significant money compared to downtown hotels.",
      },
    ],
    relatedSlugs: [
      "near-portland-airport",
      "family-friendly",
      "large-groups",
      "budget-friendly",
    ],
  },

  // ──────────────────────────────────────────────
  // HOTEL-INTENT PAGES (Google Ads — hotel keyword capture)
  // ──────────────────────────────────────────────
  {
    slug: "portland-accommodations",
    title: "Places to Stay in Portland, Oregon",
    tagline:
      "275+ homes with more space than a hotel — kitchens, parking, no fees",
    metaDescription:
      "Browse 275+ places to stay in Portland, Oregon. Full kitchens, free parking, and no booking fees. More space than a hotel at a better price. Book direct with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "Portland visitors have been choosing vacation rentals over hotels in record numbers — and it's easy to see why. A typical Portland hotel room costs $180-350 per night for 300 square feet, no kitchen, and a $30 parking fee. A Book Traverse home averages 1,200 square feet with a full kitchen, free parking, and starts at $99 per night. For families and groups, the math isn't even close: one 3-bedroom home costs less than two hotel rooms and sleeps everyone under one roof.",
      "Our 275+ properties span every walkable Portland neighborhood — NW 23rd, the Pearl District, Hawthorne, Alberta, Mississippi, Division, and more. Every home is professionally managed with hotel-quality linens, stocked kitchens, and 24/7 local support. We've hosted over 80,000 guests with an 87% 5-star review rate across 8,300+ reviews.",
      "When you book direct on BookTraverse.com, you always get the lowest price — up to $95 less per booking compared to listing the same property on Airbnb or VRBO. No booking fees, no service fees, no resort fees. Just a straightforward nightly rate with cleaning included.",
    ],
    bottomContent: [
      {
        question: "Is a vacation rental better than a Portland hotel?",
        answer:
          "For most travelers, yes. You get 3-4x more space, a full kitchen (saving $50-100/day on dining), free parking (hotels charge $25-45/night), and real neighborhood access. The average Book Traverse guest rates their experience 4.8 out of 5 — higher than most Portland hotels.",
      },
      {
        question: "How much cheaper is Book Traverse vs. a hotel?",
        answer:
          "Our homes start at $99/night — comparable to budget hotels but with far more space and amenities. For groups, the savings compound: a 3-bedroom home at $250/night replaces three $180 hotel rooms ($540/night). Add free parking and kitchen savings, and you could save $200+ per day.",
      },
      {
        question: "Do you offer hotel-like amenities?",
        answer:
          "Yes. Every property includes hotel-quality linens and towels, a fully stocked kitchen, WiFi, TV, washer/dryer, and professionally cleaned interiors. Many also offer hot tubs, fireplaces, patios, and dedicated workspaces. You also get 24/7 local guest support — just like a hotel front desk.",
      },
      {
        question: "How does check-in work without a front desk?",
        answer:
          "We use secure keypad or smart lock entry, so you get a unique code before arrival and can check in anytime — no waiting in line, no holding a credit card for incidentals. Check-in instructions are sent the day before your stay with step-by-step directions.",
      },
      {
        question: "Can I cancel or change my reservation?",
        answer:
          "Yes. Cancellation policies vary by property and are clearly displayed before you book. Most properties offer free cancellation up to a set number of days before check-in. You can manage your booking directly from your Book Traverse account.",
      },
      {
        question: "What neighborhoods are closest to downtown Portland?",
        answer:
          "The Pearl District, NW 23rd/Nob Hill, and Goose Hollow are all within walking distance of downtown. The Central Eastside, Hawthorne, and Lloyd District are 10-15 minutes by transit. We have properties in all of these neighborhoods.",
      },
      {
        question:
          "How do I know the property will be clean and well-maintained?",
        answer:
          "Every property is professionally cleaned between guests using hotel-standard protocols. We inspect properties regularly — 87% of our 8,300+ guest reviews are five stars. If anything isn't right, our local team resolves it within hours.",
      },
    ],
    relatedSlugs: [
      "downtown-portland",
      "luxury",
      "pet-friendly",
      "family-friendly",
      "walkable",
      "best-portland-stays",
      "downtown-portland-stays",
    ],
  },

  {
    slug: "downtown-portland-stays",
    title: "Downtown Portland Accommodations",
    tagline:
      "Walk to everything — NW 23rd, Pearl District, Hawthorne, and more",
    metaDescription:
      "Find accommodations near downtown Portland, Oregon. Walkable neighborhoods with full kitchens, free parking, and no fees. Better than a downtown hotel. Book direct with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: { minLat: 45.5, maxLat: 45.555, minLng: -122.72, maxLng: -122.63 },
    introContent: [
      "Downtown Portland hotels charge $200-400 per night for a room you can barely turn around in, plus $30-45 for parking and $15 for WiFi. Our homes in Portland's most walkable neighborhoods give you a full kitchen, living room, free parking, and a real sense of the city — all for less than most downtown hotels charge for a standard room.",
      "We don't have properties in downtown Portland's hotel district — and that's the point. Portland's best restaurants, bars, and shops aren't downtown. They're on NW 23rd Avenue, in the Pearl District, along Hawthorne and Division Streets, on Alberta and Mississippi. Our homes put you in the neighborhoods locals actually spend time in, all within 10-20 minutes of downtown by foot, bike, or transit.",
      "Every property listed here is in a walkable neighborhood with a Walk Score above 80. Step out your front door and you're already somewhere worth being — no Uber needed, no searching for parking, no $18 cocktails in a hotel lobby.",
    ],
    bottomContent: [
      {
        question: "How far are these properties from downtown Portland?",
        answer:
          "All properties on this page are within 10-20 minutes of downtown Portland by car, transit, or bike. Many in the Pearl District, NW 23rd, and inner SE are within walking distance. Portland's MAX light rail and streetcar connect most neighborhoods directly to the city center.",
      },
      {
        question: "Why stay in a neighborhood instead of a downtown hotel?",
        answer:
          "Portland's neighborhoods are where the city comes alive — the food carts, independent coffee shops, vintage boutiques, and craft breweries that make Portland famous. Downtown has corporate chains and office buildings. Our guests consistently say the neighborhood experience is the best part of their trip.",
      },
      {
        question: "Is parking free at these properties?",
        answer:
          "Most of our properties include free on-site parking — a driveway, garage, or dedicated spot. Downtown Portland hotels charge $25-45 per night for parking. Even properties without dedicated parking are in neighborhoods where street parking is free and available.",
      },
      {
        question: "Do I need a car to get around from these neighborhoods?",
        answer:
          "Not necessarily. All properties listed here are highly walkable with excellent transit access. Portland's MAX, streetcar, and bus system connect neighborhoods to downtown and each other. Many guests explore entirely on foot and by bike using Portland's Biketown bike-share.",
      },
      {
        question:
          "What's the best neighborhood for first-time Portland visitors?",
        answer:
          "NW 23rd/Nob Hill and the Pearl District offer the most concentrated restaurant and shopping scenes. Hawthorne and Division have Portland's signature quirky, independent vibe. Alberta is great for art galleries and diverse food. All are excellent bases for exploring the city.",
      },
    ],
    relatedSlugs: [
      "portland-accommodations",
      "downtown-portland",
      "pearl-district",
      "nw-23rd",
      "hawthorne-belmont",
      "walkable",
    ],
  },

  {
    slug: "best-portland-stays",
    title: "Best Places to Stay in Portland, Oregon",
    tagline: "8,300+ guest reviews — 87% 5-star rated",
    metaDescription:
      "Discover the best places to stay in Portland, Oregon. 8,300+ reviews, 87% 5-star rated. Top-rated vacation homes with kitchens, parking, and no fees. Book direct with Book Traverse.",
    heroImage: "/images/portland-skyline-hero.jpg",
    filters: {},
    introContent: [
      "With 8,300+ guest reviews and an 87% 5-star rate, Book Traverse consistently outperforms Portland hotels on guest satisfaction. The difference isn't hard to explain: more space, real kitchens, walkable neighborhoods, and prices that don't require a corporate travel budget. Our guests don't just rate us well — 35% come back for another stay, and returning guests account for 78% of our revenue.",
      "What makes a great place to stay in Portland isn't thread count or lobby art — it's location, space, and value. Our top-rated properties put you on streets like NW 23rd, Alberta, Hawthorne, and Mississippi, where you're steps from the restaurants, coffee shops, and bars that make Portland worth visiting. You get an entire home to spread out in, a kitchen to cook breakfast (or reheat last night's food cart haul), and a neighborhood that actually feels like Portland.",
      "Every property on this page is among our highest-rated homes across all platforms — Airbnb, VRBO, Booking.com, and direct bookings. When you book direct on BookTraverse.com, you get the same property at the lowest available price, with no booking fees and dedicated local support.",
    ],
    bottomContent: [
      {
        question: "How are these properties rated so highly?",
        answer:
          "We maintain strict quality standards across our portfolio — professional cleaning, hotel-quality linens, fully stocked kitchens, and responsive local support. Properties that fall below our standards are removed from the collection. 87% of our 8,300+ verified guest reviews are five stars.",
      },
      {
        question: "Are these the same properties listed on Airbnb and VRBO?",
        answer:
          "Yes — many of our properties are also listed on Airbnb, VRBO, and Booking.com. When you book direct on BookTraverse.com, you get the same property at a lower price because we don't pay OTA commissions. You save up to $95 per booking compared to Airbnb.",
      },
      {
        question: "How does Book Traverse compare to Portland hotels?",
        answer:
          "Our guest satisfaction scores consistently exceed Portland hotel averages. The median Portland hotel scores 4.2 on Google Reviews; our portfolio averages 4.8 across 8,300+ reviews. Guests cite more space, full kitchens, neighborhood locations, and better value as the primary reasons they prefer us.",
      },
      {
        question: "What if something goes wrong during my stay?",
        answer:
          "Our local Portland-based team is available 24/7 by phone, text, and email. Unlike hotel chains with remote call centers, our support team lives in Portland and can dispatch maintenance or resolve issues in person, usually within hours.",
      },
      {
        question: "Do you have luxury or premium options?",
        answer:
          "Yes. Our Luxury Collection features designer interiors, premium amenities like hot tubs and fireplaces, and prime locations in the Pearl District, Nob Hill, and Hawthorne. These properties offer a boutique hotel experience with the space and privacy of a private home.",
      },
    ],
    relatedSlugs: [
      "portland-accommodations",
      "luxury",
      "top-rated",
      "walkable",
      "downtown-portland-stays",
    ],
  },
];

export function getLandingPage(slug: string): LandingPageConfig | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return LANDING_PAGES.map((p) => p.slug);
}
