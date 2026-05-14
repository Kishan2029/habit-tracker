import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 120;
const RESISTANCE = 0.5;

export function usePullToRefresh({ onRefresh, enabled = true }) {
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) === 0;

    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (!atTop()) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    };

    const onTouchMove = (e) => {
      if (refreshingRef.current || startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        pullingRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      if (!atTop()) {
        startYRef.current = null;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      pullingRef.current = true;
      const eased = Math.min(MAX_PULL, delta * RESISTANCE);
      pullDistanceRef.current = eased;
      setPullDistance(eased);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (refreshingRef.current) return;
      const shouldRefresh = pullingRef.current && pullDistanceRef.current >= THRESHOLD;
      pullingRef.current = false;
      startYRef.current = null;
      if (shouldRefresh) {
        refreshingRef.current = true;
        setRefreshing(true);
        pullDistanceRef.current = THRESHOLD;
        setPullDistance(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
      } else {
        pullDistanceRef.current = 0;
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
  }, [enabled, onRefresh]);

  return { containerRef, pullDistance, refreshing, threshold: THRESHOLD };
}
