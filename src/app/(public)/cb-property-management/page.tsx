/**
 * /cb-property-management — QR landing page for the Crested Butte owner
 * campaign (print → QR → this page).
 *
 * This WAS a deliberate copy of /projection, held as a placeholder until the
 * campaign content landed. It has now landed and the two pages have genuinely
 * diverged, so the copy note is gone and so is the noindex that went with it.
 * /projection still speaks to base-area condo owners inside resort rental
 * programmes; this page speaks to people who own a whole house in the valley.
 * They are different businesses with different problems, and almost none of
 * the condo page's argument survived the move:
 *
 *   - The density proof does not transfer. We manage 101 condos across three
 *     base-area buildings and exactly ONE house in Crested Butte (Guesty,
 *     active + listed, checked 2026-11-18). "We know your building" is the
 *     condo page's strongest line and it would be a lie here. What is true is
 *     that we run 100+ properties in the valley — so the team, the inspectors
 *     and the overnight cover are already on the ground — and 70+ whole homes
 *     and cabins elsewhere in Colorado, which is where the house-specific
 *     experience actually comes from. Both are said plainly below.
 *
 *   - The fee argument does not transfer either. "40–50% is the going rate"
 *     is true of resort rental programmes at the base area; a single-family
 *     owner in CB South is comparing us against a local manager at 20–30% or
 *     against self-managing. Leading on price to this audience would be
 *     picking a fight we have not obviously won, so the page does not mention
 *     our commission at all. The offer is the review, not the rate.
 *
 *   - The August RevPAR figures are gone rather than restated. They were a
 *     point in time (August 2026) and this is November; the old file said to
 *     refresh or remove them rather than let them go stale, and removing was
 *     right here because a single month of condo RevPAR says nothing about a
 *     4-bedroom house anyway.
 *
 * ⚠️ ONE CLAIM ON THIS PAGE IS AHEAD OF THE OPERATION. See HOME_CARE below.
 *
 * Lead-form `source` values are cb-home-*, so single-family leads stay
 * separable from the cb-pm-* condo leads in the ops alert.
 */
import type { Metadata } from "next";
import { SITE_ORIGIN } from "@/lib/listing-jsonld";
import Image from "next/image";
import Link from "next/link";
import {
  TrendingUp,
  CalendarClock,
  MessageCircle,
  ClipboardCheck,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Camera,
  LineChart,
  ListChecks,
  ScrollText,
  Home,
} from "lucide-react";
import { HomeLeadForm } from "@/components/projection/home-lead-form";
import { PORTFOLIO_STATS } from "@/lib/portfolio-stats";
// Shared with audit.booktraverse.com on purpose: the layout primitives
// (shell, band, hero, form card, FAQ) are the same landing-page system in the
// same brand. projection.css adds the stat/scenario/beat primitives this page
// inherited; cb-home.css adds only what is new here.
import "../audit/audit.css";
import "../projection/projection.css";
import "./cb-home.css";

const B2B_PHONE = { tel: "+19705333583", display: "(970) 533-3583" };

/**
 * ⚠️ Verify before editing — these are the page's credibility.
 *
 * Counted from the listings mirror on 2026-11-18, active AND listed, which
 * reconciled to 213 against Guesty's 214 (one unit in flight):
 *
 *   Crested Butte, all property types     108   -> "100+", rounded down
 *   Houses + cabins, every market          74   -> "70+",  rounded down
 *     (Leadville 52 + 11, Twin Lakes 1 + 6, Granby 1 + 1, Denver 1, CB 1)
 *
 * Both round DOWN so neither can overstate. MARKETING_COUNT and the rating
 * come from portfolio-stats.ts, which the quarterly refresh script owns —
 * don't hand-set them here.
 */
const CB_PROPERTIES = "100+";
const WHOLE_HOMES = "70+";
const MARKETING_COUNT = PORTFOLIO_STATS.marketingCount;
const GUEST_RATING = PORTFOLIO_STATS.googleRating;

export const metadata: Metadata = {
  title: "Crested Butte Home Management — Earning Less Than It Should?",
  description:
    "For people who own a whole house in the Gunnison Valley: a free, sourced review of what your home should be earning, and of whether anyone is actually looking after it between guests.",
  alternates: { canonical: `${SITE_ORIGIN}/cb-property-management` },
  openGraph: {
    title:
      "Is your Crested Butte home earning what it should — and is anyone looking after it? | Traverse Hospitality",
    description: `A free, sourced review for Crested Butte homeowners. We manage ${CB_PROPERTIES} properties in the valley and ${WHOLE_HOMES} whole homes across Colorado.`,
    url: `${SITE_ORIGIN}/cb-property-management`,
  },
};

/**
 * Where the money actually goes on a whole house.
 *
 * Deliberately no dollar figures. Every one would have to be either invented
 * or derived from a comp set we do not have for Crested Butte houses, and a
 * single soft number would undermine a page whose offer is "we'll show you
 * the workings". The owner supplies the arithmetic from their own statement;
 * we supply the list of places to look.
 */
const REVENUE_GAPS = [
  {
    icon: TrendingUp,
    title: "A rate that was set in October and never moved",
    body: "A house is priced far less often than a condo, because there is no building full of near-identical units to price it against — so it tends to get a number at the start of the season and keep it. That is fine in a week that sells itself and expensive in every other one. Rates that respond to how the valley is actually booking are the single biggest line on this list.",
  },
  {
    icon: CalendarClock,
    title: "The orphan nights nobody fills",
    body: "A Sunday-to-Thursday gap between two weekend bookings is worth nothing unless somebody notices it and prices it to go. On a large home those gaps are wider and more frequent, because the minimum stay that protects your peak weeks is the same one that blocks the midweek filling them.",
  },
  {
    icon: MessageCircle,
    title: "Enquiries that go cold overnight",
    body: "A family weighing a $700-a-night house asks more questions than someone booking a studio, and they ask them in the evening. An unanswered question at 9pm on a Friday is how a booking becomes somebody else's booking — and it never shows up as a loss anywhere you could see it.",
  },
  {
    icon: LineChart,
    title: "Too few places selling it",
    body: "One or two channels is the normal state of a self-managed or lightly managed home. We list across 50+ channels, which matters most for exactly the weeks a large house struggles to fill — shoulder season, midweek, and the gaps either side of the holidays.",
  },
];

/**
 * What a house needs that a condo does not. This is the second pillar and the
 * more emotional one, so it is concrete and seasonal rather than abstract.
 *
 * The framing is deliberately "a condo has an HOA doing this for you, a house
 * has nobody" — true, non-insulting, and it explains why an owner who had a
 * condo before is caught out by a house.
 */
const CARE_GAPS = [
  {
    icon: Snowflake,
    title: "Nobody is watching the roof or the pipes",
    body: "In a condo the HOA plows, clears the roof and keeps the common systems alive. A house has no HOA. Ice dams, a heat tape that quietly stopped working, a crawl space that got cold — these are the failures that turn into five-figure repairs, and every one of them gives weeks of warning to somebody who is looking.",
  },
  {
    icon: Thermometer,
    title: "The gap between guests is when things break",
    body: "A vacant house in January is the riskiest thing you own. A furnace that fails on a Tuesday with nobody booked until Friday is a burst pipe, not an inconvenience. The question is not whether your manager would fix it — it is whether anybody would be in the building to find it.",
  },
  {
    icon: ClipboardCheck,
    title: "A turnover is not an inspection",
    body: "Cleaners clean. They are not looking under sinks, testing the hot tub chemistry, checking the detector batteries or noticing that a deck board has gone soft — and they are not being asked to. If the only person who enters your home between guests is there to change the sheets, nothing preventative is happening in your house at all.",
  },
  {
    icon: Camera,
    title: "You find out from the statement, weeks later",
    body: "Damage and wear surface as a line item long after anyone could charge a guest for them or stop them getting worse. By the time it reaches you it is your cost and your problem, and the guest who caused it went home a month ago.",
  },
];

/**
 * A single January night, told as beats. Chosen over a damage scenario (which
 * is what the condo page runs) because it is the failure a homeowner already
 * fears, and because it is the one where "somebody is physically nearby" is
 * the whole answer — which is the honest shape of our advantage in a valley
 * where we have the team but not the houses.
 */
const COLD_SNAP = [
  {
    beat: "Tuesday, 9°F, the house is empty",
    other:
      "Nobody is scheduled to enter until the Friday clean. The furnace has three days to fail unobserved.",
    ours: "Vacant homes get checked on a set rotation through the winter, not only when a guest is due. Somebody opens the door.",
  },
  {
    beat: "The furnace quits",
    other:
      "It is found on Friday morning by a cleaner, who is not a technician and whose job that is not.",
    ours: "It is found on the check, with a photograph of the unit and the thermostat reading, and a trade is called the same morning.",
  },
  {
    beat: "What you hear, and when",
    other:
      "A call on Friday — or a repair line on a statement at the end of the month.",
    ours: "A message the day it is found, with the photographs and what we propose to do, before the money is spent.",
  },
  {
    beat: "Friday's guests",
    other:
      "Arrive to a cold house, or do not arrive at all because you cancelled on them that morning.",
    ours: "Arrive to a warm one, and never learn anything happened.",
  },
];

/**
 * ⚠️ READ THIS BEFORE SHIPPING.
 *
 * This section describes a seasonal home-care schedule. As of 2026-11-18 that
 * schedule is NOT a configured programme anywhere in our stack: SuiteOp holds
 * no element service rules and no recurring task schedules, and the CRM's
 * `maintenance_log` table is empty. What we demonstrably do run is the
 * inspection programme — 1,580 documented inspection runs covering 70,415
 * individual checkpoints with photographs — which is why the inspection
 * claims on this page are stated as fact and these are stated as what the
 * home programme includes.
 *
 * So this is a commitment, not a track record. Either stand the schedule up
 * before the QR codes go out, or soften this section to what we already do.
 * Nadim's call — flagged, not decided here.
 */
const HOME_CARE = [
  {
    season: "Before the snow",
    items: [
      "Heat tape and gutters tested under power, not just looked at",
      "Shut-offs located, labelled and photographed for the file",
      "Detectors, extinguishers and furnace filters dated and replaced",
    ],
  },
  {
    season: "Through the winter",
    items: [
      "Vacant-home checks on a rotation, independent of the booking calendar",
      "Plowing and roof clearing arranged before it becomes a problem",
      "Hot tub chemistry logged every service, not topped up by eye",
    ],
  },
  {
    season: "Every single turnover",
    items: [
      "A documented inspection, item by item, with photographs",
      "Anything wrong raised as a work order the same day",
      "You told that day — with the photographs — not at month end",
    ],
  },
];

const steps = [
  {
    n: 1,
    title: "Tell us where the home is and how big",
    body: "The area and the bedroom count. That is the whole ask — no listing link, no address, no account details.",
  },
  {
    n: 2,
    title: "We do the work by hand",
    body: `We price a home of your size against what the valley is genuinely booking, using our own data from ${CB_PROPERTIES} properties here and what we have learned running ${WHOLE_HOMES} whole homes elsewhere in Colorado.`,
  },
  {
    n: 3,
    title: "You get both halves, in writing",
    body: "A revenue range with the assumptions shown, and a straight read on what a house of that age and exposure needs over a winter. Including, where it applies, that you are already doing fine.",
  },
];

const deliverables = [
  {
    icon: LineChart,
    title: "What a home like yours should earn",
    body: "A range for your size and area across a full year, with the seasonality broken out — because a Crested Butte house makes its money in a handful of weeks and the rest of the calendar is where the difference between managers shows up.",
  },
  {
    icon: ListChecks,
    title: "Where your gap most likely is",
    body: "Which of the leaks above we would expect to be costing you most, ranked, and what we would change first. Specific enough to act on without us — if you would rather take it to your current manager, that is a perfectly good outcome.",
  },
  {
    icon: ScrollText,
    title: "The assumptions, in writing",
    body: "What we priced against, what we could not know about your home, and where the estimate is weakest. We manage one house in Crested Butte and we will say so — the valley data is real, an in-your-street comp is not something we can honestly offer.",
  },
];

const faqs = [
  {
    q: "How many houses do you actually manage in Crested Butte?",
    a: `One. We would rather tell you that on the page than have you find out later. What we do have here is scale of a different kind — ${CB_PROPERTIES} properties in the valley, which is what pays for inspectors who are already out this morning and guest cover through the night — plus ${WHOLE_HOMES} whole homes and cabins in Leadville, Twin Lakes and Granby, which is where everything we know about boilers, crawl spaces, plowing and hot tubs comes from. Houses are not new to us. Houses in Crested Butte are.`,
  },
  {
    q: "Isn't a bigger company going to treat my home as one of many?",
    a: "It is the right worry, and the honest answer is that it depends entirely on whether the work is documented. Ours is: every turnover produces an inspection with photographs against a fixed checklist, and you can see it. A one-person operation that knows your house well is a genuinely good alternative right up until they are ill, or on holiday, or stop answering.",
  },
  {
    q: "What does it cost?",
    a: "The review is free and there is no obligation attached to it. Management terms depend on the home — size, location, whether there is a hot tub, how much of the care side you want us holding — so quoting a rate here before we have seen your place would be a number designed to be renegotiated later. We will put it in writing once we have looked.",
  },
  {
    q: "I'm half-managing it myself. Is that a problem?",
    a: "No, and a lot of the best homes in the valley are run that way. Owners usually come to us when the bit they enjoy (choosing how the place feels) has been swallowed by the bit they don't (a boiler at 11pm while they are in Denver). Tell us which half you want to keep.",
  },
  {
    q: "Am I not locked in with my current manager?",
    a: "Possibly, and that is fine — knowing the number commits you to nothing. Most owners who ask for this are working out whether to renew when the term is up. Nothing here asks you to break an agreement.",
  },
  {
    q: "What do you do with my details?",
    a: "We send you the review and follow up once. We do not sell your details, add you to a list or pass them to anyone else.",
  },
];

export default function CrestedButteHomePage() {
  return (
    <div className="audit-page proj-page cbh-page">
      {/* ── Nav ── */}
      <header className="audit-nav">
        <a
          href="#top"
          className="audit-nav-brand"
          aria-label="Traverse Hospitality — Crested Butte home management"
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
          <a href="#earning">The money</a>
          <a href="#care">The house</a>
          <a href="#faq">FAQ</a>
          <a href="#review" className="audit-nav-cta">
            Get my review
          </a>
        </nav>
      </header>

      {/* ── Hero ──
           Two questions, not one, because the campaign targets owners who may
           only feel one of them. The second is deliberately the sharper: an
           owner who suspects their house is being neglected acts faster than
           one who suspects they are leaving a few points of yield behind. */}
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
            {/* Short on purpose — the longer "Free review for Crested Butte
                homeowners" wrapped to two lines inside the pill at 375px. */}
            <p className="audit-eyebrow">Free review for homeowners</p>
            <h1>
              Leaving thousands on the table? Or worse — is anyone actually
              looking after your home?
            </h1>
            <p className="audit-lede">
              Two different problems, and most owners of a whole house in this
              valley have at least one of them. Tell us the area and the size
              and we&apos;ll come back within a business day with what a home
              like yours should be earning — and what a winter here does to a
              house nobody is checking.
            </p>
            <ul className="audit-trust">
              <li>
                <strong>{CB_PROPERTIES}</strong> properties in the valley
              </li>
              <li>
                <strong>{WHOLE_HOMES}</strong> whole homes in Colorado
              </li>
              <li>
                <strong>{GUEST_RATING}</strong> guest rating
              </li>
              <li>
                <strong>1</strong> business day
              </li>
            </ul>
          </div>

          <div className="audit-formcard" id="review">
            <p className="audit-formcard-title">
              What should your home be earning?
            </p>
            <HomeLeadForm id="home-hero" source="cb-home-hero" />
            <p className="audit-formnote">
              Free, written by a person, back within one business day. No card,
              no commitment.
            </p>
          </div>
        </div>
      </section>

      {/* ── The two pillars, stated once, plainly ── */}
      <section className="cbh-pillars" aria-labelledby="pillars-h">
        <div className="audit-shell">
          <h2 id="pillars-h">
            There are only two ways a mountain home lets you down.
          </h2>
          <p className="proj-compare-sub">
            It earns less than it should, or it quietly falls apart. They are
            usually the same problem wearing different clothes — nobody is
            paying close enough attention — and the rest of this page is about
            both.
          </p>
          <div className="cbh-pillar-pair">
            <article className="cbh-pillar">
              <span className="cbh-pillar-n">01</span>
              <h3>The money you never see</h3>
              <p>
                Not a dramatic loss. A rate that didn&apos;t move, a week that
                didn&apos;t fill, an enquiry answered on Monday. None of it
                appears on a statement as a number, because money you never
                earned leaves no trace.
              </p>
              <a href="#earning">What that looks like →</a>
            </article>
            <article className="cbh-pillar cbh-pillar-alt">
              <span className="cbh-pillar-n">02</span>
              <h3>The house nobody is checking</h3>
              <p>
                A condo has an HOA watching the roof, the plowing and the common
                systems. Your house has whoever you hired — and if all they do
                is turn it over between guests, the answer is nobody.
              </p>
              <a href="#care">What that costs →</a>
            </article>
          </div>
        </div>
      </section>

      {/* ── Pillar one ── */}
      <section className="audit-band" id="earning">
        <div className="audit-shell">
          <h2>Where the money actually goes</h2>
          <p className="audit-sub">
            Four leaks, none of which show up as a line you could point at.
          </p>
          <div className="proj-costs proj-costs-wide cbh-quad">
            {REVENUE_GAPS.map(({ icon: Icon, title, body }) => (
              <div className="proj-cost" key={title}>
                <Icon className="audit-leak-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <p className="proj-delta-note">
            We are not going to put a dollar figure on your home from a landing
            page — anyone who does is guessing. That is what the review is for,
            and it comes with the workings shown so you can disagree with it.
          </p>
        </div>
      </section>

      {/* ── Self-check ── */}
      <section className="proj-check" aria-labelledby="check-h">
        <div className="audit-shell">
          <h2 id="check-h">
            Don&apos;t take our word for it. Try answering four questions.
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
                When did your nightly rate <strong>last change</strong>, and who
                changed it?
              </p>
            </li>
            <li>
              <span className="proj-check-n">3</span>
              <p>
                Who was the <strong>last person inside your house</strong>, and
                what were they looking for?
              </p>
            </li>
            <li>
              <span className="proj-check-n">4</span>
              <p>
                When something last broke, <strong>how did you find out</strong>{" "}
                — and how long after?
              </p>
            </li>
          </ol>
          <p className="proj-check-foot">
            If you can answer all four, you are being looked after and you
            should stay where you are. Most owners we speak to cannot answer the
            third one at all.
          </p>
        </div>
      </section>

      {/* ── Pillar two ── */}
      <section className="cbh-care" id="care">
        <div className="audit-shell">
          <div className="proj-scenario-head">
            <div className="proj-scenario-mark">
              <Home aria-hidden="true" />
            </div>
            <h2>A house is not a big condo</h2>
          </div>
          <p className="proj-compare-sub">
            Everything the building used to do for you is now somebody&apos;s
            job, and on most managed homes in this valley it is nobody&apos;s.
          </p>
          <div className="proj-costs proj-costs-wide cbh-quad">
            {CARE_GAPS.map(({ icon: Icon, title, body }) => (
              <div className="proj-cost" key={title}>
                <Icon className="audit-leak-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cold-snap scenario ──
           An icon rather than a photograph on purpose: a stock shot of a
           frozen pipe would visibly not be one of our homes, which undercuts
           the very claim the section makes. */}
      <section className="proj-scenario" aria-labelledby="scenario-h">
        <div className="audit-shell">
          <div className="proj-scenario-head">
            <div className="proj-scenario-mark">
              <Snowflake aria-hidden="true" />
            </div>
            <h2 id="scenario-h">
              It&apos;s 9°F on a Tuesday and the furnace quits. Now what?
            </h2>
          </div>
          <p className="proj-compare-sub">
            Nobody is booked in until Friday. This is the night that decides
            whether you have a repair bill or an insurance claim.
          </p>
          <ol className="proj-beats">
            {COLD_SNAP.map((b) => (
              <li key={b.beat}>
                <h3>{b.beat}</h3>
                <div className="proj-beat-pair">
                  <div className="proj-beat proj-beat-other">
                    <span>Turnover-only management</span>
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
            The furnace costs what it costs either way. What differs is whether
            anyone was in the house while it was still only a furnace.
          </p>
        </div>
      </section>

      {/* ── The home care programme ── */}
      <section className="audit-band audit-band-alt" id="care-plan">
        <div className="audit-shell">
          <h2>What looking after it actually means</h2>
          <p className="audit-sub">
            Not a promise to be responsive. A schedule, with dates on it.
          </p>
          <div className="cbh-seasons">
            {HOME_CARE.map((s) => (
              <div className="cbh-season" key={s.season}>
                <h3>{s.season}</h3>
                <ul>
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="cbh-proof">
            <ShieldCheck aria-hidden="true" />
            <span>
              The inspection half of this is not new and not a plan: across our
              portfolio we have run thousands of documented turnover inspections
              covering tens of thousands of individual checkpoints, with
              photographs attached. It is the same checklist, the same software
              and the same people your home would get.
            </span>
          </p>
        </div>
      </section>

      {/* ── Who we are, honestly ── */}
      <section className="proj-building">
        <div className="audit-shell proj-building-inner">
          <div className="proj-building-mark">
            <Home aria-hidden="true" />
          </div>
          <div>
            <h2>
              {MARKETING_COUNT} homes, six Colorado markets, one house in
              Crested Butte
            </h2>
            <p>
              That last part is deliberate. We manage {CB_PROPERTIES} properties
              in this valley and almost all of them are condos at the base area
              — so we are not going to claim we know your street. What we can
              tell you is that the inspector is already out here this morning
              and the overnight guest cover already exists, because{" "}
              {CB_PROPERTIES} properties pay for both.
            </p>
            <p>
              The house-specific part comes from {WHOLE_HOMES} whole homes and
              cabins we run in Leadville, Twin Lakes and Granby — colder than
              here, older housing stock, the same frozen pipes and the same
              plowing. Single-family homes in Crested Butte are where we are
              deliberately growing, and the terms reflect that.
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
            <h2>See the numbers for your home</h2>
            <p>The area and the bedroom count. That&apos;s the whole ask.</p>
          </div>
          <HomeLeadForm id="home-mid" source="cb-home-mid" />
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="audit-band audit-band-alt" id="what-you-get">
        <div className="audit-shell">
          <h2>What lands in your inbox</h2>
          <p className="audit-sub">
            Written for someone who owns one house, not a portfolio manager with
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
            Every figure we send is an estimate based on market data and
            comparable homes, not a guarantee of what your home will earn. Its
            condition, location, access, amenities and calendar all move the
            number, and we say so in the write-up.
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
          <h2>Find out what your home should be earning.</h2>
          <p>
            And what this winter is doing to it. Free, written by a person, back
            within one business day.
          </p>
          <div className="audit-formcard audit-formcard-dark">
            <HomeLeadForm id="home-bottom" source="cb-home-footer" />
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
            <Link href="https://audit.booktraverse.com">
              Free listing audit
            </Link>
            <Link href="https://www.booktraverse.com/privacy">Privacy</Link>
            <a href={`tel:${B2B_PHONE.tel}`}>{B2B_PHONE.display}</a>
          </div>
          <p className="audit-footer-fine">
            © {new Date().getFullYear()} HALTAN LLC dba Traverse Hospitality ·
            Colorado short-term rental management · Crested Butte · Leadville ·
            Vail · Avon · Granby · Twin Lakes. Reviews are estimates based on
            market data and comparable homes and are not a guarantee of future
            earnings.
          </p>
        </div>
      </footer>
    </div>
  );
}
