export const pageContent = `
<section class="ttd-hero">
  <div class="ttd-hero-bg" style="background-image:url('/crested-butte/things-year-round.jpg');"></div>
  <div class="ttd-hero-overlay"></div>
  <div class="ttd-hero-inner">
    <div class="eyebrow">Gunnison County · Elevation 9,375 ft</div>
    <h1>Things to Do in <em>Crested Butte.</em></h1>
    <p class="hero-lede">Have some free time while in Crested Butte? Here are a few of our favorite things to do — through every season, with mountains in every direction.</p>
  </div>
</section>

<section class="ttd-section">
  <div class="ttd-grid">
    <article class="ttd-card">
      <img class="ttd-card-img" src="/crested-butte/things-summer.jpg" alt="Wildflowers and mountain hiking in Crested Butte Colorado summer" loading="lazy">
      <div class="ttd-card-body">
        <span class="ttd-tag">Summer</span>
        <h2>Summer Activities</h2>
        <p>With miles of scenic trails, biking routes through the forests, and opportunities for golfing and more, the adventure continues. Whether you're hiking to capture breathtaking views, cycling through mountain passes, or enjoying a round of golf surrounded by stunning vistas, Crested Butte offers an array of summer activities.</p>
        <a class="ttd-link" href="/crested-butte/things-to-do/summer-activities">Let's Adventure →</a>
      </div>
    </article>

    <article class="ttd-card ttd-card--reverse">
      <img class="ttd-card-img" src="/crested-butte/things-winter.jpeg" alt="Skiing, snowboarding, and snowshoeing in Crested Butte" loading="lazy">
      <div class="ttd-card-body">
        <span class="ttd-tag">Winter</span>
        <h2>Winter Activities</h2>
        <p>Skiing and snowboarding are Colorado's go-to winter activities, but Crested Butte and its surrounding areas offer so much more — snowmobiling, snowshoeing, ice skating, dog sledding, and many holiday events you won't want to miss.</p>
        <a class="ttd-link" href="/crested-butte/things-to-do/winter-activities">Let's Adventure →</a>
      </div>
    </article>

    <article class="ttd-card">
      <img class="ttd-card-img" src="/crested-butte/things-year-round.jpg" alt="Year-round activities in Crested Butte — scenic drives, museums, distilleries" loading="lazy">
      <div class="ttd-card-body">
        <span class="ttd-tag">All Year</span>
        <h2>All-Year-Round Activities</h2>
        <p>Scenic drives, museums, arts and culture, brewery tours, and downtown exploration. There's always something to do in Crested Butte, no matter the season.</p>
        <a class="ttd-link" href="/crested-butte/things-to-do/all-year-round-activities">Let's Adventure →</a>
      </div>
    </article>
  </div>
</section>

<section class="ttd-section">
  <div style="max-width:820px;margin:0 auto;padding:0 20px;">
    <h2 style="text-align:center;margin-bottom:8px;">Crested Butte Things to Do: FAQ</h2>
    <div style="margin-top:28px;display:grid;gap:22px;">
      <div>
        <h3>What is there to do in Crested Butte in the summer?</h3>
        <p>Crested Butte is known as the Wildflower Capital of Colorado, with peak blooms in July. Summer favorites include hiking and wildflower walks, world-class mountain biking, scenic drives over Kebler Pass, golf, and fly-fishing on the Slate and Gunnison rivers.</p>
      </div>
      <div>
        <h3>What winter activities are there in Crested Butte?</h3>
        <p>Crested Butte Mountain Resort offers some of Colorado's most challenging lift-served terrain. Beyond skiing and snowboarding you can snowshoe, cross-country ski, snowmobile, ice skate, and try dog sledding, plus seasonal holiday events in the historic downtown.</p>
      </div>
      <div>
        <h3>What is there to do in Crested Butte if you don't ski?</h3>
        <p>Plenty, year-round — explore the historic Elk Avenue downtown, visit the Crested Butte Mountain Heritage Museum, tour local breweries and a distillery, take a scenic drive, or browse the arts and gallery scene.</p>
      </div>
      <div>
        <h3>When is wildflower season in Crested Butte?</h3>
        <p>Wildflower season runs from roughly mid-June through August and peaks in July, when the Crested Butte Wildflower Festival takes place — the best window for guided hikes and photography among the meadows.</p>
      </div>
      <div>
        <h3>How do you get around Crested Butte?</h3>
        <p>A free year-round shuttle (Mountain Express) connects the town of Crested Butte with the Mt. Crested Butte base area, so you can stay slope-side or downtown without a car. The base-area lifts, dining, and shops are all walkable.</p>
      </div>
    </div>
  </div>
</section>

<section class="ttd-cta-band">
  <div class="ttd-cta-inner">
    <h2>Need a Place to Stay?</h2>
    <p>From slope-side condos at the Grand Lodge to Plaza suites and Mountaineer Square — we manage 70+ Crested Butte vacation rentals. Book direct and save up to 15%.</p>
    <a class="btn btn-primary" href="/properties?city=Crested+Butte">Browse Crested Butte Rentals</a>
  </div>
</section>
`;

export const schemaBlocks: Array<Record<string, unknown>> = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Things to Do in Crested Butte Colorado",
    description:
      "Summer, winter, and year-round activities in Crested Butte, Colorado — skiing, hiking, scenic drives, dog sledding, museums and more.",
    url: "https://www.booktraverse.com/crested-butte/things-to-do/",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.booktraverse.com/" },
        { "@type": "ListItem", position: 2, name: "Crested Butte", item: "https://www.booktraverse.com/crested-butte/" },
        { "@type": "ListItem", position: 3, name: "Things to Do", item: "https://www.booktraverse.com/crested-butte/things-to-do/" },
      ],
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is there to do in Crested Butte in the summer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Crested Butte is known as the Wildflower Capital of Colorado, with peak blooms in July. Summer favorites include hiking and wildflower walks, world-class mountain biking, scenic drives over Kebler Pass, golf, and fly-fishing on the Slate and Gunnison rivers.",
        },
      },
      {
        "@type": "Question",
        name: "What winter activities are there in Crested Butte?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Crested Butte Mountain Resort offers some of Colorado's most challenging lift-served terrain. Beyond skiing and snowboarding you can snowshoe, cross-country ski, snowmobile, ice skate, and try dog sledding, plus seasonal holiday events in the historic downtown.",
        },
      },
      {
        "@type": "Question",
        name: "What is there to do in Crested Butte if you don't ski?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Plenty, year-round — explore the historic Elk Avenue downtown, visit the Crested Butte Mountain Heritage Museum, tour local breweries and a distillery, take a scenic drive, or browse the arts and gallery scene.",
        },
      },
      {
        "@type": "Question",
        name: "When is wildflower season in Crested Butte?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Wildflower season runs from roughly mid-June through August and peaks in July, when the Crested Butte Wildflower Festival takes place — the best window for guided hikes and photography among the meadows.",
        },
      },
      {
        "@type": "Question",
        name: "How do you get around Crested Butte?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A free year-round shuttle (Mountain Express) connects the town of Crested Butte with the Mt. Crested Butte base area, so you can stay slope-side or downtown without a car. The base-area lifts, dining, and shops are all walkable.",
        },
      },
    ],
  },
];
