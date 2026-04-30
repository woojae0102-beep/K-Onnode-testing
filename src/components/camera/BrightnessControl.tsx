// 카메라 명암(밝기/대비/채도) 조절 패널 (바텀 시트 형태)
// useCameraWithFilter 훅의 filter / setFilter / resetFilter 와 연결해서 사용.
//
// 바텀 시트는 viewport 기준 position: fixed 로 그려지기 때문에
// 카메라 박스 크기와 무관하게 항상 화면 하단에 고정된다 (잘림 방지).
import React from 'react';
import type { CameraFilter } from '../../hooks/useCameraWithFilter';

interface BrightnessControlProps {
  filter: CameraFilter;
  onChange: (next: CameraFilter) => void;
  onReset: () => void;
  visible: boolean;
  /** 닫기 버튼이 눌렸을 때 호출 (선택) */
  onClose?: () => void;
}

interface SliderConfig {
  key: keyof CameraFilter;
  label: string;
  min: number;
  max: number;
  step: number;
  leftHint: string;
  rightHint: string;
}

const SLIDERS: SliderConfig[] = [
  { key: 'brightness', label: '밝기', min: 0.2, max: 2.5, step: 0.05, leftHint: '어둡', rightHint: '밝음' },
  { key: 'contrast', label: '대비', min: 0.2, max: 2.5, step: 0.05, leftHint: '낮음', rightHint: '높음' },
  { key: 'saturation', label: '채도', min: 0.0, max: 2.5, step: 0.05, leftHint: '흑백', rightHint: '선명' },
];

const PRESETS: Array<{ label: string; values: CameraFilter }> = [
  { label: '기본', values: { brightness: 1.0, contrast: 1.0, saturation: 1.0 } },
  { label: '밝게', values: { brightness: 1.4, contrast: 1.1, saturation: 1.1 } },
  { label: '드라마틱', values: { brightness: 0.9, contrast: 1.6, saturation: 1.3 } },
  { label: '흑백', values: { brightness: 1.0, contrast: 1.2, saturation: 0.0 } },
  { label: '따뜻하게', values: { brightness: 1.1, contrast: 1.0, saturation: 1.4 } },
];

export default function BrightnessControl({ filter, onChange, onReset, visible, onClose }: BrightnessControlProps) {
  if (!visible) return null;

  return (
    <>
      {/* backdrop: 바깥 클릭 시 닫힘 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          zIndex: 9998,
        }}
      />
      <div
        role="dialog"
        aria-label="카메라 명암 조절"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: 16,
          padding: 16,
          paddingBottom: 14,
          zIndex: 9999,
          color: '#fff',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '70vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* drag handle (시각적 힌트) */}
        <div
          style={{
            width: 36,
            height: 4,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 2,
            margin: '0 auto 12px',
          }}
        />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>카메라 조절</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              color: '#FF1F8E',
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            초기화
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              style={{
                color: '#fff',
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                width: 28,
                height: 28,
                borderRadius: '50%',
                fontSize: 16,
                lineHeight: '28px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {SLIDERS.map((slider) => {
        const value = filter[slider.key];
        const ratio = (value - slider.min) / (slider.max - slider.min);
        return (
          <div key={slider.key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#ccc', fontSize: 12 }}>{slider.label}</span>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{value.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#666', minWidth: 20 }}>{slider.leftHint}</span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={value}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    [slider.key]: parseFloat(e.target.value),
                  })
                }
                style={{
                  flex: 1,
                  accentColor: '#FF1F8E',
                  height: 4,
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 10, color: '#ccc', minWidth: 24, textAlign: 'right' }}>{slider.rightHint}</span>
            </div>
            <div
              style={{
                marginTop: 4,
                height: 2,
                background: '#333',
                borderRadius: 1,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, ratio * 100))}%`,
                  height: '100%',
                  background: '#FF1F8E',
                  borderRadius: 1,
                }}
              />
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.values)}
            style={{
              flex: '1 1 60px',
              padding: '6px 4px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#ddd',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      </div>
    </>
  );
}
