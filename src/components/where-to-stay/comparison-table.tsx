import type { NeighborhoodData } from "@/lib/where-to-stay-data";

export function ComparisonTable({
  neighborhoods,
}: {
  neighborhoods: NeighborhoodData[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border bg-muted/30 text-left">
            <th className="whitespace-nowrap px-4 py-3 font-semibold">
              Neighborhood
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Vibe</th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
              Walk
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
              Dining
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
              Nightlife
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">
              Best For
            </th>
          </tr>
        </thead>
        <tbody>
          {neighborhoods.map((n) => (
            <tr key={n.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: n.color }}
                  />
                  <span className="font-medium">{n.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{n.vibe}</td>
              <td className="px-4 py-3 text-center">
                {n.scores.walkability}/10
              </td>
              <td className="px-4 py-3 text-center">{n.scores.dining}/10</td>
              <td className="px-4 py-3 text-center">{n.scores.nightlife}/10</td>
              <td className="px-4 py-3 text-muted-foreground">
                {n.bestFor.join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
