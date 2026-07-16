// @ts-nocheck
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdminProfile } from '../utils/adminAuth';
import { useProductionDanceStudio } from '../hooks/useProductionDanceStudio';
import { GROUP_DATA } from '../data/groupPracticeData';
import { PRODUCTION_ERRORS } from '../types/productionDanceAsset';

const PHASE_LABELS: Record<string, string> = {
  setup: 'Setup',
  config_check: 'API Configuration',
  upload: 'Upload',
  job_created: 'Job Created',
  processing: 'Processing',
  motion_received: 'Motion Received',
  track_mapping: 'Member Split / Track Mapping',
  avatar_binding: 'Avatar Retarget',
  formation_build: 'Formation Build',
  preview: 'Preview',
  saving: 'Save',
  complete: 'Complete',
  error: 'Error',
};

export default function ProductionDanceStudioView({ onNavigate }) {
  const { user, userProfile, isLoading } = useAuth();
  const studio = useProductionDanceStudio();
  const isAdmin = isAdminProfile(userProfile);

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#fff' }}>
        <p>권한 확인 중...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#fff', minHeight: '100vh', background: '#0d0d14' }}>
        <h2 style={{ color: '#FF6B6B' }}>{PRODUCTION_ERRORS.ADMIN_ACCESS_REQUIRED}</h2>
        <p style={{ fontSize: 13, marginTop: 12, color: 'rgba(255,255,255,0.6)' }}>
          Production Dance Studio는 Admin 계정만 접근할 수 있습니다.
        </p>
        {!user ? (
          <p style={{ fontSize: 12, marginTop: 8 }}>로그인 후 Admin 권한이 있는 계정으로 다시 시도하세요.</p>
        ) : null}
        <button type="button" onClick={() => onNavigate?.('home')} style={btn}>홈으로</button>
      </div>
    );
  }

  const {
    phase, groupId, setGroupId, songId, setSongId, videoFile, setVideoFile,
    apiConfigured, jobId, jobProgress, stepMessage, error, outputs,
    trackMapping, setTrackMapping, avatarAssetIds, setAvatarAssetIds,
    avatarLibrary, uploadMemberAvatar, stageBackgroundId, setStageBackgroundId,
    stagePresets, draftAsset, songsForGroup, groupMembers, reset, checkConfig,
    startProduction, confirmTrackMapping, goPreview, saveAsset,
  } = studio;

  const mappedMemberIds = [...new Set(Object.values(trackMapping).filter(Boolean))];

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', color: '#fff', padding: 16 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 18, color: '#FF1F8E', margin: 0 }}>Production Dance Studio</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              Admin · DeepMotion · Firestore Persistence · Group Mode Production Asset
            </p>
          </div>
          <button type="button" onClick={() => onNavigate?.('home')} style={btn}>닫기</button>
        </header>

        <div style={panel}>
          <div style={{ fontSize: 11, color: '#FFD700', marginBottom: 12 }}>
            Phase: {PHASE_LABELS[phase] || phase}
            {jobId ? ` · Job ${jobId}` : ''}
            {phase === 'processing' ? ` · ${jobProgress}%` : ''}
          </div>
          {stepMessage ? <div style={{ fontSize: 12, marginBottom: 12 }}>{stepMessage}</div> : null}
          {error ? <div style={{ color: '#FF6B6B', fontSize: 12, marginBottom: 12 }}>{error}</div> : null}

          {(phase === 'setup' || phase === 'error') && (
            <>
              <Row label="API Configuration">
                <span style={{ fontSize: 12, color: apiConfigured ? '#44FF88' : '#FF6B6B' }}>
                  {apiConfigured == null ? '확인 중...' : apiConfigured ? 'Configured' : PRODUCTION_ERRORS.DEEPMOTION_API_KEY_MISSING}
                </span>
                <button type="button" onClick={checkConfig} style={btn}>Check API</button>
              </Row>
              <Row label="그룹">
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={input}>
                  {Object.keys(GROUP_DATA).map((id) => (
                    <option key={id} value={id}>{GROUP_DATA[id]?.nameKr || id}</option>
                  ))}
                </select>
              </Row>
              <Row label="곡">
                <select value={songId} onChange={(e) => setSongId(e.target.value)} style={input}>
                  {songsForGroup.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </Row>
              <Row label="Stage Preset">
                <select value={stageBackgroundId} onChange={(e) => setStageBackgroundId(e.target.value)} style={input}>
                  {stagePresets.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </Row>
              <Row label="안무 영상">
                <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
              </Row>
              <button type="button" onClick={startProduction} disabled={!videoFile || !apiConfigured} style={primary}>
                Create Production Motion
              </button>
            </>
          )}

          {phase === 'track_mapping' && (
            <>
              <h3 style={{ fontSize: 13, marginBottom: 12 }}>Track Mapping</h3>
              {outputs.map((o) => (
                <Row key={o.trackId} label={`Track ${o.trackId}`}>
                  <select
                    value={trackMapping[o.trackId] || ''}
                    onChange={(e) => setTrackMapping({ ...trackMapping, [o.trackId]: e.target.value })}
                    style={input}
                  >
                    <option value="">— 선택 —</option>
                    {groupMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.nameKr} ({m.id})</option>
                    ))}
                  </select>
                </Row>
              ))}
              <button type="button" onClick={confirmTrackMapping} style={primary}>Confirm Member Mapping</button>
            </>
          )}

          {phase === 'avatar_binding' && (
            <>
              <h3 style={{ fontSize: 13, marginBottom: 12 }}>Avatar Asset Binding</h3>
              {mappedMemberIds.map((memberId) => {
                const gm = groupMembers.find((m) => m.id === memberId);
                return (
                  <div key={memberId} style={{ marginBottom: 16, padding: 12, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, marginBottom: 8 }}>{gm?.nameKr || memberId}</div>
                    <Row label="Select Existing">
                      <select
                        value={avatarAssetIds[memberId] || ''}
                        onChange={(e) => setAvatarAssetIds({ ...avatarAssetIds, [memberId]: e.target.value })}
                        style={input}
                      >
                        <option value="">— 선택 —</option>
                        {avatarLibrary
                          .filter((a) => !a.memberId || a.memberId === memberId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>{a.id} ({a.memberName || a.memberId || 'shared'})</option>
                          ))}
                      </select>
                    </Row>
                    <Row label="Upload Avatar">
                      <input
                        type="file"
                        accept=".glb,model/gltf-binary"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            await uploadMemberAvatar(memberId, file);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      />
                    </Row>
                  </div>
                );
              })}
              <button type="button" onClick={goPreview} style={primary}>Preview</button>
            </>
          )}

          {phase === 'preview' && draftAsset && (
            <>
              <ul style={{ fontSize: 12, lineHeight: 1.8 }}>
                {draftAsset.members.map((m) => (
                  <li key={m.memberId}>
                    {m.memberName}: motion={m.motionAssetUrl ? '✓' : '✗'} avatar={m.avatarAssetId ? '✓' : '✗'} status={m.status}
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 11, color: '#FFD700', marginBottom: 12 }}>
                status={draftAsset.status} — ready일 때만 저장됩니다.
              </div>
              <button type="button" onClick={saveAsset} disabled={draftAsset.status !== 'ready'} style={primary}>
                Save Production Asset (Server)
              </button>
            </>
          )}

          {phase === 'complete' && (
            <>
              <div style={{ color: '#44FF88', marginBottom: 12 }}>✓ Production Asset saved to Firestore (Server Source of Truth)</div>
              <button type="button" onClick={reset} style={primary}>새 콘텐츠 제작</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ width: 140, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <div style={{ flex: 1, minWidth: 200 }}>{children}</div>
    </div>
  );
}

const panel = { padding: 16, borderRadius: 10, border: '1px solid rgba(255,31,142,0.3)', background: 'rgba(3,3,8,0.95)' };
const input = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: '#1a1a24', color: '#fff', fontSize: 12 };
const btn = { padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12 };
const primary = { ...btn, background: 'rgba(255,31,142,0.25)', border: '1px solid #FF1F8E' };
