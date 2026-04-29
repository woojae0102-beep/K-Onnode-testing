// @ts-nocheck
import React from 'react';
import DiscoverView from './DiscoverView';

export default function PopularDanceView({ onNavigate }) {
  return <DiscoverView onNavigate={onNavigate} initialCategory="dance" hideCategoryTabs />;
}
