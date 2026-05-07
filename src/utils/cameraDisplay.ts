/**
 * iOS Safari / Android WebKit: <video>가 화면에 보이지 않거나 opacity:0 이면
 * 디코딩이 멈추거나, 캔버스로 drawImage 한 결과가 검은 화면이 되는 경우가 많습니다.
 * 이 환경에서는 비디오를 직접 표시(surface: video)해야 합니다.
 */
export function prefersDirectVideoDisplay(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';

  if (/iPad|iPhone|iPod/i.test(ua)) return true;

  // iPadOS 13+ (데스크톱 UA로 위장)
  if (navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return true;
  }

  if (/Android/i.test(ua)) return true;

  return false;
}
