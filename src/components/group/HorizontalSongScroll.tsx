// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/group-studio.css';

const CARD_STEP = 152;

export function HorizontalSongScroll({ children, showArrows = true }) {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
      ro?.disconnect();
    };
  }, [updateArrows, children]);

  const scrollByStep = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * CARD_STEP, behavior: 'smooth' });
  }, []);

  return (
    <div className={`group-studio-scroll-wrap ${showArrows ? 'has-arrows' : ''}`}>
      {showArrows && canScrollLeft ? (
        <button
          type="button"
          className="group-studio-scroll-arrow group-studio-scroll-arrow--left"
          onClick={() => scrollByStep(-1)}
          aria-label={t('groupStudio.home.scrollPrev')}
        >
          ‹
        </button>
      ) : null}

      <div ref={scrollRef} className="group-studio-scroll group-studio-scroll-snap">
        {children}
      </div>

      {showArrows && canScrollRight ? (
        <button
          type="button"
          className="group-studio-scroll-arrow group-studio-scroll-arrow--right"
          onClick={() => scrollByStep(1)}
          aria-label={t('groupStudio.home.scrollNext')}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

export default HorizontalSongScroll;
