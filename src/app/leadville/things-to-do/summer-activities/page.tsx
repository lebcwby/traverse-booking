import type { Metadata } from "next";
import {
  ActivityListPage,
  type Activity,
} from "../activity-list-page";
import "../../../no-fees/no-fees.css";
import "../activities-shared.css";

export const metadata: Metadata = {
  title: "Summer Activities in Leadville Colorado | Traverse Hospitality",
  description:
    "Hiking, mountain biking, fly fishing, golf, horseback riding and more — summer things to do in Leadville, Colorado. Local-favorite picks from Traverse Hospitality.",
  alternates: {
    canonical:
      "https://www.booktraverse.com/leadville/things-to-do/summer-activities/",
  },
};

const ACTIVITIES: Activity[] = [
  {
    heading: "Hiking",
    image: "/leadville/activities/summer-hiking.jpg",
    description:
      "If you're looking for a long or short hike, Leadville has it. There are so many trailheads close to Leadville. Easier hikes include Turquoise Lake Trail, Native Lake Trail, or Mineral Belt Trail. If you want to become a true Coloradan though, you can hike a 14er (14,000 ft mountain) like Mt. Massive or Mt. Elbert.",
    link: { url: "https://www.alltrails.com/us/colorado/leadville" },
  },
  {
    heading: "Running",
    image: "/leadville/activities/summer-running.jpeg",
    description:
      "These races will take your breath away. Because of Leadville's elevation, these races are some of the hardest in the country, but you'll get some great views of the Rockies — once-in-a-lifetime experiences.",
    link: { url: "https://www.alltrails.com/us/colorado/leadville" },
  },
  {
    heading: "Mountain Biking",
    image: "/leadville/activities/summer-mountain-biking.jpg",
    description:
      "Another way to explore the Rockies is mountain biking. Going on a self-guided tour in the mountains is one of the best ways to explore and adventure through the land. The Mineral Belt Trail is a 12.5-mile paved loop that wanders through Leadville's Historic Mining District.",
    link: { url: "https://www.alltrails.com/us/colorado/leadville" },
  },
  {
    heading: "Boom Days",
    image: "/leadville/activities/summer-boom-days.jpeg",
    description:
      "Boom Days is a Colorado mountain festival and a celebration of the Old West. There are gunslingers, burro races (CO's state summer sport), contests of mining skills, and over 100 booths. Experience Leadville in all its glory with three days of food, art, craft, and activities.",
  },
  {
    heading: "Fish Hatchery",
    image: "/leadville/activities/summer-fish-hatchery.jpeg",
    description:
      "The second-oldest federally operated National Fish Hatchery in the country — built to increase the depleting fish supply for inland waters. The hatchery grounds occupy 3,072 acres of clean, cold water that creates the perfect environment for growing trout.",
    link: {
      url: "https://www.fws.gov/mountain-prairie/fisheries/leadville.php",
    },
  },
  {
    heading: "Golf",
    image: "/leadville/activities/summer-golf.jpeg",
    description:
      "Colorado's highest golf course with the prettiest view of the mountains. Mt. Massive Golf Course is open to the public and is located near the Arkansas River headwaters.",
    link: { url: "https://www.mtmassivegolf.com/" },
  },
  {
    heading: "Horseback Riding",
    image: "/leadville/activities/summer-horseback-riding.jpeg",
    description:
      "Go on a horseback riding trip through the Rockies and tap into your inner rancher. You'll have incredible mountain views and pass old mines and logging sites — you could even ride to the top of Mt. Zion.",
    link: { url: "https://halfmoonpacking.com/rides/" },
  },
  {
    heading: "UTV + Dirt Bike Tours",
    image: "/leadville/activities/summer-utv-dirt-bike-tours.jpeg",
    description:
      "Guided tours through trails in 4-seated UTVs or dirt bikes through Leadville's terrain.",
    link: { url: "https://www.elkmountainadventures.com/tours" },
  },
  {
    heading: "Canoes, Kayaks + Paddleboards",
    image: "/leadville/activities/summer-canoes-kayaks-paddleboards.jpg",
    description:
      "Experience the fresh, clean mountain water from a canoe, kayak, stand-up paddleboard, or even a fishing trip.",
    link: {
      url: "https://www.leadvilletwinlakes.com/things-to-do-detail/twin-lakes-canoe-kayak-adventures/",
    },
  },
  {
    heading: "Rafting",
    image: "/leadville/activities/summer-rafting.jpeg",
    description:
      "What's a Colorado trip without whitewater rafting? Travel to Breckenridge or Frisco — just an hour outside of Leadville — to experience this amazing adventure.",
    link: {
      url: "https://www.colorado.com/co/leadville/water-activities/rafting",
    },
  },
  {
    heading: "Fly Fishing",
    image: "/leadville/activities/summer-fly-fishing.jpg",
    description:
      "Walk-and-wade fly fishing in the Arkansas River. You're likely to find wild brown trout, but the smaller streams support a healthy population of wild browns and brook trout, and you can find cutthroat trout in the high alpine lakes.",
    link: { url: "https://coloradoflyfishingguides.com/" },
  },
];

export default function Page() {
  return (
    <ActivityListPage
      bgImage="/leadville/things-summer.webp"
      title="Summer Activities"
      lede="Don't forget to bring sunscreen and canned oxygen! Leadville's summer is short, sweet, and stuffed with above-treeline adventure."
      activities={ACTIVITIES}
    />
  );
}
