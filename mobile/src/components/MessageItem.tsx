import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
}

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const showSources = () => {
    if (!message.sources || message.sources.length === 0) return;
    
    const sourcesText = message.sources.join('\n• ');
    Alert.alert(
      'Sources',
      `• ${sourcesText}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.assistantContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble
      ]}>
        {/* Message Header */}
        <View style={styles.messageHeader}>
          <Text style={[
            styles.roleText,
            isUser ? styles.userRoleText : styles.assistantRoleText
          ]}>
            {isUser ? 'You' : 'DocuChat AI'}
          </Text>
          <Text style={[
            styles.timestampText,
            isUser ? styles.userTimestampText : styles.assistantTimestampText
          ]}>
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>

        {/* Message Content */}
        <Text style={[
          styles.contentText,
          isUser ? styles.userContentText : styles.assistantContentText
        ]}>
          {message.content}
        </Text>

        {/* Sources Button */}
        {message.sources && message.sources.length > 0 && (
          <TouchableOpacity
            style={[
              styles.sourcesButton,
              isUser ? styles.userSourcesButton : styles.assistantSourcesButton
            ]}
            onPress={showSources}
          >
            <Text style={[
              styles.sourcesButtonText,
              isUser ? styles.userSourcesButtonText : styles.assistantSourcesButtonText
            ]}>
              📚 Sources ({message.sources.length})
            </Text>
          </TouchableOpacity>
        )}

        {/* Web Search Indicator */}
        {message.usedWebSearch && (
          <View style={[
            styles.webSearchIndicator,
            isUser ? styles.userWebSearchIndicator : styles.assistantWebSearchIndicator
          ]}>
            <Text style={[
              styles.webSearchText,
              isUser ? styles.userWebSearchText : styles.assistantWebSearchText
            ]}>
              🌐 Enhanced with web search
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#007bff',
  },
  assistantBubble: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userRoleText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assistantRoleText: {
    color: '#495057',
  },
  timestampText: {
    fontSize: 11,
  },
  userTimestampText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  assistantTimestampText: {
    color: '#6c757d',
  },
  contentText: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    lineHeight: 20,
  },
  userContentText: {
    color: '#fff',
  },
  assistantContentText: {
    color: '#212529',
  },
  sourcesButton: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  userSourcesButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  assistantSourcesButton: {
    backgroundColor: '#e9ecef',
  },
  sourcesButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userSourcesButtonText: {
    color: '#fff',
  },
  assistantSourcesButtonText: {
    color: '#495057',
  },
  webSearchIndicator: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  userWebSearchIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
  },
  assistantWebSearchIndicator: {
    backgroundColor: 'rgba(23, 162, 184, 0.1)',
    borderLeftColor: '#17a2b8',
  },
  webSearchText: {
    fontSize: 11,
  },
  userWebSearchText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assistantWebSearchText: {
    color: '#17a2b8',
  },
});

export default MessageItem;