// @ts-nocheck
import { useEffect, useState } from 'react';
import { isMobileDevice } from '../utils/mobileMedia';

/** 좁은 화면(스마트폰)에서 티칭 UI를 세로 스택으로 전환 */
export function useMobileLayout() {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined') return isMobileDevice();
    return window.innerWidth < 768 || isMobileDevice();
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsNarrow(mq.matches || isMobileDevice());
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return { isNarrow, isMobile: isMobileDevice() };
}

export default useMobileLayout;
