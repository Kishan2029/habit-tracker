import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 120;
const RESISTANCE = 0.5;

export function usePullToRefresh({ onRefresh, enabled = true }) {
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) === 0;

    const onTouchStart = (e) => {
      if (refreshing) return;
      if (!atTop()) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    };

    const onTouchMove = (e) => {
      if (refreshing || startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }
      if (!atTop()) {
        startYRef.current = null;
        setPullDistance(0);
        return;
      }
      pullingRef.current = true;
      const eased = Math.min(MAX_PULL, delta * RESISTANCE);
      setPullDistance(eased);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (refreshing) return;
      const shouldRefresh = pullingRef.current && pullDistance >= THRESHOLD;
      pullingRef.current = false;
      startYRef.current = null;
      if (shouldRefresh) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance, refreshing]);

  return { containerRef, pullDistance, refreshing, threshold: THRESHOLD };
}
