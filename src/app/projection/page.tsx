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
 * Grand Lodge is 65 per Alex/Nadim (2026-08-29). The listings mirror only tags
 * 61 of them, so four units are missing the "The Grand Lodge Crested Butte"
 * BEAPI tag — worth fixing at source, because the building pages on the main
 * site filter on that tag and those four are invisible there.
 *
 * These counts are the page's core credibility claim, so re-check before
 * editing. The mirror puts the whole Crested Butte portfolio at 101, which is
 * what MT_CB_TOTAL rounds down to.
 */
const OUR_UNITS = { grandLodge: 65, mountaineerSquare: 16, plaza: 20 };
const BASE_AREA_TOTAL =
  OUR_UNITS.grandLodge + OUR_UNITS.mountaineerSquare + OUR_UNITS.plaza;

/** Rounded down from the 101 the mirror holds, so it can never overstate. */
const MT_CB_TOTAL = "100+";

export const metadata: Metadata = {
  title: "What Should Your Crested Butte Condo Be Earning?",
  description:
    "A free, sourced revenue projection for Mt. Crested Butte condo owners — built from what comparable units in your own building actually earned over the last twelve months.",
  alternates: { canonical: "https://projection.booktraverse.com" },
  openGraph: {
    title:
      "What Should Your Crested Butte Condo Be Earning? | Traverse Hospitality",
    description: `Still paying 40-50% to your property manager? We manage ${MT_CB_TOTAL} condos in Mt Crested Butte. See what units like yours actually earned.`,
    url: "https://projection.booktraverse.com",
  },
};

/**
 * Three claims, kept deliberately top-level.
 *
 * This replaced a line-by-line owner-statement comparison. Two reasons it had
 * to go. First, a fee table invites a fee argument, and it hands an owner
 * something to take back to their current manager to be picked apart line by
 * line — an argument we do not need to win to win the account. Second, it was
 * fragile: the owner-net difference swung from $16 to $198 purely by changing
 * the example week, because the HOA fee is charged per night while the
 * commission difference is a percentage. Any owner trying their own week would
 * have got a different answer to ours.
 *
 * RevPAR does the same job in one number and is much harder to argue with,
 * because it is an outcome rather than a formula — it already contains both
 * occupancy and rate.
 *
 * ⚠️ The RevPAR figures are a point in time (August 2026). Date them, and
 * refresh or remove them rather than letting them quietly go stale.
 */
const HEADLINE_STATS = [
  {
    // The headline is the GAP, which is what an owner cares about, and it is
    // 14.4 points rather than 14.4% growth — hence "ahead of the market"
    // rather than a bare percentage, with both components spelled out below.
    value: "+14.4%",
    label: "Ahead of the market, August",
    foot: "Revenue per unit rose 3.6% for us over the month, while the Crested Butte market fell 10.8%. Same mountain, same weather, same guests deciding.",
  },
  {
    value: "30%",
    label: "Our management commission",
    foot: "Where 40% is the going rate for a resort programme at this base area.",
  },
  {
    value: "4.8",
    label: "Guest rating across 200+ homes",
    foot: "The one part of service nobody can claim for themselves — guests decide it, stay by stay.",
  },
];

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
    body: "More places selling the unit, and rates that respond to how the mountain is actually booking rather than sitting where they were set in October. In August we finished 14.4 points ahead of the Crested Butte market — up 3.6% per unit while the market fell 10.8% — and that lands on the top line before a single fee is deducted, which is the one part of a statement that helps every line below it.",
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
    body: "A lower commission, and every other line on your statement one you can explain. Our own staff fix what our own staff can fix, so maintenance appears only when something genuinely needed a trade. Cleaning is billed at what the clean costs. The HOA fee is passed through at face value, with no resort fee charged to your guest carrying a margin inside it.",
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
    body: "Those same stays run through our fee schedule line by line, so the comparison is about what reaches your account rather than what appears at the top of a page. This is where the detail lives, on your unit rather than a worked example.",
  },
  {
    icon: ScrollText,
    title: "The assumptions, in writing",
    body: "Which units we compared you against, what we could not know about yours, and where the estimate is weakest. If the honest answer is that you're already doing well, that is what it will say.",
  },
];

const faqs = [
  {
    q: "Where do the RevPAR figures come from?",
    a: "Ours is our own portfolio across these markets, measured August against the same month last year. The market figure is the Crested Butte comparison set over the same period. It is one month rather than a trend, and we would rather show you the run of months for your own building than lean on a single good one.",
  },
  {
    q: "Isn't a lower commission just less service?",
    a: "It is the reasonable question, and it would be true if the rate were the only thing that changed. The reason we can charge less here is density: we run 88 condos across these three buildings, so the inspector is already in your building that morning and the team already covers those guests overnight. That is why we are cheaper in Crested Butte specifically rather than everywhere, and why the service goes up rather than down.",
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
           Opens on the rate because it is the one fact that qualifies this
           audience instantly: legacy clients at this base area are on 50%,
           newer ones on 40%. It blames the rate rather than the owner, which
           matters — these people chose that manager deliberately and will not
           buy from anyone who has just implied they were foolish. */}
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
            <h1>
              Still paying 40&ndash;50% to your property manager?
            </h1>
            <p className="audit-lede">
              Then it is worth re-evaluating what your listing is actually
              doing. We manage {MT_CB_TOTAL}{" "}
              condos in Mt Crested Butte — tell us your building and we&apos;ll
              show you what units like yours earned last year, and what they
              would earn with us.
            </p>
            <ul className="audit-trust">
              <li>
                <strong>{MT_CB_TOTAL}</strong> condos in Mt Crested Butte
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

      {/* ── The three claims ── */}
      <section className="proj-compare" id="compare">
        <div className="audit-shell">
          <h2>Higher occupancy. Lower commission. You earn more.</h2>
          <p className="proj-compare-sub">
            That is the whole of it, and the three numbers below are where we
            stand today. What follows them is the rest of what changes — the
            parts of managing a condo you only notice when they are missing.
          </p>

          <ul className="proj-stats">
            {HEADLINE_STATS.map((s) => (
              <li key={s.label}>
                <strong>{s.value}</strong>
                <span className="proj-stat-label">{s.label}</span>
                <span className="proj-stat-foot">{s.foot}</span>
              </li>
            ))}
          </ul>

          <p className="proj-delta-note">
            A unit that books more nights at a better rate, with less taken out
            of each one, is worth more to you at the end of the season. We would
            rather show you what that looks like for your condo than argue about
            percentages in the abstract.
          </p>
        </div>
      </section>

      {/* ── Self-check ──
           Repointed away from statement line items when the fee comparison
           came out. Line-by-line questions are a conversation to have with an
           owner, not to start on a landing page — and this version lands the
           visibility point instead, which is the one nobody has an answer to. */}
      <section className="proj-check" aria-labelledby="check-h">
        <div className="audit-shell">
          <h2 id="check-h">
            Don&apos;t take our word for it. Try answering three questions.
          </h2>
          <ol className="proj-check-steps">
            <li>
              <span className="proj-check-n">1</span>
              <p>
                Without opening a statement, what is{" "}
                <strong>on your calendar for February</strong>?
              </p>
            </li>
            <li>
              <span className="proj-check-n">2</span>
              <p>
                What did your unit <strong>earn last month</strong>, and how
                does that compare with the one down the hall?
              </p>
            </li>
            <li>
              <span className="proj-check-n">3</span>
              <p>
                When something last broke,{" "}
                <strong>how did you find out</strong> — and how long after?
              </p>
            </li>
          </ol>
          <p className="proj-check-foot">
            If you can answer all three, you are being looked after. Most owners
            we speak to cannot answer any of them.
          </p>
        </div>
      </section>

      {/* ── Why owners move ── */}
      <section className="audit-band" id="why">
        <div className="audit-shell">
          <h2>What the difference actually is</h2>
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
            <h2>See the numbers for your condo</h2>
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
