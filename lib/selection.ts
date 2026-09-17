export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  url?: string;
  image?: string;
  contentId?: string;
  source: "kakao" | "tourapi" | "map";
};
export type SavedCourse = {
  id: string;
  title: string;
  memo: string;
  createdAt: string;
  places: Place[];
  parking: Place | null;
};
type Saved = {
  version: 1;
  parking: Place | null;
  courses: SavedCourse[];
};
export const STORAGE_KEY = "suwon-ddp-real-selections-v1";
function validPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Place;
  return (
    typeof place.id === "string" &&
    !!place.id &&
    typeof place.name === "string" &&
    !!place.name &&
    typeof place.address === "string" &&
    ["kakao", "tourapi", "map"].includes(place.source) &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lng) <= 180
  );
}
export function readSaved(): Saved {
  const empty: Saved = { version: 1, parking: null, courses: [] };
  if (typeof window === "undefined") return empty;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "null",
    );
    if (!saved || saved.version !== 1) return empty;
    return {
      version: 1,
      parking: validPlace(saved.parking) ? saved.parking : null,
      courses: Array.isArray(saved.courses)
        ? saved.courses.filter(
            (course: SavedCourse) =>
              course &&
              typeof course.id === "string" &&
              typeof course.title === "string" &&
              typeof course.memo === "string" &&
              typeof course.createdAt === "string" &&
              Array.isArray(course.places) &&
              course.places.length > 0 &&
              course.places.every(validPlace) &&
              (course.parking === null || validPlace(course.parking)),
          )
        : [],
    };
  } catch {
    return empty;
  }
}
export function writeSaved(saved: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    window.dispatchEvent(new Event("suwon-saved-change"));
    return true;
  } catch {
    return false;
  }
}
export function saveParking(parking: Place) {
  return writeSaved({ ...readSaved(), parking });
}
export function saveCourse(
  places: Place[],
  parking: Place | null,
): SavedCourse | null {
  if (!places.length || !places.every(validPlace)) return null;
  const course: SavedCourse = {
    id: crypto.randomUUID(),
    title: places.map((place) => place.name).join(" → "),
    memo: "",
    createdAt: new Date().toISOString(),
    places,
    parking,
  };
  return writeSaved({
    ...readSaved(),
    courses: [course, ...readSaved().courses],
  })
    ? course
    : null;
}
