import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string, options?: { useWebSearch?: boolean }) => void;
  onClear: () => void;
  isLoading: boolean;
  conversationId: string;
  disabled?: boolean;
  conversationTitle?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onClear,
  isLoading,
  conversationId,
  disabled = false,
  conversationTitle
}) => {
  const [input, setInput] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSendMessage(input.trim(), { useWebSearch });
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
      onSendMessage(question, { useWebSearch });
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
    "What technology equipment is provided?",
    "What's the current price of AAPL?", // Stock query example
    "How has Tesla performed this week?" // Stock query example
  ];

  const getContextualSuggestions = () => {
    if (messages.length === 0) return suggestedQuestions;
    
    // Generate contextual follow-up questions based on recent messages
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant');
    
    if (lastAssistantMessage) {
      const content = lastAssistantMessage.content.toLowerCase();
      
      if (content.includes('vacation') || content.includes('pto')) {
        return [
          "How do I request vacation time?",
          "Can I carry over unused vacation days?",
          "What's the vacation approval process?"
        ];
      }
      
      if (content.includes('sick') || content.includes('medical')) {
        return [
          "Do I need a doctor's note for sick leave?",
          "How long can I take sick leave?",
          "What about family medical leave?"
        ];
      }
      
      if (content.includes('benefits') || content.includes('insurance')) {
        return [
          "When do benefits start?",
          "How do I enroll in benefits?",
          "What's covered under the health plan?"
        ];
      }
      
      if (content.includes('stock') || content.includes('price')) {
        return [
          "What's the current price of TSLA?",
          "How has Microsoft performed today?",
          "Show me Amazon's stock performance"
        ];
      }
    }
    
    return [
      "Can you explain that in more detail?",
      "What are the specific requirements?",
      "Are there any exceptions to this policy?"
    ];
  };

  const hasMemoryContext = messages.length > 2;
  const webSearchCount = messages.filter(msg => msg.usedWebSearch).length;
  const documentCount = messages.filter(msg => msg.sources && msg.sources.length > 0 && !msg.usedWebSearch).length;

  return (
    <div className="chat-interface">
      {conversationTitle && (
        <div className="conversation-header">
          <h2 className="conversation-title">{conversationTitle}</h2>
          {hasMemoryContext && (
            <div className="context-indicator" title="This conversation has memory context">
              🧠 Memory Active
            </div>
          )}
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-header">
              <h2>🤖 Welcome to Enhanced DocuChat!</h2>
              <div className="feature-badges">
                <span className="feature-badge">📚 Document Search</span>
                <span className="feature-badge">🌐 Web Search</span>
                <span className="feature-badge">🧠 Memory Context</span>
                <span className="feature-badge">📈 Stock Data</span>
              </div>
            </div>
            
            <p>Ask questions about company policies or general topics. Here are some suggestions:</p>
            
            <div className="suggested-questions">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  className={`suggested-question ${
                    question.includes('AAPL') || question.includes('Tesla') ? 'stock-question' : ''
                  }`}
                  onClick={() => handleSuggestedQuestion(question)}
                  disabled={isLoading || disabled}
                >
                  {question.includes('stock') || question.includes('price') || question.includes('AAPL') || question.includes('Tesla') ? '📈 ' : '📄 '}
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
          <>
            <div className="messages-list">
              {messages.map((message, index) => (
                <MessageBubble key={`${conversationId}-${index}`} message={message} />
              ))}
              {isLoading && (
                <div className="loading-message">
                  <div className="loading-animation">
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="loading-text">
                      {useWebSearch ? '🌐 AI is searching and thinking...' : '🤖 AI is thinking...'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Contextual follow-up suggestions */}
            {!isLoading && messages.length > 0 && (
              <div className="follow-up-suggestions">
                <div className="suggestions-header">💡 Follow-up questions:</div>
                <div className="suggestions-list">
                  {getContextualSuggestions().slice(0, 3).map((question, index) => (
                    <button
                      key={index}
                      className="follow-up-question"
                      onClick={() => handleSuggestedQuestion(question)}
                      disabled={disabled}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        {/* Settings Panel */}
        {showSettings && (
          <div ref={settingsRef} className="settings-panel">
            <div className="settings-header">
              <h4>🛠️ Chat Settings</h4>
              <button 
                className="close-settings" 
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>
            <div className="settings-content">
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={useWebSearch}
                  onChange={(e) => setUseWebSearch(e.target.checked)}
                />
                <span className="checkmark"></span>
                <div className="setting-label">
                  <strong>🌐 Enable Web Search</strong>
                  <small>Search the web when document doesn't have the answer</small>
                </div>
              </label>
              
              {messages.length > 0 && (
                <div className="stats-section">
                  <h5>📊 Session Stats</h5>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-value">{documentCount}</span>
                      <span className="stat-label">Document</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{webSearchCount}</span>
                      <span className="stat-label">Web Search</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{messages.length / 2}</span>
                      <span className="stat-label">Exchanges</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                disabled 
                  ? "Server disconnected..." 
                  : useWebSearch 
                    ? "Ask about policies or anything else (web search enabled)..." 
                    : "Ask about the document..."
              }
              disabled={isLoading || disabled}
              rows={1}
              className="message-input"
              maxLength={1000}
            />
            
            <div className="input-controls">
              <button
                type="button"
                className={`settings-btn ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings(!showSettings)}
                disabled={disabled}
                title="Chat settings"
                aria-label="Chat settings"
              >
                ⚙️
              </button>
              
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading || disabled}
                className="send-button"
                title={disabled ? "Server disconnected" : isLoading ? "Processing..." : "Send message"}
              >
                {isLoading ? (
                  <span className="loading-spinner">⏳</span>
                ) : (
                  <span className="send-icon">🚀</span>
                )}
              </button>
            </div>
          </div>
          
          {useWebSearch && (
            <div className="web-search-indicator">
              🌐 Web search enabled for comprehensive answers
            </div>
          )}
        </form>
        
        {messages.length > 0 && (
          <div className="chat-controls">
            <button 
              onClick={onClear}
              className="clear-button"
              disabled={isLoading || disabled}
              title="Clear conversation"
            >
              🗑️ Clear Chat
            </button>
            
            <div className="message-count">
              💬 {messages.length} message{messages.length !== 1 ? 's' : ''}
              {hasMemoryContext && <span className="memory-indicator" title="Memory context active"> • 🧠</span>}
            </div>
          </div>
        )}
      </div>

      {conversationId && (
        <div className="conversation-info">
          <small>
            ID: {conversationId.split('_')[1]}
            {disabled && ' (Disconnected)'}
            {hasMemoryContext && ' • Memory: Active'}
          </small>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;