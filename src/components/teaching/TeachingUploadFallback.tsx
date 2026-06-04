// @ts-nocheck
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import VideoUploader from './VideoUploader';

export function TeachingUploadFallback({
  accept = 'video',
  maxSizeMb,
  label,
  hint,
  onFile,
  showYoutube = false,
  youtubeUrl,
  onYoutubeUrlChange,
  onYoutubeLoad,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-white/10 pt-4 mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-sm text-white/50 hover:text-white/80 py-2"
      >
        {open ? '▲' : '▼'} {t('teaching.session.uploadInstead')}
      </button>
      {open ? (
        <div className="mt-3">
          <VideoUploader
            label={label}
            hint={hint}
            accept={accept}
            maxSizeMb={maxSizeMb}
            onFile={onFile}
            showYoutube={showYoutube}
            youtubeUrl={youtubeUrl}
            onYoutubeUrlChange={onYoutubeUrlChange}
            onYoutubeLoad={onYoutubeLoad}
          />
        </div>
      ) : null}
    </div>
  );
}

export default TeachingUploadFallback;
