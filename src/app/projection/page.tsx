import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  Award,
  FileStack,
  Building2,
  LineChart,
  ListChecks,
  ScrollText,
} from "lucide-react";
import { ProjectionLeadForm } from "@/components/projection/projection-lead-form";
// Shared with audit.booktraverse.com on purpose: the layout primitives
// (shell, band, hero, form card, FAQ) are the same landing-page system in the
// same brand, and forking 900 lines of CSS to rename `audit-` to `proj-` would
// mean every future design fix had to be made twice. projection.css below adds
// only what this page has and the audit page doesn't.
import "../audit/audit.css";
import "./projection.css";

const B2B_PHONE = { tel: "+19705333583", display: "(970) 533-3583" };

/**
 * Unit counts are the real, current figures from the listings mirror
 * (2026-08-26), not the rounded ones in CLAUDE.md. They are the single most
 * persuasive fact on this page — the comp comes from the same hallway, not
 * from "comparable properties in the area" — so they need to stay true.
 * Re-check with the listings table before editing.
 */
const OUR_UNITS = { grandLodge: 52, mountaineerSquare: 16, plaza: 20 };
const BASE_AREA_TOTAL =
  OUR_UNITS.grandLodge + OUR_UNITS.mountaineerSquare + OUR_UNITS.plaza;

export const metadata: Metadata = {
  title: "What Should Your Crested Butte Condo Be Earning?",
  description:
    "A free, sourced revenue projection for Mt. Crested Butte condo owners — built from what comparable units in your own building actually earned over the last twelve months.",
  alternates: { canonical: "https://projection.booktraverse.com" },
  openGraph: {
    title:
      "What Should Your Crested Butte Condo Be Earning? | Traverse Hospitality",
    description: `We manage ${BASE_AREA_TOTAL} condos at the Mt. Crested Butte base. Find out what units like yours actually earned last year.`,
    url: "https://projection.booktraverse.com",
  },
};

/**
 * Whose listing is it. NOT whether the unit is distributed — it is, and the
 * first version of this page wrongly claimed otherwise. Resort programs push
 * inventory to Airbnb and Vrbo through distribution partners (RedAwning,
 * LeaveTown and similar) and sit on Booking.com directly, so "your condo isn't
 * on Airbnb" is false and trivially disproved by a screenshot. The real gap is
 * ownership: the listing, the reviews and the ranking live in somebody else's
 * account.
 */
const channels = [
  {
    name: "Airbnb",
    role: "Usually via a distribution partner",
    owned: false,
    state: "Listed under their account",
  },
  {
    name: "Vrbo",
    role: "Usually via a distribution partner",
    owned: false,
    state: "Listed under their account",
  },
  {
    name: "Booking.com",
    role: "Usually the resort's own account",
    owned: false,
    state: "Listed under their account",
  },
  {
    name: "A listing that is yours",
    role: "With your reviews, your ranking, your history",
    owned: true,
    state: "Doesn't exist yet",
  },
];

const costs = [
  {
    icon: Star,
    title: "The reviews are real. They just aren't yours.",
    body: "Every review that listing earns attaches to the account that holds it, not to your condo. Change managers and none of it follows you — not the review count, not the rating, not the search ranking those reviews bought. You could have five years of five-star stays behind you and still start from nothing the day you leave.",
  },
  {
    icon: Award,
    title: "You cannot earn Superhost or Guest Favourite",
    body: "Both are awarded to the host account, not the property. When your unit sits inside a portfolio of thousands, those badges are decided by that portfolio's overall response rate, cancellations and ratings — nothing you do to your own condo moves them, and you never get the search boost they carry.",
  },
  {
    icon: FileStack,
    title: "Your listing was written by a feed",
    body: "Aggregator listings are generated from a data export: a templated title, a generic description, whatever photos the feed happens to carry, and no mention of a local team. It is the same page as a thousand other units with the address swapped. That is precisely what stops a browser turning into a booking.",
  },
];

const steps = [
  {
    n: 1,
    title: "Tell us the building and unit size",
    body: "That is all we need to find the right comparison — no listing link required, which is rather the point.",
  },
  {
    n: 2,
    title: "We pull the actuals",
    body: `We manage ${BASE_AREA_TOTAL} condos across the base area. We look at what units of your size in your building genuinely took over the last twelve months, across every channel.`,
  },
  {
    n: 3,
    title: "You get the figures and the workings",
    body: "A range, not a single flattering number, with the comps and the assumptions written out so you can check them yourself.",
  },
];

const deliverables = [
  {
    icon: LineChart,
    title: "What comparable units actually earned",
    body: "Trailing twelve months for units of your size in your building — gross revenue, occupancy and average nightly rate. Real figures from real bookings, not a model.",
  },
  {
    icon: ListChecks,
    title: "Where the difference comes from",
    body: "Broken down by channel and by season, so you can see which months and which platforms account for the gap rather than taking a headline number on trust.",
  },
  {
    icon: ScrollText,
    title: "The assumptions, in writing",
    body: "Which units we compared you against, what we could not know about yours, and where the estimate is weakest. If the honest answer is that you're already doing well, that is what it will say.",
  },
];

const faqs = [
  {
    q: "My manager says we ARE on Airbnb and Vrbo. Are you saying that's untrue?",
    a: "No \u2014 it's true, and we should be straight about that. Resort programs reach Airbnb and Vrbo through distribution partners, and sit on Booking.com directly, so the nights really are being sold there. The point isn't that your condo is invisible. It's that the listing doing the selling belongs to that partner's account, along with every review it has earned and the search ranking those reviews bought. Ask for the link and look at whose name is on it. Distribution fills your calendar this year; a listing of your own is the thing you still have in five years.",
  },
  {
    q: "Is this a real number or a sales figure?",
    a: "It is built from what units of your size in your building actually took over the last twelve months, and we show you the comps and assumptions behind it. It is an estimate and it is labelled as one — your unit's finish, floor, view and calendar all move the figure, and we cannot see those from outside. We would rather send you a defensible range than an impressive number you later find out was invented.",
  },
  {
    q: "Am I not locked into my current agreement?",
    a: "Very possibly, and that is fine — knowing the number does not commit you to anything. Most owners who ask for this are simply working out whether to renew when their current term is up. Nothing here asks you to break an agreement.",
  },
  {
    q: "What if my condo is already doing well?",
    a: "Then we will tell you that. It happens, and saying so is the only reason this is worth anything to you. We would rather be the people who gave you a straight answer than the people who talked you into a switch you didn't need.",
  },
  {
    q: "Do I have to leave my current manager to get this?",
    a: "No. There is no cost, no card and no commitment. If you want to talk afterwards there is a phone number at the bottom of this page, and that is entirely your call.",
  },
  {
    q: "Why do you know my building?",
    a: `Because we are in it. We manage ${OUR_UNITS.grandLodge} units at The Grand Lodge, ${OUR_UNITS.mountaineerSquare} at The Lodge at Mountaineer Square and ${OUR_UNITS.plaza} at The Plaza — same buildings, same floorplans, same lifts, same weather. That is why the comparison means something, and why we can do it in a day.`,
  },
  {
    q: "What do you do with my details?",
    a: "We send you the projection and follow up once. We do not sell your details, add you to a list or pass them to anyone else.",
  },
];

export default function ProjectionPage() {
  return (
    <div className="audit-page proj-page">
      {/* ── Nav ── */}
      <header className="audit-nav">
        <a
          href="#top"
          className="audit-nav-brand"
          aria-label="Traverse Hospitality revenue projection"
        >
          <Image
            src="/book-traverse-wordmark-dark.png"
            alt="Traverse Hospitality"
            width={168}
            height={30}
            priority
          />
        </a>
        <nav className="audit-nav-links">
          <a href="#cost">What it costs</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a href="#projection" className="audit-nav-cta">
            Get my projection
          </a>
        </nav>
      </header>

      {/* ── Hero ──
           The headline is an instruction rather than a claim on purpose. An
           owner can verify it in ten seconds, which makes it land harder than
           anything we could assert about ourselves, and it cannot be dismissed
           as a sales pitch. */}
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
            <p className="audit-eyebrow">Free revenue projection</p>
            <h1>Your condo is on Airbnb. The listing isn&apos;t yours.</h1>
            <p className="audit-lede">
              Resort programs reach the big platforms through a distribution
              partner, so the listing, the reviews and the search ranking all
              sit in somebody else&apos;s account. Five years of five-star
              stays, and none of it follows you out the door. We manage{" "}
              {BASE_AREA_TOTAL}{" "}
              condos at this base area — tell us your building and we&apos;ll
              show you what units like yours actually earned last year.
            </p>
            <ul className="audit-trust">
              <li>
                <strong>{BASE_AREA_TOTAL}</strong> condos at the base
              </li>
              <li>
                <strong>200+</strong> homes managed
              </li>
              <li>
                <strong>4.8</strong> guest rating
              </li>
              <li>
                <strong>1</strong> business day
              </li>
            </ul>
          </div>

          <div className="audit-formcard" id="projection">
            <p className="audit-formcard-title">
              What should your condo be earning?
            </p>
            <ProjectionLeadForm id="projection-hero" source="hero" />
            <p className="audit-formnote">
              Free, sourced from real bookings, back within one business day.
              No card, no commitment.
            </p>
          </div>
        </div>
      </section>

      {/* ── The self-check ──
           Self-administered proof. Costs nothing, takes ten seconds, and an
           owner who does it has convinced themselves rather than been told. */}
      <section className="proj-check" aria-labelledby="check-h">
        <div className="audit-shell">
          <h2 id="check-h">Don&apos;t take our word for it. Ask one question.</h2>
          <ol className="proj-check-steps">
            <li>
              <span className="proj-check-n">1</span>
              <p>
                Ask your manager for <strong>the Airbnb link to your condo</strong>
                {" "}
                — not the resort&apos;s booking page. The Airbnb listing, with
                reviews on it.
              </p>
            </li>
            <li>
              <span className="proj-check-n">2</span>
              <p>
                When it arrives, look at <strong>whose name is on it</strong>.
                Scroll to the host and see how many other properties that
                account holds.
              </p>
            </li>
            <li>
              <span className="proj-check-n">3</span>
              <p>
                Every review on that page belongs to <strong>that account</strong>.
                {" "}
                If you move your condo tomorrow, none of it comes with you.
              </p>
            </li>
          </ol>
          <p className="proj-check-foot">
            That is the whole difference between being distributed and being
            established. One fills nights this year. The other is an asset you
            keep.
          </p>
        </div>
      </section>

      {/* ── What it actually costs ── */}
      <section className="audit-band" id="cost">
        <div className="audit-shell">
          <h2>What renting someone else&apos;s listing costs you</h2>
          <p className="audit-sub">
            None of this is about how good your condo is. It is about what you
            are building — and who gets to keep it.
          </p>
          <div className="proj-costs">
            {costs.map(({ icon: Icon, title, body }) => (
              <div className="proj-cost" key={title}>
                <Icon className="audit-leak-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Whose listing is it ── */}
      <section className="audit-band audit-band-alt">
        <div className="audit-shell">
          <h2>Whose listing is it?</h2>
          <p className="audit-sub">
            Your condo probably does appear on all of these. The question is
            who the listing actually belongs to.
          </p>
          <ul className="proj-channels">
            {channels.map((c) => (
              <li
                key={c.name}
                className={c.owned ? "proj-ch-gap" : "proj-ch-no"}
              >
                <span className="proj-ch-mark" aria-hidden="true">
                  {c.owned ? "—" : "✕"}
                </span>
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.role}</span>
                </div>
                <span className="proj-ch-state">{c.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Same building ── */}
      <section className="proj-building">
        <div className="audit-shell proj-building-inner">
          <div className="proj-building-mark">
            <Building2 aria-hidden="true" />
          </div>
          <div>
            <h2>We manage {BASE_AREA_TOTAL} condos in these buildings</h2>
            <p>
              {OUR_UNITS.grandLodge} at The Grand Lodge,{" "}
              {OUR_UNITS.mountaineerSquare} at The Lodge at Mountaineer Square
              and {OUR_UNITS.plaza} at The Plaza. Same floorplans, same lifts,
              same shoulder seasons, same weather.
            </p>
            <p>
              That is why this is worth reading. It isn&apos;t a model or a
              national average or &ldquo;comparable properties in the
              area&rdquo; — it is what the units down your own hallway took last
              year.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="audit-band" id="how">
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
            <h2>Find out what the gap is worth</h2>
            <p>Your building and your unit size. That&apos;s the whole ask.</p>
          </div>
          <ProjectionLeadForm id="projection-mid" source="mid" compact />
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="audit-band audit-band-alt" id="what-you-get">
        <div className="audit-shell">
          <h2>What lands in your inbox</h2>
          <p className="audit-sub">
            Written for someone who owns one condo, not a portfolio manager with
            a spreadsheet.
          </p>
          <div className="proj-costs">
            {deliverables.map(({ icon: Icon, title, body }) => (
              <div className="proj-cost" key={title}>
                <Icon className="audit-deliv-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <p className="proj-disclaimer">
            Every figure we send is an estimate based on comparable units, not a
            guarantee of what your condo will earn. Your unit&apos;s condition,
            floor, view, calendar and pricing all move the number, and we say so
            in the write-up.
          </p>
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
          <h2>Find out what your condo should be earning.</h2>
          <p>
            Free, sourced from real bookings in your building, back within one
            business day.
          </p>
          <div className="audit-formcard audit-formcard-dark">
            <ProjectionLeadForm id="projection-bottom" source="footer" />
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
            <Link href="https://audit.booktraverse.com">Free listing audit</Link>
            <Link href="https://www.booktraverse.com/privacy">Privacy</Link>
            <a href={`tel:${B2B_PHONE.tel}`}>{B2B_PHONE.display}</a>
          </div>
          <p className="audit-footer-fine">
            © {new Date().getFullYear()} Traverse Hospitality · Colorado
            short-term rental management · Crested Butte · Leadville · Vail ·
            Avon · Granby · Twin Lakes. Projections are estimates based on
            comparable units and are not a guarantee of future earnings.
            Traverse Hospitality is not affiliated with Crested Butte Mountain
            Resort or Vail Resorts.
          </p>
        </div>
      </footer>
    </div>
  );
}
