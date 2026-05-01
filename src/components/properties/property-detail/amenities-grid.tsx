"use client";

import { useState } from "react";
import {
  Wifi,
  Car,
  Tv,
  Flame,
  Coffee,
  WashingMachine,
  AirVent,
  Snowflake,
  UtensilsCrossed,
  Bath,
  Dog,
  Dumbbell,
  Waves,
  Trees,
  BedDouble,
  Luggage,
  Sofa,
  Droplets,
  Briefcase,
  Wind,
  Thermometer,
  CookingPot,
  Fence,
  CircleParking,
  ShirtIcon,
  Microwave,
  Refrigerator,
  DoorOpen,
  Lock,
  ShieldCheck,
  Baby,
  Cigarette,
  Mountain,
  Bike,
  Utensils,
  Armchair,
  BookOpen,
  Speaker,
  Gamepad2,
  Tent,
  Umbrella,
  Sparkles,
  Heater,
  Plug,
  MonitorSmartphone,
  Shirt,
  HandPlatter,
  Fish,
  Music,
  Wine,
  Flag,
  Calendar,
  Home,
  MapPin,
  Lightbulb,
  Lamp,
  Globe,
  Ticket,
  Store,
  Sailboat,
  Users,
  Accessibility,
  EyeOff,
  Clapperboard,
  FlameKindling,
  GlassWater,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Icon mapping — keys are lowercase substrings matched against amenity names.
// Order matters: more specific keys should come before generic ones.
const amenityIcons: [string, React.ComponentType<{ className?: string }>][] = [
  // Connectivity & entertainment
  ["wireless internet", Wifi],
  ["internet", Wifi],
  ["wifi", Wifi],
  ["wi-fi", Wifi],
  ["cable tv", Tv],
  ["television", Tv],
  ["dvd player", Clapperboard],
  ["tv", Tv],
  ["smart tv", MonitorSmartphone],
  ["netflix", MonitorSmartphone],
  ["streaming", MonitorSmartphone],
  ["sound system", Speaker],
  ["stereo", Speaker],
  ["speaker", Speaker],
  ["game console", Gamepad2],
  ["board game", Gamepad2],
  ["foosball", Gamepad2],
  ["ping pong", Gamepad2],
  ["pool table", Gamepad2],
  ["piano", Music],

  // Kitchen & dining
  ["dishwasher", CookingPot],
  ["microwave", Microwave],
  ["refrigerator", Refrigerator],
  ["freezer", Refrigerator],
  ["mini fridge", Refrigerator],
  ["fridge", Refrigerator],
  ["ice maker", Refrigerator],
  ["oven", CookingPot],
  ["stove", CookingPot],
  ["toaster", CookingPot],
  ["blender", CookingPot],
  ["kettle", CookingPot],
  ["baking sheet", CookingPot],
  ["cookware", CookingPot],
  ["barbeque utensil", UtensilsCrossed],
  ["coffee", Coffee],
  ["espresso", Coffee],
  ["keurig", Coffee],
  ["kitchen", CookingPot],
  ["cooking", CookingPot],
  ["dishes", Utensils],
  ["silverware", Utensils],
  ["dinnerware", Utensils],
  ["wine glass", Wine],
  ["dining", Utensils],
  ["breakfast", HandPlatter],
  ["hot water", GlassWater],
  ["trash compactor", Sparkles],

  // Laundry & clothing
  ["iron", ShirtIcon],
  ["ironing", ShirtIcon],
  ["washer", WashingMachine],
  ["washing machine", WashingMachine],
  ["laundry", WashingMachine],
  ["coin laundry", WashingMachine],
  ["dryer", Wind],
  ["hanger", Shirt],
  ["clothing storage", Shirt],
  ["closet", ShirtIcon],

  // Climate
  ["air conditioning", Snowflake],
  ["central air", Snowflake],
  ["heating", Thermometer],
  ["heated", Heater],
  ["radiator", Heater],
  ["indoor fireplace", Flame],
  ["fireplace guard", ShieldCheck],
  ["fireplace", Flame],
  ["fire place", Flame],
  ["fire pit", FlameKindling],
  ["portable fan", AirVent],
  ["ceiling fan", AirVent],
  ["fan", AirVent],
  ["ventilat", AirVent],
  ["room-darkening", EyeOff],
  ["blackout", EyeOff],

  // Bathroom & toiletries
  ["hair dryer", Waves],
  ["hairdryer", Waves],
  ["blow dryer", Waves],
  ["shower gel", Droplets],
  ["shower bench", Bath],
  ["bathtub", Bath],
  ["hot tub", Bath],
  ["jacuzzi", Bath],
  ["body soap", Droplets],
  ["shampoo", Droplets],
  ["conditioner", Droplets],
  ["toiletries", Droplets],
  ["towel", Sparkles],
  ["essentials", Sparkles],

  // Bedroom & linens
  ["bed linen", BedDouble],
  ["linens", BedDouble],
  ["pillow", BedDouble],
  ["blanket", BedDouble],
  ["mattress", BedDouble],
  ["travel crib", Baby],
  ["crib", Baby],
  ["high chair", Baby],
  ["stair gate", Baby],
  ["window guard", Baby],
  ["children", Baby],
  ["kid friendly", Baby],
  ["infant", Baby],
  ["baby", Baby],

  // Outdoor & recreation
  ["free parking", CircleParking],
  ["paid parking", Car],
  ["parking", Car],
  ["garage", Car],
  ["ev charger", Plug],
  ["bbq", UtensilsCrossed],
  ["grill", UtensilsCrossed],
  ["patio", Fence],
  ["balcony", Fence],
  ["deck", Fence],
  ["terrace", Fence],
  ["outdoor seating", Fence],
  ["yard", Fence],
  ["garden", Trees],
  ["backyard", Trees],
  ["outdoor pool", Waves],
  ["outdoor", Tent],
  ["swimming pool", Waves],
  ["pool", Waves],
  ["swim", Waves],
  ["water sport", Sailboat],
  ["water view", Waves],
  ["waterfront", Waves],
  ["beach", Umbrella],
  ["lake", Waves],
  ["river", Waves],
  ["ocean", Waves],
  ["mountain view", Mountain],
  ["mountain", Mountain],
  ["city view", MapPin],
  ["golf", Flag],
  ["cycling", Bike],
  ["bike", Bike],
  ["bicycle", Bike],
  ["fishing", Fish],
  ["gym", Dumbbell],
  ["fitness", Dumbbell],
  ["exercise", Dumbbell],
  ["resort", Globe],
  ["zoo", Ticket],
  ["museum", Store],
  ["theme park", Ticket],
  ["shopping", Store],
  ["view", Mountain],

  // Living space
  ["sofa", Sofa],
  ["couch", Sofa],
  ["living room", Sofa],
  ["lounge", Armchair],
  ["reading", BookOpen],
  ["books and toys", BookOpen],
  ["books", BookOpen],
  ["single level", Home],

  // Safety & security
  ["smoke detector", ShieldCheck],
  ["smoke alarm", ShieldCheck],
  ["carbon monoxide", ShieldCheck],
  ["fire extinguisher", ShieldCheck],
  ["first aid", ShieldCheck],
  ["disinfect", ShieldCheck],
  ["enhanced cleaning", ShieldCheck],
  ["high touch surface", ShieldCheck],
  ["safe", Lock],
  ["security", Lock],
  ["lock", Lock],
  ["deadbolt", Lock],
  ["keypad", Lock],
  ["self check-in", DoorOpen],
  ["lockbox", DoorOpen],
  ["private entrance", DoorOpen],
  ["path to entrance", Lightbulb],
  ["lit at night", Lightbulb],

  // Accessibility
  ["step-free", Accessibility],
  ["wide hallway", Accessibility],
  ["accessible", Accessibility],

  // Pets
  ["pet", Dog],
  ["dog", Dog],
  ["cat", Dog],

  // Other
  ["luggage", Luggage],
  ["suitcase", Luggage],
  ["workspace", Briefcase],
  ["laptop", Briefcase],
  ["desk", Briefcase],
  ["office", Briefcase],
  ["elevator", DoorOpen],
  ["suitable for events", Users],
  ["long term stays", Calendar],
  ["no smoking", Cigarette],
  ["smoking allowed", Cigarette],
  ["cleaning", Sparkles],
  ["lamp", Lamp],
];

function getAmenityIcon(amenity: string) {
  const lower = amenity.toLowerCase();
  for (const [key, Icon] of amenityIcons) {
    if (lower.includes(key)) return Icon;
  }
  // No fallback checkmark — pick a contextual icon based on category hints
  if (lower.includes("view")) return Mountain;
  if (lower.includes("access")) return DoorOpen;
  return Sparkles;
}

// Priority keywords — amenities matching these (in order) sort to the top
const priorityKeywords = [
  "wifi",
  "wi-fi",
  "wireless internet",
  "kitchen",
  "free parking",
  "parking",
  "pool",
  "hot tub",
  "jacuzzi",
  "washer",
  "washing machine",
  "dryer",
  "air conditioning",
  "central air",
  "workspace",
  "desk",
  "ev charger",
  "fireplace",
  "patio",
  "balcony",
  "deck",
  "bbq",
  "grill",
  "gym",
  "fitness",
  "self check-in",
  "pet",
];

function sortAmenitiesByPriority(amenities: string[]): string[] {
  const sorted: string[] = [];
  const remaining = [...amenities];

  for (const keyword of priorityKeywords) {
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i].toLowerCase().includes(keyword)) {
        sorted.push(remaining[i]);
        remaining.splice(i, 1);
      }
    }
  }

  return [...sorted, ...remaining];
}

export function AmenitiesGrid({ amenities }: { amenities: string[] }) {
  const [open, setOpen] = useState(false);
  const sortedAmenities = sortAmenitiesByPriority(amenities);
  const displayed = sortedAmenities.slice(0, 10);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {displayed.map((amenity) => {
          const Icon = getAmenityIcon(amenity);
          return (
            <div
              key={amenity}
              className="flex items-center gap-3 rounded-lg py-2 text-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <span className="text-sm text-foreground">{amenity}</span>
            </div>
          );
        })}
      </div>

      {amenities.length > 10 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-6 rounded-full px-6">
              Show all {amenities.length} amenities
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>All amenities</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {sortedAmenities.map((amenity) => {
                const Icon = getAmenityIcon(amenity);
                return (
                  <div
                    key={amenity}
                    className="flex items-center gap-3 rounded-lg py-2 text-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <span className="text-sm text-foreground">{amenity}</span>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
