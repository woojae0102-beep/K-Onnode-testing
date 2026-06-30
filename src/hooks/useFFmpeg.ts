// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function generateSRT(captions = []) {
  return captions
    .map((c, i) => `${i + 1}\n${formatSrtTime(c.start || 0)} --> ${formatSrtTime(c.end || 3)}\n${c.text || ''}\n`)
    .join('\n');
}

function calculateHighlightStart(scoreData, clipDuration) {
  if (!Array.isArray(scoreData) || scoreData.length === 0) return 0;
  let maxAvg = -1;
  let bestStart = 0;
  scoreData.forEach((row) => {
    const start = Number(row.time) || 0;
    const end = start + clipDuration;
    const windowScores = scoreData.filter((s) => Number(s.time) >= start && Number(s.time) <= end);
    if (!windowScores.length) return;
    const avg = windowScores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / windowScores.length;
    if (avg > maxAvg) {
      maxAvg = avg;
      bestStart = start;
    }
  });
  return Math.max(0, bestStart - 2);
}

async function createWatermarkImage(trackType) {
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 104;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 31, 142, 0.86)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 20);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 30px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ONNODE AI COACH', canvas.width / 2, 48);
  ctx.font = '500 18px Inter, Arial, sans-serif';
  ctx.fillText(String(trackType || 'practice').toUpperCase(), canvas.width / 2, 76);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function buildCaptionFilter(ffmpeg, addCaption) {
  if (!Array.isArray(addCaption) || !addCaption.length) return null;
  await ffmpeg.writeFile('caption.srt', new TextEncoder().encode(generateSRT(addCaption)));
  return "subtitles=caption.srt:force_style='FontName=Arial Black,FontSize=40,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BackColour=&H80000000&,BorderStyle=4,Outline=1,Shadow=0,Bold=1,MarginV=260,Alignment=2'";
}

export function useFFmpeg() {
  const ffmpegRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadFFmpeg = useCallback(async () => {
    if (isLoaded && ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;
    ffmpeg.on('progress', ({ progress: nextProgress }) => {
      setProgress(Math.max(0, Math.min(100, Math.round((nextProgress || 0) * 100))));
    });
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    setIsLoaded(true);
    return ffmpeg;
  }, [isLoaded]);

  const createShorts = useCallback(async ({
    videoBlob,
    duration = 60,
    highlightScore = null,
    addWatermark = true,
    addCaption = null,
    trackType = 'dance',
  }) => {
    if (!videoBlob) throw new Error('쇼츠로 만들 영상이 없습니다.');
    setProgress(0);
    const ffmpeg = await loadFFmpeg();
    const clipDuration = Math.max(5, Math.min(60, Number(duration) || 60));
    const startTime = calculateHighlightStart(highlightScore, clipDuration);

    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));

    const args = ['-ss', String(startTime), '-t', String(clipDuration), '-i', 'input.webm'];

    if (addWatermark) {
      const watermarkBlob = await createWatermarkImage(trackType);
      await ffmpeg.writeFile('watermark.png', await fetchFile(watermarkBlob));
      args.push('-loop', '1', '-i', 'watermark.png');
    }

    // 블러 배경 레터박스 + 워터마크 + 자막을 단일 filter_complex로 처리 (재인코딩 1회)
    let filter =
      '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=25,eq=brightness=-0.05[bg];' +
      '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,format=yuva420p[fg];' +
      '[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto[base]';

    let lastLabel = 'base';
    if (addWatermark) {
      filter += `;[${lastLabel}][1:v]overlay=W-w-36:H-h-200[wm]`;
      lastLabel = 'wm';
    }

    const captionFilter = await buildCaptionFilter(ffmpeg, addCaption);
    if (captionFilter) {
      filter += `;[${lastLabel}]${captionFilter}[vout]`;
      lastLabel = 'vout';
    }

    args.push(
      '-filter_complex', filter,
      '-map', `[${lastLabel}]`,
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '19',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5',
      '-movflags', '+faststart',
      '-shortest',
      'output.mp4',
    );

    await ffmpeg.exec(args);

    const outputData = await ffmpeg.readFile('output.mp4');
    setProgress(100);
    return new Blob([outputData], { type: 'video/mp4' });
  }, [loadFFmpeg]);

  const createThumbnail = useCallback(async (videoBlob) => {
    if (!videoBlob) return null;
    const ffmpeg = await loadFFmpeg();
    await ffmpeg.writeFile('thumb_input.mp4', await fetchFile(videoBlob));
    await ffmpeg.exec(['-i', 'thumb_input.mp4', '-ss', '00:00:01', '-vframes', '1', '-q:v', '2', 'thumbnail.jpg']);
    const thumbData = await ffmpeg.readFile('thumbnail.jpg');
    return new Blob([thumbData], { type: 'image/jpeg' });
  }, [loadFFmpeg]);

  return {
    createShorts,
    createThumbnail,
    isLoaded,
    progress,
    loadFFmpeg,
  };
}

export default useFFmpeg;
