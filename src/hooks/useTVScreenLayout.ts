// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';

const MOBILE_MAX = 767;

function readLayout() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isLandscape: false };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  // 가로 회전 시 width가 768px 이상이어도 짧은 변 기준으로 스마트폰 판별
  const isMobile = Math.min(w, h) <= MOBILE_MAX;
  const isLandscape = w > h;
  return { isMobile, isLandscape };
}

/**
 * CSS orientation 미디어쿼리 대신 실제 뷰포트 비율로 세로/가로 판별 (iOS·Android 공통)
 */
export function useTVScreenLayout() {
  const [layout, setLayout] = useState(readLayout);

  const refresh = useCallback(() => {
    setLayout(readLayout());
  }, []);

  useEffect(() => {
    refresh();
    const onResize = () => refresh();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const t1 = window.setTimeout(refresh, 120);
    const t2 = window.setTimeout(refresh, 400);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [refresh]);

  const layoutClass = layout.isMobile
    ? layout.isLandscape
      ? 'tv-screen-mobile tv-screen-landscape'
      : 'tv-screen-mobile tv-screen-portrait'
    : 'tv-screen-desktop';

  return { ...layout, layoutClass };
}

export default useTVScreenLayout;
