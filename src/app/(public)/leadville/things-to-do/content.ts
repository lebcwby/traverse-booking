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

<section class="ttd-section">
  <div style="max-width:820px;margin:0 auto;padding:0 20px;">
    <h2 style="text-align:center;margin-bottom:8px;">Leadville Things to Do: FAQ</h2>
    <div style="margin-top:28px;display:grid;gap:22px;">
      <div>
        <h3>What is there to do in Leadville, Colorado?</h3>
        <p>Leadville is the highest incorporated city in North America at 10,152 feet, packed with Old West history. Visit the National Mining Hall of Fame &amp; Museum and other history museums, walk the historic Harrison Avenue downtown, ride or walk the Mineral Belt Trail, and take the Leadville, Colorado &amp; Southern scenic railroad.</p>
      </div>
      <div>
        <h3>What outdoor activities are near Leadville?</h3>
        <p>Leadville sits beneath Colorado's two highest peaks — Mount Elbert and Mount Massive — both popular 14er hikes. Nearby Turquoise Lake and Twin Lakes offer fishing, paddling, and camping, and the 11.6-mile paved Mineral Belt Trail loops the town for biking, walking, and Nordic skiing.</p>
      </div>
      <div>
        <h3>Can you ski near Leadville?</h3>
        <p>Yes — Ski Cooper is about 20 minutes away with affordable, uncrowded terrain, and Copper Mountain, Vail, and Breckenridge are all roughly 30–60 minutes by car, making Leadville a budget-friendly base for a Colorado ski trip.</p>
      </div>
      <div>
        <h3>Is Leadville worth visiting in the summer?</h3>
        <p>Summer is prime time — wildflowers, 14er hikes, alpine lakes, mountain biking on the Mineral Belt Trail, and historic events like Boom Days. The high elevation keeps temperatures cool and comfortable.</p>
      </div>
      <div>
        <h3>How far is Leadville from Vail and Copper Mountain?</h3>
        <p>Leadville is about 35 minutes from Copper Mountain and roughly 45–50 minutes from Vail, which is why many travelers stay in Leadville for lower lodging rates and drive to the larger resorts.</p>
      </div>
    </div>
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
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is there to do in Leadville, Colorado?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Leadville is the highest incorporated city in North America at 10,152 feet, packed with Old West history. Visit the National Mining Hall of Fame & Museum and other history museums, walk the historic Harrison Avenue downtown, ride or walk the Mineral Belt Trail, and take the Leadville, Colorado & Southern scenic railroad.",
        },
      },
      {
        "@type": "Question",
        name: "What outdoor activities are near Leadville?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Leadville sits beneath Colorado's two highest peaks — Mount Elbert and Mount Massive — both popular 14er hikes. Nearby Turquoise Lake and Twin Lakes offer fishing, paddling, and camping, and the 11.6-mile paved Mineral Belt Trail loops the town for biking, walking, and Nordic skiing.",
        },
      },
      {
        "@type": "Question",
        name: "Can you ski near Leadville?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — Ski Cooper is about 20 minutes away with affordable, uncrowded terrain, and Copper Mountain, Vail, and Breckenridge are all roughly 30–60 minutes by car, making Leadville a budget-friendly base for a Colorado ski trip.",
        },
      },
      {
        "@type": "Question",
        name: "Is Leadville worth visiting in the summer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Summer is prime time — wildflowers, 14er hikes, alpine lakes, mountain biking on the Mineral Belt Trail, and historic events like Boom Days. The high elevation keeps temperatures cool and comfortable.",
        },
      },
      {
        "@type": "Question",
        name: "How far is Leadville from Vail and Copper Mountain?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Leadville is about 35 minutes from Copper Mountain and roughly 45–50 minutes from Vail, which is why many travelers stay in Leadville for lower lodging rates and drive to the larger resorts.",
        },
      },
    ],
  },
];
