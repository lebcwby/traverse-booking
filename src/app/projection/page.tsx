import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  TrendingUp,
  MessageCircle,
  ClipboardCheck,
  Receipt,
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
 * (2026-08-26). "We manage 88 condos in your building" is the page's core
 * credibility claim, so re-check the listings table before editing.
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
    description: `We manage ${BASE_AREA_TOTAL} condos at the Mt. Crested Butte base. See what a peak week actually nets you.`,
    url: "https://projection.booktraverse.com",
  },
};

/**
 * ⚠️ ILLUSTRATIVE FIGURES — REPLACE BEFORE PROMOTING THIS PAGE ⚠️
 *
 * This is comparative advertising aimed at an identifiable competitor, so
 * every number has to be one we can stand behind:
 *
 *  · The TRAVERSE column is a commitment to a prospective client. Nobody
 *    should invent our commission rate — it has to come from the real fee
 *    schedule, signed off by Alex or Nadim.
 *  · The OTHER column describes a competitor's economics. Only state what we
 *    can evidence. The honest source is "statements owners have shown us",
 *    which is how the page frames it.
 *  · Never publish one real owner's statement without their written
 *    permission — they may owe their manager confidentiality.
 *
 * The label under the table says these are illustrative. It stays until the
 * numbers are real.
 */
const PEAK_WEEK = {
  label: "Presidents' Week · 2 bedroom · 7 nights",
  /** Same stay in both columns, so only the line items can explain a gap. */
  rows: [
    {
      line: "Guest pays for the stay",
      other: 4375,
      ours: 4795,
      note: "Wider distribution and pricing that moves lift the top line before anyone takes a cut",
      emphasis: false,
    },
    {
      line: "Management commission",
      other: -1750,
      ours: -959,
      note: "Resort programs commonly sit around 40%",
      emphasis: false,
    },
    {
      line: "Resort / admin fee kept by the manager",
      other: -306,
      ours: 0,
      note: "Charged to the guest, retained by the manager, and rarely itemised where the owner can see it",
      emphasis: true,
    },
    {
      line: "Cleaning",
      other: -75,
      ours: 0,
      note: "Billed to the guest and passed through at cost, so it should never reach your side of the statement",
      emphasis: false,
    },
  ],
  totals: { other: 2244, ours: 3836 },
};

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US")}`;

/** Why the bottom lines differ — what we actually do, not what they don't. */
const reasons = [
  {
    icon: TrendingUp,
    title: "Wider distribution, and pricing that moves",
    body: "More places selling the unit, and rates that respond to how the mountain is actually booking rather than sitting where they were set in October. That lifts the top line before a single fee is deducted — the one part of a statement that helps every line below it.",
  },
  {
    icon: MessageCircle,
    title: "Someone answers at eleven at night",
    body: "Guest messaging is covered around the clock, near enough. An unanswered question at 9pm on a Friday is how an enquiry becomes a booking somewhere else, and how a fine stay becomes a three-star review that costs you the next six.",
  },
  {
    icon: ClipboardCheck,
    title: "Every clean is inspected, not spot-checked",
    body: "Cleanliness is the most-cited reason for a sub-five-star review across the whole industry, and it is almost never about effort — it is hair in a drain, dust on a ceiling fan, a fridge shelf someone missed. We inspect after every turnover, because that is a process problem and processes are fixable.",
  },
  {
    icon: Receipt,
    title: "Lower commission, and no fee we invented",
    body: "A lower management rate, fees stated plainly, and no resort fee charged to your guest and quietly kept by us. If a line appears on your statement you should be able to say what it bought.",
  },
];

const steps = [
  {
    n: 1,
    title: "Tell us the building and unit size",
    body: "That is all we need to find the right comparison — no listing link required.",
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
    title: "What it would net you",
    body: "The same stays run through our fee schedule, so the comparison is about what reaches your account rather than what appears at the top of the page.",
  },
  {
    icon: ScrollText,
    title: "The assumptions, in writing",
    body: "Which units we compared you against, what we could not know about yours, and where the estimate is weakest. If the honest answer is that you're already doing well, that is what it will say.",
  },
];

const faqs = [
  {
    q: "Are those comparison numbers real?",
    a: "They are illustrative, and the page says so under the table. Their shape comes from statements owners have brought us and from our own fee schedule, but your unit, your weeks and your agreement will all differ. That is exactly why the projection is built for your building rather than pulled off a landing page — ask for it and you get your numbers instead of ours.",
  },
  {
    q: "Isn't a lower commission just less service?",
    a: "It would be if the rate were the only thing that changed. The reason we can charge less here is density: we run enough units in these buildings that the inspector is already in your building that morning and the team already covers those guests overnight. That is why we are cheaper in Crested Butte specifically, rather than everywhere.",
  },
  {
    q: "Am I not locked into my current agreement?",
    a: "Very possibly, and that is fine — knowing the number does not commit you to anything. Most owners who ask for this are simply working out whether to renew when their term is up. Nothing here asks you to break an agreement.",
  },
  {
    q: "What if my condo is already doing well?",
    a: "Then we will tell you that. It happens, and saying so is the only reason this is worth anything to you. We would rather be the people who gave you a straight answer than the people who talked you into a switch you didn't need.",
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
          <a href="#compare">The comparison</a>
          <a href="#why">Why it differs</a>
          <a href="#faq">FAQ</a>
          <a href="#projection" className="audit-nav-cta">
            Get my projection
          </a>
        </nav>
      </header>

      {/* ── Hero ──
           The argument is the bottom line, not the headline rate. An owner
           already gets a statement every month; what they have never had is a
           second one to hold it against. */}
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
            <h1>Same week. Same condo. A very different statement.</h1>
            <p className="audit-lede">
              Your statement tells you what your condo earned. It has never told
              you what it could have kept. We manage {BASE_AREA_TOTAL}{" "}
              condos at this base area — tell us your building and we&apos;ll
              show you what units like yours actually took last year, and what
              that would have netted you.
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
              Free, sourced from real bookings, back within one business day. No
              card, no commitment.
            </p>
          </div>
        </div>
      </section>

      {/* ── The comparison — the whole argument in one table ── */}
      <section className="proj-compare" id="compare">
        <div className="audit-shell">
          <h2>One peak week, run two ways</h2>
          <p className="proj-compare-sub">
            Identical stay, identical unit. Everything separating the two bottom
            lines is a line item, not the nightly rate.
          </p>
          <p className="proj-compare-stay">{PEAK_WEEK.label}</p>

          <div
            className="proj-table"
            role="table"
            aria-label="Owner statement comparison"
          >
            <div className="proj-tr proj-thead" role="row">
              <span role="columnheader">On the statement</span>
              <span role="columnheader">A typical resort program</span>
              <span role="columnheader" className="proj-ours">
                With Traverse
              </span>
            </div>

            {PEAK_WEEK.rows.map((r) => (
              <div
                className={`proj-tr${r.emphasis ? " proj-tr-flag" : ""}`}
                role="row"
                key={r.line}
              >
                <span role="cell">
                  <strong>{r.line}</strong>
                  <small>{r.note}</small>
                </span>
                <span role="cell" className="proj-num">
                  <span className="proj-collabel" aria-hidden="true">
                    Resort program
                  </span>
                  {money(r.other)}
                </span>
                <span role="cell" className="proj-num proj-ours">
                  <span className="proj-collabel" aria-hidden="true">
                    Traverse
                  </span>
                  {r.ours === 0 ? "—" : money(r.ours)}
                </span>
              </div>
            ))}

            <div className="proj-tr proj-tfoot" role="row">
              <span role="cell">
                <strong>What reaches your account</strong>
              </span>
              <span role="cell" className="proj-num">
                <span className="proj-collabel" aria-hidden="true">
                  Resort program
                </span>
                {money(PEAK_WEEK.totals.other)}
              </span>
              <span role="cell" className="proj-num proj-ours">
                <span className="proj-collabel" aria-hidden="true">
                  Traverse
                </span>
                {money(PEAK_WEEK.totals.ours)}
              </span>
            </div>
          </div>

          <p className="proj-delta">
            <strong>
              {money(PEAK_WEEK.totals.ours - PEAK_WEEK.totals.other)}
            </strong>{" "}
            more from one week. Multiply that by the peak weeks in a season.
          </p>

          <p className="proj-illustrative">
            Illustrative figures, shaped by statements owners have brought us and
            by our own fee schedule. Your unit, your weeks and your agreement
            will all differ — which is why the projection we send is built from
            your building rather than from this table.
          </p>
        </div>
      </section>

      {/* ── Self-check, pointed at the artifact they already hold ── */}
      <section className="proj-check" aria-labelledby="check-h">
        <div className="audit-shell">
          <h2 id="check-h">
            Don&apos;t take our word for it. Open your last statement.
          </h2>
          <ol className="proj-check-steps">
            <li>
              <span className="proj-check-n">1</span>
              <p>
                Find a <strong>peak week</strong> — Presidents&apos;,
                Christmas, Spring Break. Somewhere the unit was full at the top
                rate.
              </p>
            </li>
            <li>
              <span className="proj-check-n">2</span>
              <p>
                Work down it. <strong>The commission percentage</strong>, any
                resort or admin fee, and what the cleaning was billed at.
              </p>
            </li>
            <li>
              <span className="proj-check-n">3</span>
              <p>
                Now compare <strong>the top line with the bottom line</strong>.
                That gap is the part nobody sends you a second opinion on.
              </p>
            </li>
          </ol>
          <p className="proj-check-foot">
            If you can explain every line on it, you are in good shape. Most
            owners find at least one they can&apos;t.
          </p>
        </div>
      </section>

      {/* ── Why the bottom lines differ ── */}
      <section className="audit-band" id="why">
        <div className="audit-shell">
          <h2>Why the two columns differ</h2>
          <p className="audit-sub">
            Four things, and only one of them is the commission rate.
          </p>
          <div className="proj-costs proj-costs-4">
            {reasons.map(({ icon: Icon, title, body }) => (
              <div className="proj-cost" key={title}>
                <Icon className="audit-leak-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
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
              That is why the comparison is worth reading, and it is also why the
              numbers work. The inspector is already in your building that
              morning and the team already covers those guests overnight —
              density is what lets us charge less for more attention.
            </p>
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
            <h2>See your version of that table</h2>
            <p>Your building and your unit size. That&apos;s the whole ask.</p>
          </div>
          <ProjectionLeadForm id="projection-mid" source="mid" compact />
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="audit-band" id="what-you-get">
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
      <section className="audit-band audit-band-alt" id="faq">
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
            short-term rental management · Crested Butte · Leadville · Vail
            · Avon · Granby · Twin Lakes. Comparison figures are
            illustrative. Projections are estimates based on comparable units and
            are not a guarantee of future earnings. Traverse Hospitality is not
            affiliated with Crested Butte Mountain Resort or Vail Resorts.
          </p>
        </div>
      </footer>
    </div>
  );
}
