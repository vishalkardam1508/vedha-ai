"use client";

import { useEffect, useState } from "react";

// Shared across the home page and /practice — whichever page's toggle is used, the choice is
// remembered under this one key so the other page picks up the same theme on its next load.
const THEME_STORAGE_KEY = "veda-home-theme";

export function useTheme() {
  // Dark is the default look for a first-time visitor — this matches the server-rendered
  // initial value exactly (the effect below only ever runs client-side, after hydration), so
  // there's no hydration mismatch even though it's read before localStorage is checked.
  const [dark, setDark] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(THEME_STORAGE_KEY) === "light") setDark(false);
    } catch {
      /* localStorage unavailable (private mode, etc.) — default to dark */
    }

    function onStorage(e: StorageEvent) {
      if (e.key === THEME_STORAGE_KEY) setDark(e.newValue === "dark");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return { dark, toggleTheme };
}
