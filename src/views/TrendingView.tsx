// @ts-nocheck
import React from 'react';
import DiscoverView from './DiscoverView';

export default function TrendingView({ onNavigate }) {
  return <DiscoverView onNavigate={onNavigate} initialCategory="trending" hideCategoryTabs />;
}
