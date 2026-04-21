// @ts-nocheck
import React, { useCallback, useState } from 'react';
import TopNavBar from './layout/TopNavBar';
import LeftPanel from './layout/LeftPanel';
import TabBar from './layout/TabBar';
import NewChatModal from './community/NewChatModal';
import { useRealtimeChat } from '../hooks/useRealtimeChat';

import HomeView from '../views/HomeView';
import AICoachView from '../views/AICoachView';
import DanceTrainingView from '../views/DanceTrainingView';
import VocalTrainingView from '../views/VocalTrainingView';
import KoreanAIView from '../views/KoreanAIView';
import MyPageView from '../views/MyPageView';
import NotificationsView from '../views/NotificationsView';
import SettingsView from '../views/SettingsView';
import ChatWindowView from '../views/ChatWindowView';
import GrowthGraphView from '../views/GrowthGraphView';
import GoalsView from '../views/GoalsView';
import SavedVideosView from '../views/SavedVideosView';
import FeedbackHistoryView from '../views/FeedbackHistoryView';
import TrendingView from '../views/TrendingView';
import PopularDanceView from '../views/PopularDanceView';
import PopularSongsView from '../views/PopularSongsView';
import KoreanContentView from '../views/KoreanContentView';
import ChallengesView from '../views/ChallengesView';
import WeaknessView from '../views/WeaknessView';
import RoutineView from '../views/RoutineView';
import CoachingView from '../views/CoachingView';

const TAB_TO_DEFAULT_VIEW = {
  home: 'home',
  discover: 'trending',
  chat: 'chat',
  aicoach: 'aicoach',
};

const VIEW_TO_TAB = {
  home: 'home',
  mypage: 'home',
  growth: 'home',
  goals: 'home',
  'saved-videos': 'home',
  'feedback-history': 'home',
  dance: 'home',
  vocal: 'home',
  korean: 'home',
  trending: 'discover',
  'popular-dance': 'discover',
  'popular-songs': 'discover',
  'korean-content': 'discover',
  challenges: 'discover',
  chat: 'chat',
  aicoach: 'aicoach',
  weakness: 'aicoach',
  routine: 'aicoach',
  coaching: 'aicoach',
};

const TRAINING_VIEWS = ['dance', 'vocal', 'korean', 'aicoach'];

export default function Layout(props) {
  const [activeTab, setActiveTab] = useState('home');
  const [mainView, setMainView] = useState('home');
  const [conversationId, setConversationId] = useState(null);
  const [lastTrainingView, setLastTrainingView] = useState('dance');
  const [newChatOpen, setNewChatOpen] = useState(false);

  const chat = useRealtimeChat();

  const handleChangeTab = useCallback(
    (tab) => {
      setActiveTab(tab);
      const defaultView = TAB_TO_DEFAULT_VIEW[tab] || 'home';
      setMainView(defaultView);
      if (TRAINING_VIEWS.includes(defaultView)) {
        setLastTrainingView(defaultView);
      }
      if (tab === 'chat' && !conversationId && chat.conversations.length) {
        const firstId = chat.conversations[0].id;
        setConversationId(firstId);
        chat.setActiveConversationId(firstId);
      }
    },
    [chat, conversationId]
  );

  const handleSelectView = useCallback((nextView) => {
    setMainView(nextView);
    const nextTab = VIEW_TO_TAB[nextView];
    if (nextTab) setActiveTab(nextTab);
    if (TRAINING_VIEWS.includes(nextView)) {
      setLastTrainingView(nextView);
    }
  }, []);

  const handleSelectConversation = useCallback(
    (id) => {
      setConversationId(id);
      chat.setActiveConversationId(id);
      setMainView('chat');
      setActiveTab('chat');
    },
    [chat]
  );

  const handleCreateConversation = useCallback(
    (name, type) => {
      chat.createConversation(name, type);
    },
    [chat]
  );

  const handleOpenNotifications = useCallback(() => {
    setMainView('notifications');
  }, []);

  const handleOpenSettings = useCallback(() => {
    setMainView('settings');
  }, []);

  const renderMainContent = () => {
    switch (mainView) {
      case 'home':
        return <HomeView onNavigate={handleSelectView} />;
      case 'mypage':
        return <MyPageView onNavigate={handleSelectView} lastTrainingView={lastTrainingView} />;
      case 'growth':
        return <GrowthGraphView />;
      case 'goals':
        return <GoalsView />;
      case 'saved-videos':
        return <SavedVideosView />;
      case 'feedback-history':
        return <FeedbackHistoryView />;
      case 'dance':
        return <DanceTrainingView onNavigate={handleSelectView} />;
      case 'vocal':
        return <VocalTrainingView onNavigate={handleSelectView} />;
      case 'korean':
        return <KoreanAIView />;
      case 'trending':
        return <TrendingView />;
      case 'popular-dance':
        return <PopularDanceView />;
      case 'popular-songs':
        return <PopularSongsView />;
      case 'korean-content':
        return <KoreanContentView />;
      case 'challenges':
        return <ChallengesView />;
      case 'chat':
        return (
          <ChatWindowView
            conversationId={conversationId}
            conversations={chat.conversations}
            activeConversation={chat.activeConversation}
            setActiveConversationId={chat.setActiveConversationId}
            draft={chat.draft}
            setDraft={chat.setDraft}
            sendText={chat.sendText}
            sendMedia={chat.sendMedia}
            uploading={chat.uploading}
            markRead={chat.markRead}
          />
        );
      case 'aicoach':
        return <AICoachView />;
      case 'weakness':
        return <WeaknessView />;
      case 'routine':
        return <RoutineView />;
      case 'coaching':
        return <CoachingView />;
      case 'notifications':
        return <NotificationsView onNavigate={handleSelectView} />;
      case 'settings':
        return <SettingsView {...props} />;
      default:
        return <HomeView onNavigate={handleSelectView} />;
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{ background: '#F5F5F7' }}
    >
      <TopNavBar
        onOpenNotifications={handleOpenNotifications}
        onOpenSettings={handleOpenSettings}
      />

      <div
        className="flex flex-1 min-h-0"
        style={{ paddingTop: 48 }}
      >
        <LeftPanel
          activeTab={activeTab}
          mainView={mainView}
          conversationId={conversationId}
          onChangeTab={handleChangeTab}
          onSelectView={handleSelectView}
          onSelectConversation={handleSelectConversation}
          onOpenNewChat={() => setNewChatOpen(true)}
          onOpenSettings={handleOpenSettings}
          conversations={chat.conversations}
        />

        <main
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ background: '#F5F5F7' }}
        >
          {renderMainContent()}
        </main>
      </div>

      <div
        className="md:hidden"
        style={{ flexShrink: 0, background: '#FFFFFF' }}
      >
        <TabBar
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          layout="bottom"
        />
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onCreate={handleCreateConversation}
      />
    </div>
  );
}
