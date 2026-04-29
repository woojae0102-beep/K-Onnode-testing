// @ts-nocheck
import React from 'react';
import DiscoverView from './DiscoverView';

export default function PopularSongsView({ onNavigate }) {
  return <DiscoverView onNavigate={onNavigate} initialCategory="songs" hideCategoryTabs />;
}
