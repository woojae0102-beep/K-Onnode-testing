// @ts-nocheck
import React, { useEffect } from 'react';
import ChatWindow from '../components/community/ChatWindow';

export default function ChatWindowView({
  conversationId,
  conversations = [],
  activeConversation,
  setActiveConversationId,
  draft,
  setDraft,
  sendText,
  sendMedia,
  uploading,
  markRead,
}) {
  useEffect(() => {
    if (conversationId && conversationId !== activeConversation?.id) {
      setActiveConversationId(conversationId);
    }
  }, [conversationId, activeConversation, setActiveConversationId]);

  const conversation = conversations.find((c) => c.id === conversationId) || activeConversation;

  return (
    <div
      className="flex flex-col"
      style={{ height: '100%', background: '#FFFFFF' }}
    >
      <ChatWindow
        conversation={conversation}
        draft={draft}
        setDraft={setDraft}
        onSend={sendText}
        onMedia={sendMedia}
        uploading={uploading}
        onRead={markRead}
      />
    </div>
  );
}
