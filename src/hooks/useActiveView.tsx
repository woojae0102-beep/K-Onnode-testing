// @ts-nocheck
import React, { createContext, useContext, useMemo, useState } from 'react';

const ActiveViewContext = createContext(null);

export function ActiveViewProvider({ children }) {
  const [activeView, setActiveView] = useState('aicoach');
  const [lastTrainingView, setLastTrainingView] = useState('tv-mode');

  const navigate = (nextView) => {
    setActiveView(nextView);
    if (['korean', 'tv-mode', 'agency-audition', 'aicoach'].includes(nextView)) {
      setLastTrainingView(nextView);
    }
  };

  const value = useMemo(
    () => ({
      activeView,
      setActiveView: navigate,
      lastTrainingView,
      setLastTrainingView,
    }),
    [activeView, lastTrainingView]
  );

  return <ActiveViewContext.Provider value={value}>{children}</ActiveViewContext.Provider>;
}

export function useActiveView() {
  const ctx = useContext(ActiveViewContext);
  if (!ctx) {
    throw new Error('useActiveView must be used inside ActiveViewProvider');
  }
  return ctx;
}
