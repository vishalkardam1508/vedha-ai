"use client";

import { useEffect, useCallback, useRef } from "react";
import type { WarningType } from "@/types";
import { getTimestamp } from "@/lib/utils";
import { WARNING_MESSAGES } from "@/lib/constants";

const AWAY_GRACE_MS = 5000;

interface UseProctoringOptions {
  active: boolean;
  onWarning: (type: WarningType, message: string, timestamp: string) => void;
  /** Fired if the candidate stays off this tab/window for longer than the grace period. */
  onAwayTimeout: () => void;
}

export function useProctoring({ active, onWarning, onAwayTimeout }: UseProctoringOptions) {
  const activeRef = useRef(active);
  activeRef.current = active;

  const warn = useCallback(
    (type: WarningType) => {
      if (!activeRef.current) return;
      const message = WARNING_MESSAGES[type];
      const timestamp = getTimestamp();
      onWarning(type, message, timestamp);
    },
    [onWarning]
  );

  useEffect(() => {
    if (!active) return;

    // Tab-switch fires visibilitychange AND window blur almost simultaneously — track a single
    // "away" state so both are treated as one incident, with one grace-period timer.
    let isAway = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const markAway = (type: WarningType) => {
      if (isAway) return;
      isAway = true;
      warn(type);
      timer = setTimeout(() => {
        if (isAway) onAwayTimeout();
      }, AWAY_GRACE_MS);
    };

    const markBack = () => {
      if (!isAway) return;
      isAway = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) markAway("TAB_CHANGE");
      else markBack();
    };
    const handleBlur = () => markAway("WINDOW_BLUR");
    const handleFocus = () => markBack();
    // The interview auto-enters fullscreen on start (see page.tsx) — exiting it (Esc, alt-tab
    // on some setups, etc.) is treated the same way as switching tabs: same grace timer, same
    // strike system, not a separate mechanism.
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) markAway("FULLSCREEN_EXIT");
      else markBack();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (timer) clearTimeout(timer);
    };
  }, [active, warn, onAwayTimeout]);

  return { triggerWarning: warn };
}
