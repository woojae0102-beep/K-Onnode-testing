// @ts-nocheck
import React, { useRef } from 'react';

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'video/quicktime'];

export function VideoUploader({
  label,
  hint,
  accept = 'video',
  maxSizeMb = 500,
  onFile,
  youtubeUrl = '',
  onYoutubeUrlChange,
  onYoutubeLoad,
  showYoutube = false,
  className = '',
}) {
  const inputRef = useRef(null);
  const isAudio = accept === 'audio';

  const handleFile = (file) => {
    if (!file) return;
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`파일 크기는 ${maxSizeMb}MB 이하여야 합니다.`);
      return;
    }
    const allowed = isAudio ? AUDIO_TYPES : VIDEO_TYPES;
    if (!allowed.some((t) => file.type === t || file.name.match(/\.(mp4|mov|avi|webm|mp3|wav|m4a)$/i))) {
      alert(isAudio ? 'mp3, wav, m4a, mp4, mov 형식만 지원합니다.' : 'mp4, mov, avi, webm 형식만 지원합니다.');
      return;
    }
    onFile?.(file);
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex-1 min-h-[140px] rounded-2xl border-2 border-dashed border-[#FF1F8E]/50 bg-[#FF1F8E]/5 hover:bg-[#FF1F8E]/10 transition-colors p-4 flex flex-col items-center justify-center gap-2"
      >
        <span className="text-3xl">📁</span>
        <span className="text-sm font-semibold text-white text-center">{label}</span>
        {hint ? <span className="text-xs text-white/50 text-center">{hint}</span> : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={isAudio ? 'audio/*,video/mp4,video/quicktime' : 'video/*'}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {showYoutube ? (
        <div className="flex gap-2">
          <input
            value={youtubeUrl}
            onChange={(e) => onYoutubeUrlChange?.(e.target.value)}
            placeholder="유튜브 URL"
            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={onYoutubeLoad}
            className="rounded-xl px-4 py-2 bg-[#111] text-white text-sm font-semibold shrink-0"
          >
            불러오기
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default VideoUploader;
