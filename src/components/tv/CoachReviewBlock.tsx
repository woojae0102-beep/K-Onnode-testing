// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useAgencyPersona } from '../../hooks/useAgencyPersona';
import { useJudgeVoice } from '../../hooks/useJudgeVoice';
import type { Agency } from '../../types/tv';
import { AGENCY_JUDGE_IDS } from '../../types/tv';

export function CoachReviewBlock({
  agency,
  reviewText,
}: {
  agency: Agency;
  reviewText: string;
}) {
  const persona = useAgencyPersona(agency);
  const { speakText } = useJudgeVoice();
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!reviewText) return;
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setDisplayed(reviewText.slice(0, i));
      if (i >= reviewText.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, 28);
    return () => clearInterval(timer);
  }, [reviewText]);

  useEffect(() => {
    if (!done || !reviewText) return;
    speakText(reviewText, AGENCY_JUDGE_IDS[agency], 1);
  }, [done, reviewText, agency, speakText]);

  return (
    <div className="tv-result-coach">
      <div
        className="tv-result-coach-avatar"
        style={{ borderColor: `${persona.color}44`, boxShadow: `0 0 24px ${persona.color}30` }}
      >
        <span style={{ fontSize: 48 }}>{persona.coachAvatar}</span>
      </div>
      <div>
        <div className="tv-result-coach-name">{persona.coachName}</div>
        <div className="tv-result-coach-bubble">
          {displayed}
          {!done ? <span className="tv-type-cursor">|</span> : null}
        </div>
      </div>
    </div>
  );
}

export default CoachReviewBlock;
