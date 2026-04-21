// @ts-nocheck
import React from 'react';
import { Bell, Settings } from 'lucide-react';

export default function TopNavBar({ onOpenNotifications, onOpenSettings }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white"
      style={{ height: 48, borderBottom: '1px solid #F0F0F0', padding: '0 16px' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="grid place-items-center rounded-full bg-[#FF1F8E] text-white font-black italic shadow-sm"
          style={{ width: 28, height: 28, fontSize: 14 }}
        >
          O
        </div>
        <span
          className="truncate"
          style={{ fontSize: 15, fontWeight: 500, color: '#111111' }}
        >
          ONNODE
        </span>
      </div>
      <div className="flex items-center gap-1">
        <IconButton aria-label="Notifications" onClick={onOpenNotifications}>
          <Bell size={20} />
        </IconButton>
        <IconButton aria-label="Settings" onClick={onOpenSettings}>
          <Settings size={20} />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({ children, onClick, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        width: 36,
        height: 36,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 8,
        color: '#888888',
        background: hover ? '#F5F5F7' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}
