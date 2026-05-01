"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";

const FAQS: {
  question: string;
  answer: React.ReactNode;
  schemaAnswer: string;
}[] = [
  {
    question:
      "What are the best neighborhoods for vacation rentals in Portland?",
    answer: (
      <>
        Portland&apos;s best vacation rental neighborhoods include{" "}
        <Link
          href={getLandingPagePath("southeast-portland")}
          className="text-primary hover:underline"
        >
          Southeast Portland
        </Link>{" "}
        (Hawthorne, Division, Belmont) for food and culture,{" "}
        <Link
          href={getLandingPagePath("northeast-portland")}
          className="text-primary hover:underline"
        >
          Northeast Portland
        </Link>{" "}
        (Alberta, Mississippi) for creative energy, and{" "}
        <Link
          href={getLandingPagePath("northwest-portland")}
          className="text-primary hover:underline"
        >
          Northwest Portland
        </Link>{" "}
        (Pearl District, Nob Hill) for upscale walkability. Each neighborhood
        has its own personality and all are well-connected by transit and bike
        routes.
      </>
    ),
    schemaAnswer:
      "Portland's best vacation rental neighborhoods include Southeast Portland (Hawthorne, Division, Belmont) for food and culture, Northeast Portland (Alberta, Mississippi) for creative energy, and Northwest Portland (Pearl District, Nob Hill) for upscale walkability. Each neighborhood has its own personality and all are well-connected by transit and bike routes.",
  },
  {
    question: "Is it cheaper to book a vacation rental or hotel in Portland?",
    answer:
      "Vacation rentals in Portland are typically 20\u201340% less expensive than hotels, especially for groups and families. You also get a full kitchen, laundry, and more space. Booking direct with Book Traverse saves an additional 10\u201315% compared to listing platforms like Airbnb and VRBO since we don\u2019t charge service fees.",
    schemaAnswer:
      "Vacation rentals in Portland are typically 20-40% less expensive than hotels, especially for groups and families. You also get a full kitchen, laundry, and more space. Booking direct with Book Traverse saves an additional 10-15% compared to listing platforms like Airbnb and VRBO since we don't charge service fees.",
  },
  {
    question: "Are there pet-friendly vacation rentals in Portland?",
    answer: (
      <>
        Yes — Portland is one of the most dog-friendly cities in the country.
        Browse our full selection of{" "}
        <Link
          href={getLandingPagePath("pet-friendly")}
          className="text-primary hover:underline"
        >
          pet-friendly vacation rentals
        </Link>{" "}
        with fenced yards, nearby off-leash parks, and no breed restrictions.
        Many of our homes welcome dogs of all sizes.
      </>
    ),
    schemaAnswer:
      "Yes — Portland is one of the most dog-friendly cities in the country. Book Traverse offers pet-friendly vacation rentals with fenced yards, nearby off-leash parks, and no breed restrictions. Many homes welcome dogs of all sizes.",
  },
  {
    question: "What\u2019s the best time to visit Portland, Oregon?",
    answer:
      "Portland\u2019s peak season runs June through September with warm, dry weather and outdoor festivals. Spring (April\u2013May) and fall (September\u2013October) offer mild temperatures and fewer crowds. Winter brings Portland\u2019s cozy side — fireplaces, hot tubs, and world-class food without the summer crowds. There\u2019s truly no bad time to visit.",
    schemaAnswer:
      "Portland's peak season runs June through September with warm, dry weather and outdoor festivals. Spring (April-May) and fall (September-October) offer mild temperatures and fewer crowds. Winter brings Portland's cozy side — fireplaces, hot tubs, and world-class food without the summer crowds. There's truly no bad time to visit.",
  },
  {
    question: "How do I book a vacation rental in Portland?",
    answer:
      "Browse our properties, select your dates and guest count, and book instantly — no waiting for host approval. You\u2019ll receive a confirmation email with check-in instructions, door codes, and a neighborhood guide. Our Portland-based team is available if you need anything before or during your stay.",
    schemaAnswer:
      "Browse properties on booktraverse.com, select your dates and guest count, and book instantly — no waiting for host approval. You'll receive a confirmation email with check-in instructions, door codes, and a neighborhood guide. The Portland-based team is available if you need anything before or during your stay.",
  },
  {
    question: "What\u2019s included in a Book Traverse vacation rental?",
    answer:
      "Every rental includes fast WiFi, a fully equipped kitchen, quality linens and towels, toiletries, a washer/dryer (in most homes), and streaming services. We also provide a local neighborhood guide with restaurant, coffee shop, and activity recommendations. Many homes include extras like bikes, games, and outdoor spaces.",
    schemaAnswer:
      "Every rental includes fast WiFi, a fully equipped kitchen, quality linens and towels, toiletries, a washer/dryer (in most homes), and streaming services. A local neighborhood guide with restaurant, coffee shop, and activity recommendations is also provided. Many homes include extras like bikes, games, and outdoor spaces.",
  },
  {
    question: "Can I get a refund if I need to cancel my Portland trip?",
    answer: (
      <>
        Yes. Our cancellation policy allows flexible changes and refunds within
        the cancellation window listed on each property. For full details, see
        our{" "}
        <Link href="/cancellation" className="text-primary hover:underline">
          cancellation policy
        </Link>
        . We recommend booking direct for the most flexible terms.
      </>
    ),
    schemaAnswer:
      "Yes. The cancellation policy allows flexible changes and refunds within the cancellation window listed on each property. Booking direct offers the most flexible terms.",
  },
  {
    question: "Is Portland a good destination for a family vacation?",
    answer: (
      <>
        Portland is excellent for families. Top attractions include OMSI, the
        Oregon Zoo, Powell&apos;s Books, Oaks Amusement Park, and dozens of
        parks and playgrounds. Our{" "}
        <Link
          href={getLandingPagePath("family-friendly")}
          className="text-primary hover:underline"
        >
          family-friendly vacation rentals
        </Link>{" "}
        come with cribs, high chairs, fenced yards, and kid-friendly
        neighborhoods within walking distance of ice cream shops and
        playgrounds.
      </>
    ),
    schemaAnswer:
      "Portland is excellent for families. Top attractions include OMSI, the Oregon Zoo, Powell's Books, Oaks Amusement Park, and dozens of parks and playgrounds. Book Traverse's family-friendly vacation rentals come with cribs, high chairs, fenced yards, and kid-friendly neighborhoods.",
  },
];

function FaqItem({ faq }: { faq: (typeof FAQS)[number] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <h3 className="text-base font-semibold text-foreground pr-4 sm:text-lg">
          {faq.question}
        </h3>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ${
          isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="leading-relaxed text-muted-foreground">{faq.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  return (
    <section className="bg-secondary/30 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Everything you need to know about vacation rentals in Portland,
          Oregon.
        </p>
        <div className="mt-10">
          {FAQS.map((faq, i) => (
            <FaqItem key={i} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
