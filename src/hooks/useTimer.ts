"use client";

import { useState, useEffect, useRef } from "react";

export function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const reset = () => setElapsed(0);
  return { elapsed, reset };
}
