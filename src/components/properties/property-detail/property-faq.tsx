interface FaqItem {
  question: string;
  answer: string;
}

interface PropertyFaqProps {
  faqs: FaqItem[];
}

export function PropertyFaq({ faqs }: PropertyFaqProps) {
  if (faqs.length === 0) return null;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Frequently Asked Questions</h2>
      <dl className="divide-y divide-border">
        {faqs.map((faq, i) => (
          <div key={i} className="py-4 first:pt-0 last:pb-0">
            <dt className="text-sm font-semibold text-foreground">
              {faq.question}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Generate property-specific FAQ items from listing data.
 * Called server-side in page.tsx.
 */
export function generatePropertyFaqs({
  propertyName,
  bedrooms,
  bathrooms,
  accommodates,
  petsAllowed,
  checkInTime,
  checkOutTime,
  cancellationText,
  neighborhoodName,
  hasKitchen,
  hasWifi,
  hasParking,
  hasWasherDryer,
}: {
  propertyName: string;
  bedrooms: number | null;
  bathrooms: number | null;
  accommodates: number | null;
  petsAllowed: boolean;
  checkInTime: string;
  checkOutTime: string;
  cancellationText: string;
  neighborhoodName: string | null;
  hasKitchen: boolean;
  hasWifi: boolean;
  hasParking: boolean;
  hasWasherDryer: boolean;
}): FaqItem[] {
  const faqs: FaqItem[] = [];

  // Capacity
  if (accommodates) {
    const parts = [
      `${propertyName} accommodates up to ${accommodates} guests`,
      bedrooms
        ? `with ${bedrooms} ${bedrooms === 1 ? "bedroom" : "bedrooms"}`
        : null,
      bathrooms
        ? `and ${bathrooms} ${Number(bathrooms) === 1 ? "bathroom" : "bathrooms"}`
        : null,
    ].filter(Boolean);
    faqs.push({
      question: `How many guests can stay at ${propertyName}?`,
      answer: `${parts.join(" ")}. All linens, towels, and essentials are provided for your stay.`,
    });
  }

  // Check-in/out
  if (checkInTime || checkOutTime) {
    const parts = [
      checkInTime ? `Check-in is after ${checkInTime}` : null,
      checkOutTime ? `checkout is before ${checkOutTime}` : null,
    ].filter(Boolean);
    faqs.push({
      question: "What time is check-in and check-out?",
      answer: `${parts.join(" and ")}. All of our properties feature self check-in with smart lock access — no need to coordinate a key handoff.`,
    });
  }

  // Pets
  faqs.push({
    question: `Is ${propertyName} pet-friendly?`,
    answer: petsAllowed
      ? `Yes, ${propertyName} welcomes pets. A pet fee may apply — check the listing details for specifics. We recommend bringing your pet's bedding and bowls for their comfort.`
      : `${propertyName} does not allow pets. If you're traveling with a pet, browse our pet-friendly Colorado rentals for options that welcome furry friends.`,
  });

  // Amenities
  const amenityList: string[] = [];
  if (hasKitchen) amenityList.push("a full kitchen");
  if (hasWifi) amenityList.push("high-speed WiFi");
  if (hasParking) amenityList.push("parking");
  if (hasWasherDryer) amenityList.push("in-unit washer and dryer");
  if (amenityList.length >= 2) {
    faqs.push({
      question: "What amenities are included?",
      answer: `${propertyName} includes ${amenityList.join(", ")}, along with all the essentials for a comfortable stay. See the full amenities list above for everything that's available.`,
    });
  }

  // Cancellation
  if (cancellationText) {
    faqs.push({
      question: "What is the cancellation policy?",
      answer: `${cancellationText} You can view our full cancellation policy for more details.`,
    });
  }

  // Location
  if (neighborhoodName) {
    faqs.push({
      question: `What is the ${neighborhoodName} neighborhood like?`,
      answer: `${propertyName} is located in Colorado's ${neighborhoodName}, one of the city's most desirable neighborhoods for visitors. The area features walkable streets, excellent restaurants, and easy access to Colorado's top attractions. See the neighborhood section above for nearby landmarks.`,
    });
  }

  return faqs;
}
