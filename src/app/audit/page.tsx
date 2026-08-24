import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Camera, FileText, ShieldCheck, Star, TrendingUp, ClipboardList, MessageSquareQuote } from "lucide-react";
import { AuditLeadForm } from "@/components/audit/audit-lead-form";
import "./audit.css";

const B2B_PHONE = { tel: "+19705333583", display: "(970) 533-3583" };

export const metadata: Metadata = {
  title: "Free Colorado Listing Audit",
  description:
    "A free, expert audit of your Colorado short-term rental listing — title, photos, review themes and trust signals, with the highest-impact fixes first.",
  alternates: { canonical: "https://audit.booktraverse.com" },
  openGraph: {
    title: "Free Colorado Listing Audit | Traverse Hospitality",
    description:
      "See what's quietly costing your mountain rental bookings. A free listing audit from the team managing 200+ Colorado homes.",
    url: "https://audit.booktraverse.com",
  },
};

const leaks = [
  {
    icon: Camera,
    label: "Photos",
    body: "Your best shot isn't first. Guests decide in the gallery thumbnail, not on photo 14.",
  },
  {
    icon: FileText,
    label: "Description",
    body: "It reads like every other mountain condo. Nothing tells a guest why this one, this weekend.",
  },
  {
    icon: ShieldCheck,
    label: "Trust signals",
    body: "Nothing shows there's a local team 20 minutes away when the hot tub stops working at 9pm.",
  },
];

const steps = [
  {
    n: 1,
    title: "Paste your listing",
    body: "Airbnb, Vrbo or Booking.com — whichever link you have handy.",
  },
  {
    n: 2,
    title: "We read it like a guest",
    body: "A real person on our Colorado team goes through it the way a booking guest would, then the way a manager would.",
  },
  {
    n: 3,
    title: "You get the write-up",
    body: "A written audit in your inbox within one business day, biggest opportunities first.",
  },
];

const deliverables = [
  {
    icon: Star,
    title: "Where you stand",
    body: "A category-by-category read on title, photos, description, amenities, house rules and trust signals — what's working and what a guest skims past.",
  },
  {
    icon: ClipboardList,
    title: "The fixes, in order",
    body: "Ranked by impact, not by how easy they are for us to write. The first three are usually worth more than the next thirty.",
  },
  {
    icon: MessageSquareQuote,
    title: "What your reviews keep saying",
    body: "Recurring themes pulled out of your guest reviews, so operational problems stop hiding in five-star ratings.",
  },
];

const markets = [
  { name: "Crested Butte", image: "/markets/crested-butte.jpg" },
  { name: "Leadville", image: "/markets/leadville.jpg" },
  { name: "Vail", image: "/property-management/markets/vail.jpg" },
  { name: "Avon", image: "/markets/avon.jpg" },
  { name: "Granby", image: "/property-management/markets/granby.jpg" },
  { name: "Twin Lakes", image: "/property-management/markets/twin-lakes.jpg" },
];

/** Mock rows for the report preview — illustrative, not a real audit. */
const previewFixes = [
  { sev: "high", label: "Move the deck-at-sunset shot to photo 1", tag: "Photos" },
  { sev: "high", label: "Title doesn't mention ski-in access", tag: "Title" },
  { sev: "med", label: "First 200 characters read as boilerplate", tag: "Description" },
  { sev: "med", label: "No mention of a local team in the listing", tag: "Trust" },
  { sev: "low", label: "Hot tub not tagged as an amenity", tag: "Amenities" },
];

const faqs = [
  {
    q: "Is it actually free?",
    a: "Yes. No card, no commitment, and you don't have to be considering a management change to ask for one.",
  },
  {
    q: "How long does it take?",
    a: "A written audit lands in your inbox within one business day. A person reads your listing — this isn't an automated score.",
  },
  {
    q: "What do you need from me?",
    a: "Your listing link, your name and an email address. The property zip code helps us judge it against the right market.",
  },
  {
    q: "Will I get a sales pitch?",
    a: "No. The audit is the audit. If you want to talk about management afterwards there's a phone number at the bottom, and that's entirely your call.",
  },
  {
    q: "Do you only audit Colorado listings?",
    a: "We're most useful on Colorado mountain markets — Crested Butte, Leadville, Vail, Avon, Granby and Twin Lakes — because that's where we operate and where we know the comps. Send anything; we'll tell you if we're not the right read.",
  },
];

export default function ListingAuditPage() {
  return (
    <div className="audit-page">
      {/* ── Nav ── */}
      <header className="audit-nav">
        <a href="#top" className="audit-nav-brand" aria-label="Traverse Hospitality listing audit">
          <Image
            src="/book-traverse-wordmark-dark.png"
            alt="Traverse Hospitality"
            width={168}
            height={30}
            priority
          />
        </a>
        <nav className="audit-nav-links">
          <a href="#how">How it works</a>
          <a href="#what-you-get">What you get</a>
          <a href="#faq">FAQ</a>
          <a href="#audit" className="audit-nav-cta">
            Get my free audit
          </a>
        </nav>
      </header>

      {/* ── Hero — photographic, dark. The page was previously white-on-white
           top to bottom; the porch view gives it a subject and instant
           contrast, and the form card reads as the one thing to do. ── */}
      <section className="audit-hero" id="top">
        <Image
          src="/property-management/hero-porch-view.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="audit-hero-img"
        />
        <div className="audit-hero-scrim" />
        <div className="audit-shell audit-hero-inner">
          <div className="audit-hero-copy">
            <p className="audit-eyebrow">Free listing audit</p>
            <h1>Your listing is losing bookings in the first three seconds.</h1>
            <p className="audit-lede">
              Most Colorado owners are one photo order and three sentences away
              from a materially better booking rate. Paste your listing and
              we&apos;ll tell you exactly where it&apos;s leaking — free, from
              the team that manages 200+ mountain homes.
            </p>
            <ul className="audit-trust">
              <li>
                <strong>200+</strong> homes managed
              </li>
              <li>
                <strong>80,000+</strong> guests since 2016
              </li>
              <li>
                <strong>4.8</strong> guest rating
              </li>
              <li>
                <strong>6</strong> mountain markets
              </li>
            </ul>
          </div>

          <div className="audit-formcard" id="audit">
            <p className="audit-formcard-title">Start your free audit</p>
            <AuditLeadForm id="audit-hero" source="hero" />
            <p className="audit-formnote">
              Written by a person, back within one business day. No card, no
              commitment.
            </p>
          </div>
        </div>
      </section>

      {/* ── Market strip — proves the "local" claim visually ── */}
      <section className="audit-markets" aria-label="Markets we operate in">
        <div className="audit-shell">
          <p className="audit-markets-label">
            Boots on the ground in six Colorado mountain markets
          </p>
          <ul className="audit-markets-row">
            {markets.map((m) => (
              <li key={m.name}>
                <Image src={m.image} alt="" width={200} height={130} />
                <span>{m.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The leaks ── */}
      <section className="audit-band">
        <div className="audit-shell">
          <h2>Three things we find on almost every listing</h2>
          <p className="audit-sub">
            None of them are obvious from inside your own listing. All of them
            are visible to a guest in the first few seconds.
          </p>
          <div className="audit-leaks">
            {leaks.map(({ icon: Icon, label, body }) => (
              <div className="audit-leak" key={label}>
                <Icon className="audit-leak-icon" aria-hidden="true" />
                <h3>{label}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="audit-band audit-band-alt" id="how">
        <div className="audit-shell">
          <h2>How it works</h2>
          <p className="audit-sub">
            Three steps, and only the first one is yours.
          </p>
          <ol className="audit-steps">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="audit-step-n">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Mid CTA ── */}
      <section className="audit-midcta">
        <div className="audit-shell audit-midcta-inner">
          <div>
            <h2>Want the honest read?</h2>
            <p>
              Paste your listing link. We&apos;ll do the rest.
            </p>
          </div>
          <AuditLeadForm id="audit-mid" source="mid" compact />
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="audit-band" id="what-you-get">
        <div className="audit-shell">
          <h2>What lands in your inbox</h2>
          <p className="audit-sub">
            Written for someone who owns one property, not a portfolio manager
            with a spreadsheet.
          </p>
          <div className="audit-getgrid">
            <div className="audit-deliverables">
              {deliverables.map(({ icon: Icon, title, body }) => (
                <div className="audit-deliverable" key={title}>
                  <Icon className="audit-deliv-icon" aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>

            {/* Illustrative preview of the write-up. Sample content, clearly
                labelled — the numbers are not from a real property. */}
            <figure className="audit-preview" aria-labelledby="preview-cap">
              <div className="audit-preview-card">
                <div className="audit-preview-head">
                  <span className="audit-preview-dot" />
                  <span className="audit-preview-dot" />
                  <span className="audit-preview-dot" />
                  <span className="audit-preview-file">
                    listing-audit.pdf
                  </span>
                </div>
                <div className="audit-preview-body">
                  <div className="audit-preview-score">
                    <div className="audit-preview-ring">
                      <span>68</span>
                      <small>/100</small>
                    </div>
                    <div>
                      <strong>Overall listing score</strong>
                      <p>Strong property, under-sold above the fold.</p>
                    </div>
                  </div>
                  <ul className="audit-preview-list">
                    {previewFixes.map((f) => (
                      <li key={f.label}>
                        <span className={`audit-sev audit-sev-${f.sev}`} />
                        <span className="audit-preview-fix">{f.label}</span>
                        <span className="audit-preview-tag">{f.tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <figcaption id="preview-cap">
                Sample layout. Your report is written for your property.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── Why we do this ── */}
      <section className="audit-band audit-band-alt" id="why">
        <div className="audit-shell audit-why">
          <div className="audit-why-mark">
            <TrendingUp aria-hidden="true" />
          </div>
          <div>
            <h2>Why we give this away</h2>
            <p>
              We manage 200+ homes across six
              Colorado mountain markets, and we see the same handful of fixable
              problems on listing after listing — good properties underperforming
              for reasons the owner can&apos;t see from the inside.
            </p>
            <p>
              Most owners never get a straight answer about their own listing.
              We&apos;d rather give you one and let you do whatever you want with
              it. If you fix it yourself, genuinely good. If you&apos;d rather
              hand it to a local team, you know where we are.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="audit-band" id="faq">
        <div className="audit-shell audit-faqwrap">
          <h2>Questions</h2>
          <dl className="audit-faq">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="audit-final">
        <div className="audit-shell">
          <h2>Find out what your listing is costing you.</h2>
          <p>Free, written by a person, back within one business day.</p>
          <div className="audit-formcard audit-formcard-dark">
            <AuditLeadForm id="audit-bottom" source="footer" />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="audit-footer">
        <div className="audit-shell audit-footer-inner">
          <Image
            src="/book-traverse-wordmark-white.png"
            alt="Traverse Hospitality"
            width={150}
            height={27}
          />
          <div className="audit-footer-links">
            <Link href="https://www.booktraverse.com/property-management">
              Property management
            </Link>
            <Link href="https://www.booktraverse.com">Book a stay</Link>
            <Link href="https://www.booktraverse.com/privacy">Privacy</Link>
            <a href={`tel:${B2B_PHONE.tel}`}>{B2B_PHONE.display}</a>
          </div>
          <p className="audit-footer-fine">
            © {new Date().getFullYear()} Traverse Hospitality · Colorado short-term
            rental management · Crested Butte · Leadville · Vail · Avon · Granby ·
            Twin Lakes
          </p>
        </div>
      </footer>
    </div>
  );
}
