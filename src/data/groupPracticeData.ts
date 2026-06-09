// @ts-nocheck
import type { GroupData, GroupMember } from '../types/groupPractice';

export type { GroupMember };

export const GROUP_DATA: Record<string, GroupData> = {
  blackpink: {
    name: 'BLACKPINK',
    nameKr: '블랙핑크',
    memberCount: 4,
    defaultFormation: 'diamond',
    members: [
      {
        id: 'jennie',
        name: 'Jennie',
        nameKr: '제니',
        color: '#FF6B9D',
        defaultX: 0.5,
        defaultY: 0.3,
        avatar: '💗',
        position: { default: { x: 0.5, y: 0.3 } },
      },
      {
        id: 'lisa',
        name: 'Lisa',
        nameKr: '리사',
        color: '#FFD700',
        defaultX: 0.75,
        defaultY: 0.5,
        avatar: '💛',
        position: { default: { x: 0.75, y: 0.5 } },
      },
      {
        id: 'rose',
        name: 'Rosé',
        nameKr: '로제',
        color: '#A78BFA',
        defaultX: 0.25,
        defaultY: 0.5,
        avatar: '💜',
        position: { default: { x: 0.25, y: 0.5 } },
      },
      {
        id: 'jisoo',
        name: 'Jisoo',
        nameKr: '지수',
        color: '#6EE7B7',
        defaultX: 0.5,
        defaultY: 0.7,
        avatar: '💚',
        position: { default: { x: 0.5, y: 0.7 } },
      },
    ],
  },

  twice: {
    name: 'TWICE',
    nameKr: '트와이스',
    memberCount: 9,
    defaultFormation: 'v_shape',
    members: [
      { id: 'nayeon', name: 'Nayeon', nameKr: '나연', color: '#FF6348', defaultX: 0.5, defaultY: 0.2, avatar: '🌸', position: { default: { x: 0.5, y: 0.2 } } },
      { id: 'jeongyeon', name: 'Jeongyeon', nameKr: '정연', color: '#FFD700', defaultX: 0.35, defaultY: 0.35, avatar: '⭐', position: { default: { x: 0.35, y: 0.35 } } },
      { id: 'momo', name: 'Momo', nameKr: '모모', color: '#FF1F8E', defaultX: 0.65, defaultY: 0.35, avatar: '💕', position: { default: { x: 0.65, y: 0.35 } } },
      { id: 'sana', name: 'Sana', nameKr: '사나', color: '#A78BFA', defaultX: 0.2, defaultY: 0.5, avatar: '🌟', position: { default: { x: 0.2, y: 0.5 } } },
      { id: 'jihyo', name: 'Jihyo', nameKr: '지효', color: '#6EE7B7', defaultX: 0.5, defaultY: 0.5, avatar: '👑', position: { default: { x: 0.5, y: 0.5 } } },
      { id: 'mina', name: 'Mina', nameKr: '미나', color: '#93C5FD', defaultX: 0.8, defaultY: 0.5, avatar: '🦢', position: { default: { x: 0.8, y: 0.5 } } },
      { id: 'dahyun', name: 'Dahyun', nameKr: '다현', color: '#FCD34D', defaultX: 0.3, defaultY: 0.65, avatar: '🐰', position: { default: { x: 0.3, y: 0.65 } } },
      { id: 'chaeyoung', name: 'Chaeyoung', nameKr: '채영', color: '#F87171', defaultX: 0.5, defaultY: 0.72, avatar: '🌺', position: { default: { x: 0.5, y: 0.72 } } },
      { id: 'tzuyu', name: 'Tzuyu', nameKr: '쯔위', color: '#34D399', defaultX: 0.7, defaultY: 0.65, avatar: '🌿', position: { default: { x: 0.7, y: 0.65 } } },
    ],
  },

  bts: {
    name: 'BTS',
    nameKr: '방탄소년단',
    memberCount: 7,
    defaultFormation: 'v_shape',
    members: [
      { id: 'rm', name: 'RM', nameKr: 'RM', color: '#6C5CE7', defaultX: 0.5, defaultY: 0.2, avatar: '🎤', position: { default: { x: 0.5, y: 0.2 } } },
      { id: 'jin', name: 'Jin', nameKr: '진', color: '#FF6B9D', defaultX: 0.3, defaultY: 0.35, avatar: '💜', position: { default: { x: 0.3, y: 0.35 } } },
      { id: 'suga', name: 'Suga', nameKr: '슈가', color: '#A78BFA', defaultX: 0.7, defaultY: 0.35, avatar: '⚡', position: { default: { x: 0.7, y: 0.35 } } },
      { id: 'jhope', name: 'J-Hope', nameKr: '제이홉', color: '#FCD34D', defaultX: 0.15, defaultY: 0.5, avatar: '☀️', position: { default: { x: 0.15, y: 0.5 } } },
      { id: 'jimin', name: 'Jimin', nameKr: '지민', color: '#F87171', defaultX: 0.5, defaultY: 0.5, avatar: '🌟', position: { default: { x: 0.5, y: 0.5 } } },
      { id: 'v', name: 'V', nameKr: '뷔', color: '#34D399', defaultX: 0.85, defaultY: 0.5, avatar: '🎨', position: { default: { x: 0.85, y: 0.5 } } },
      { id: 'jungkook', name: 'Jungkook', nameKr: '정국', color: '#60A5FA', defaultX: 0.5, defaultY: 0.7, avatar: '🐰', position: { default: { x: 0.5, y: 0.7 } } },
    ],
  },

  itzy: {
    name: 'ITZY',
    nameKr: '있지',
    memberCount: 5,
    defaultFormation: 'line',
    members: [
      { id: 'yeji', name: 'Yeji', nameKr: '예지', color: '#FF6348', defaultX: 0.1, defaultY: 0.4, avatar: '🔥', position: { default: { x: 0.1, y: 0.4 } } },
      { id: 'lia', name: 'Lia', nameKr: '리아', color: '#A78BFA', defaultX: 0.3, defaultY: 0.4, avatar: '💜', position: { default: { x: 0.3, y: 0.4 } } },
      { id: 'ryujin', name: 'Ryujin', nameKr: '류진', color: '#FF1F8E', defaultX: 0.5, defaultY: 0.35, avatar: '👑', position: { default: { x: 0.5, y: 0.35 } } },
      { id: 'chaeryeong', name: 'Chaeryeong', nameKr: '채령', color: '#6EE7B7', defaultX: 0.7, defaultY: 0.4, avatar: '🌿', position: { default: { x: 0.7, y: 0.4 } } },
      { id: 'yuna', name: 'Yuna', nameKr: '유나', color: '#FCD34D', defaultX: 0.9, defaultY: 0.4, avatar: '⭐', position: { default: { x: 0.9, y: 0.4 } } },
    ],
  },

  aespa: {
    name: 'aespa',
    nameKr: '에스파',
    memberCount: 4,
    defaultFormation: 'diamond',
    members: [
      { id: 'karina', name: 'Karina', nameKr: '카리나', color: '#E91E63', defaultX: 0.5, defaultY: 0.25, avatar: '👾', position: { default: { x: 0.5, y: 0.25 } } },
      { id: 'giselle', name: 'Giselle', nameKr: '지젤', color: '#9C27B0', defaultX: 0.75, defaultY: 0.5, avatar: '💜', position: { default: { x: 0.75, y: 0.5 } } },
      { id: 'winter', name: 'Winter', nameKr: '윈터', color: '#00BCD4', defaultX: 0.25, defaultY: 0.5, avatar: '❄️', position: { default: { x: 0.25, y: 0.5 } } },
      { id: 'ningning', name: 'Ningning', nameKr: '닝닝', color: '#FF9800', defaultX: 0.5, defaultY: 0.75, avatar: '🌟', position: { default: { x: 0.5, y: 0.75 } } },
    ],
  },

  ive: {
    name: 'IVE',
    nameKr: '아이브',
    memberCount: 6,
    defaultFormation: 'line',
    members: [
      { id: 'wonyoung', name: 'Wonyoung', nameKr: '장원영', color: '#FF6B9D', defaultX: 0.5, defaultY: 0.3, avatar: '🦢', position: { default: { x: 0.5, y: 0.3 } } },
      { id: 'yujin', name: 'Yujin', nameKr: '안유진', color: '#FFD700', defaultX: 0.2, defaultY: 0.45, avatar: '⭐', position: { default: { x: 0.2, y: 0.45 } } },
      { id: 'rei', name: 'Rei', nameKr: '레이', color: '#A78BFA', defaultX: 0.8, defaultY: 0.45, avatar: '💜', position: { default: { x: 0.8, y: 0.45 } } },
      { id: 'gaeul', name: 'Gaeul', nameKr: '가을', color: '#6EE7B7', defaultX: 0.35, defaultY: 0.6, avatar: '🍂', position: { default: { x: 0.35, y: 0.6 } } },
      { id: 'liz', name: 'Liz', nameKr: '리즈', color: '#93C5FD', defaultX: 0.65, defaultY: 0.6, avatar: '💎', position: { default: { x: 0.65, y: 0.6 } } },
      { id: 'leeseo', name: 'Leeseo', nameKr: '이서', color: '#FCD34D', defaultX: 0.5, defaultY: 0.75, avatar: '🌸', position: { default: { x: 0.5, y: 0.75 } } },
    ],
  },

  newjeans: {
    name: 'NewJeans',
    nameKr: '뉴진스',
    memberCount: 5,
    defaultFormation: 'scattered',
    members: [
      { id: 'minji', name: 'Minji', nameKr: '민지', color: '#FF6348', defaultX: 0.2, defaultY: 0.4, avatar: '🐰', position: { default: { x: 0.2, y: 0.4 } } },
      { id: 'hanni', name: 'Hanni', nameKr: '하니', color: '#FF1F8E', defaultX: 0.4, defaultY: 0.35, avatar: '💖', position: { default: { x: 0.4, y: 0.35 } } },
      { id: 'danielle', name: 'Danielle', nameKr: '다니엘', color: '#FFD700', defaultX: 0.6, defaultY: 0.35, avatar: '☀️', position: { default: { x: 0.6, y: 0.35 } } },
      { id: 'haerin', name: 'Haerin', nameKr: '해린', color: '#A78BFA', defaultX: 0.8, defaultY: 0.4, avatar: '🐱', position: { default: { x: 0.8, y: 0.4 } } },
      { id: 'hyein', name: 'Hyein', nameKr: '혜인', color: '#6EE7B7', defaultX: 0.5, defaultY: 0.65, avatar: '🌿', position: { default: { x: 0.5, y: 0.65 } } },
    ],
  },
};
