import React from 'react';
import { Conversation } from '../types';

interface ChatHistoryProps {
  conversations: Conversation[];
  currentConversationId: string;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  conversations,
  currentConversationId,
  onConversationSelect,
  onNewConversation
}) => {
  const formatLastActivity = (lastActivity: string | null) => {
    if (!lastActivity) return 'No messages';
    
    const date = new Date(lastActivity);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="chat-history">
      <div className="history-header">
        <h3>Chat History</h3>
        <button 
          className="btn-primary"
          onClick={onNewConversation}
        >
          + New Chat
        </button>
      </div>

      <div className="conversations-list">
        {conversations.length === 0 ? (
          <div className="empty-history">
            <p>No conversations yet</p>
            <small>Start chatting to see your history here</small>
          </div>
        ) : (
          conversations
            .sort((a, b) => {
              const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
              const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
              return dateB - dateA;
            })
            .map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  conversation.id === currentConversationId ? 'active' : ''
                }`}
                onClick={() => onConversationSelect(conversation.id)}
              >
                <div className="conversation-preview">
                  <div className="conversation-title">
                    Conversation
                  </div>
                  <div className="conversation-meta">
                    <span className="message-count">
                      {conversation.messageCount} messages
                    </span>
                    <span className="last-activity">
                      {formatLastActivity(conversation.lastActivity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ChatHistory;