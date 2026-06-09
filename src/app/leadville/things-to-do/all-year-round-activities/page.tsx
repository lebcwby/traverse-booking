import type { Metadata } from "next";
import {
  ActivityListPage,
  type Activity,
} from "../activity-list-page";
import "../../../no-fees/no-fees.css";
import "../activities-shared.css";

export const metadata: Metadata = {
  title: "All-Year-Round Activities in Leadville Colorado",
  description:
    "Downtown Leadville, Tabor Opera House, museums, scenic railroads, zip lining, hunting — year-round things to do in Leadville, Colorado.",
  alternates: {
    canonical:
      "https://www.booktraverse.com/leadville/things-to-do/all-year-round-activities/",
  },
};

const ACTIVITIES: Activity[] = [
  {
    heading: "Downtown Leadville",
    image: "/leadville/activities/year-downtown-leadville.jpeg",
    description:
      "The cutest little mining town. It's kept all its charm from the Gold Rush days but also has new, modern restaurants and shops with everything you'll need during your stay. Don't forget to stop by Leadville's famous Melanzana for locally made outdoor clothing.",
    link: { url: "https://www.leadvilletwinlakes.com/" },
  },
  {
    heading: "Tabor Opera House",
    image: "/leadville/activities/year-tabor-opera-house.jpeg",
    description:
      "The Tabor Opera House is undergoing a multi-million-dollar restoration. The building has been deemed a National Treasure by the National Trust for Historic Preservation and is the cultural and community center of Leadville.",
    link: { url: "https://taboroperahouse.org/" },
  },
  {
    heading: "Railroads",
    image: "/leadville/activities/year-railroads.jpg",
    description:
      "Scenic rides through the Rocky Mountains with views of Colorado's highest peaks, wildflowers, and aspen groves — and you'll learn about Leadville's history along the way. Perfect for summer or fall.",
    link: { url: "https://www.leadville-train.com/" },
  },
  {
    heading: "Museums",
    image: "/leadville/activities/year-museums.jpg",
    description:
      "Learn about Leadville's history in our 8 museums (that's more museums per capita than anywhere else in Colorado). You can explore historic homes or learn about the mining history of the area.",
    link: { url: "https://www.leadvilletwinlakes.com/" },
  },
  {
    heading: "Zip Lining",
    image: "/leadville/activities/year-zip-lining.jpeg",
    description:
      "Zipline at the Top of the Rockies, only a 10-minute drive from Leadville, open all seasons. Enjoy a two-hour prospect tour or zip lining in the middle of a train tour.",
  },
  {
    heading: "Hunting",
    image: "/leadville/activities/year-hunting.jpeg",
    description:
      "In Leadville, you'll have access to GMUs (game-managed units) 48 and 49 — home to pronghorns, moose, elk, deer, and smaller game like snowshoe hares and ptarmigan. These GMUs are 80% public land, so bring your bows and rifles.",
  },
];

export default function Page() {
  return (
    <ActivityListPage
      bgImage="/leadville/things-year-round.png"
      title="All-Year-Round Activities"
      lede="There's always something to do in Leadville. From museums to scenic train rides to a downtown that hasn't lost its mining-town charm, the historic side of America's highest city is open year-round."
      activities={ACTIVITIES}
    />
  );
}
