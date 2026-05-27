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
];
