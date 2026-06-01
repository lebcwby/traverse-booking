export const revalidate = 300;

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import Link from "next/link";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesSearchBar } from "@/components/no-fees/no-fees-search-bar";
import { NoFeesEmailSignup } from "@/components/no-fees/no-fees-email-signup";
import { GoogleReviewsCarousel } from "@/components/google-reviews-carousel";
import "./no-fees/no-fees.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--nof-font-sans",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--nof-font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "Traverse Hospitality | Colorado Vacation Rentals — Crested Butte, Leadville, Vail & More",
  description:
    "189+ locally managed vacation rentals across 6 Colorado mountain markets. Ski-in condos at Crested Butte, cabins in Leadville, homes near Vail & Copper Mountain. Book direct and save up to 15%.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "https://www.booktraverse.com/",
    title:
      "Traverse Hospitality — Colorado's Locally Managed Vacation Rentals",
    description:
      "189+ vacation rentals across 6 Colorado mountain markets. Ski-in condos, cabins, historic homes. Book direct and save 15%.",
    images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
  },
};

/* ────────── JSON-LD Schema ────────── */
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Traverse Hospitality",
  alternateName: ["Book Traverse", "High Rocky Homes"],
  url: "https://www.booktraverse.com",
  // Logo + image populate the brand mark in Google Knowledge Panel results
  // (and clear the "Missing field 'image' (optional)" warning in Rich Results
  // Test). Both point to the same brand asset on the canonical domain.
  logo: "https://www.booktraverse.com/book-traverse-logo.png",
  image: "https://www.booktraverse.com/book-traverse-logo.png",
  description:
    "Colorado's locally managed vacation rental company. 189+ properties across Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes.",
  foundingDate: "2016",
  address: [
    {
      "@type": "PostalAddress",
      streetAddress: "115 W 6th St",
      addressLocality: "Leadville",
      addressRegion: "CO",
      postalCode: "80461",
      addressCountry: "US",
    },
    {
      "@type": "PostalAddress",
      streetAddress: "11 Snowmass Road",
      addressLocality: "Mount Crested Butte",
      addressRegion: "CO",
      postalCode: "81225",
      addressCountry: "US",
    },
  ],
  telephone: ["+1-720-759-2013", "+1-970-438-2241", "+1-970-533-3583"],
};

/* ────────── Five Stars SVG ────────── */
function FiveStars() {
  return (
    <svg viewBox="0 0 120 20" width="100" height="16" aria-hidden="true">
      {[0, 24, 48, 72, 96].map((x) => (
        <polygon
          key={x}
          fill="var(--star)"
          points={`${x + 10},1 ${x + 12.5},7 ${x + 19},7.5 ${x + 14},12.5 ${x + 15.5},19 ${x + 10},15.5 ${x + 4.5},19 ${x + 6},12.5 ${x + 1},7.5 ${x + 7.5},7`}
        />
      ))}
    </svg>
  );
}

/* ────────── Market data ────────── */
const MARKETS = [
  {
    href: "/crested-butte",
    name: "Crested Butte",
    count: "70+",
    sub: "3 slope-side buildings",
    img: "/markets/crested-butte.jpg",
  },
  {
    href: "/leadville",
    name: "Leadville",
    count: "70+",
    sub: "Cabins, homes & hot tubs",
    img: "/markets/leadville.jpg",
  },
  {
    href: "/properties?city=Vail",
    name: "Vail",
    count: "",
    sub: "Near Vail Village & Lionshead",
    img: "/property-management/markets/vail.jpg",
  },
  {
    href: "/properties?city=Avon",
    name: "Avon",
    count: "",
    sub: "Near Beaver Creek Resort",
    img: "/property-management/markets/avon.jpg",
  },
  {
    href: "/properties?city=Granby",
    name: "Granby",
    count: "",
    sub: "Near Winter Park & Grand Lake",
    img: "/property-management/markets/granby.jpg",
  },
  {
    href: "/properties?city=Twin+Lakes",
    name: "Twin Lakes",
    count: "",
    sub: "At the foot of Mt Elbert",
    img: "/property-management/markets/twin-lakes.jpg",
  },
];

/* ────────── Featured properties ────────── */
const FEATURED = [
  {
    href: "/properties/68256c8c48e69c0010d11e2f",
    img: "https://assets.guesty.com/image/upload/h_600/v1756763963/production/55935b4b5d6bcf0e0084abd6/imrwi3xskefrorcofyqa.jpg",
    alt: "1BR Condo at Lodge at Mountaineer Square",
    badge: "Crested Butte",
    title: "Lodge at Mountaineer Square — 1BR",
    rating: 4.85,
    reviews: 15,
    sleeps: 4,
    bedrooms: 1,
    bathrooms: 2,
    price: "$95",
  },
  {
    href: "/properties/5bf09e709d2adc002667c5ec",
    img: "/featured/mountain-hideaway.jpg",
    alt: "Mountain Hideaway sleeps 20 in Leadville",
    badge: "Leadville",
    title: "The Mountain Hideaway — Sleeps 20",
    rating: 4.9,
    reviews: 42,
    sleeps: 20,
    bedrooms: 10,
    bathrooms: 9,
    price: "$595",
  },
  {
    href: "/properties/68772cc34b0b0000109cc6c5",
    img: "https://assets.guesty.com/image/upload/h_600/v1756514170/production/55935b4b5d6bcf0e0084abd6/cerpq3hoexjezuum0b4j.jpg",
    alt: "The Plaza 2BR with mountain views",
    badge: "Crested Butte",
    title: "The Plaza — 2BR Suite with Views",
    rating: 4.8,
    reviews: 9,
    sleeps: 6,
    bedrooms: 2,
    bathrooms: 2,
    price: "$95",
  },
  {
    href: "/properties/5f2ee35e0a0b48002c8095b6",
    img: "/featured/hilltop-suite.jpg",
    alt: "Hilltop Suite Leadville with Mt Massive views",
    badge: "Leadville · Pet Friendly",
    title: "The Hilltop Suite — Mt Massive Views",
    rating: 4.9,
    reviews: 28,
    sleeps: 4,
    bedrooms: 2,
    bathrooms: 1,
    price: "$125",
  },
];

/* Reviews now live in src/lib/google-reviews.ts (single source of truth for
   home page + property-management carousels). Refresh quarterly. */

/* ═══════════════════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <div data-no-fees-layout="hide-chrome" className={`${jakarta.variable} ${inter.variable}`}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      {/* Header */}
      <NoFeesHeader />

      {/* ================= HERO ================= */}
      <section
        className="hero"
        style={{
          backgroundImage: "url('/markets/crested-butte.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
        }}
      >
        <div className="hero-media">
          <div className="hero-overlay"></div>
        </div>
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker">
              Colorado Vacation Rentals · Book Direct
            </span>
            <h1 className="hero-title">
              Skip the front desk.
              <br />
              Book <em className="script">Traverse.</em>
            </h1>
            <p className="hero-sub">
              189+ managed rentals across 6 Colorado mountain markets — with
              locally managed comfort and <strong>save up to 15% by booking direct.</strong>
            </p>
            <div className="hero-stats">
              <div className="hero-stats-item">
                <div className="stars" aria-label="4.8 out of 5 stars">
                  <FiveStars />
                </div>
                <span>
                  <strong>4.8★</strong> average rating
                </span>
              </div>
              <div className="hero-stats-item">
                <strong>189+</strong>
                <span>properties</span>
              </div>
              <div className="hero-stats-item">
                <strong>6</strong>
                <span>mountain markets</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEARCH BAR ================= */}
      <NoFeesSearchBar />

      {/* ================= TRUST STRIP ================= */}
      <section className="trust-inline wrap">
        <div className="trust-pill">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span><strong>Save up to 15%</strong> by booking direct</span>
        </div>
        <div className="trust-pill">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span><strong>Best price</strong> guaranteed</span>
        </div>
        <div className="trust-pill">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 4 3 10 9 10" />
            <path d="M3.5 10A9 9 0 1 1 6 18.5" />
          </svg>
          <span><strong>Flexible</strong> cancellation</span>
        </div>
        <div className="trust-pill">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span><strong>24/7</strong> local support</span>
        </div>
      </section>

      {/* ================= EXPLORE OUR MARKETS ================= */}
      <section id="markets" className="section-alt">
        <div className="wrap">
          <div className="section-head centered">
            <h2>Explore Our Markets</h2>
            <p className="section-lede">
              Six Colorado mountain towns. From slope-side condos to lakeside cabins — find your basecamp.
            </p>
          </div>
          <div className="neighborhoods-grid">
            {MARKETS.map((m) => (
              <Link key={m.name} href={m.href} className="nbr-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.img} alt={m.name} loading="lazy" />
                <div className="nbr-label">
                  <strong>{m.name}</strong>
                  <span>{m.count ? `${m.count} rentals · ${m.sub}` : m.sub}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURED PROPERTIES ================= */}
      <section id="stays" className="section wrap popular-stays">
        <div className="section-head">
          <div>
            <h2>Colorado Favorites</h2>
            <p className="section-sub">
              Book direct and save — best price guaranteed.
            </p>
          </div>
          <Link href="/properties" className="section-link">
            View all 189+ stays →
          </Link>
        </div>
        <div className="stay-grid">
          {FEATURED.map((s) => (
            <Link key={s.href} href={s.href} className="stay-card">
              <div className="stay-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.alt} loading="lazy" />
                <span className="sp-badge sp-badge-favorite">
                  📍 {s.badge}
                </span>
              </div>
              <div className="stay-info">
                <h3>{s.title}</h3>
                <div className="stay-meta">
                  <span className="stay-stars">
                    ★ {s.rating} ({s.reviews})
                  </span>
                  <span>
                    {s.sleeps} guests · {s.bedrooms} bed · {s.bathrooms} bath
                  </span>
                </div>
                <div className="stay-price">
                  From <strong>{s.price}</strong>
                  <span>/night</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= TRIP PLANNER PROMO ================= */}
      <section id="plan" className="section wrap">
        <a href="/plan" target="_blank" rel="noopener" className="trip-planner-banner">
          <div className="tp-copy">
            <span className="tp-kicker">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              Free Trip Planner
            </span>
            <h3>Tell us what you love. We&apos;ll plan your Colorado trip in 2 minutes.</h3>
            <p>
              Real picks from the team managing 189+ Colorado rentals — skiing, hiking, restaurants, and a matching vacation rental, built around your dates.
            </p>
          </div>
          <div className="tp-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/home/colorado-mountain-scene.jpg"
              alt="Colorado mountain scene"
              loading="lazy"
              style={{
                borderRadius: "16px",
                marginBottom: "24px",
                border: "1px solid var(--line)",
              }}
            />
          </div>
        </a>
      </section>

      {/* ================= WHY BOOK DIRECT ================= */}
      <section id="why" className="section-why">
        <div className="wrap why-grid">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/home/managed-rental-interior.jpg"
              alt="Traverse Hospitality managed vacation rental interior"
              className="why-img"
              loading="lazy"
            />
          </div>
          <div className="why-copy">
            <span className="hero-kicker" style={{ color: "var(--muted)" }}>
              Why Book Direct
            </span>
            <h2>
              Colorado&apos;s locally managed vacation rental company.
            </h2>
            <p>
              Book Traverse isn&apos;t a platform — we&apos;re the team that manages
              the property. Local offices in Leadville and Crested Butte.
              When you call, you reach someone who lives where your rental is.
            </p>
            <ul className="why-perks">
              <li>
                <strong>No booking fees</strong> — save 10–15% vs. Airbnb and VRBO. The price you see is the price you pay
              </li>
              <li>
                <strong>Local 24/7 support</strong> — real people in Leadville (115 W 6th St) and Mt. Crested Butte (the Plaza)
              </li>
              <li>
                <strong>One simple cancellation policy</strong> — full refund up to 14 days before check-in, every property
              </li>
              <li>
                <strong>Direct relationships</strong> — talk to the team that actually manages your home
              </li>
            </ul>
            <NoFeesEmailSignup />
          </div>
        </div>
      </section>

      {/* ================= FOR PROPERTY OWNERS ================= */}
      <section className="section" style={{ background: "var(--bg-2)", padding: "80px 0" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <div>
              <span className="hero-kicker" style={{ color: "var(--muted)", marginBottom: "16px", display: "block" }}>
                For Property Owners
              </span>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 42px)", marginBottom: "20px", lineHeight: "1.15" }}>
                Your property, professionally managed.
              </h2>
              <p style={{ fontSize: "16px", lineHeight: "1.7", color: "var(--muted)", marginBottom: "16px" }}>
                Traverse handles everything — guest communication, dynamic pricing,
                professional photography, cleaning, maintenance coordination, and owner
                reporting. You earn rental income without the operational overhead.
              </p>
              <p style={{ fontSize: "16px", lineHeight: "1.7", color: "var(--muted)", marginBottom: "28px" }}>
                Our offices are in Leadville and Crested Butte. We&apos;re not managing
                your property from Denver — we&apos;re down the street.
              </p>
              <Link
                href="/property-management"
                className="btn btn-primary"
                style={{ display: "inline-block" }}
              >
                Learn About Property Management →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ padding: "28px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)" }}>
                <strong style={{ fontSize: "36px", fontWeight: 800, display: "block", marginBottom: "4px" }}>189+</strong>
                <span style={{ fontSize: "13px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Managed properties
                </span>
              </div>
              <div style={{ padding: "28px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)" }}>
                <strong style={{ fontSize: "36px", fontWeight: 800, display: "block", marginBottom: "4px" }}>6</strong>
                <span style={{ fontSize: "13px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Colorado markets
                </span>
              </div>
              <div style={{ padding: "28px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)" }}>
                <strong style={{ fontSize: "36px", fontWeight: 800, display: "block", marginBottom: "4px" }}>4.8★</strong>
                <span style={{ fontSize: "13px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Guest rating
                </span>
              </div>
              <div style={{ padding: "28px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)" }}>
                <strong style={{ fontSize: "36px", fontWeight: 800, display: "block", marginBottom: "4px" }}>2</strong>
                <span style={{ fontSize: "13px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Local offices
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= REVIEWS ================= */}
      <GoogleReviewsCarousel
        heading="What guests & owners say"
        subhead="4.8 stars from thousands of stays across Colorado."
      />

      {/* ================= GUIDES / BLOG ================= */}
      <section className="section-alt" style={{ padding: "80px 0" }}>
        <div className="wrap">
          <div className="section-head centered">
            <h2>Guides & Resources</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginTop: "40px" }}>
            <Link
              href="/crested-butte/guides/where-to-stay"
              style={{
                display: "block",
                padding: "32px 28px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s",
              }}
            >
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", fontWeight: 600 }}>
                Lodging Guide
              </span>
              <h3 style={{ fontSize: "20px", marginTop: "8px", marginBottom: "8px" }}>
                Where to Stay in Crested Butte
              </h3>
              <p style={{ fontSize: "14px", color: "var(--muted)" }}>
                An honest comparison of slope-side lodging options — including properties we don&apos;t manage.
              </p>
            </Link>
            <Link
              href="/crested-butte"
              style={{
                display: "block",
                padding: "32px 28px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s",
              }}
            >
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", fontWeight: 600 }}>
                Market Hub
              </span>
              <h3 style={{ fontSize: "20px", marginTop: "8px", marginBottom: "8px" }}>
                Crested Butte Vacation Rentals
              </h3>
              <p style={{ fontSize: "14px", color: "var(--muted)" }}>
                Browse slope-side condos at the Grand Lodge, Lodge at Mountaineer Square, and the Plaza.
              </p>
            </Link>
            <Link
              href="/leadville"
              style={{
                display: "block",
                padding: "32px 28px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s",
              }}
            >
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", fontWeight: 600 }}>
                Market Hub
              </span>
              <h3 style={{ fontSize: "20px", marginTop: "8px", marginBottom: "8px" }}>
                Leadville Vacation Rentals
              </h3>
              <p style={{ fontSize: "14px", color: "var(--muted)" }}>
                70+ cabins, historic homes, and hot tub rentals in America&apos;s highest city.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section
        className="section"
        style={{
          background: "var(--forest)",
          color: "#fff",
          padding: "100px 0",
          textAlign: "center",
        }}
      >
        <div className="wrap">
          <h2 style={{ fontSize: "clamp(30px, 5vw, 52px)", color: "#fff", marginBottom: "18px" }}>
            Find your Colorado rental.
          </h2>
          <p style={{ fontSize: "18px", maxWidth: "55ch", margin: "0 auto 36px", opacity: 0.6 }}>
            189+ locally managed properties across 6 mountain markets. Book direct and save up to 15%.
          </p>
          <Link href="/properties" className="btn btn-primary" style={{ display: "inline-block" }}>
            Search Available Dates
          </Link>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer style={{ background: "var(--ink-2)", color: "rgba(255,255,255,0.6)", padding: "64px 0 32px", fontSize: "14px" }}>
        <div className="wrap" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "48px", marginBottom: "48px" }}>
            <div>
              <strong style={{ color: "#fff", fontSize: "18px", display: "block", marginBottom: "12px" }}>
                Traverse Hospitality
              </strong>
              <p style={{ lineHeight: "1.7", maxWidth: "300px" }}>
                Colorado&apos;s locally managed vacation rental company. Offices in Leadville and Crested Butte.
              </p>
              <div style={{ marginTop: "16px" }}>
                <div>Leadville: <a href="tel:+17207592013" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>(720) 759-2013</a></div>
                <div>Crested Butte: <a href="tel:+19704382241" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>(970) 438-2241</a></div>
              </div>
            </div>
            <div>
              <strong style={{ color: "#fff", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "12px" }}>
                Guests
              </strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link href="/properties" style={{ color: "inherit", textDecoration: "none" }}>All Rentals</Link>
                <Link href="/crested-butte" style={{ color: "inherit", textDecoration: "none" }}>Crested Butte</Link>
                <Link href="/leadville" style={{ color: "inherit", textDecoration: "none" }}>Leadville</Link>
                <Link href="/crested-butte/guides/where-to-stay" style={{ color: "inherit", textDecoration: "none" }}>Where to Stay Guide</Link>
              </div>
            </div>
            <div>
              <strong style={{ color: "#fff", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "12px" }}>
                Owners
              </strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link href="/property-management" style={{ color: "inherit", textDecoration: "none" }}>Property Management</Link>
                <a href="https://dashboard.traversehospitality.com" style={{ color: "inherit", textDecoration: "none" }}>Owner Portal</a>
              </div>
            </div>
            <div>
              <strong style={{ color: "#fff", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "12px" }}>
                Company
              </strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link href="/about" style={{ color: "inherit", textDecoration: "none" }}>About Us</Link>
                <Link href="/contact" style={{ color: "inherit", textDecoration: "none" }}>Contact</Link>
                <Link href="/reviews" style={{ color: "inherit", textDecoration: "none" }}>Reviews</Link>
                <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</Link>
                <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</Link>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px", textAlign: "center", fontSize: "13px", opacity: 0.5 }}>
            © 2026 Traverse Hospitality · Locally managed in Leadville & Crested Butte, CO
          </div>
        </div>
      </footer>
    </div>
  );
}
