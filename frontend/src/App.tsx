import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import ChatHistory from './components/ChatHistory';
import { Conversation, Message } from './types';
import { chatApi } from './services/api';
import './styles/global.css';

const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState({
    useWebSearch: false,
    maintainHistory: true
  });

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await chatApi.getConversations();
      setConversations(response.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId('');
    setMessages([]);
    setError('');
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await chatApi.getConversationHistory(conversationId);
      setCurrentConversationId(conversationId);
      setMessages(response.messages);
      setShowHistory(false);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation history');
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);
    setError('');

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId,
        useWebSearch: settings.useWebSearch,
        maintainHistory: settings.maintainHistory
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
        sources: response.sources,
        usedWebSearch: response.usedWebSearch
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentConversationId(response.conversationId);
      
      // Refresh conversations list
      await loadConversations();
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message. Please try again.');
      
      // Remove the user message if the request failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    if (!currentConversationId) {
      startNewConversation();
      return;
    }

    try {
      await chatApi.clearConversationHistory(currentConversationId);
      startNewConversation();
      await loadConversations();
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      setError('Failed to clear conversation');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>DocuChat</h1>
          <p>AI-powered document Q&A assistant</p>
          
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            
            <button 
              className="btn-secondary"
              onClick={startNewConversation}
            >
              New Chat
            </button>
          </div>
        </div>

        <div className="settings-panel">
          <label className="setting-item">
            <input
              type="checkbox"
              checked={settings.useWebSearch}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                useWebSearch: e.target.checked
              }))}
            />
            <span>Enable web search fallback</span>
          </label>
          
          <label className="setting-item">
            <input
              type="checkbox"
              checked={settings.maintainHistory}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                maintainHistory: e.target.checked
              }))}
            />
            <span>Maintain conversation context</span>
          </label>
        </div>
      </header>

      <main className="app-main">
        {showHistory && (
          <div className="sidebar">
            <ChatHistory
              conversations={conversations}
              currentConversationId={currentConversationId}
              onConversationSelect={loadConversation}
              onNewConversation={startNewConversation}
            />
          </div>
        )}

        <div className={`chat-container ${showHistory ? 'with-sidebar' : ''}`}>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError('')}>×</button>
            </div>
          )}

          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            onClear={clearConversation}
            isLoading={isLoading}
            conversationId={currentConversationId}
          />
        </div>
      </main>

      <footer className="app-footer">
        <p>
          DocuChat - Document-based AI Assistant | 
          {settings.useWebSearch && ' Web Search Enabled |'}
          {settings.maintainHistory && ' Context Memory Enabled |'}
          Status: {isLoading ? 'Processing...' : 'Ready'}
        </p>
      </footer>
    </div>
  );
};

export default App;