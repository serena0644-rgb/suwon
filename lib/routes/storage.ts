import type { Place } from "@/lib/selection";
import type { MapPlace } from "@/components/map/route-map";

export function toMapPlace(place: Place): MapPlace {
  return {
    ...place,
    id: `${place.source}-${place.id}`,
    kind: "tour",
    subtitle: place.address,
    original: place,
  };
}
