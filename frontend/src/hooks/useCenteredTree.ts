import { useCallback, useEffect, useState } from "react";

export function useCenteredTree(defaultTranslate = { x: 0, y: 0 }) {
  const [translate, setTranslate] = useState(defaultTranslate);

  const containerRef = useCallback((containerEl: HTMLDivElement | null) => {
    if (containerEl !== null) {
      const dimensions = containerEl.getBoundingClientRect();
      setTranslate({
        x: dimensions.width / 2,
        y: 100, 
      });
    }
  }, []);

  return { translate, containerRef };
}
