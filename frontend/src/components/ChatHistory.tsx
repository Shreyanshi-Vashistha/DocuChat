import React from 'react';
import { Conversation } from '../types';

interface ChatHistoryProps {
  conversations: Conversation[];
  currentConversationId: string;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation?: (conversationId: string) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  conversations,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation
}) => {
  const formatLastActivity = (lastActivity: string | null) => {
    if (!lastActivity) return 'No messages';
    
    const date = new Date(lastActivity);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) { // 24 hours
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else if (diffInMinutes < 10080) { // 7 days
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateTitle = (title: string, maxLength: number = 45) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength).trim() + '...';
  };

  const groupConversationsByDate = (conversations: Conversation[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const groups: { [key: string]: Conversation[] } = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': []
    };

    conversations.forEach(conv => {
      if (!conv.lastActivity) {
        groups['Older'].push(conv);
        return;
      }

      const convDate = new Date(conv.lastActivity);
      if (convDate >= today) {
        groups['Today'].push(conv);
      } else if (convDate >= yesterday) {
        groups['Yesterday'].push(conv);
      } else if (convDate >= lastWeek) {
        groups['This Week'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (onDeleteConversation && window.confirm('Are you sure you want to delete this conversation?')) {
      onDeleteConversation(conversationId);
    }
  };

  const groupedConversations = groupConversationsByDate(conversations);

  return (
    <div className="chat-history">
      <div className="history-header">
        <h3>Chat History</h3>
        <button 
          className="btn-primary new-chat-btn"
          onClick={onNewConversation}
          title="Start a new conversation"
        >
          <span className="btn-icon">💬</span>
          New Chat
        </button>
      </div>

      <div className="conversations-list">
        {conversations.length === 0 ? (
          <div className="empty-history">
            <div className="empty-icon">📝</div>
            <p>No conversations yet</p>
            <small>Start chatting to see your history here</small>
          </div>
        ) : (
          Object.entries(groupedConversations).map(([groupName, groupConversations]) => {
            if (groupConversations.length === 0) return null;
            
            return (
              <div key={groupName} className="conversation-group">
                <div className="group-header">{groupName}</div>
                {groupConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`conversation-item ${
                      conversation.id === currentConversationId ? 'active' : ''
                    }`}
                    onClick={() => onConversationSelect(conversation.id)}
                    title={conversation.title}
                  >
                    <div className="conversation-content">
                      <div className="conversation-title">
                        {truncateTitle(conversation.title || 'Untitled Conversation')}
                      </div>
                      
                      {conversation.keyTopics && conversation.keyTopics.length > 0 && (
                        <div className="conversation-topics">
                          {conversation.keyTopics.slice(0, 2).map(topic => (
                            <span key={topic} className="topic-tag">
                              {topic}
                            </span>
                          ))}
                          {conversation.keyTopics.length > 2 && (
                            <span className="topic-more">+{conversation.keyTopics.length - 2}</span>
                          )}
                        </div>
                      )}
                      
                      <div className="conversation-meta">
                        <span className="message-count">
                          💬 {conversation.messageCount}
                        </span>
                        <span className="last-activity">
                          🕒 {formatLastActivity(conversation.lastActivity)}
                        </span>
                      </div>
                    </div>
                    
                    {onDeleteConversation && (
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDeleteClick(e, conversation.id)}
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {conversations.length > 0 && (
        <div className="history-footer">
          <small className="conversation-count">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} total
          </small>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;