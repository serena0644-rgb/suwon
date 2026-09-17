"use client";
import { useMemo, useSyncExternalStore } from "react";
import { readSaved, STORAGE_KEY } from "@/lib/selection";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("suwon-saved-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("suwon-saved-change", callback);
  };
}
function snapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
export function useSaved() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(
    () =>
      raw ? readSaved() : { version: 1 as const, parking: null, courses: [] },
    [raw],
  );
}
