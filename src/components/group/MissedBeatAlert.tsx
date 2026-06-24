// @ts-nocheck
import React, { useEffect } from 'react';

export function MissedBeatAlert({
  show,
  onDismiss,
}: {
  show: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!show) return undefined;
    const timer = window.setTimeout(onDismiss, 800);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '8px 20px',
        background: 'rgba(255,68,68,0.85)',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        pointerEvents: 'none',
        animation: 'flashFade 0.8s ease forwards',
        zIndex: 30,
      }}
    >
      박자 놓침 — 계속 진행하세요
      <style>{`
        @keyframes flashFade {
          0% { opacity: 0; transform: translate(-50%, -60%); }
          20% { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(-50%, -40%); }
        }
      `}</style>
    </div>
  );
}

export default MissedBeatAlert;
