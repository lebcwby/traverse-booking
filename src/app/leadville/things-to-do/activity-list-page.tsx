import { NoFeesHeader } from "@/components/no-fees/no-fees-header";

export interface Activity {
  heading: string;
  description: string;
  link?: { url: string; label?: string };
  image?: string;
}

interface ActivityListPageProps {
  bgImage: string;
  title: string;
  lede: string;
  activities: Activity[];
  /** Path back to the parent things-to-do hub (defaults to Leadville). */
  thingsToDoHref?: string;
  /** Browse-rentals CTA at the bottom of the page. */
  browseHref?: string;
  browseLabel?: string;
  browseLede?: string;
}

export function ActivityListPage({
  bgImage,
  title,
  lede,
  activities,
  thingsToDoHref = "/leadville/things-to-do",
  browseHref = "/properties?city=Leadville",
  browseLabel = "Browse Leadville Rentals",
  browseLede = "We manage 70+ Leadville-area vacation rentals — cabins, historic Victorians, hot tub homes, and pet-friendly stays.",
}: ActivityListPageProps) {
  return (
    <div data-no-fees-layout={true}>
      <NoFeesHeader />
      <div className="traverse-page">
        <header className="act-hero">
          <div
            className="act-hero-bg"
            style={{ backgroundImage: `url('${bgImage}')` }}
          />
          <div className="act-hero-overlay" />
          <div className="act-hero-inner">
            <div className="breadcrumb">
              <a href={thingsToDoHref}>Things to Do</a>
              <span>›</span>
              <span>{title}</span>
            </div>
            <h1>{title}</h1>
            <p className="hero-lede">{lede}</p>
          </div>
        </header>

        <section className="act-section">
          <div className="act-list">
            {activities.map((a, i) => (
              <article
                key={a.heading}
                className={`act-item${a.image ? " act-item--with-image" : ""}${
                  a.image && i % 2 === 1 ? " act-item--reverse" : ""
                }`}
              >
                {a.image && (
                  <div className="act-item-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.image} alt={a.heading} loading="lazy" />
                  </div>
                )}
                <div className="act-item-body">
                  <h2>{a.heading}</h2>
                  <p>{a.description}</p>
                  {a.link && (
                    <a
                      className="act-link"
                      href={a.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {a.link.label || "Learn More"} →
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="act-cta">
          <div className="act-cta-inner">
            <h2>Need a Place to Stay?</h2>
            <p>{browseLede}</p>
            <a className="btn" href={browseHref}>
              {browseLabel}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
