import { useEffect, useState } from "react";

type VisualViewportSnapshot = {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
};

const readSnapshot = (): VisualViewportSnapshot => {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, offsetTop: 0, offsetLeft: 0, scale: 1 };
  }

  const vv = window.visualViewport;

  // visualViewport is the most reliable source for “what the user can actually see” on mobile
  // (especially when the on-screen keyboard opens). Fallback to innerWidth/innerHeight.
  return {
    width: Math.round((vv?.width ?? window.innerWidth) || 0),
    height: Math.round((vv?.height ?? window.innerHeight) || 0),
    offsetTop: Math.round(vv?.offsetTop ?? 0),
    offsetLeft: Math.round(vv?.offsetLeft ?? 0),
    scale: vv?.scale ?? 1,
  };
};

export function useVisualViewport(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [snapshot, setSnapshot] = useState<VisualViewportSnapshot>(() => readSnapshot());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const vv = window.visualViewport;
    let raf = 0;

    const update = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setSnapshot(readSnapshot());
      });
    };

    // Sync immediately (covers the “2–3 seconds later” viewport correction that some browsers do)
    update();

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return snapshot;
}
