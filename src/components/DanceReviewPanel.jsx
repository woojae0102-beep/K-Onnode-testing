import React, { useMemo, useRef } from 'react';
import { BarChart3, Play, SkipBack } from 'lucide-react';

// 수정됨 — sessionLogs 타임라인 클릭 → 가이드/내 영상 seek (녹화 있으면 동기 재생)
export default function DanceReviewPanel({
  sessionLogs,
  replayVideoUrl,
  onSeekSeconds: _onSeekSeconds,
  guideVideoRef,
  remoteVideoRef,
  replayVideoRef,
}) {
  const barRef = useRef(null);

  const maxT = useMemo(() => {
    if (!sessionLogs?.length) return 0;
    return Math.max(...sessionLogs.map((e) => e.t ?? 0), 0);
  }, [sessionLogs]);

  const handleSeek = (t) => {
    try {
      _onSeekSeconds?.(t);
      const sec = Math.max(0, Number(t) || 0);
      const gv = guideVideoRef?.current;
      if (gv && typeof gv.currentTime === 'number') {
        try {
          gv.currentTime = sec;
          void gv.play?.();
        } catch (e) {
          console.warn(e);
        }
      }
      if (remoteVideoRef?.current) {
        try {
          remoteVideoRef.current.currentTime = sec;
          void remoteVideoRef.current.play?.();
        } catch (e) {
          console.warn(e);
        }
      }
      if (replayVideoUrl && replayVideoRef?.current) {
        try {
          replayVideoRef.current.currentTime = sec;
          void replayVideoRef.current.play?.();
        } catch (e) {
          console.warn(e);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBarClick = (ev) => {
    try {
      const el = barRef.current;
      if (!el || maxT <= 0) return;
      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      handleSeek(ratio * maxT);
    } catch (e) {
      console.error(e);
    }
  };

  if (!sessionLogs?.length) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-center text-xs text-slate-500">
        안무 세션 로그가 없습니다. 스마트폰 카메라가 켜진 상태에서 연습하면 기록됩니다.
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-fuchsia-500/25 bg-slate-950/90 p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 text-fuchsia-300">
        <BarChart3 size={18} />
        <h3 className="text-sm font-black uppercase tracking-widest">나의 안무 리포트 · 타임라인</h3>
      </div>
      <p className="text-[10px] text-slate-500 break-keep">
        막대를 클릭하거나 아래 이벤트를 눌러 해당 시점으로 가이드·내 화면을 맞춥니다.
        {replayVideoUrl ? ' (녹화본이 있으면 동일 시점으로 재생)' : ' (녹화는 WebRTC 수신 스트림이 있을 때만 저장됩니다.)'}
      </p>

      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-valuenow={maxT}
        className="relative h-10 w-full cursor-pointer rounded-xl bg-slate-800/80 overflow-hidden border border-slate-600/50"
        onClick={handleBarClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleSeek(0);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF1493]/40 to-violet-600/30"
          style={{ width: '100%' }}
        />
        {sessionLogs.map((entry, i) => {
          const left = maxT > 0 ? (entry.t / maxT) * 100 : 0;
          const color =
            entry.grade === 'Perfect'
              ? 'bg-amber-400'
              : entry.grade === 'Bad'
                ? 'bg-red-500'
                : 'bg-fuchsia-400';
          return (
            <button
              key={`${entry.t}-${i}`}
              type="button"
              title={`${entry.t}s · ${entry.grade}`}
              className={`absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full ${color} opacity-90 hover:scale-125 hover:opacity-100 transition pointer-events-auto`}
              style={{ left: `${Math.min(99, Math.max(0, left))}%` }}
              onClick={(ev) => {
                ev.stopPropagation();
                handleSeek(entry.t);
              }}
            />
          );
        })}
      </div>

      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/50">
        <table className="w-full text-left text-[10px] sm:text-xs">
          <thead className="sticky top-0 bg-slate-900/95 text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-2 py-2">시간(s)</th>
              <th className="px-2 py-2">판정</th>
              <th className="px-2 py-2">포인트</th>
              <th className="px-2 py-2">각도(유저/가이드)</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {sessionLogs.slice(-200).map((row, i) => (
              <tr
                key={`${row.t}-${i}`}
                className="border-t border-slate-800/80 hover:bg-fuchsia-950/20 cursor-pointer"
                onClick={() => handleSeek(row.t)}
              >
                <td className="px-2 py-1.5 font-mono text-fuchsia-300/90">{row.t}</td>
                <td className="px-2 py-1.5 font-bold">{row.grade}</td>
                <td className="px-2 py-1.5 break-keep max-w-[140px]">{row.wrongPart || '—'}</td>
                <td className="px-2 py-1.5 font-mono text-[10px]">
                  {row.userAngle != null && row.guideAngle != null
                    ? `${row.userAngle?.toFixed?.(0) ?? row.userAngle}° / ${row.guideAngle?.toFixed?.(0) ?? row.guideAngle}°`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={() => handleSeek(0)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-600 px-3 py-2 text-[10px] font-black text-slate-200 hover:bg-slate-800"
        >
          <SkipBack size={14} /> 처음으로
        </button>
        <button
          type="button"
          onClick={() => handleSeek(maxT * 0.5)}
          className="inline-flex items-center gap-1 rounded-xl border border-[#FF1493]/50 px-3 py-2 text-[10px] font-black text-fuchsia-200 hover:bg-fuchsia-950/40"
        >
          <Play size={14} /> 중간
        </button>
      </div>

      {replayVideoUrl && (
        <div className="mt-2">
          <p className="text-[10px] font-bold text-slate-500 mb-1">세션 녹화 (WebRTC 수신)</p>
          <video
            ref={replayVideoRef}
            src={replayVideoUrl}
            controls
            playsInline
            className="w-full max-h-48 rounded-xl border border-slate-700 bg-black"
          />
        </div>
      )}
    </div>
  );
}
