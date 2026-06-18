import { useState, useEffect } from "react";

/** Reactive media-query hook for responsive layout switches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    // matchMedia "change" + window "resize" — the latter also covers viewport
    // changes (rotation, devtools resize) that don't always fire "change".
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [query]);

  return matches;
}
