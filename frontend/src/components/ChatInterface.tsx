import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClear: () => void;
  isLoading: boolean;
  conversationId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onClear,
  isLoading,
  conversationId
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestedQuestions = [
    "What are the company's vacation policies?",
    "How many sick days do employees get?",
    "What benefits does the company offer?",
    "What are the remote work requirements?",
    "How does the performance review process work?"
  ];

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to DocuChat!</h2>
            <p>Ask questions about the company policy document. Here are some suggestions:</p>
            <div className="suggested-questions">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  className="suggested-question"
                  onClick={() => !isLoading && onSendMessage(question)}
                  disabled={isLoading}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {isLoading && (
              <div className="loading-message">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>AI is thinking...</span>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the document..."
              disabled={isLoading}
              rows={1}
              className="message-input"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="send-button"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </form>
        
        {messages.length > 0 && (
          <button 
            onClick={onClear}
            className="clear-button"
            disabled={isLoading}
          >
            Clear Conversation
          </button>
        )}
      </div>

      {conversationId && (
        <div className="conversation-info">
          <small>Conversation ID: {conversationId}</small>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;