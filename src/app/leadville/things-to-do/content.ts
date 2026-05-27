export const pageContent = `
<section class="ttd-hero">
  <div class="ttd-hero-bg" style="background-image:url('/leadville/things-year-round.png');"></div>
  <div class="ttd-hero-overlay"></div>
  <div class="ttd-hero-inner">
    <div class="eyebrow">Lake County · Elevation 10,152 ft</div>
    <h1>Things to Do in <em>Leadville.</em></h1>
    <p class="hero-lede">Have some free time while in Leadville? Here are a few of our favorite things to do — at 10,000 feet you'll never have a bad view, no matter the season or the journey.</p>
  </div>
</section>

<section class="ttd-section">
  <div class="ttd-grid">
    <article class="ttd-card">
      <img class="ttd-card-img" src="/leadville/things-summer.webp" alt="Mountain hiking and biking in Leadville Colorado summer" loading="lazy">
      <div class="ttd-card-body">
        <span class="ttd-tag">Summer</span>
        <h2>Summer Activities</h2>
        <p>Hiking, fishing, burro races, you name it — Leadville's got it. At 10,000 feet you'll never have a bad view so no matter which destination you're going to or what journey you take, we know you'll have a blast. Don't forget to bring water!</p>
        <a class="ttd-link" href="/leadville/things-to-do/summer-activities">Let's Adventure →</a>
      </div>
    </article>

    <article class="ttd-card ttd-card--reverse">
      <img class="ttd-card-img" src="/leadville/things-winter.webp" alt="Winter activities near Leadville Colorado — skiing, snowboarding, fat tire biking" loading="lazy">
      <div class="ttd-card-body">
        <span class="ttd-tag">Winter</span>
        <h2>Winter Activities</h2>
        <p>Skiing and snowboarding are Colorado's go-to winter activities, but Leadville and its surrounding areas offer so much more! Dog sledding, fat tire biking, and skijoring are some of our favorites — and you'll never get tired of the view.</p>
        <a class="ttd-link" href="/leadville/things-to-do/winter-activities">Let's Adventure →</a>
      </div>
    </article>

    <article class="ttd-card">
      <img class="ttd-card-img" src="/leadville/things-year-round.png" alt="Year-round activities in downtown Leadville Colorado — museums, zip-lining, hunting" loading="lazy">
      <div class="ttd-card-body">
        <span class="ttd-tag">All Year</span>
        <h2>All-Year-Round Activities</h2>
        <p>Hunting, zip-lining, museums and so much more to explore in downtown Leadville. We're sure you'll find something to enjoy in our little historic town no matter when you visit.</p>
        <a class="ttd-link" href="/leadville/things-to-do/all-year-round-activities">Let's Adventure →</a>
      </div>
    </article>
  </div>
</section>

<section class="ttd-cta-band">
  <div class="ttd-cta-inner">
    <h2>Ready to Plan Your Stay?</h2>
    <p>From cozy cabins to historic Victorians, we manage 70+ Leadville-area vacation rentals. Book direct and save up to 15%.</p>
    <a class="btn btn-primary" href="/properties?city=Leadville">Browse Leadville Rentals</a>
  </div>
</section>
`;

export const schemaBlocks: Array<Record<string, unknown>> = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Things to Do in Leadville Colorado",
    description:
      "Summer, winter, and year-round activities in Leadville, Colorado — hiking, skiing, fishing, dog sledding, museums, and more. Local favorites curated by Traverse Hospitality.",
    url: "https://www.booktraverse.com/leadville/things-to-do/",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.booktraverse.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Leadville",
          item: "https://www.booktraverse.com/leadville/",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Things to Do",
          item: "https://www.booktraverse.com/leadville/things-to-do/",
        },
      ],
    },
  },
];
