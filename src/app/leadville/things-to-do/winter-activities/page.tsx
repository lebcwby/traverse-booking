import type { Metadata } from "next";
import {
  ActivityListPage,
  type Activity,
} from "../activity-list-page";
import "../../../no-fees/no-fees.css";
import "../activities-shared.css";

export const metadata: Metadata = {
  title: "Winter Activities in Leadville Colorado | Traverse Hospitality",
  description:
    "Skiing, dog sledding, fat tire biking, ice castles, ski joring and more — winter things to do in Leadville, Colorado. Local picks from Traverse Hospitality.",
  alternates: {
    canonical:
      "https://www.booktraverse.com/leadville/things-to-do/winter-activities/",
  },
};

const ACTIVITIES: Activity[] = [
  {
    heading: "Ski Joring",
    image: "/leadville/activities/winter-ski-joring.jpeg",
    description:
      "Leadville has been hosting a ski joring race for over 70 years. The snow is packed down on the street, and then horse-and-rider teams pull skiers behind them while going off jumps.",
  },
  {
    heading: "Ski Cooper",
    image: "/leadville/activities/winter-ski-cooper.jpeg",
    description:
      "Yep, you read that right. Ski Cooper has 59 trails served by 5 lifts that span 470 lift-served acres. Ski Cooper is the closest ski mountain to Leadville (10-minute drive). Because of its base elevation and an average of 260\" of snow every year, the snow stays dry and fluffy.",
    link: { url: "https://www.skicooper.com/" },
  },
  {
    heading: "Snowcat Skiing",
    image: "/leadville/activities/winter-snowcat-skiing.jpeg",
    description:
      "\"Soak in spectacular scenery as we climb along the Continental Divide with dozens of Colorado's highest peaks in view. Enjoy remarkable runs with small groups and a guide\" — just on the other side of Ski Cooper.",
    link: { url: "https://www.skicooper.com/snowcat-skiing/" },
  },
  {
    heading: "Copper Mountain",
    image: "/leadville/activities/winter-copper-mountain.jpeg",
    description:
      "20 miles away from Leadville is Copper Mountain Ski Resort — another great place for skiing or snowboarding. World-class resort and part of the Ikon Pass.",
    link: { url: "https://www.coppercolorado.com/" },
  },
  {
    heading: "Nordic Skiing + Snowshoeing",
    image: "/leadville/activities/winter-nordic-skiing-snowshoeing.jpeg",
    description:
      "Nordic skiing is a great way to explore miles and miles of the area. If skiing isn't really for you, don't worry — rent a pair of snowshoes to adventure on foot.",
    link: { url: "https://www.alpineskiandsport.com/" },
  },
  {
    heading: "Fat Tire Biking",
    image: "/leadville/activities/winter-fat-tire-biking.jpeg",
    description:
      "Biking is a year-round event here in Colorado. After you rent your bike in town, take it to the Mineral Belt Trail, the Historic Mining District, or Turquoise Lake — some of Leadville's most popular trails for fat tire biking.",
    link: { url: "https://colbikes.com/winter-rentals.html" },
  },
  {
    heading: "Snow Mobiling",
    image: "/leadville/activities/winter-snow-mobiling.jpeg",
    description:
      "Go on a guided trail tour (roughly 2 hours, self-driven) or a High Adventure tour \"for the more experienced rider seeking a personal experience on ungroomed terrain.\"",
    link: { url: "https://www.elkmountainadventures.com/" },
  },
  {
    heading: "UTVs",
    image: "/leadville/activities/winter-utvs.jpeg",
    description:
      "Covered and heated UTVs that seat 4 people. \"It's a great option for families and groups with mixed skills.\" Drive alone or tag along with a guide to explore the Rockies.",
    link: { url: "https://www.elkmountainadventures.com/" },
  },
  {
    heading: "Tubing + Sledding",
    image: "/leadville/activities/winter-tubing-sledding.jpeg",
    description:
      "Bring your own tube or sled (or rent from the rental hut) to Dutch Henry Sledding Hill.",
  },
  {
    heading: "Ice Skating",
    image: "/leadville/activities/winter-ice-skating.jpg",
    description:
      "Huck Finn Ice Rink is the largest man-made ice skating rink in Colorado — and it's right here in Leadville. Bring your own skates or rent them from the rink.",
  },
  {
    heading: "Dog Sledding",
    image: "/leadville/activities/winter-dog-sledding.jpeg",
    description:
      "Go with a small group to experience this \"dog-powered fun\" — where you actually get to drive the dog sled.",
    link: { url: "https://www.alpineadventuresdogsledding.com/" },
  },
  {
    heading: "Ice Fishing",
    image: "/leadville/activities/winter-ice-fishing.jpeg",
    description:
      "Go out to Turquoise Lake, Twin Lakes, or Clear Creek Reservoir for the best ice fishing in Leadville. For a more secluded experience, try Hayden Meadows or Crystal Lakes — just south of Leadville.",
    link: {
      url: "https://www.leadvilletwinlakes.com/things-to-do/category/outdoors/fishing-ice-fishing/",
    },
  },
  {
    heading: "Ice Castles",
    image: "/leadville/activities/winter-ice-castles.jpeg",
    description:
      "Visit this award-winning frozen attraction, only a 40-minute drive from Leadville. There are ice mazes, slides, and plenty of caverns to explore. Perfect for kids and adults — and they have private alcoves you can book for special occasions.",
    link: { url: "https://icecastles.com/colorado" },
  },
  {
    heading: "Hot Springs",
    image: "/leadville/activities/winter-hot-springs.jpeg",
    description:
      "Experience Colorado's natural heated pools this winter in Buena Vista. Cottonwood Hot Springs and Mount Princeton Hot Springs are both located there, just an hour south of Leadville.",
    link: { url: "https://mtprinceton.com/" },
  },
];

export default function Page() {
  return (
    <ActivityListPage
      bgImage="/leadville/things-winter.webp"
      title="Winter Activities"
      lede="Yes, you still need sunscreen in the winter here. From Ski Cooper to dog sledding to ice castles, Leadville's winter is loaded with adventure."
      activities={ACTIVITIES}
    />
  );
}
