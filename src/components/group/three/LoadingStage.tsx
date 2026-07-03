// @ts-nocheck
import React from 'react';
import { Html } from '@react-three/drei';

/** Suspense fallback — GLB/3D 에셋 로딩 중 표시 */
export function LoadingStage({ label = 'Loading Stage...' }: { label?: string }) {
  return (
    <Html center style={{ pointerEvents: 'none' }}>
      <div
        style={{
          padding: '12px 20px',
          borderRadius: 10,
          border: '1px solid rgba(255, 200, 0, 0.45)',
          background: 'rgba(10, 10, 20, 0.92)',
          color: '#FFD700',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        {label}
      </div>
    </Html>
  );
}

export default LoadingStage;
