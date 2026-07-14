// Long-form SEO body + FAQs per slug. Rendered at /plan/<slug> below the
// main itinerary block. Each entry has ~600 words of keyword-targeted copy
// (best time to visit, where to stay, getting around, cost) plus 5 FAQs.
//
// Kept in a separate module from slug-map.ts so routing/metadata edits
// don't trip on long strings, and so this file can be edited independently
// when refreshing copy.
//
// HISTORY (2026-05-26): the file previously held 5 Portland-era slug
// bodies inherited from the Stay Portland codebase. They were never wired
// into Traverse's Colorado slug-map (only crested-butte-* and
// colorado-mountains-* slugs route to /plan/<slug>), so the Portland
// bodies were dead code and the live Colorado plan pages rendered with
// no body or FAQs. The Portland content has been stripped; the structure
// and SLUG_CONTENT export are preserved so getSlugContent(slug) keeps
// returning null cleanly. Add Colorado entries below as copy is drafted.

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
  "Written by the Traverse Hospitality team — locals managing 189+ vacation rentals across Colorado's Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes markets. We've hosted thousands of guests and built these itineraries from the places we recommend to friends, family, and our own booked guests.";

// Colorado long-form bodies + FAQs, one entry per routed slug in slug-map.ts.
// Venue names mirror each slug's live metaDescription (team-vetted at write
// time); altitude/geography facts are stable. Restaurant/business open-closed
// status should be spot-checked periodically — see memory
// `project_traverse_crested_butte_businesses_status`.
export const SLUG_CONTENT: Record<string, PlanSlugContent> = {
  "crested-butte-food-itinerary": {
    body: `## Where to eat over a Crested Butte weekend

Crested Butte packs a surprisingly deep food scene into a few walkable blocks of **Elk Avenue**, the town's historic main street. You don't need a car for any of this — everything below is within a ten-minute stroll of the other, and most of it is a short drive or free shuttle ride from the mountain base where many of [our Crested Butte rentals](/properties) sit.

## Day one — breakfast, a long lunch, and a nightcap

Start slow. **Paradise Cafe** is the classic Elk Avenue breakfast — get there before the powder-day rush or expect a wait. Fuel up, then spend the middle of the day outside; the food tastes better after a walk on the [Lower Loop trail](/crested-butte/things-to-do) or a few laps at the ski hill.

For dinner, **The Secret Stash** is the town institution — a rambling pizza spot in a historic building that locals and visitors both defend fiercely. Cap the night at **Montanya Distillers**, which makes its rum in town and pours cocktails you won't find anywhere else in Colorado.

## Day two — slow morning, elevated dinner

Ease into the second day, then book a proper sit-down dinner. **Public House** is a reliable choice for a nicer meal without a Vail-sized bill. If the weather cooperates, time your afternoon so you're finishing a hike or a bike ride right as the kitchens open.

## Why book direct for a food weekend

A food trip lives and dies on location — you want to walk home, not drive after a cocktail. Booking direct through Traverse means **no booking fees** and homes chosen for their proximity to Elk Avenue and the mountain. [Browse Crested Butte rentals](/properties) or [see everything there is to do in town](/crested-butte).`,
    faqs: [
      {
        question: "How many days do you need for a Crested Butte food weekend?",
        answer:
          "Two days is the sweet spot. It's enough to hit the breakfast institutions, a long lunch, and two dinners without rushing — and it pairs naturally with a hike or a ski day in between so you actually work up an appetite.",
      },
      {
        question: "Is Crested Butte's restaurant scene walkable?",
        answer:
          "Yes. Nearly everything worth eating is on or just off Elk Avenue, the historic main street, within a ten-minute walk. From the mountain base at Mt. Crested Butte it's a short drive or a free shuttle ride into town.",
      },
      {
        question: "Do I need reservations?",
        answer:
          "For weekend dinners at the popular spots, yes — especially in peak ski season (December–March) and during the July wildflower season. Breakfast and lunch are generally first-come, so go early on powder days.",
      },
      {
        question: "What's Crested Butte known for food-wise?",
        answer:
          "An outsized scene for a town of its size: a beloved pizza institution, a local rum distillery pouring cocktails you can't get elsewhere in Colorado, and a cluster of chef-driven spots that punch well above a mountain town's weight.",
      },
      {
        question: "Where should I stay for a food-focused trip?",
        answer:
          "Somewhere walkable to Elk Avenue so you can leave the car parked. Our Crested Butte homes are chosen for proximity to town and the mountain, and booking direct means no booking fees. Browse them at booktraverse.com/properties.",
      },
    ],
  },
  "leadville-14er-itinerary": {
    body: `## A high-altitude weekend from a Leadville basecamp

Leadville sits at **10,150 feet** — the highest incorporated city in North America — which makes it the natural launch point for Colorado's two tallest peaks. Both **Mount Elbert (14,440 ft)**, the highest summit in the Rockies, and **Mount Massive (14,428 ft)** rise just southwest of town. This is a three-day plan built around one big summit, one recovery day, and a scenic drive, all from a cabin with a hot tub waiting at the end of it.

## Day one — acclimate, don't conquer

If you're arriving from lower elevation, resist the urge to summit on day one. Spend it getting your lungs used to the altitude: an easy walk around **Turquoise Lake**, a stroll through Leadville's historic downtown, and an early night. Altitude is the single biggest reason 14er attempts go sideways.

## Day two — Mount Elbert (or Mount Massive)

Start in the dark. Mount Elbert's standard routes are non-technical but long, and afternoon thunderstorms are a real danger above treeline in summer — the rule is to be off the summit by noon. Elbert is the more popular and slightly more forgiving of the two; Massive is longer and quieter. Either way, you'll be back at the cabin by mid-afternoon, which is exactly what the hot tub is for.

## Day three — Twin Lakes and Independence Pass

Wind down with a mellow day. **Twin Lakes**, just south of Leadville, is a stunning spot for paddleboarding or a lakeside lunch. If it's summer, drive up and over **Independence Pass (12,095 ft)** toward Aspen — one of the most scenic paved drives in the state. Note the pass is closed in winter, typically from early November until late May.

## Book direct for a peak-bagging weekend

A 14er weekend runs on early starts and hard recovery — you want a full kitchen for pre-dawn breakfasts and a hot tub for afterward. Booking direct through Traverse means **no booking fees** on [our Leadville cabins](/properties). [Browse Leadville stays](/leadville) or [see more Leadville trip ideas](/leadville/things-to-do).`,
    faqs: [
      {
        question: "Which is the best 14er to climb from Leadville?",
        answer:
          "Mount Elbert (14,440 ft) is the most popular — it's the highest peak in the Rockies, non-technical, and slightly more forgiving than neighboring Mount Massive (14,428 ft). Both trailheads are a short drive from town.",
      },
      {
        question: "How should I handle the altitude?",
        answer:
          "Leadville itself is at 10,150 ft, so give yourself a day to acclimate before summiting. Hydrate hard, sleep low the first night, and don't attempt a 14er the same day you arrive from sea level. Altitude sickness is the most common reason attempts fail.",
      },
      {
        question: "What time should I start a 14er hike?",
        answer:
          "Before sunrise. Colorado's summer afternoons bring fast-moving thunderstorms, and the standard safety rule is to be off the summit and below treeline by noon. Most hikers are on the trail by 5–6 a.m.",
      },
      {
        question: "Is Independence Pass open year-round?",
        answer:
          "No. The pass (12,095 ft) is closed in winter, typically from early November through late May, depending on snow. In summer it's one of the most scenic paved drives in Colorado, connecting Twin Lakes to Aspen.",
      },
      {
        question: "What's there to do besides climbing?",
        answer:
          "Plenty of lower-key options: paddleboarding at Twin Lakes, walking Turquoise Lake, exploring Leadville's historic mining-era downtown, and the scenic railroad. It makes a good recovery day between or after summit attempts.",
      },
    ],
  },
  "crested-butte-history-arts-tour": {
    body: `## The Crested Butte beyond the ski lifts

Crested Butte started as a coal-mining town, and its entire downtown is a **National Historic District** — those colorful Victorian storefronts on Elk Avenue are the real thing, not a reproduction. This is a two-day itinerary for travelers who want to understand how the town actually lives, spread across its museums, its arts center, and its famously independent main street.

## Day one — history on Elk Avenue

Begin at the **Crested Butte Mountain Heritage Museum**, housed in a former hardware store and gas station, which tells the town's arc from coal camp to ski town to mountain-bike birthplace (Crested Butte has a real claim to the sport's origins). From there, Elk Avenue itself is the exhibit — walk it slowly and read the building plaques.

Break up the afternoon at **Townie Books**, the independent bookstore that doubles as the town's living room, with a coffee bar in back. It's the best place to feel the pulse of local life.

## Day two — the arts

Spend the second day at the **Center for the Arts**, Crested Butte's hub for live music, theater, gallery shows, and workshops. Check its calendar before you arrive — a weekend often has something on, and it's the clearest window into the town's creative side. Fill the rest of the day with the galleries and maker shops tucked along and just off Elk Avenue.

## Where the town lives

This kind of trip rewards staying *in* it rather than at a resort remove. Booking direct through Traverse puts you in a real Crested Butte home with **no booking fees**. [Browse Crested Butte rentals](/properties), [see the full things-to-do guide](/crested-butte/things-to-do), or [read our Crested Butte guides](/crested-butte/guides).`,
    faqs: [
      {
        question: "Is downtown Crested Butte actually historic?",
        answer:
          "Yes — the entire downtown is a National Historic District. The Victorian storefronts along Elk Avenue date to the town's 19th-century coal-mining era and are genuine, not a themed reconstruction.",
      },
      {
        question: "What museums are worth visiting in Crested Butte?",
        answer:
          "The Crested Butte Mountain Heritage Museum is the standout — it covers the town's evolution from coal camp to ski town to a birthplace of mountain biking. It's right on Elk Avenue and makes an easy first stop.",
      },
      {
        question: "What is there to do in Crested Butte besides skiing and hiking?",
        answer:
          "A real arts and history scene: the Heritage Museum, the Center for the Arts (live music, theater, galleries), Townie Books, and the historic Elk Avenue district itself. It's an easy weekend of low-key, walkable culture.",
      },
      {
        question: "Do I need a car for a history and arts weekend?",
        answer:
          "Not really. Nearly everything is on or near Elk Avenue and walkable. A free town shuttle connects downtown Crested Butte with the mountain base if your rental is up at Mt. Crested Butte.",
      },
      {
        question: "How much time should I plan?",
        answer:
          "Two days is comfortable — one for the historic district and museum, one for the arts center and galleries — with plenty of room for long meals and coffee stops in between.",
      },
    ],
  },
  "crested-butte-weekend-itinerary": {
    body: `## Crested Butte's greatest hits in two days

If it's your first time in Crested Butte and you've only got a weekend, this is the plan: the mountain, the main street, one good hike, and one memorable dinner. The town sits at about **8,900 feet** with the ski base at Mt. Crested Butte just above it, so build in a little time to adjust to the altitude before you push hard.

## Day one — the mountain and the main street

Spend the morning on the mountain — skiing or riding the [Silver Queen gondola](/crested-butte/things-to-do) in winter, or lift-served hiking and biking in summer. Come down for a long lunch and then walk **Elk Avenue**, the historic Victorian main street, in the afternoon. Cap the night at **The Secret Stash**, the town's beloved pizza institution — reservations help on weekends.

## Day two — a hike and a view

Get outside early. The **Lower Loop Trail** is the classic accessible Crested Butte hike — gentle grades, big views, and easy to reach from town. In July, Crested Butte earns its title as the **Wildflower Capital of Colorado**, and the trails explode with color. Reward the effort with a craft cocktail back in town and one last dinner with a view.

## Make it easy on yourself

A first-timer's weekend is best spent walking, not parking. Booking direct through Traverse means **no booking fees** and homes close to both the mountain and Elk Avenue. [Browse Crested Butte rentals](/properties), or if you want to be steps from the lifts, look at [The Grand Lodge](/crested-butte/grand-lodge), [The Plaza](/crested-butte/the-plaza), or the [Lodge at Mountaineer Square](/crested-butte/lodge-at-mountaineer-square).`,
    faqs: [
      {
        question: "Is two days enough for Crested Butte?",
        answer:
          "For a first visit, yes. Two days covers the mountain, a walk down historic Elk Avenue, one classic hike like the Lower Loop, and a couple of good meals — a full weekend without feeling rushed.",
      },
      {
        question: "When is the best time to visit Crested Butte?",
        answer:
          "It's a true two-season town. Ski season runs roughly December through early April; summer peaks in July, when Crested Butte becomes the Wildflower Capital of Colorado. Both make excellent weekends; September brings golden aspens and thinner crowds.",
      },
      {
        question: "What's the one hike a first-timer should do?",
        answer:
          "The Lower Loop Trail — it's close to town, has gentle grades suitable for most fitness levels, and delivers the big Crested Butte scenery without a full-day commitment. Stunning in July wildflower season.",
      },
      {
        question: "How do I get around Crested Butte without a car?",
        answer:
          "A free shuttle connects the town of Crested Butte with the ski base at Mt. Crested Butte, and Elk Avenue is fully walkable. Many visitors park the car for the weekend and don't touch it again.",
      },
      {
        question: "Where should I stay for a first Crested Butte weekend?",
        answer:
          "Close to the mountain and Elk Avenue so you can walk to most of it. The Grand Lodge, The Plaza, and the Lodge at Mountaineer Square are all slope-side buildings we manage — booked direct with no booking fees.",
      },
    ],
  },
  "colorado-mountains-with-kids-itinerary": {
    body: `## A Colorado mountain weekend built for families

Mountain trips with kids need a different rhythm: hands-on activities, wins that don't require a 14er, and a hot tub to melt down into at the end of the day. This is a two-day plan you can run out of either **Crested Butte** or **Leadville**, weighted toward the things kids actually remember — a train, a trail with a story, and animals up close.

## A note on altitude with kids

Both towns are high — Crested Butte around 8,900 feet, Leadville above 10,000 — and kids feel it too. Keep the first day mellow, push water all weekend, and plan for earlier bedtimes than usual. Low-key activities near town beat ambitious ones the first day.

## Day one — a train and a museum

If you're basing in Leadville, the **Leadville Colorado & Southern Railroad** scenic train is the easy headline — a relaxed ride through the mountains that little kids love and adults don't mind. Pair it with the hands-on **Children's Museum** for an indoor option if the weather turns. Near Leadville, the **National Fish Hatchery** is free, easy, and a hit with younger kids.

## Day two — an easy trail and open space

Keep the hiking short and interesting. A **Storybook Trail** — a walk with illustrated story pages posted along the route — turns a gentle hike into a game, which is exactly the trick for tired legs. Follow it with lakeside time or a playground and an early dinner.

## Why families book direct

Family trips need space — bedrooms, a full kitchen, laundry, and a hot tub — not a cramped hotel room. Booking direct through Traverse means **no booking fees** on [our family-friendly Colorado rentals](/properties). Explore [things to do in Crested Butte](/crested-butte/things-to-do) or [in Leadville](/leadville/things-to-do).`,
    faqs: [
      {
        question: "Is Crested Butte or Leadville better for a trip with kids?",
        answer:
          "Both work well. Leadville has the scenic railroad, the fish hatchery, and a children's museum — very easy wins. Crested Butte offers a walkable town and gentle trails. Pick by what's closer or by which rental fits your family; both are covered in this plan.",
      },
      {
        question: "How do I manage altitude with young children?",
        answer:
          "Take the first day slow, keep everyone well hydrated, and expect earlier bedtimes. Choose low-key activities near town before anything ambitious. Kids feel the thin air too, especially in Leadville, which sits above 10,000 feet.",
      },
      {
        question: "What are the best kid-friendly activities in the Colorado mountains?",
        answer:
          "A scenic train ride, a hands-on children's museum, a free fish hatchery, and a short 'storybook' trail with posted story pages that turns a walk into a game. All are low-effort, high-reward for kids aged roughly 5–12.",
      },
      {
        question: "What kind of rental is best for a family?",
        answer:
          "Look for multiple bedrooms, a full kitchen, and in-unit laundry — and a hot tub is the closing move after a day out. Our Colorado homes are set up for families, and booking direct means no booking fees.",
      },
      {
        question: "How many days do you need?",
        answer:
          "A two-day weekend is plenty for the highlights — a train or museum day and an easy-trail day — with margin for slow mornings and the altitude adjustment that trips with kids always need.",
      },
    ],
  },
};

export function getSlugContent(slug: string): PlanSlugContent | null {
  return SLUG_CONTENT[slug] ?? null;
}
