// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';

const DEVICE_CATALOG = [
  { id: 'smart-tv', label: 'Smart TV', icon: '📺', desc: '삼성·LG·Android TV' },
  { id: 'chromecast', label: 'Chromecast', icon: '🔵', desc: 'Google Cast' },
  { id: 'airplay', label: 'AirPlay', icon: '🍎', desc: 'Apple TV · AirPlay 2' },
  { id: 'samsung', label: 'Samsung Smart View', icon: '📱', desc: '갤럭시 · Smart TV' },
  { id: 'lg', label: 'LG TV', icon: '🟥', desc: 'webOS TV' },
  { id: 'google-tv', label: 'Google TV', icon: '▶️', desc: 'Chromecast with Google TV' },
];

function detectPlatformDevices() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const hasPresentation =
    typeof window !== 'undefined' &&
    'presentation' in navigator &&
    !!(navigator.presentation as { defaultRequest?: unknown }).defaultRequest;

  const found = [];

  if (hasPresentation) {
    found.push({ ...DEVICE_CATALOG[0], signal: 'strong', hint: '보조 디스플레이 감지됨' });
  }

  if (isIOS) {
    found.push({ ...DEVICE_CATALOG[2], signal: 'strong', hint: 'AirPlay 사용 가능' });
  }

  if (isAndroid) {
    found.push({ ...DEVICE_CATALOG[3], signal: 'medium', hint: '같은 Wi-Fi 네트워크' });
    found.push({ ...DEVICE_CATALOG[1], signal: 'medium', hint: 'Cast 지원 TV' });
  }

  found.push({ ...DEVICE_CATALOG[0], signal: 'medium', hint: '브라우저 TV 모드' });
  found.push({ ...DEVICE_CATALOG[4], signal: 'weak', hint: 'webOS 브라우저' });
  found.push({ ...DEVICE_CATALOG[5], signal: 'weak', hint: 'Google TV 브라우저' });

  const seen = new Set();
  return found.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

export function useStudioDeviceScan() {
  const [phase, setPhase] = useState('idle');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [presentationAvailable, setPresentationAvailable] = useState(false);
  const timerRef = useRef(null);

  const startScan = useCallback(() => {
    setPhase('scanning');
    setDevices([]);
    setSelectedDevice(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setDevices(detectPlatformDevices());
      setPresentationAvailable(
        typeof window !== 'undefined' &&
          'presentation' in navigator &&
          !!(navigator.presentation as { defaultRequest?: unknown }).defaultRequest,
      );
      setPhase('results');
    }, 1800);
  }, []);

  const selectDevice = useCallback((device) => {
    setSelectedDevice(device);
  }, []);

  const tryPresentationCast = useCallback(async (url) => {
    try {
      const pres = navigator.presentation;
      if (!pres?.defaultRequest) return false;
      const request = new pres.defaultRequest(url, 'browser');
      await request.start();
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    phase,
    devices,
    selectedDevice,
    presentationAvailable,
    startScan,
    selectDevice,
    tryPresentationCast,
    deviceCatalog: DEVICE_CATALOG,
  };
}

export default useStudioDeviceScan;
