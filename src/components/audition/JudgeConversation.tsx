// @ts-nocheck
import React from 'react';
import JudgeDialogBox from './JudgeDialogBox';
import MicResponseInput from './MicResponseInput';

type Judge = {
  id: string;
  name?: string;
  avatar?: string;
  accentColor?: string;
  title?: string;
};

type Message = {
  id: number;
  judgeId: string;
  text: string;
  type?: string;
};

type Props = {
  judges: Judge[];
  messages: Message[];
  currentSpeaker?: string | null;
  awaitingResponse?: boolean;
  onUserResponse: (text: string) => void;
  language?: string;
  agencyAccent?: string;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  responsePrompt?: string;
  compact?: boolean;
};

export default function JudgeConversation({
  judges,
  messages,
  currentSpeaker = null,
  awaitingResponse = false,
  onUserResponse,
  language = 'ko',
  agencyAccent = '#FF1F8E',
  voiceEnabled = true,
  onToggleVoice,
  responsePrompt = '심사위원의 질문에 답해주세요.',
  compact = false,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0,
        height: '100%',
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <JudgeDialogBox
          judges={judges}
          messages={messages}
          currentSpeaker={currentSpeaker}
          voiceEnabled={voiceEnabled}
          onToggleVoice={onToggleVoice}
          agencyAccent={agencyAccent}
          compact={compact}
        />
      </div>

      {awaitingResponse ? (
        <MicResponseInput
          language={language}
          accentColor={agencyAccent}
          prompt={responsePrompt}
          onSubmit={onUserResponse}
        />
      ) : null}
    </div>
  );
}
