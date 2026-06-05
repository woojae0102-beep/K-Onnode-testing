// @ts-nocheck
import { buildAudioConstraints, cameraDefaultToFacingMode } from './mediaSettings';
import { prefersDirectVideoDisplay } from './cameraDisplay';

export { prefersDirectVideoDisplay };

export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isMobileDevice() {
  return prefersDirectVideoDisplay();
}

/** iOS Safari는 사용자 탭 이후에만 카메라/마이크·AudioContext가 안정적으로 동작 */
export function requiresMediaUserGesture() {
  return isMobileDevice();
}

export function pickRecorderMimeType(hasVideo) {
  if (typeof MediaRecorder === 'undefined') return '';
  const iosFirst = isIOSDevice();
  const videoTypes = iosFirst
    ? ['video/mp4', 'video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=h264,aac', 'video/mp4'];
  const audioTypes = iosFirst
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const types = hasVideo ? videoTypes : audioTypes;
  for (const t of types) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* ignore */
    }
  }
  return '';
}

export function mimeToRecordingExtension(mimeType, hasVideo) {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('mp4')) return hasVideo ? 'mp4' : 'm4a';
  if (m.includes('webm')) return 'webm';
  return hasVideo ? (isIOSDevice() ? 'mp4' : 'webm') : 'webm';
}

export function isSessionRecordingFile(fileOrUrl) {
  if (typeof fileOrUrl === 'string') {
    return /session-|\.webm|\.mp4|\.mov|\.m4a/i.test(fileOrUrl);
  }
  const name = fileOrUrl?.name || '';
  const type = fileOrUrl?.type || '';
  return (
    /session-/i.test(name) ||
    /webm|mp4|quicktime|mpeg|m4a/i.test(type) ||
    /\.(webm|mp4|mov|m4a)$/i.test(name)
  );
}

export function buildMobileVideoConstraints(settings) {
  const facingMode = cameraDefaultToFacingMode(settings?.cameraDefault);
  const mobile = isMobileDevice();
  return {
    facingMode,
    width: { ideal: mobile ? 720 : 1280, max: mobile ? 1280 : 1920 },
    height: { ideal: mobile ? 1280 : 720, max: mobile ? 1920 : 1080 },
    frameRate: { ideal: 24, max: 30 },
  };
}

export function buildMobileAudioConstraints(settings) {
  return buildAudioConstraints(settings);
}

export function applyInlineVideoAttributes(video) {
  if (!video) return;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('x5-playsinline', 'true');
}
