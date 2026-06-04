// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function TeachingReviewPanel({ file, mode = 'dance', onAnalyze, onRetake, isLoading = false }) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState('');
  const isVideo = mode === 'dance';

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">{t('teaching.session.reviewTitle')}</h2>
      <p className="text-sm text-white/50">{t('teaching.session.reviewSubtitle')}</p>

      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video max-h-[360px]">
        {isVideo ? (
          <video src={previewUrl} controls playsInline className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 p-6">
            <span className="text-4xl">🎧</span>
            <audio src={previewUrl} controls className="w-full max-w-md" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onRetake} disabled={isLoading} className="flex-1 py-3 rounded-xl bg-white/10 font-semibold text-sm">
          {t('teaching.session.retake')}
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!file || isLoading}
          className="flex-[2] py-4 rounded-xl font-bold text-white disabled:opacity-40"
          style={{ background: '#FF1F8E' }}
        >
          {t('teaching.session.analyze')}
        </button>
      </div>
    </div>
  );
}

export default TeachingReviewPanel;
