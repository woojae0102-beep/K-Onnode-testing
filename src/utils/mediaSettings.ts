import { settingsDefaults } from '../store/settingsSlice';

type AppSettings = typeof settingsDefaults;

export function getMediaSettings(settings?: Partial<AppSettings>) {
  return {
    micSensitivity:
      typeof settings?.micSensitivity === 'number'
        ? settings.micSensitivity
        : settingsDefaults.micSensitivity,
    noiseFilter:
      typeof settings?.noiseFilter === 'boolean'
        ? settings.noiseFilter
        : settingsDefaults.noiseFilter,
    cameraDefault: settings?.cameraDefault === 'back' ? 'back' : 'front',
  };
}

export function buildAudioConstraints(settings?: Partial<AppSettings>) {
  const media = getMediaSettings(settings);
  return {
    echoCancellation: media.noiseFilter,
    noiseSuppression: media.noiseFilter,
    autoGainControl: media.noiseFilter,
  };
}

export function micSensitivityToGain(micSensitivity = settingsDefaults.micSensitivity) {
  const normalized = Math.max(1, Math.min(10, Number(micSensitivity) || 6));
  return 0.6 + normalized * 0.14;
}

export function cameraDefaultToFacingMode(cameraDefault?: string) {
  return cameraDefault === 'back' ? 'environment' : 'user';
}
