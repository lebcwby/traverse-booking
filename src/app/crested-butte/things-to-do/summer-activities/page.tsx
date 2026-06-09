import type { Metadata } from "next";
import {
  ActivityListPage,
  type Activity,
} from "../../../leadville/things-to-do/activity-list-page";
import "../../../no-fees/no-fees.css";
import "../../../leadville/things-to-do/activities-shared.css";

export const metadata: Metadata = {
  title: "Summer Activities in Crested Butte Colorado",
  description:
    "Hiking, mountain biking, wildflower trails, golf, horseback riding and more — summer things to do in Crested Butte, Colorado.",
  alternates: {
    canonical:
      "https://www.booktraverse.com/crested-butte/things-to-do/summer-activities/",
  },
};

const ACTIVITIES: Activity[] = [
  {
    heading: "Hiking",
    image: "/leadville/activities/summer-hiking.jpg",
    description:
      "Crested Butte is the wildflower capital of Colorado — and one of the best summer hiking towns in the state. Trails range from easy meadow strolls (Snodgrass, Lower Loop) to alpine-pass scrambles (West Maroon, Conundrum). The Mountain Express shuttle drops you at most major trailheads.",
    link: { url: "https://www.alltrails.com/us/colorado/crested-butte" },
  },
  {
    heading: "Mountain Biking",
    image: "/leadville/activities/summer-mountain-biking.jpg",
    description:
      "Crested Butte calls itself the birthplace of mountain biking — the 401 Trail and the Lower Loop are world-class, and the resort runs a lift-served bike park in summer. Rentals and shuttle service are available in town.",
    link: { url: "https://www.skicb.com/explore-the-resort/activities-and-events/summer-activities.aspx" },
  },
  {
    heading: "Wildflower Festival",
    image: "/leadville/activities/summer-boom-days.jpeg",
    description:
      "Every July, Crested Butte hosts the longest-running wildflower festival in Colorado — guided hikes, photography workshops, art classes, and identification walks across nine days. The town is bursting with lupine, paintbrush, and columbine through August.",
    link: { url: "https://crestedbuttewildflowerfestival.org/" },
  },
  {
    heading: "Golf",
    image: "/leadville/activities/summer-golf.jpeg",
    description:
      "The Club at Crested Butte and the Skyland course offer golfers two scenic options at altitude. Both courses sit between 8,000 and 9,000 ft, with mountain views on every hole.",
    link: { url: "https://theclubatcb.com/" },
  },
  {
    heading: "Horseback Riding",
    image: "/leadville/activities/summer-horseback-riding.jpeg",
    description:
      "Half-day and full-day rides through aspen groves and alpine meadows. Local outfitters know the back trails and the best wildflower viewpoints — perfect for first-time and experienced riders alike.",
    link: { url: "https://www.fantasyranchoutfitters.com/" },
  },
  {
    heading: "Fly Fishing",
    image: "/leadville/activities/summer-fly-fishing.jpg",
    description:
      "The East River, Slate River, and Lake Irwin all hold trout. Local fly shops run guided wade trips and float trips on the Gunnison and Taylor Rivers — both an easy drive from Crested Butte.",
    link: { url: "https://dragonflyanglers.com/" },
  },
  {
    heading: "Stand-Up Paddleboarding",
    image: "/leadville/activities/summer-canoes-kayaks-paddleboards.jpg",
    description:
      "Lake Irwin (15 minutes from town) and Long Lake (top of Kebler Pass) both offer calm alpine water for paddleboarding, kayaking, and canoeing. Rentals are available in town.",
    link: { url: "https://travelcrestedbutte.com/crested-butte-stand-up-paddleboarding/" },
  },
  {
    heading: "Rafting",
    image: "/leadville/activities/summer-rafting.jpeg",
    description:
      "Whitewater rafting on the Taylor and Arkansas Rivers — both within a 1-2 hour drive from Crested Butte. Half-day floats up to full-day adventures, with options for families and thrill-seekers.",
    link: { url: "https://www.scenicriverrafting.com/" },
  },
  {
    heading: "Hot Air Ballooning",
    image: "/leadville/activities/summer-utv-dirt-bike-tours.jpeg",
    description:
      "Sunrise hot air balloon flights over the Gunnison Valley with mountain views in every direction. A bucket-list way to see the wildflowers from above.",
    link: { url: "https://heycrestedbutte.com/listing/big-horn-balloon/" },
  },
];

export default function Page() {
  return (
    <ActivityListPage
      bgImage="/crested-butte/things-summer.jpg"
      title="Summer Activities"
      lede="Crested Butte's summer is wildflowers, mountain bikes, and lift-served bike parks — three months of alpine play between the snow melts and the leaves turn."
      activities={ACTIVITIES}
      thingsToDoHref="/crested-butte/things-to-do"
      browseHref="/properties?city=Crested+Butte"
      browseLabel="Browse Crested Butte Rentals"
      browseLede="From slope-side condos to downtown lofts — we manage 70+ Crested Butte vacation rentals. Book direct and save up to 15%."
    />
  );
}
