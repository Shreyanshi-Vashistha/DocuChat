import React from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="message-header">
        <span className="message-role">
          {message.role === 'user' ? 'You' : 'DocuChat AI'}
        </span>
        <span className="message-timestamp">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      
      <div className="message-content">
        <p>{message.content}</p>
        
        {message.sources && message.sources.length > 0 && (
          <div className="message-sources">
            <strong>Sources:</strong>
            <ul>
              {message.sources.map((source, index) => (
                <li key={index}>{source}</li>
              ))}
            </ul>
          </div>
        )}
        
        {message.usedWebSearch && (
          <div className="web-search-indicator">
            <small>🌐 Enhanced with web search</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
