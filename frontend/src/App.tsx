import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import ChatHistory from './components/ChatHistory';
import { Conversation, Message } from './types';
import { chatApi } from './services/api';
import './styles/global.css';
//import './styles/enhanced.css';

const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [settings, setSettings] = useState({
    useWebSearch: false,
    maintainHistory: true
  });

  // Load conversations and check connection on mount
  useEffect(() => {
    checkConnection();
    loadConversations();
  }, []);

  const checkConnection = async () => {
    try {
      await chatApi.healthCheck();
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
      setError('Unable to connect to the server. Please check if the backend is running.');
    }
  };

  const loadConversations = async () => {
    try {
      const response = await chatApi.getConversations();
      setConversations(response.conversations);
      console.log(`Loaded ${response.conversations.length} conversations`);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      // Don't show error for conversations loading failure if we're already showing connection error
      if (connectionStatus === 'connected') {
        setError('Failed to load conversation history');
      }
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId('');
    setMessages([]);
    setError('');
    console.log('Started new conversation');
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await chatApi.getConversationHistory(conversationId);
      setCurrentConversationId(conversationId);
      setMessages(response.messages);
      setShowHistory(false);
      setError('');
      console.log(`Loaded conversation ${conversationId} with ${response.messages.length} messages`);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation history');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Check connection before sending
    if (connectionStatus === 'disconnected') {
      setError('Cannot send message: Not connected to server');
      return;
    }

    setIsLoading(true);
    setError('');

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      console.log(`Sending message: "${message}" to conversation: ${currentConversationId || 'new'}`);
      
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId || undefined,
        useWebSearch: settings.useWebSearch,
        maintainHistory: settings.maintainHistory
      });

      console.log('Received response:', {
        conversationId: response.conversationId,
        sources: response.sources,
        usedWebSearch: response.usedWebSearch
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
      
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
      console.log(`Clearing conversation: ${currentConversationId}`);
      await chatApi.clearConversationHistory(currentConversationId);
      startNewConversation();
      await loadConversations();
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      setError('Failed to clear conversation');
    }
  };

  const retryConnection = () => {
    setError('');
    setConnectionStatus('checking');
    checkConnection();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-main">
            <h1>DocuChat</h1>
            <p>AI-powered document Q&A assistant</p>
          </div>
          
          <div className="connection-status">
            <span className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'checking' && '🔄 Checking...'}
              {connectionStatus === 'connected' && '🟢 Connected'}
              {connectionStatus === 'disconnected' && '🔴 Disconnected'}
            </span>
            {connectionStatus === 'disconnected' && (
              <button className="btn-secondary" onClick={retryConnection}>
                Retry
              </button>
            )}
          </div>
          
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => setShowHistory(!showHistory)}
              disabled={connectionStatus === 'disconnected'}
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            
            <button 
              className="btn-secondary"
              onClick={startNewConversation}
              disabled={connectionStatus === 'disconnected'}
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
              disabled={connectionStatus === 'disconnected'}
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
              disabled={connectionStatus === 'disconnected'}
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
            disabled={connectionStatus === 'disconnected'}
          />
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-info">
            <span>DocuChat - Document-based AI Assistant</span>
            {settings.useWebSearch && <span>• Web Search Enabled</span>}
            {settings.maintainHistory && <span>• Context Memory Enabled</span>}
          </div>
          
          <div className="footer-status">
            <span>Status: {
              isLoading ? 'Processing...' : 
              connectionStatus === 'connected' ? 'Ready' : 
              connectionStatus === 'checking' ? 'Connecting...' : 
              'Disconnected'
            }</span>
            {currentConversationId && (
              <span>• Conversation: {currentConversationId.substring(0, 8)}...</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;