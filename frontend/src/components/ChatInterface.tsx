import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClear: () => void;
  isLoading: boolean;
  conversationId: string;
  disabled?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onClear,
  isLoading,
  conversationId,
  disabled = false
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

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
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

  const handleSuggestedQuestion = (question: string) => {
    if (!isLoading && !disabled) {
      onSendMessage(question);
    }
  };

  const suggestedQuestions = [
    "What are the company's vacation policies?",
    "How many sick days do employees get?",
    "What benefits does the company offer?",
    "What are the remote work requirements?",
    "How does the performance review process work?",
    "What is the expense reimbursement policy?",
    "What are the working hours?",
    "What technology equipment is provided?"
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
                  onClick={() => handleSuggestedQuestion(question)}
                  disabled={isLoading || disabled}
                >
                  {question}
                </button>
              ))}
            </div>
            {disabled && (
              <div className="connection-warning">
                <p>⚠️ Unable to connect to the server. Please check that the backend is running.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => (
              <MessageBubble key={`${conversationId}-${index}`} message={message} />
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
              placeholder={disabled ? "Server disconnected..." : "Ask a question about the document..."}
              disabled={isLoading || disabled}
              rows={1}
              className="message-input"
              maxLength={1000}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading || disabled}
              className="send-button"
              title={disabled ? "Server disconnected" : isLoading ? "Processing..." : "Send message"}
            >
              {isLoading ? '...' : '📤'}
            </button>
          </div>
        </form>
        
        {messages.length > 0 && (
          <div className="chat-controls">
            <button 
              onClick={onClear}
              className="clear-button"
              disabled={isLoading || disabled}
              title="Clear conversation"
            >
              🗑️ Clear Conversation
            </button>
            
            <div className="message-count">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {conversationId && (
        <div className="conversation-info">
          <small>
            Conversation ID: {conversationId}
            {disabled && ' (Disconnected)'}
          </small>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;