// @ts-nocheck
import React, { useEffect } from 'react';
import { useJudgeVoice } from '../../hooks/useJudgeVoice';

const JOINT_LABELS = {
  nose: '코',
  left_shoulder: '왼어깨',
  right_shoulder: '오른어깨',
  left_elbow: '왼팔꿈치',
  right_elbow: '오른팔꿈치',
  left_wrist: '왼손목',
  right_wrist: '오른손목',
  left_hip: '왼골반',
  right_hip: '오른골반',
  left_knee: '왼무릎',
  right_knee: '오른무릎',
  left_ankle: '왼발목',
  right_ankle: '오른발목',
};

export function PersonaTeacher({
  comment,
  personaName = 'AI 코치',
  personaAvatar = '🎤',
  autoSpeak = true,
  intervalSec = 10,
  playbackSpeed = 1,
}) {
  const { speakText, supported } = useJudgeVoice();
  const text = comment?.instruction
    ? `${JOINT_LABELS[comment.problemJoint] || comment.problemJoint}: ${comment.instruction}`
    : '좋아요! 리듬을 유지하면서 동작 크기를 키워 보세요.';

  useEffect(() => {
    if (!autoSpeak || !supported || !text) return;
    speakText(text, 'teaching-coach', playbackSpeed);
  }, [text, autoSpeak, supported, speakText, intervalSec, playbackSpeed]);

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
      <div className="flex items-end gap-3">
        <div className="w-12 h-12 rounded-full bg-[#FF1F8E]/20 border-2 border-[#FF1F8E] flex items-center justify-center text-2xl shrink-0">
          {personaAvatar}
        </div>
        <div className="flex-1 rounded-2xl rounded-bl-sm bg-white/10 border border-white/20 px-4 py-3">
          <p className="text-xs text-[#FF1F8E] font-bold mb-1">{personaName}</p>
          <p className="text-sm text-white leading-relaxed">{text}</p>
          {comment?.personaStyle ? (
            <p className="text-xs text-white/50 mt-1 italic">{comment.personaStyle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PersonaTeacher;
