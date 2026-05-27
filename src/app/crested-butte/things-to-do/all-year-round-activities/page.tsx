import type { Metadata } from "next";
import {
  ActivityListPage,
  type Activity,
} from "../../../leadville/things-to-do/activity-list-page";
import "../../../no-fees/no-fees.css";
import "../../../leadville/things-to-do/activities-shared.css";

export const metadata: Metadata = {
  title:
    "All-Year-Round Activities in Crested Butte Colorado | Traverse Hospitality",
  description:
    "Scenic drives, arts & culture, museums, distillery tours, breweries and horseback riding — year-round things to do in Crested Butte, Colorado.",
  alternates: {
    canonical:
      "https://www.booktraverse.com/crested-butte/things-to-do/all-year-round-activities/",
  },
};

const ACTIVITIES: Activity[] = [
  {
    heading: "Scenic Drives",
    image: "/crested-butte/activities/year-scenic-drives.jpg",
    description:
      "Take a drive along the West Elk Loop Scenic Byway or Kebler Pass to witness the stunning fall foliage. The Kebler Pass aspen grove is one of the largest in the country.",
    link: { url: "https://travelcrestedbutte.com/crested-butte-scenic-drives/" },
  },
  {
    heading: "Arts & Culture",
    image: "/crested-butte/activities/year-arts-culture.jpg",
    description:
      "Crested Butte has a thriving arts scene, with galleries, museums, and events at The Center for the Arts.",
    link: { url: "https://crestedbuttearts.org" },
  },
  {
    heading: "Museums",
    image: "/crested-butte/activities/year-museums.jpg",
    description:
      "Crested Butte Museum: through engaging educational and cultural experiences, the museum connects people to the past, the place, and each other. The Trailhead Children's Museum offers engaging and dynamic experiences that inspire children and families to explore and create.",
    link: { url: "https://crestedbuttemuseum.com/" },
  },
  {
    heading: "Montanya Distillers — Distillery Tour",
    image: "/crested-butte/activities/year-montanya-distillery.jpg",
    description:
      "Tour Crested Butte's award-winning rum distillery — Montanya Distillers crafts small-batch rums in the heart of the Rockies. Tastings, cocktails, and a beloved downtown tasting room.",
    link: { url: "https://montanyadistillers.com/" },
  },
  {
    heading: "Explore the Town & Nightlife",
    image: "/crested-butte/activities/year-eldo-brewery.jpg",
    description:
      "The Eldo Brewery is the only locally owned and operated brewery in Historic Downtown Crested Butte. Visit the taproom at 215 Elk Ave and try one of ten beers brewed on site — plus dozens of restaurants and shops along Elk Avenue.",
    link: { url: "https://www.eldobrewery.com/" },
  },
  {
    heading: "Horseback Riding",
    image: "/crested-butte/activities/year-horseback-riding.jpg",
    description:
      "Crested Butte and the Gunnison Valley on horseback is like no other. Whether you ride in the summer, fall, or winter, the landscapes accessed by horse will absolutely be worth it. Fantasy Ranch and Harmel's Ranch both run guided trips.",
    link: { url: "https://www.harmels.com/" },
  },
];

export default function Page() {
  return (
    <ActivityListPage
      bgImage="/crested-butte/things-year-round.jpg"
      title="All-Year-Round Activities"
      lede="There's always something to do in Crested Butte. From scenic drives over Kebler Pass to small-batch rum at Montanya Distillers, the historic side of Crested Butte is open every season."
      activities={ACTIVITIES}
      thingsToDoHref="/crested-butte/things-to-do"
      browseHref="/properties?city=Crested+Butte"
      browseLabel="Browse Crested Butte Rentals"
      browseLede="From slope-side condos to downtown lofts — we manage 70+ Crested Butte vacation rentals. Book direct and save up to 15%."
    />
  );
}
