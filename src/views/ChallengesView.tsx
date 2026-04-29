// @ts-nocheck
import React from 'react';
import DiscoverView from './DiscoverView';

export default function ChallengesView({ onNavigate }) {
  return <DiscoverView onNavigate={onNavigate} initialCategory="challenges" hideCategoryTabs />;
}
