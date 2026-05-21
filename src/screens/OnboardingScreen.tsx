// @ts-nocheck
import React, { useState } from 'react';
import { useAuth, AuthTrack } from '../contexts/AuthContext';

const TRACKS: { id: AuthTrack; icon: string; label: string; desc: string }[] = [
  { id: 'dance', icon: '🕺', label: '댄스', desc: 'K-POP 안무 연습' },
  { id: 'vocal', icon: '🎤', label: '보컬', desc: '음정·발성 트레이닝' },
  { id: 'korean', icon: '🇰🇷', label: '한국어', desc: '가사로 배우는 한국어' },
];

const GOALS = [
  { id: 'hobby', icon: '🎵', label: '취미로 즐기기' },
  { id: 'audition', icon: '🏆', label: '실제 오디션 준비' },
  { id: 'global', icon: '🌍', label: '글로벌 K-POP 팬' },
  { id: 'content', icon: '📱', label: '콘텐츠 크리에이터' },
];

export default function OnboardingScreen() {
  const { updateUserProfile, userProfile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTracks, setSelectedTracks] = useState<AuthTrack[]>(
    (userProfile?.tracks as AuthTrack[]) || [],
  );
  const [selectedGoal, setSelectedGoal] = useState<string>(
    userProfile?.goal || '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTrack = (id: AuthTrack) => {
    setSelectedTracks((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleComplete = async () => {
    if (!selectedGoal || selectedTracks.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateUserProfile({
        tracks: selectedTracks,
        goal: selectedGoal,
        onboardingCompleted: true,
      });
    } catch (err: any) {
      setError(err?.message || '프로필 저장 중 오류가 발생했습니다.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="auth-screen"
      style={{
        alignItems: 'center',
        paddingTop: 'calc(40px + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* 진행 바 */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          height: 4,
          background: '#222',
          borderRadius: 2,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: `${(step / 2) * 100}%`,
            height: '100%',
            background: '#FF1F8E',
            borderRadius: 2,
            transition: 'width 0.3s',
          }}
        />
      </div>

      {step === 1 && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}
            >
              어떤 걸 연습하고 싶어요?
            </div>
            <div
              style={{ fontSize: 13, color: '#666', marginTop: 8 }}
            >
              여러 개 선택 가능해요
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {TRACKS.map((track) => {
              const selected = selectedTracks.includes(track.id);
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => toggleTrack(track.id)}
                  style={{
                    padding: '16px 20px',
                    background: selected ? '#FF1F8E18' : '#1a1a1a',
                    border: `1px solid ${selected ? '#FF1F8E' : '#333'}`,
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span style={{ fontSize: 24 }}>{track.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{track.label}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#888',
                        marginTop: 2,
                      }}
                    >
                      {track.desc}
                    </div>
                  </div>
                  {selected && (
                    <span style={{ color: '#FF1F8E', fontSize: 18 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={selectedTracks.length === 0}
            className="auth-btn-primary"
            style={{
              marginTop: 24,
              background: selectedTracks.length > 0 ? '#FF1F8E' : '#333',
            }}
          >
            다음
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}
            >
              목표가 뭐예요?
            </div>
            <div
              style={{ fontSize: 13, color: '#666', marginTop: 8 }}
            >
              나에게 맞춘 코칭을 준비해드릴게요
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {GOALS.map((goal) => {
              const selected = selectedGoal === goal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoal(goal.id)}
                  style={{
                    padding: '16px 20px',
                    background: selected ? '#FF1F8E18' : '#1a1a1a',
                    border: `1px solid ${selected ? '#FF1F8E' : '#333'}`,
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span style={{ fontSize: 24 }}>{goal.icon}</span>
                  <span style={{ fontWeight: 500, flex: 1 }}>
                    {goal.label}
                  </span>
                  {selected && (
                    <span style={{ color: '#FF1F8E', fontSize: 18 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div
              style={{
                marginTop: 16,
                background: '#2a1015',
                border: '1px solid #E24B4A44',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#E24B4A',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 24,
            }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={isSaving}
              className="auth-btn-primary"
              style={{
                flex: '0 0 80px',
                background: '#222',
              }}
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleComplete}
              disabled={!selectedGoal || isSaving}
              className="auth-btn-primary"
              style={{
                flex: 1,
                background: selectedGoal && !isSaving ? '#FF1F8E' : '#333',
              }}
            >
              {isSaving ? '저장 중...' : '시작하기 🚀'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
