import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  TrendingUp,
  MessageCircle,
  ClipboardCheck,
  CalendarCheck,
  ShieldCheck,
  BedDouble,
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
 * ⚠️ REPLACE THE SUBTOTAL AND CLEANING FIGURE BEFORE PROMOTING THIS PAGE ⚠️
 *
 * The fee STRUCTURE below is real, supplied by Alex/Nadim 2026-08-28, and both
 * columns reconcile to the penny: guest = owner + manager + HOA + cleaner.
 *
 *   RESORT    40% management commission on the subtotal (net of OTA fees).
 *             Their cleaners are hourly and paid out of that commission, so no
 *             cleaning fee reaches the guest. A 15% "resort fee" is charged to
 *             the guest on top; $15 a night goes to the HOA and the manager
 *             retains the difference. Taxes and the association fee pass
 *             through. No OTA/processing fee on direct bookings.
 *   TRAVERSE  30% management commission on the subtotal (net of OTA fees).
 *             $15 a night is deducted from the subtotal and passed to the owner
 *             to remit to the HOA. Cleaning is charged to the guest above the
 *             subtotal and passed through at cost. Taxes and TCC pass through.
 *
 * The week is a real quoted stay (Dec 23-27, LMS 2-bedroom) and our model of
 * their fee stack reproduces its published totals to the cent, so both columns
 * are defensible as they stand.
 *
 * ⚠️ The owner gap is sensitive to length of stay. The HOA fee is per NIGHT
 * while the commission difference is a percentage, so on this four-night stay
 * the owner is $198.32 better off, where a seven-night stay at a lower nightly
 * rate came out at only $16. Re-check the arithmetic before swapping the
 * example — a longer, cheaper week makes our column look much weaker.
 *
 * ⚠️ The competitor is never named on the page: it says "resort manager". Keep
 * it that way.
 */
const PEAK_WEEK = {
  label: "Dec 23–27 · The Lodge at Mountaineer Square, 2 bedroom · 4 nights",
  /**
   * Every figure is derived from a real resort checkout for this stay:
   * $2,583.20 subtotal, $1,038.03 taxes and fees, $3,621.23 online total. Our
   * model of their fee stack reproduces both totals to the cent — 15% resort
   * fee, 3% association fee, 18.8% tax (county 6 + TOT 9.9 + state 2.9) — which
   * is what makes the left-hand column something we can stand behind. $200 is
   * the cleaning fee on all five of our 2-bedroom units in this building; it is
   * not an average with a spread hiding inside it.
   *
   * Reads top-down as deductions, so it opens on what the guest actually hands
   * over. It cannot open on the $2,583.20 stay figure: the resort fee and our
   * cleaning fee are both charged to the guest ABOVE the stay, so subtracting
   * them from it lands nowhere near the real owner nets. Every column still
   * reconciles — guest = owner + manager + HOA + cleaner.
   */
  rows: [
    {
      line: "What your guest pays for the stay",
      other: 2970.68,
      ours: 2783.2,
      note: "The same four nights in the same unit, quoted on each company's own terms, before taxes",
      kind: "line",
    },
    {
      line: "Resort fee charged to your guest",
      other: -387.48,
      ours: null,
      note: "15% of the stay. $60 of it reaches the HOA — the manager keeps the other $327.48",
      kind: "flag",
    },
    {
      line: "HOA resort fee, from your side",
      other: null,
      ours: -60,
      note: "The same $15 a night obligation. We take it out of the stay and pass it to you to remit; the resort programme funds theirs from the guest's resort fee and keeps the surplus",
      kind: "line",
    },
    {
      line: "Cleaning charged to your guest",
      other: null,
      ours: -200,
      note: "Straight to the cleaner at cost. Resort-programme cleaners are hourly and paid from the commission instead, so nothing appears here",
      kind: "line",
    },
    {
      line: "Management commission",
      other: -1033.28,
      ours: -774.96,
      note: "40% and 30% of the subtotal",
      kind: "line",
    },
  ],
  totals: {
    owner: { label: "What reaches your account", other: 1549.92, ours: 1748.24 },
    manager: { label: "What the manager keeps", other: 1360.76, ours: 774.96 },
  },
};

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const cell = (n: number | null) => (n === null ? "—" : money(n));

/** What the guest keeps in their pocket on the same week — the honest headline. */
const GUEST_SAVING =
  (PEAK_WEEK.rows[0].other ?? 0) - (PEAK_WEEK.rows[0].ours ?? 0);

/**
 * An incidentals scenario, because "we have a damage waiver" means nothing to
 * an owner until they can see how a specific bad night actually plays out.
 *
 * Deliberately carries no invented dollar figure for the bed. The difference
 * that matters is WHO pays and WHEN the owner hears about it, and a made-up
 * replacement cost would be the one soft number in an otherwise sourced page.
 */
const BROKEN_BED = [
  {
    beat: "Saturday, the guest checks out",
    other:
      "The unit is turned over for the next arrival. A cracked bed frame under a made bed is not something a turnover is looking for.",
    ours: "Every turnover is inspected, so the frame is found and photographed before anyone else is let into the unit.",
  },
  {
    beat: "Saturday afternoon",
    other:
      "Nothing reaches you. Whatever happens next happens without you in the conversation.",
    ours: "You are told the same day, with the photographs and what we intend to do about it.",
  },
  {
    beat: "Who pays for the replacement",
    other:
      "There is no damage waiver covering incidentals, so the cost lands on you or is argued out with a guest who has already gone home.",
    ours: "The guest is charged, or it comes out of the damage waiver. Either way it is settled while the stay is still fresh.",
  },
  {
    beat: "The next guest",
    other: "Checks in to whatever state the bed was left in.",
    ours: "Arrives to a bed that has been replaced, because we knew on Saturday.",
  },
];

/** Why the bottom lines differ — what we actually do, not what they don't. */
const reasons = [
  {
    icon: TrendingUp,
    title: "Wider distribution, and pricing that moves",
    body: "More places selling the unit, and rates that respond to how the mountain is actually booking rather than sitting where they were set in October. In August our RevPAR was up 3.6% year over year while the Crested Butte market fell 10.8% — a fourteen-point swing, and it lands on the top line before a single fee is deducted, which is the one part of a statement that helps every line below it.",
  },
  {
    icon: CalendarCheck,
    title: "You can see your bookings as they happen",
    body: "Log in and look — every reservation on your calendar the moment it is made, with what it is worth. Resort programmes allocate nights through block bookings, so what actually happened to your unit arrives with the owner statement at the end of the month. A calendar you can only read in arrears is not one you can plan a season around, or use your own home from.",
  },
  {
    icon: ShieldCheck,
    title: "You hear about damage the day it happens",
    body: "A broken dresser gets photographed at the inspection and you are told that afternoon — along with whether we are charging the guest for it or covering it from the damage waiver. Resort programmes here run no damage waiver for incidentals, so that kind of thing surfaces as a line on a statement weeks later, by which point nobody can do anything about it.",
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
    title: "Fees you can actually account for",
    body: "Our own staff fix what our own staff can fix, so maintenance reaches your statement only when something genuinely needed a trade. Cleaning is billed at what the clean costs, the HOA fee is passed to you at face value, and no resort fee is charged to your guest with a margin folded into it. Our commission is lower too, though part of that difference is cleaning we bill separately rather than bury — the point is that every line is one you can explain.",
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
          <h2>One Christmas week, run two ways</h2>
          <p className="proj-compare-sub">
            Identical stay, identical unit, both fee schedules as they actually
            work. Every figure here is net of OTA fees, taxes and damage
            waivers: those pass through on each side alike, so they cannot move
            the outcome and only get in the way of seeing what does.
          </p>
          <p className="proj-compare-stay">{PEAK_WEEK.label}</p>

          <div
            className="proj-table"
            role="table"
            aria-label="Owner statement comparison"
          >
            <div className="proj-tr proj-thead" role="row">
              <span role="columnheader">On the statement</span>
              <span role="columnheader">Resort manager</span>
              <span role="columnheader" className="proj-ours">
                With Traverse
              </span>
            </div>

            {PEAK_WEEK.rows.map((r) => (
              <div
                className={`proj-tr proj-tr-${r.kind}`}
                role="row"
                key={r.line}
              >
                <span role="cell">
                  <strong>{r.line}</strong>
                  <small>{r.note}</small>
                </span>
                <span role="cell" className="proj-num">
                  <span className="proj-collabel" aria-hidden="true">
                    Resort manager
                  </span>
                  {cell(r.other)}
                </span>
                <span role="cell" className="proj-num proj-ours">
                  <span className="proj-collabel" aria-hidden="true">
                    Traverse
                  </span>
                  {cell(r.ours)}
                </span>
              </div>
            ))}

            {[PEAK_WEEK.totals.owner, PEAK_WEEK.totals.manager].map((t) => (
              <div className="proj-tr proj-tfoot" role="row" key={t.label}>
                <span role="cell">
                  <strong>{t.label}</strong>
                </span>
                <span role="cell" className="proj-num">
                  <span className="proj-collabel" aria-hidden="true">
                    Resort manager
                  </span>
                  {money(t.other)}
                </span>
                <span role="cell" className="proj-num proj-ours">
                  <span className="proj-collabel" aria-hidden="true">
                    Traverse
                  </span>
                  {money(t.ours)}
                </span>
              </div>
            ))}
          </div>

          {/* The whole point of the table, stated plainly. It was previously
              one sentence under a wall of figures and read as an afterthought.
              The owner-net tile is included even though it is the weakest of
              the three: leaving it out invites the reader to work it out and
              wonder why we hid it. */}
          <ul className="proj-deltas">
            <li className="proj-delta-lead">
              <strong>{money(GUEST_SAVING)}</strong>
              <span>less out of your guest&apos;s pocket</span>
            </li>
            <li>
              <strong>
                {money(
                  PEAK_WEEK.totals.owner.ours - PEAK_WEEK.totals.owner.other
                )}
              </strong>
              <span>more reaching your account</span>
            </li>
            <li className="proj-delta-lead">
              <strong>
                {money(
                  PEAK_WEEK.totals.manager.other -
                    PEAK_WEEK.totals.manager.ours
                )}
              </strong>
              <span>less taken by the manager</span>
            </li>
          </ul>
          <p className="proj-delta-note">
            The week is worth about the same to you either way. What changes is
            that your guest is charged {money(GUEST_SAVING)} less to book it —
            we are not built to earn more per stay, we are built to fill more of
            them.
          </p>

          <p className="proj-illustrative">
            Both columns come from a real quote for these dates: a $2,583.20
            stay, $1,038.03 in taxes and fees, $3,621.23 online. $200 is what a
            two-bedroom clean costs in this building. In fairness to the
            comparison, resort-programme cleaners are hourly and paid out of the
            commission — so part of that $1,360.76 is cleaning we bill your
            guest for separately rather than bury. Your unit, your weeks and
            your agreement will all differ, which is why the projection we send
            is built from your building rather than from this table.
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
            Six things, and only one of them is the commission rate.
          </p>
          <div className="proj-costs proj-costs-wide">
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

      {/* ── Incidentals scenario ── */}
      <section className="proj-scenario" aria-labelledby="scenario-h">
        <div className="audit-shell">
          <div className="proj-scenario-head">
            {/* An icon rather than a photograph on purpose. A stock shot of a
                broken bed would be visibly not one of our units, which quietly
                undercuts the very claim this section makes — that we photograph
                the damage ourselves at the inspection. */}
            <div className="proj-scenario-mark">
              <BedDouble aria-hidden="true" />
            </div>
            <h2 id="scenario-h">A guest breaks a bed. Now what?</h2>
          </div>
          <p className="proj-compare-sub">
            Damage is the part of this business nobody quotes you on, and it is
            where the difference between two managers is easiest to feel.
          </p>
          <ol className="proj-beats">
            {BROKEN_BED.map((b) => (
              <li key={b.beat}>
                <h3>{b.beat}</h3>
                <div className="proj-beat-pair">
                  <div className="proj-beat proj-beat-other">
                    <span>Resort manager</span>
                    <p>{b.other}</p>
                  </div>
                  <div className="proj-beat proj-beat-ours">
                    <span>Traverse</span>
                    <p>{b.ours}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="proj-check-foot">
            The replacement costs what it costs either way. What differs is
            whether you find out in time for anyone to do anything about it.
          </p>
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
            are not a guarantee of future earnings.
          </p>
        </div>
      </footer>
    </div>
  );
}
