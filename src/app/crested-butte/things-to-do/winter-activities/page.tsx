import type { Metadata } from "next";
import {
  ActivityListPage,
  type Activity,
} from "../../../leadville/things-to-do/activity-list-page";
import "../../../no-fees/no-fees.css";
import "../../../leadville/things-to-do/activities-shared.css";

export const metadata: Metadata = {
  title: "Winter Activities in Crested Butte Colorado",
  description:
    "Skiing, snowboarding, snowshoeing, dog sledding, ice skating and holiday events — winter things to do in Crested Butte, Colorado.",
  alternates: {
    canonical:
      "https://www.booktraverse.com/crested-butte/things-to-do/winter-activities/",
  },
};

const ACTIVITIES: Activity[] = [
  {
    heading: "Downhill Skiing & Snowboarding",
    image: "/crested-butte/activities/winter-downhill-ski.webp",
    description:
      "Crested Butte Mountain Resort is renowned for its varied terrain, including extreme slopes and family-friendly runs. The resort also offers lessons for all skill levels at their Ski & Ride School.",
    link: { url: "https://www.skicb.com/plan-your-trip/ski-and-ride-lessons.aspx" },
  },
  {
    heading: "Holiday Events",
    image: "/crested-butte/activities/winter-holiday-events.jpg",
    description:
      "Celebrate the seasons in Crested Butte with unforgettable events like the torchlight parades on New Year's Eve and Christmas Eve at Crested Butte Mountain Resort, where you can watch skiers and snowboarders descend the slopes with glowing torches, followed by fireworks. Plus Mardi Gras with the Mardi Gras parade and more.",
    link: { url: "https://heycrestedbutte.com/crested-butte-holiday-events/" },
  },
  {
    heading: "Snowmobiling",
    image: "/crested-butte/activities/winter-snowmobiling.png",
    description:
      "Guided tours or rentals are available, offering the perfect opportunity to explore the backcountry. Whether you're seeking an adventure through untouched powder or a scenic ride across snowy landscapes, these experiences let you immerse yourself in the wilderness.",
    link: { url: "https://travelcrestedbutte.com/crested-butte-snowmobile-rentals/" },
  },
  {
    heading: "Ice Skating",
    image: "/crested-butte/activities/winter-ice-skating.jpg",
    description:
      "The Big Mine Ice Arena offers free public skating and pick-up hockey.",
    link: { url: "https://travelcrestedbutte.com/crested-butte-ice-skating-hockey/" },
  },
  {
    heading: "Dog Sledding",
    image: "/crested-butte/activities/winter-dog-sledding.jpg",
    description:
      "Experience the thrill of being pulled by a team of dogs on a guided tour through Crested Butte's snow-covered backcountry.",
    link: { url: "https://heycrestedbutte.com/listing/crested-butte-sled-dog-tours/" },
  },
  {
    heading: "Fat Tire Biking",
    image: "/leadville/activities/winter-fat-tire-biking.jpeg",
    description:
      "Fat biking is a fun winter activity that has recently been pioneered in the Crested Butte area — a great alternative to skiing. These bikes run with very low tire pressure and ride very well on snow.",
    link: { url: "https://travelcrestedbutte.com/crested-butte-fat-biking/" },
  },
  {
    heading: "Snowshoeing",
    image: "/crested-butte/activities/winter-snowshoeing.webp",
    description:
      "Crested Butte offers excellent snowshoeing opportunities during the winter, with trails suitable for all skill levels. The Crested Butte Nordic Center provides groomed trails, rentals, and guided tours. Popular areas include Red Lady Loop, Pooch's Paradise, and the trails around Mt. Crested Butte.",
    link: { url: "https://www.skicb.com/explore-the-resort/activities-and-events/winter-activities/crested-butte-nordic.aspx" },
  },
  {
    heading: "Ice Fishing",
    image: "/leadville/activities/winter-ice-fishing.jpeg",
    description:
      "Crested Butte ice fishing is a fun and educational respite from your time on the slopes — and can reward you with a delicious fresh dinner.",
    link: { url: "https://heycrestedbutte.com/crested-butte-ice-fishing/" },
  },
];

export default function Page() {
  return (
    <ActivityListPage
      bgImage="/crested-butte/things-winter.jpeg"
      title="Winter Activities"
      lede="Yes, you still need sunscreen in the winter here. From world-class skiing to dog sledding to torchlight parades, Crested Butte's winter is loaded with adventure."
      activities={ACTIVITIES}
      thingsToDoHref="/crested-butte/things-to-do"
      browseHref="/properties?city=Crested+Butte"
      browseLabel="Browse Crested Butte Rentals"
      browseLede="Slope-side condos at the Grand Lodge, Plaza, and Mountaineer Square — we manage 70+ Crested Butte vacation rentals. Book direct and save up to 15%."
    />
  );
}
