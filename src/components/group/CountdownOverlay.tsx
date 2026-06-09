// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/group-studio.css';

export function CountdownOverlay({ count }) {
  const { t } = useTranslation();
  if (count === null || count === undefined) return null;

  return (
    <div className="group-studio-countdown">
      {count > 0 ? (
        <div className="group-studio-countdown-num" key={count}>
          {count}
        </div>
      ) : (
        <div className="group-studio-countdown-start">{t('groupStudio.session.countdownStart')}</div>
      )}
    </div>
  );
}

export default CountdownOverlay;
