import type { TimeSlot } from "./schema";
import type { PoiCategory } from "@/lib/pois/types";

export function slotLabel(slot: TimeSlot, category?: PoiCategory): string {
  if (category === "coffee") return "Coffee";
  if (slot === "late") return "Late night";
  if (category === "bar") {
    if (slot === "afternoon") return "Happy hour";
    return "Drinks";
  }
  if (category === "restaurant" || category === "food_cart_pod") {
    if (slot === "morning") return "Breakfast";
    if (slot === "evening") return "Dinner";
    return "Lunch";
  }
  return "Things to do";
}
