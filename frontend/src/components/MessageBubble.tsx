import React, { useState } from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [showFullSources, setShowFullSources] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getContextIcon = (contextUsed?: string, usedWebSearch?: boolean) => {
    if (contextUsed === 'both') return '🌐📚';
    if (contextUsed === 'web' || usedWebSearch) return '🌐';
    if (contextUsed === 'document') return '📚';
    return '🤖';
  };

  const getContextLabel = (contextUsed?: string, usedWebSearch?: boolean) => {
    if (contextUsed === 'both') return 'Document + Web Search';
    if (contextUsed === 'web' || usedWebSearch) return 'Web Search';
    if (contextUsed === 'document') return 'Document';
    return 'AI Response';
  };

  const isStockResponse = (content: string) => {
    return content.toLowerCase().includes('stock') || 
           content.toLowerCase().includes('price') ||
           content.includes('$') ||
           content.toLowerCase().includes('market');
  };

  const formatMessageContent = (content: string) => {
    // Split content into paragraphs for better readability
    const paragraphs = content.split('\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      // Check if it's a list item
      if (paragraph.startsWith('•') || paragraph.startsWith('-') || paragraph.match(/^\d+\./)) {
        return (
          <div key={index} className="list-item">
            {paragraph}
          </div>
        );
      }
      
      // Check if it's a stock price or financial data
      if (paragraph.includes('$') || paragraph.toLowerCase().includes('price:')) {
        return (
          <div key={index} className="financial-data">
            {paragraph}
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <p key={index}>{paragraph}</p>
      );
    });
  };

  const groupSourcesByType = (sources: string[]) => {
    const documentSources = sources.filter(source => 
      !source.toLowerCase().includes('web search') && 
      !source.toLowerCase().includes('stock') &&
      !source.toLowerCase().includes('news')
    );
    
    const webSources = sources.filter(source => 
      source.toLowerCase().includes('web search') ||
      source.toLowerCase().includes('stock') ||
      source.toLowerCase().includes('news')
    );
    
    return { documentSources, webSources };
  };

  return (
    <div className={`message-bubble ${message.role} ${isStockResponse(message.content) ? 'stock-response' : ''}`}>
      <div className="message-header">
        <div className="message-info">
          <span className="message-role">
            {message.role === 'user' ? (
              <>👤 You</>
            ) : (
              <>
                {getContextIcon(message.contextUsed, message.usedWebSearch)} DocuChat AI
                <span className="context-label">
                  ({getContextLabel(message.contextUsed, message.usedWebSearch)})
                </span>
              </>
            )}
          </span>
          <span className="message-timestamp">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        
        {message.role === 'assistant' && (
          <div className="message-indicators">
            {message.usedWebSearch && (
              <div className="indicator web-search" title="Enhanced with web search">
                🌐
              </div>
            )}
            {message.sources && message.sources.length > 0 && !message.usedWebSearch && (
              <div className="indicator document" title="Based on document content">
                📚
              </div>
            )}
            {isStockResponse(message.content) && (
              <div className="indicator stock" title="Financial/Stock data">
                📈
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="message-content">
        {formatMessageContent(message.content)}
        
        {message.sources && message.sources.length > 0 && (
          <div className="message-sources">
            {(() => {
              const { documentSources, webSources } = groupSourcesByType(message.sources);
              const maxVisible = 2;
              const totalSources = message.sources.length;
              
              return (
                <>
                  <div className="sources-header">
                    <strong>📋 Sources ({totalSources}):</strong>
                    {totalSources > maxVisible && (
                      <button 
                        className="toggle-sources"
                        onClick={() => setShowFullSources(!showFullSources)}
                      >
                        {showFullSources ? 'Show Less' : `Show All (${totalSources})`}
                      </button>
                    )}
                  </div>
                  
                  <div className="sources-content">
                    {documentSources.length > 0 && (
                      <div className="source-group">
                        <div className="source-group-title">📚 Document Sources:</div>
                        <ul>
                          {(showFullSources ? documentSources : documentSources.slice(0, maxVisible))
                            .map((source, index) => (
                            <li key={`doc-${index}`} className="source-item document-source">
                              {source}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {webSources.length > 0 && (
                      <div className="source-group">
                        <div className="source-group-title">🌐 Web Sources:</div>
                        <ul>
                          {(showFullSources ? webSources : webSources.slice(0, maxVisible))
                            .map((source, index) => (
                            <li key={`web-${index}`} className="source-item web-source">
                              {source}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
        
        {message.role === 'assistant' && (
          <div className="message-footer">
            {message.usedWebSearch && message.contextUsed === 'both' && (
              <div className="enhanced-indicator">
                <small>✨ Enhanced with both document knowledge and web search</small>
              </div>
            )}
            {message.usedWebSearch && message.contextUsed === 'web' && (
              <div className="web-only-indicator">
                <small>🌐 Based on web search (no relevant document content found)</small>
              </div>
            )}
            {!message.usedWebSearch && message.sources && message.sources.length > 0 && (
              <div className="document-only-indicator">
                <small>📚 Based on document content</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;