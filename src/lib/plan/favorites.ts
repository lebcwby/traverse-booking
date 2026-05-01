// Book Traverse team favorites — real Portland spots the team loves, each
// with the specific thing to order or do. Hayden maintains this list;
// Claude appends to it when Hayden drops a new one in chat.
//
// The favorites do NOT replace sp_pois. They layer human-supplied detail on
// top of POI rows. When search_pois returns a row whose name matches a
// favorite, the tool attaches a `favorite` field to that row so the agent
// can mention the specific with explicit human attribution.

export type Favorite = {
  // Stable sp_pois id. Optional — if omitted, matching falls back to
  // normalized-name lookup against each POI's `name` field.
  poiId?: string;
  // The name we match against sp_pois rows (normalized, accent-insensitive,
  // word-boundary substring match). Always required so matching works even
  // without a pinned poiId.
  nameMatch: string;
  // Display-only hints for the system prompt render, used by the agent as
  // steering signal when choosing which neighborhoods to search_pois. Not
  // used for POI matching. Array so multi-location places can be surfaced
  // when planning in any of their neighborhoods.
  neighborhoods?: string[];
  category?: string;
  // The specific thing the human recommends ordering or doing. This is the
  // whole point of the list.
  orderThis?: string;
  // Extra colour — "pro tip", timing, caveat, whatever. Optional.
  note?: string;
};

export const FAVORITES: Favorite[] = [
  {
    nameMatch: "Por Qué No",
    neighborhoods: ["Mississippi", "Hawthorne"],
    category: "tacos",
    orderThis: "Bryan's Bowl with steak",
  },
  {
    nameMatch: "Coava",
    neighborhoods: ["Buckman", "Hawthorne"],
    category: "coffee",
    orderThis: "vanilla oat milk latte",
    note: "three Portland cafés, all east-side — SE Grand (Buckman flagship), SE Main (Public Brew Bar & Roastery), and SE Hawthorne",
  },
  {
    nameMatch: "Stepping Stone",
    neighborhoods: ["Northwest"],
    category: "breakfast",
    orderThis: "the off-menu bacon, spinach, and jack",
    note: "it's off-menu — ask for it by name",
  },
  {
    nameMatch: "Bernstein's Bagels",
    neighborhoods: ["North Portland"],
    category: "bagels",
    orderThis:
      "the breakfast sandwich — cream cheese, prosciutto, scrambled egg, arugula",
  },
  {
    nameMatch: "Baker's Mark",
    neighborhoods: ["Division", "Pearl"],
    category: "sandwiches",
    note: "best sandwich in Portland; the Dutch crunch bread is what makes it special — order ahead since they sell out early, and keep an eye out for seasonal breads; two Portland locations — SE Division (1126) and Pearl District (301 NW 10th)",
  },
  {
    nameMatch: "De Ponte",
    neighborhoods: ["Dundee Hills (day trip)"],
    category: "winery",
    orderThis: "Melon de Bourgogne",
    note: "same grape as French Muscadet (Loire Valley); Oregon's oldest Melon planting, from 40-year-old vines; the only white they make",
  },
  {
    nameMatch: "Han Oak",
    neighborhoods: ["Kerns"],
    category: "korean",
    note: "seasonal Korean cuisine powered by Pacific Northwest produce, served in an ever-evolving prix fixe",
  },
  {
    nameMatch: "Kachka",
    neighborhoods: ["Buckman"],
    category: "russian",
    orderThis: "dumplings",
  },
  {
    nameMatch: "Luce",
    neighborhoods: ["Kerns"],
    category: "italian",
    orderThis: "homemade focaccia bread",
  },
  {
    nameMatch: "Bamboo Sushi",
    neighborhoods: ["Alberta", "NW 23rd", "Downtown", "Kerns"],
    category: "sushi",
    orderThis: "the Green Machine — try with salmon or tuna",
    note: "tempura green bean, green onion, and avocado with cilantro sweet chili aioli; vegetarian by default, add the protein to order; four Portland locations — NE Alberta, NW 23rd, SW 12th (downtown), SE 28th",
  },
  {
    nameMatch: "Nostrana",
    neighborhoods: ["Buckman"],
    category: "italian",
    orderThis: "wood-fired pizza, pasta, or steak",
    note: "a team favorite for important dates; James Beard-nominated kitchen",
  },
  {
    nameMatch: "Ringside",
    neighborhoods: ["Northwest"],
    category: "steakhouse",
    orderThis: "onion rings, steak",
    note: "Portland steakhouse institution since 1944 (family-owned) on W Burnside; the onion rings are a secret family recipe from the early 1960s",
  },
  {
    nameMatch: "Phuket Cafe",
    neighborhoods: ["NW 23rd"],
    category: "thai",
    orderThis: "fried chicken",
    note: "sister restaurant to Langbaan (shares the NW 23rd space) — same kitchen team, cheaper and easier to get into than Langbaan's tasting menu",
  },
  {
    nameMatch: "Fire on the Mountain",
    neighborhoods: ["Kerns", "North Portland", "NE Portland"],
    category: "wings",
    orderThis: "spicy peanut wings, sweet potato fries",
    note: "Portland wings institution since 2005; the Spicy Peanut is their signature sauce out of a dozen options; locations on E Burnside, N Interstate, and NE Fremont",
  },
  {
    nameMatch: "Cafe Rowan",
    neighborhoods: ["Creston-Kenilworth"],
    category: "brunch",
    orderThis:
      "the Rowan Sandwich — bacon, blueberry jam, Tillamook cheddar, sea salt fried eggs",
    note: "brunch only, walk-in only (Wed-Sun, 9am-2pm)",
  },
  {
    nameMatch: "PDX Sliders",
    neighborhoods: ["Sellwood", "Division", "North Portland"],
    category: "burgers",
    orderThis: "truffle fries, the Steel, the Portland",
    note: "the Steel: double beef, American cheese, bacon, caramelized onions, aioli on brioche; the Portland: beef, American cheese, raw onions, pickle, aioli on brioche; sliders named after Portland bridges; Sellwood-Moreland, SE Division, and N Williams locations",
  },
  {
    nameMatch: "Screen Door",
    neighborhoods: ["Pearl", "Buckman"],
    category: "southern",
    orderThis:
      "The Plate — chicken tenders, mashed potatoes, and Mac & Cheese (must have)",
    note: "The Plate is a pick-3-sides combo with optional protein upgrade; known for buttermilk-battered Southern fried chicken; Pearl District + Eastside (E Burnside) locations",
  },
  {
    nameMatch: "Gabbiano's",
    neighborhoods: ["Concordia"],
    category: "italian",
    orderThis: "pan bread with burrata",
  },
  {
    nameMatch: "Fried Egg I'm in Love",
    neighborhoods: ["Downtown", "Hawthorne", "Mississippi"],
    category: "breakfast sandwiches",
    orderThis: "Yolko Zeppelin",
    note: "double fried egg, homemade pesto, parmesan, and a double hand-pressed house sausage patty (the doubled-up version of the Yolko Ono); every egg gets their 'Magic Egg Dust' secret spice blend; Pioneer Courthouse Square (SW Broadway), SE Hawthorne, and N Mississippi locations",
  },
  {
    nameMatch: "Tov Coffee",
    neighborhoods: ["Hawthorne"],
    category: "coffee",
    orderThis: "Mint Thing cold brew",
    note: "cold brew with in-house mint syrup, oat milk, and raw cane sugar; Egyptian-style coffee shop that started as a red double-decker bus",
  },
  {
    nameMatch: "Daawat A Ishq",
    neighborhoods: ["NE Portland"],
    category: "indian",
    orderThis: "butter chicken and garlic naan",
  },
  {
    nameMatch: "Dolly Olive",
    neighborhoods: ["Downtown"],
    category: "italian",
    orderThis: "focaccia, short rib, pasta",
    note: "Southern Mediterranean with an in-house bakery program in the West End; Focaccia of the Day (often caramelized shallot + balsamic honey); short rib comes as Braised Short Rib Arancini with pecorino aioli and honey; fresh-made pasta",
  },
  {
    nameMatch: "Lovely's Fifty Fifty",
    neighborhoods: ["Mississippi"],
    category: "pizza",
    note: "best pizza in Portland; sourdough crust, wood-fired, hyperlocal/foraged seasonal toppings; house-made ice cream from Pacific Northwest farm produce; featured on Netflix's Chef's Table; no reservations",
  },
  {
    nameMatch: "Matt's BBQ Tacos",
    neighborhoods: ["Division", "Alberta"],
    category: "tacos",
    orderThis: "breakfast brisket taco",
    note: "chopped brisket, potato cheddar, and eggs on a house-made lard-infused flour tortilla; same meat program as Matt's BBQ; Bon Appétit's #9 hottest restaurant in the country (2019); SE 50th (Hinterland pod) + Alberta (Great Notion) locations",
  },
  {
    nameMatch: "Bluto's",
    neighborhoods: ["Belmont"],
    category: "greek",
    orderThis: "pita, halva soft-serve, Bluto's wedge, cocktails",
    note: "pita is fresh house dough, made daily and grilled to order; house-made soft serve (vanilla/chocolate/swirl) with a halva version topped in honey and halva; Greek/Middle Eastern with Northwest flair on SE Belmont",
  },
  {
    nameMatch: "Good Coffee",
    neighborhoods: ["NW Slabtown", "Division", "Buckman"],
    category: "coffee",
    orderThis: "vanilla oat latte",
    note: "Scandinavian-inspired Portland roaster with light roast profiles; three Portland locations — Slabtown (NW Raleigh), SE Division, and SE 12th; also Beaverton, Troutdale, and PDX airport outside Portland proper",
  },
  {
    nameMatch: "Barista",
    neighborhoods: ["Pearl", "Alberta", "Downtown", "NW 23rd"],
    category: "coffee",
    orderThis: "hazelnut oat milk latte",
    note: "Pearl District flagship (NW 13th), plus NE Alberta, downtown Hamilton Building, NW 23rd, and Brass Bar at Pine Street Market; not a roaster — rotates guest specialty roasters monthly",
  },
  {
    nameMatch: "Rose City Coffee",
    neighborhoods: ["Brooklyn"],
    category: "coffee",
    orderThis: "breakfast sandwich on english muffin",
    note: "Asian, women, and veteran-owned SE Milwaukie Ave shop; built on the legacy of Shondenken, Portland's oldest micro-roaster",
  },
  {
    nameMatch: "Hat Yai",
    neighborhoods: ["Alberta", "Belmont"],
    category: "thai",
    orderThis: "fried chicken combo (curry, sticky rice)",
    note: "Southern Thai style fried chicken using Mary's free-range chicken; the Hat Yai Combo is 3 pieces (leg, thigh, wing) with malayu-style curry for dipping, sticky rice, and roti; Vernon (NE Killingsworth) plus a Belmont branch; same ownership as Langbaan and Phuket Cafe",
  },
  {
    nameMatch: "Rimsky-Korsakoffee",
    neighborhoods: ["Buckman"],
    category: "dessert",
    orderThis: "Raspberry Fool",
    note: "late-night dessert house with a speakeasy feel — classical-music-themed, quirky haunted Victorian atmosphere; one of Portland's first coffeehouses; open Wed-Sun 7pm–midnight",
  },
  {
    nameMatch: "Pinolo Gelato",
    neighborhoods: ["Richmond"],
    category: "gelato",
    orderThis: "pistachio, the seasonal flavors",
    note: "founded 2015 by a Pisa-born owner who trained at an artisanal gelato shop in Pisa before bringing the craft to Portland; authentic Tuscan-style gelato made fresh daily on SE Division; 12 flavors at a time that rotate with the seasons (pistachio is a classic from the original lineup); hyperlocal sourcing from Oregon farms (e.g. marionberries from Topaz Farm); past seasonal specials have included fioritura (strawberry-elderflower), raspberry with lemon zest, and ricotta-pine nut-honey",
  },
  {
    nameMatch: "Highland Farms",
    neighborhoods: ["Mt. Hood (day trip)"],
    category: "farm",
    orderThis: "spa, highland cows",
    note: "Brightwood, OR at the base of Mt. Hood — about 50 minutes from Portland; the Nordic Forest Spa is a 60-minute session with wood-burning dry sauna, wet sauna, and cold plunge; the farm tour meets Scottish Highland cows, Icelandic sheep, white peacocks, guardian dogs, chickens, and guinea fowl; $75/person for each",
  },
  {
    nameMatch: "Maruti",
    neighborhoods: ["Hawthorne"],
    category: "indian",
    orderThis: "vegan tikka masala",
    note: "100% vegetarian Indian on SE Hawthorne with vegan and gluten-free options throughout; tikka masala is a creamy tomato-spice sauce served with paneer, potatoes, or mushrooms",
  },
  {
    nameMatch: "TwentySix Cafe",
    neighborhoods: ["NE Portland"],
    category: "coffee",
    orderThis: "bagel sandwich",
    note: "European-style cafe on NE 7th Ave (Irvington/Eliot); uses Spielman bagels, Terrain & Tristero coffee, and Grand Central breads",
  },
  {
    nameMatch: "Life of Pie",
    neighborhoods: ["Mississippi", "NW 23rd"],
    category: "pizza",
    orderThis: "Happy Hour Margherita pizza",
    note: "$5 Margherita during happy hour daily 11am-6pm (regularly $12); wood-fired in an oven imported from Naples; Eastside at N Williams and Westside at NW 23rd",
  },
  {
    nameMatch: "Papa Haydn",
    neighborhoods: ["NW 23rd", "Sellwood"],
    category: "dessert",
    orderThis: "Boccone Dolce",
    note: "French meringue layered with semi-sweet chocolate, whipped cream, and fresh seasonal fruit ('sweet mouthful' in Italian); gluten-free; signature dessert since 1978; NW 23rd and Sellwood locations",
  },
  {
    nameMatch: "Big's Chicken",
    neighborhoods: ["NE Portland"],
    category: "chicken",
    orderThis: "grilled chicken sandwich",
    note: "Alabama-style grilled chicken — marinated in Fresno pepper sauce, smoked over fruit wood, grilled to order, basted with their White Gold BBQ sauce; comes with slaw, pickles, and sauce; NE Glisan in Portland plus a Beaverton location",
  },
  {
    nameMatch: "Spitz",
    neighborhoods: ["North Portland"],
    category: "mediterranean",
    orderThis: "Doner Basket",
    note: "doner is slow-roasted beef, lamb, or chicken on a vertical spit with veggies and tzatziki; Mediterranean/Greek spot on N Killingsworth",
  },
  {
    nameMatch: "Breakside",
    neighborhoods: ["Woodlawn", "NW Slabtown"],
    category: "brewery",
    orderThis: "IPAs, Buffalo wrap",
    note: "Portland craft brewery with a gold-medal-winning IPA program (Great American Beer Festival); Woodlawn flagship on NE Dekum + NW Slabtown pub; also Milwaukie, Lake Oswego, Beaverton, Vancouver, and an Astoria coast taproom",
  },
  {
    nameMatch: "Ken's Artisan Pizza",
    neighborhoods: ["Kerns"],
    category: "pizza",
    note: "wood-fired pizza on SE 28th, open since 2006; sister operation to Ken's Artisan Bakery; named one of 50 Top Pizza's best pizzerias in the world five years running (currently 8th-best American pizzeria, with the Latteria San Salvatore Award for the dessert menu); also recognized by Food & Wine, Sunset Magazine, The Oregonian, Bloomberg, Thrillist, and Modernist Pizza; James Beard Award-winning cookbook author behind the kitchen (Flour Water Salt Yeast, 2013); we've never ordered something we didn't like — get there early",
  },
  {
    nameMatch: "Laurelhurst Park",
    neighborhoods: ["Kerns", "Laurelhurst"],
    category: "park",
    note: "26.81 acres in inner NE, designed in 1912 by Emanuel Mische (former horticulturist for the Olmsted Brothers firm); spring-fed duck pond, off-leash area, concert grove; first city park in the US on the National Register of Historic Places (2001)",
  },
  {
    nameMatch: "Tabor",
    neighborhoods: ["Mt. Tabor", "Southeast"],
    category: "park",
    note: "196-acre extinct volcanic cinder cone in SE Portland — one of only a handful of US cities with a volcano inside city limits; three decommissioned open reservoirs (built 1894 + 1911); summit viewpoint with Mt. Hood and downtown skyline; three waymarked loops (1, 1.7, and 3 miles)",
  },
  {
    nameMatch: "Forest Park",
    neighborhoods: ["Northwest", "Nob Hill"],
    category: "park",
    note: "5,157 acres along Portland's NW hills — the largest urban forest in the US; 80+ miles of trails anchored by the 30-mile Wildwood Trail (a National Recreation Trail); easiest entrances are Lower Macleay (NW Upshur) and the Thurman/Leif Erikson gate",
  },
  {
    nameMatch: "Matador",
    neighborhoods: ["NW 23rd", "Kerns", "North Portland"],
    category: "mexican",
    orderThis: "agave chicken wrap, margaritas",
    note: "agave-marinated chicken breast with bacon, avocado, cilantro-pepita dressing, pico de gallo, shredded lettuce, serrano vinaigrette, and cotija; happy hour every day 4–6pm and 10pm to last call; all tequilas and mezcals in cocktails are certified 100% agave; three Portland locations — NW 23rd Ave, E Burnside (Sunnyside), and N Williams",
  },
  {
    nameMatch: "Casa Italia",
    neighborhoods: ["Division", "Richmond"],
    category: "italian",
    orderThis: "Pennoni con Pancetta",
    note: "quaint family-run Italian on SE Division (Richmond) with fresh-made pasta and locally-grown ingredients; Pennoni con Pancetta is large pasta tubes with pan-fried pancetta in a vodka cream tomato sauce (option to add shrimp); pasta program is the draw",
  },
  {
    nameMatch: "Killer Burger",
    neighborhoods: ["Hollywood", "Downtown", "Sellwood"],
    category: "burgers",
    orderThis: "Peanut Butter Pickle Bacon Burger",
    note: "Portland-born burger chain, opened 2010 — home of the Peanut Butter Pickle Bacon Burger with bacon, peanut butter sauce, house sauce, mayo, grilled onion, and pickles; every burger comes with bacon; voted Best Burgers in Portland multiple years running; Portland locations on NE Sandy (Hollywood), SW 3rd (Downtown), and SE 17th (Sellwood)",
  },
  {
    nameMatch: "Cheese & Crack",
    neighborhoods: ["Kerns"],
    category: "snack shop",
    orderThis: "soft serve sundae specials, banana pudding",
    note: "snack shop / cheese shop / beer & wine bar at 22 SE 28th Ave near E Burnside; soft serve comes plain or dusted (espresso, matcha, beet, chocolate malt, or strawberry); rotating sundae specials change frequently and the banana pudding sundae is a recurring favorite; also serves charcuterie, mac & cheese, and sandwiches; hours Mon-Fri 3-10pm, Sat-Sun 12-10pm",
  },
  {
    nameMatch: "Noho's",
    neighborhoods: ["NE Portland"],
    category: "hawaiian",
    orderThis: "Spicy Teriyaki chicken",
    note: "authentic Hawaiian plate lunches since 1992; Spicy Teriyaki is marinated teriyaki chicken pan-fried with white onions and extra Hawaiian sauce; entrees come with sticky white rice and macaroni salad; NE Fremont (Beaumont-Wilshire) location, plus a Medford outpost; big outdoor space that's a summer pick; sometimes live music; service can run on island pace — settle in",
  },
  {
    nameMatch: "Mississippi Studios",
    neighborhoods: ["Mississippi"],
    category: "music venue",
    note: "intimate 375-cap live music venue at 3939 N Mississippi Ave, musician-owned and operated since 2002; custom non-parallel walls give it the acoustic reputation as one of the best venues in the country; books nationally and internationally touring acts plus local favorites; Bar Bar next door (added 2010) handles food and drinks — burger joint with a large covered patio, beer list, and rotating seasonal cocktails, open 11am-2am every day; check the calendar before pinning to an itinerary",
  },
  {
    nameMatch: "The 1905",
    neighborhoods: ["Mississippi", "North Portland"],
    category: "jazz club",
    note: "pizzeria + jazz club at 830 N Shaver St (Boise/Mississippi corridor); New York-style pies with house-made dough plus handcrafted cocktails; live jazz nightly with sets typically starting at 6, 7, or 8pm depending on the day — deep ties to Portland's jazz scene since 2016; named for the year pizza went commercial in the US; check the calendar to see who's booked",
  },
  {
    nameMatch: "Prost",
    neighborhoods: ["Mississippi"],
    category: "beer hall",
    orderThis: "imported German drafts, the food cart pod next door",
    note: "authentic German bier hall on N Mississippi Ave with a huge bier garten and communal tables (covered seating makes it year-round); every beer is imported from Germany and poured into the proper glass per German tradition (König Ludwig Weissbier, Schönramer Gold, Hacker-Pschorr Münchner Dunkel, etc.); shares its patio with the Mississippi Marketplace food cart pod — anchored by Matt's BBQ (Texas-style brisket), Native Bowl (vegan rice bowls), and Koi Fusion (Korean tacos)",
  },
  {
    nameMatch: "Jam on Hawthorne",
    neighborhoods: ["Hawthorne"],
    category: "breakfast",
    orderThis: "the jam on a biscuit",
    note: "everybody-friendly breakfast/brunch spot at 2239 SE Hawthorne — vegan, omnivore, kid, and booze-friendly all on one menu; housemade biscuits are the draw and pair with the housemade jams that give the place its name; 8am-2pm daily (extended weekend hours), no reservations — first-come walk-up only, sign in at the host stand and they'll text when a table is ready; be ready for a long line, especially weekend mornings",
  },
  {
    nameMatch: "Tamale Boy",
    neighborhoods: ["North Portland", "NE Portland"],
    category: "mexican",
    orderThis: "Burrito Del Mar, margaritas",
    note: "savory and sweet tamales — traditional and contemporary — made with local, sustainable, and organic ingredients; the Burrito Del Mar is a shrimp burrito with white wine cream sauce and chili oil; housemade margarita program is the cocktail draw; two Portland locations — N Russell St (Boise/Eliot) and NE Dekum St (Woodlawn)",
  },
  {
    nameMatch: "Trail Blazers",
    neighborhoods: ["NE Portland"],
    category: "basketball",
    note: "Portland's NBA team, playing at the 19,393-seat Moda Center in the Rose Quarter just east of the Burnside Bridge; arena opened in 1995 (originally the Rose Garden, renamed in 2013); regular season runs October–April; check the schedule for home games when planning a trip",
  },
  {
    nameMatch: "Portland Timbers",
    neighborhoods: ["Northwest"],
    category: "soccer",
    note: "Portland's MLS soccer team at Providence Park in Goose Hollow (25,218 capacity, opened 1926 as Multnomah Stadium); Timbers Army fills the south stand with continuous chants and tifo displays — frequently called one of the loudest venues in MLS, comparable to South American and European atmospheres; sold out every match from joining MLS in 2011 through 2023; same stadium hosts the NWSL Portland Thorns; MLS season runs late February–October",
  },
  {
    nameMatch: "Andina",
    neighborhoods: ["Pearl"],
    category: "peruvian",
    note: "high-end modern Peruvian (Novo-Andean) in the Pearl District at 1314 NW Glisan — fuses Inca-rooted ingredients like quinoa and purple potato with Spanish, Asian, and Pacific Rim techniques; signature dishes are the ceviche and lomo saltado; The Oregonian's Restaurant of the Year (2005) and invited to cook a six-course dinner at the James Beard House in NYC (2006); reservations recommended",
  },
  {
    nameMatch: "Alloro",
    neighborhoods: ["Chehalem Mountains (day trip)"],
    category: "winery",
    note: "110-acre estate at 650' elevation in the Chehalem Mountains AVA (Sherwood, ~30 min SW of Portland), planted in Laurelwood loess soil — founded 1999 with an Italian-leaning vision (Alloro = Italian for 'laurel'); estate plantings include Pinot Noir, Chardonnay, Riesling, Nebbiolo, Arneis, and Muscat (~7 wines bottled in a typical year, including three Pinot Noirs and a Riesling stylistically reminiscent of Alsace); tasting house pairs small bites with the estate's top wines; patio with fire pit; reservations via Tock",
  },
  {
    nameMatch: "Voodoo Doughnut",
    neighborhoods: ["NE Portland", "Kerns"],
    category: "donuts",
    orderThis: "the Pop-Tart donut",
    note: "honest take: more tourist novelty than craft donut — but the Pop-Tart donut is actually pretty good (strawberry-filled with vanilla frosting and sprinkles); if recommending, send guests to the NE Davis location (1501 NE Davis St) — easier to get to and a safer block than the Old Town original on SW 3rd, with the same menu and shorter lines; open early until 11pm-midnight",
  },
  {
    nameMatch: "Bible Club",
    neighborhoods: ["Sellwood"],
    category: "speakeasy",
    note: "Prohibition-era speakeasy in a 1922 yellow Craftsman house at 6716 SE 16th Ave (Sellwood) — no signage outside, period-correct details inside down to the doorknobs, 90-year-old beer taps, velvet drapery, and a 24-carat-gold-leaf bar called The Holy Land; vintage cocktail menu (Devils Fork Fix with Union Gin + Suze + ginger + celery + lemon, the Coffee Cobbler with brandy and cold brew, Fernet Champagne Flip with whole egg) plus elevated pub grub; surprisingly welcoming for the genre",
  },
  {
    nameMatch: "Focacceria",
    neighborhoods: ["Sellwood"],
    category: "italian",
    note: "loaded focaccia pizza by the slice or whole slab, plus sandwiches and salads, at 1613 SE Bybee Blvd (Sellwood) — offshoot of Montelupo Italian Market; popular slabs include the Pepperoni Square, Vodka Sausage Square, and Mushroom Square (hazelnut pesto, oyster + crimini mushrooms, ricotta, arugula); Cheesy Stix (focaccia with fontina, cacio, mozzarella, provolone, parsley) come with red sauce; outdoor seating, takeout, and delivery",
  },
  {
    nameMatch: "Holy Ghost",
    neighborhoods: ["Creston-Kenilworth"],
    category: "cocktail bar",
    note: "cocktail bar at 4107 SE 28th Ave (Creston-Kenilworth, just south of Hawthorne) opened November 2021 by Three on a Match in the old Pub at the End of the Universe building; agave-forward program with a ~400-bottle tequila and mezcal collection plus thoughtful low-ABV and non-alcoholic options built on drinking vinegars, Seedlip, and house syrups; food menu is intentionally limited because the shared building also hosts Pan Con Queso and Bbang (Korean sandwiches, fried chicken, tofu) — they'll bring food into the Holy Ghost room or out to the patio; coffee + a few other small food tenants round out the building; family-friendly; named after a Bar-Kays funk song",
  },
  {
    nameMatch: "Twisted Croissant",
    neighborhoods: ["NE Portland", "Sellwood"],
    category: "bakery",
    orderThis: "a cruffin",
    note: "handcrafted croissants, cruffins, and croissant donuts since 2017; the Raspberry Rose Cruffin is the signature — vanilla custard, raspberry jam, and a rosewater glaze; two Portland locations — 2129 NE Broadway (Irvington) and 1625 SE Bybee (Sellwood-Moreland), both open mornings through late afternoon; also pops up at weekend farmers' markets",
  },
  {
    nameMatch: "Cedo's Falafel",
    neighborhoods: ["NE Portland"],
    category: "mediterranean",
    orderThis: "the falafel sandwich",
    note: "family-owned Mediterranean / Middle Eastern at 3901 NE MLK Jr Blvd (King neighborhood) since 2012; falafel is made from scratch and the gyros come wrapped in homemade pita; full mezze board (hummus, baba ghanoush) alongside; takeout, dine-in, and delivery",
  },
  {
    nameMatch: "Cafe Olli",
    neighborhoods: ["NE Portland"],
    category: "italian",
    note: "wood-fired pizza and destination brunch at 3925 NE MLK Jr Blvd (King neighborhood), opened 2021 in the old Ned Ludd space; The New York Times' 50 best restaurants in 2023, The Oregonian's #16 best Portland restaurant in 2025, James Beard semifinalists (Best Chef: Northwest & Pacific) in 2026; also known for Italian pastries and the chocolate cake; sibling bakery/wine bar Ollini next door",
  },
  {
    nameMatch: "Powell's",
    neighborhoods: ["Pearl", "Hawthorne"],
    category: "bookstore",
    note: "honest take: more tourist pilgrimage than everyday browse-and-buy — but the Pearl District flagship (Powell's City of Books, 1005 W Burnside) is still a cool experience; a full city block, 68,000 sq ft, nine color-coded rooms, 3,500 sections, and 4M+ new/used/rare titles; founded 1971, claims to be the world's largest independent bookstore; smaller Powell's Books on Hawthorne plus Cedar Hills Crossing, PDX airport, and a Condon satellite",
  },
  {
    nameMatch: "Urbanite",
    neighborhoods: ["Buckman"],
    category: "vintage shop",
    note: "54 makers and curators under one roof at 1005 SE Grand Ave — home decor, trend-forward fashion, vintage, art, antiques by decade, a local pottery gallery, specialty kids' shops, a plant store, and rotating community markets in an event loft; open 10am-6pm daily",
  },
  {
    nameMatch: "House of Vintage",
    neighborhoods: ["Hawthorne"],
    category: "vintage shop",
    note: "60+ independent dealers sharing 13,000 sq ft at 3315 SE Hawthorne Blvd — vintage clothing, jewelry, furniture, art, and housewares; inventory rotates constantly because each dealer rents a booth and curates their own picks; open daily 11-7; prices run above typical thrift but the range is what makes the dig worth it",
  },
  {
    nameMatch: "Artifact",
    neighborhoods: ["Division"],
    category: "vintage shop",
    note: "curated buy/sell/trade consignment at 3630 SE Division (Richmond) — vintage and secondhand clothing, home decor, and furniture on a sustainable-fashion loop; most pieces under $20; once-a-week $1 Funday Flea alleyway sale in summer with proceeds going to a rotating non-profit; open daily 10am-8pm",
  },
  {
    nameMatch: "Scottie's",
    neighborhoods: ["Division", "NW 23rd"],
    category: "pizza",
    orderThis: "the Defino",
    note: 'NY/Neapolitan hybrid founded 2015 — naturally-leavened PNW wheat dough, slow-fermented and baked in a super-hot electric deck oven; the Defino is their grandma-style square (sauce on top, fresh + aged cheese, crispy browned edges); SE Division (Hosford-Abernethy) is the original, NW 21st (Northwest District) opened late 2022; sizes include 10" personal, 18" XL, 16" grandma square, and slices to-go',
  },
  {
    nameMatch: "Ranch Pizza",
    neighborhoods: ["Buckman", "Woodlawn"],
    category: "pizza",
    note: "Detroit-style (square, crunchy-bottomed, cheese-to-the-edge) Portland pizza shop; the SE 11th location is the biggest and shares 6,000 sq ft with Baerlic Brewing as The Pie Hall (2239 SE 11th Ave) — all-ages until 9pm, daily 11am-10pm, so you can pair a pie with a fresh Baerlic pour; second location at 1760 NE Dekum (Woodlawn)",
  },
  {
    nameMatch: "Wallace",
    neighborhoods: ["Nob Hill"],
    category: "park",
    note: "city park at NW 25th and Raleigh (Nob Hill) with a double-gated fenced off-leash dog area, open fields, shaded seating, and a water fountain; 5am-midnight, dog toys allowed; easy add-on if you're walking the NW 23rd corridor or bringing a pup",
  },
  {
    nameMatch: "Aalto",
    neighborhoods: ["Belmont"],
    category: "cocktail bar",
    note: "Belmont neighborhood cocktail lounge at 3356 SE Belmont St since 2000 — mid-century/modern room with a back patio; spirit-forward, classics-leaning cocktail list; $3/$5/$7 happy hour 5-7pm daily and all day Sunday",
  },
  {
    nameMatch: "Nate's Oatmeal Cookies",
    neighborhoods: ["Belmont"],
    category: "bakery",
    note: "oatmeal-cookies-only bakery at 3308 SE Belmont in a building from 1892; Nate Lown started baking his mom's 20-year-old family recipe during 2020 lockdown, sold at farmers' markets, then opened 2024 on Belmont; fresh-baked cookies in rotating flavors plus ice cream sandwiches with locally-made vanilla; vegan and gluten-free options; Mon + Thu-Sun 11am-9pm (closed Tue-Wed)",
  },
  {
    nameMatch: "Tulip Shop Tavern",
    neighborhoods: ["North Portland"],
    category: "burgers",
    orderThis: "the smash burger, queso fries",
    note: "21+ neighborhood tavern at 825 N Killingsworth (Humboldt) serving smash burgers, craft cocktails, and daily specials; burger menu runs smashed, doubled, fish-n-chipped, or vegan with sides like thick-cut fries, wedge salads, hot wings, and warm Dos Hermanos pretzels with spicy queso; back patio; The New York Times' 25 best Portland restaurants (2024)",
  },
  {
    nameMatch: "Paymaster",
    neighborhoods: ["Northwest"],
    category: "bar",
    note: "NW 17th neighborhood bar at 1020 NW 17th Ave with a big covered back patio (heat lamps, outdoor pool table, dog-friendly) — a reliable late night hang open 2pm-2:30am daily with angry hour 2-6pm",
  },
  {
    nameMatch: "Hawthorne Asylum",
    neighborhoods: ["Buckman", "Hawthorne"],
    category: "food cart pod",
    note: "20+ food carts at 1080 SE Madison (just off SE 12th) with an adjoining bar pouring 40+ beers, wine, and spirits; picnic tables and fire pits make it work year-round; wide cuisine range so a group with split appetites can all land something; opened 2019 on the site of the old Oregon Hospital for the Insane",
  },
  {
    nameMatch: "Güero",
    neighborhoods: ["Kerns"],
    category: "mexican",
    orderThis: "tortas",
    note: "torta specialist opened 2017 at 200 NE 28th Ave (Kerns) — pressed Mexican sandwiches on crusty rolls with slow-cooked meats, crema, avocado, and pickled vegetables; sibling bar Paradise at 2821 NE Davis handles the evening crowd with cocktails Thu-Sun 4-10pm",
  },
  {
    nameMatch: "Too Soon",
    neighborhoods: ["Kerns"],
    category: "cocktail bar",
    orderThis: "a custom cocktail",
    note: "cocktail bar at 18 NE 28th Ave (Kerns) opened 2023 by Nick Flower and Adam Robinson; tell the bartender what you like and they'll build a custom drink from a 1,000+ cocktail Rolodex; short printed menu also lists originals and bartender's-choice slots; Filipino food program; nominated Best New U.S. Cocktail Bar (West Coast) at Tales of the Cocktail 2025",
  },
  {
    nameMatch: "Hollywood Theatre",
    neighborhoods: ["Hollywood"],
    category: "movie theater",
    note: "nonprofit independent movie theater at 4122 NE Sandy Blvd, built 1926 — the reason the Hollywood District is named Hollywood; run by Film Action Oregon since 1997; the only theater in Oregon with 70mm capability (restored 2015); programs repertory, indie, classic, and first-run films; new seats, screens, sound system, and marquee after a 2011-2015 renovation run",
  },
  {
    nameMatch: "Cinema 21",
    neighborhoods: ["NW 21st"],
    category: "movie theater",
    note: "Portland's oldest continuously-operating movie theater at 616 NW 21st Ave (Northwest District), opened 1925 as the State Theatre for silent films with live organ; locally owned by Tom Ranieri since the early 1980s; three-screen arthouse that leans American indie, foreign-language, documentary, and classic programming; hosts the Portland International Film Festival and Portland Queer Film Festival",
  },
  {
    nameMatch: "Laurelhurst Theater",
    neighborhoods: ["Kerns"],
    category: "movie theater",
    note: "Art Deco second-run cinema at 2735 E Burnside (at NE 28th, Kerns), built 1923; tickets $7 matinee + all-day Tuesday, $10 otherwise; beer on tap in personal pitchers, cheap concessions, and New Deal Cafe pizza slices; rotating monthly theme (sci-fi, action, etc.) alongside first and second-run films; small, cozy rooms with table-side seats",
  },
  {
    nameMatch: "Back Stage Bar",
    neighborhoods: ["Hawthorne"],
    category: "bar",
    note: "McMenamins bar behind the Bagdad Theater at 3702 SE Hawthorne — three-story room with vaulted ceilings, oriental rugs, pool tables, pinball, and shuffleboard; a 30-foot 19th-century bar from the old Lotus Cafe was installed 2017; Mon-Thu 5pm-1:30am, Fri 5pm-2:30am, Sat 12pm-2:30am, Sun 12pm-1:30pm",
  },
  {
    nameMatch: "Greater Trumps",
    neighborhoods: ["Hawthorne"],
    category: "cigar bar",
    note: "McMenamins cigar-friendly pub at 1520 SE 37th Ave (west edge of the Bagdad complex, just off Hawthorne); you can actually smoke a cigar indoors at the bar; a few sidewalk tables under umbrellas; Terminator Stout and premium whiskeys like Oban Scotch; named after Charles Williams' mystical tarot cards",
  },
  {
    nameMatch: "Grassa",
    neighborhoods: ["Downtown", "NW 23rd", "Hawthorne"],
    category: "italian",
    note: "high-quality counter-service pasta — order at the counter and the kitchen runs the dish to your table; fresh-made pasta is the draw; Portland locations at 1205 SW Washington (downtown/West End), 1506 NW 23rd (Northwest District), and 1375 SE Hawthorne, plus a PDX airport satellite; open daily 11am-10pm",
  },
  {
    nameMatch: "Last Thursday",
    neighborhoods: ["Alberta"],
    category: "event",
    note: "last Thursday of every month on NE Alberta St between 15th and 30th — free, all-ages art walk + street fair since the 1990s; June/July/August the 15-block stretch closes to traffic 6-9pm for hundreds of outdoor arts and crafts vendors, street performers, musicians, and gallery opening parties; other months it runs indoors-only at bars and galleries; only include in an itinerary if one of the trip dates actually lands on a last Thursday",
  },
  {
    nameMatch: "First Thursday",
    neighborhoods: ["Pearl"],
    category: "event",
    note: "first Thursday of every month in the Pearl District since 1986 — galleries and businesses (including PNCA, Elizabeth Leach, Blackfish, Waterstone, Russo Lee, Blue Sky) debut new exhibitions, stay open late, and throw a soirée with food, drinks, and people-watching; the outdoor First Thursday Street Gallery on NW 13th Ave runs 5-9pm with 150+ artists; warmer months close NW 13th to traffic; 10,000+ people attend; only include in an itinerary if one of the trip dates actually lands on a first Thursday; transit > driving — parking is rough",
  },
  {
    nameMatch: "Salt & Straw",
    neighborhoods: ["NW 23rd", "Alberta", "Division"],
    category: "ice cream",
    note: "Portland's signature ice cream — rotating monthly flavor menus heavy on local ingredients and seasonal Pacific Northwest produce; started as a 2011 Alberta food cart (NE Alberta is the original storefront) and grew into a national brand; Portland locations at 838 NW 23rd (Northwest District), 2035 NE Alberta, and 3345 SE Division",
  },
  {
    nameMatch: "Afuri",
    neighborhoods: ["Buckman", "NW 23rd"],
    category: "ramen",
    orderThis: "the Tonkotsu Tantan",
    note: "Japanese ramen with a Portland-bent menu — Tonkotsu Tantan is a spicy sesame-miso tare in tonkotsu broth with pork crumbles, bok choy, shiitake, red onion, and chili oil over thick noodles; four Portland-area locations — Izakaya at 923 SE 7th Ave, Slabtown at 1620 NW 21st Ave, plus a downtown ramen-and-dumpling spot and a Beaverton outpost",
  },
  {
    nameMatch: "Hale Pele",
    neighborhoods: ["NE Broadway"],
    category: "tiki bar",
    note: "tiki bar at 2733 NE Broadway (Sullivan's Gulch / Irvington) with Polynesian-inspired cocktails, rum flights, a volcano-themed room, and thunder-and-lightning effects; open daily 4-11pm; among the most serious tiki programs on the West Coast",
  },
  {
    nameMatch: "Multnomah Whiskey Library",
    neighborhoods: ["Downtown"],
    category: "whiskey bar",
    note: "very difficult to get into and for serious whiskey snobs only — 1500+ finely-curated labels at 1124 SW Alder (downtown); opened 2013; the member waitlist runs about 3 years, and non-members use a $25 Hall Pass reservation; Mondays are walk-in only (no reservations taken)",
  },
  {
    nameMatch: "Kann",
    neighborhoods: ["Buckman"],
    category: "haitian",
    orderThis: "the beef rib",
    note: "for high end dinner; live-fire Haitian spot at 548 SE Ash St (Buckman) from Gregory Gourdet; James Beard Foundation Best New Restaurant 2023; the Smoked Beef Rib is the move — Haitian coffee rub, grilled mushrooms, BBQ sauce, and ti malice (Scotch-bonnet-and-lime condiment); reservations basically required",
  },
  {
    nameMatch: "St. Johns Bridge",
    neighborhoods: ["St. Johns"],
    category: "photo spot",
    note: "photography site; steel Gothic-arched suspension bridge over the Willamette, painted weathered green since 1931 — the only suspension bridge in the Willamette Valley; the adjacent Cathedral Park neighborhood is named after the Gothic arches; for photos, park on N Pittsburg Ave and walk down to Cathedral Park at river level (especially good at night when the bridge lights the sky)",
  },
  {
    nameMatch: "OMSI",
    neighborhoods: ["SE Industrial"],
    category: "museum",
    note: "recommended for kids; Oregon Museum of Science and Industry — 17-acre SE waterfront campus at 1945 SE Water Ave since 1944, with five interactive halls, the four-story Empirical Theater, the Harry C. Kendall Planetarium, and public tours of the USS Blueback (the last non-nuclear sub the U.S. Navy built); open 9:30am-5:30pm Mon-Fri + Sun, 9:30am-7pm Sat",
  },
  {
    nameMatch: "Japanese Garden",
    neighborhoods: ["Northwest"],
    category: "garden",
    note: "tourist attraction and photo site; the Japanese Ambassador to the U.S. called it 'the most beautiful and authentic Japanese garden in the world outside of Japan' (1988); 12-acre Washington Park complex at 611 SW Kingston Ave founded 1963 with eight garden styles, a tea ceremony house, Umami Café, and rotating art exhibitions; $22.50 adult, closed Tuesdays, 10am-6pm otherwise",
  },
  {
    nameMatch: "Hoyt Arboretum",
    neighborhoods: ["Northwest"],
    category: "park",
    note: "for hikes; 190-acre ridge-top living tree museum in Washington Park (4000 SW Fairview Blvd) founded 1928 with 12 miles of trails (2 miles paved/accessible), 6,000 trees from 2,000 species worldwide; free admission, feels remote fast despite being minutes from downtown",
  },
  {
    nameMatch: "Multnomah Falls",
    neighborhoods: ["Columbia Gorge (day trip)"],
    category: "waterfall",
    note: "Oregon's tallest year-round waterfall at 620 ft across two basalt-cliff tiers — the postcard of the Columbia River Gorge, about 30 min east of Portland on I-84 (exit 31) or the Historic Columbia River Highway scenic drive; 0.2-mile paved trail climbs 335 ft to the arched Benson Bridge between the tiers (built 1914); the full Larch Mountain Trail continues steeply up to the top for Columbia River views; most visited natural recreation site in the Pacific Northwest (2M+ annually — come early or midweek to dodge the parking crunch)",
  },
  {
    nameMatch: "Pelican Brewing",
    neighborhoods: ["Pacific City (day trip)"],
    category: "brewery",
    note: "beachfront brewpub at 33180 Cape Kiwanda Dr (Pacific City) — the only beachfront brewpub in the PNW, and the birthplace of Pelican Brewing (opened 1996); outdoor patio with front-row views of Haystack Rock, surfers, and the dory boats; pair a pour with climbing the Cape Kiwanda dune next door; open daily 11am-10pm, no reservations",
  },
  {
    nameMatch: "Cape Kiwanda",
    neighborhoods: ["Pacific City (day trip)"],
    category: "viewpoint",
    orderThis: "climb the dune",
    note: "Oregon State Natural Area on the Pacific City coast — a 250-ft sandstone headland jutting into the Pacific with a big steep dune climb up top, views of the 320-ft Haystack Rock (Pacific City's own, not the Cannon Beach one) offshore, tidepools at low tide, and sandstone rock arches; heed fences at the cliff edges — erosion is real; Pelican Brewing sits right at the base",
  },
  {
    nameMatch: "Gearhart Golf",
    neighborhoods: ["Gearhart (day trip)"],
    category: "golf",
    note: "the oldest continuous golf course west of the Mississippi — founded 1892 by a group of Scotsmen burying tin cans in the Gearhart dunes; expanded to 9 holes in 1901, 18 holes in 1913, redesigned in the early 1930s by amateur architect Chandler Egan; Scottish-heritage links-style course on the North Coast just north of Seaside, open to the public (membership capped at 230)",
  },
  {
    nameMatch: "Portland Gear",
    neighborhoods: ["Downtown"],
    category: "apparel",
    note: "Portland-native apparel brand — tees, hoodies, hats, and water-resistant bags featuring the signature 'P'-with-Oregon-inside logo; founded 2014 by Hillsboro native Marcus Harvey, who started with a single chest-logo tee sold from a 1973 VW Westfalia camper after the @portland Instagram page he created hit 60K followers; downtown flagship at 403 SW 10th Ave on the corner of Harvey Milk St (next to Ace Hotel), open daily 10am-7pm; additional locations at Washington Square mall (Tigard), Bridgeport Village (Tualatin), and PDX Airport post-security between gates D and E",
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsAsWords(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const startsCleanly = idx === 0 || haystack[idx - 1] === " ";
  const endsCleanly =
    idx + needle.length === haystack.length ||
    haystack[idx + needle.length] === " ";
  return startsCleanly && endsCleanly;
}

export function findFavoriteForPoi(poi: {
  id: string;
  name: string;
}): Favorite | undefined {
  const poiNameNorm = normalize(poi.name);
  return FAVORITES.find((f) => {
    if (f.poiId && f.poiId === poi.id) return true;
    const favNorm = normalize(f.nameMatch);
    return poiNameNorm === favNorm || containsAsWords(poiNameNorm, favNorm);
  });
}

const ROTATION_POOL = [
  "Local favorite",
  "Team pick",
  "Our go-to",
  "We love",
] as const;

function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Pill text shown on the itinerary card. Rules run in priority order; first
// match wins. Notes trigger overrides via literal phrases ("James Beard",
// "off-menu", "long line", "since YYYY"), so how you phrase a favorite's note
// decides its pill. Everything without a signal falls to deterministic
// rotation hashed by nameMatch, so the same favorite always reads the same.
export function getFavoritePill(favorite: Favorite): string {
  const rawNote = favorite.note ?? "";
  const note = rawNote.toLowerCase().replace(/[‘’‛`]/g, "'");
  const orderThis = (favorite.orderThis ?? "")
    .toLowerCase()
    .replace(/[‘’‛`]/g, "'");
  const category = (favorite.category ?? "").toLowerCase();
  const neighborhoods = favorite.neighborhoods ?? [];

  if (neighborhoods.some((n) => n.toLowerCase().includes("(day trip)"))) {
    return "Day trip";
  }
  if (note.includes("james beard")) return "James Beard";
  if (note.includes("chef's table")) return "Chef's Table";
  if (note.includes("honest take")) return "Honest take";
  if (note.includes("off-menu") || orderThis.includes("off-menu")) {
    return "Off-menu";
  }
  if (category === "music venue" || category === "jazz club") {
    return "Live music";
  }
  if (category === "basketball" || category === "soccer") {
    return "Live sports";
  }
  if (category === "speakeasy" || note.includes("no signage")) {
    return "Hidden gem";
  }
  if (note.includes("long line") || note.includes("worth the wait")) {
    return "Worth the wait";
  }
  if (note.includes("late-night") || note.includes("late night")) {
    return "Late night";
  }
  if (note.includes("walk-in only")) return "Walk-in only";
  if (note.includes("prix fixe")) return "Chef's pick";
  if (/^best \w+ in portland/.test(note)) return "Best in Portland";
  const yearMatch = note.match(/(?:since|founded|opened)\s+(\d{4})/);
  if (yearMatch) return `Since ${yearMatch[1]}`;

  return ROTATION_POOL[djb2(favorite.nameMatch) % ROTATION_POOL.length];
}

export function renderFavoritesForPrompt(): string {
  if (FAVORITES.length === 0) return "(none yet)";
  return FAVORITES.map((f) => {
    const meta: string[] = [];
    if (f.neighborhoods && f.neighborhoods.length > 0) {
      meta.push(f.neighborhoods.join(" / "));
    }
    if (f.category) meta.push(f.category);
    const metaBit = meta.length > 0 ? ` (${meta.join(", ")})` : "";
    const order = f.orderThis ? ` — order: ${f.orderThis}` : "";
    const note = f.note ? ` — ${f.note}` : "";
    return `- ${f.nameMatch}${metaBit}${order}${note}`;
  }).join("\n");
}
