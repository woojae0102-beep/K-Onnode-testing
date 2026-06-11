// @ts-nocheck
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/group-studio.css';

export function HorizontalSongScroll({
  children,
  itemCount = 0,
  showArrows = true,
}) {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const count = itemCount || React.Children.count(children);
  const showNav = showArrows && count > 1;

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(maxScroll <= 2 || el.scrollLeft >= maxScroll - 2);
  }, []);

  useLayoutEffect(() => {
    updateEdges();
    const raf = requestAnimationFrame(updateEdges);
    const timers = [80, 250, 800].map((ms) => window.setTimeout(updateEdges, ms));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [children, count, updateEdges]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null;
    ro?.observe(el);
    Array.from(el.children).forEach((child) => ro?.observe(child));
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
      ro?.disconnect();
    };
  }, [updateEdges, children, count]);

  const scrollPage = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector('.group-studio-song-card');
    const gap = 12;
    const step = card ? card.getBoundingClientRect().width + gap : 152;
    const visible = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: direction * step * Math.min(visible, 2), behavior: 'smooth' });
  }, []);

  const isInteractiveTarget = (target) => target?.closest?.(
    '.group-studio-song-card, .group-studio-card-fav, .group-studio-inline-fav, button, a',
  );

  const onPointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el || e.button > 0 || isInteractiveTarget(e.target)) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag.active) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) < 8) return;
    drag.moved = true;
    el.scrollLeft = drag.scrollLeft - dx;
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
    window.setTimeout(() => {
      dragRef.current.moved = false;
    }, 0);
    updateEdges();
  }, [updateEdges]);

  return (
    <div className="group-studio-carousel">
      {showNav ? (
        <button
          type="button"
          className="group-studio-carousel-arrow group-studio-carousel-arrow--left"
          disabled={atStart}
          onClick={() => scrollPage(-1)}
          aria-label={t('groupStudio.home.scrollPrev')}
        >
          <span aria-hidden>←</span>
        </button>
      ) : null}

      <div
        ref={scrollRef}
        className="group-studio-scroll group-studio-scroll-snap group-studio-scroll-draggable"
        onScroll={updateEdges}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>

      {showNav ? (
        <button
          type="button"
          className="group-studio-carousel-arrow group-studio-carousel-arrow--right"
          disabled={atEnd}
          onClick={() => scrollPage(1)}
          aria-label={t('groupStudio.home.scrollNext')}
        >
          <span aria-hidden>→</span>
        </button>
      ) : null}
    </div>
  );
}

export default HorizontalSongScroll;
