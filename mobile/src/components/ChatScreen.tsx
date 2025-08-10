import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { chatApi } from '../services/api';
import MessageItem from './MessageItem';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
}

const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [maintainHistory, setMaintainHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const suggestedQuestions = [
    "What are the company's vacation policies?",
    "How many sick days do employees get?",
    "What benefits does the company offer?",
    "What are the remote work requirements?"
  ];

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage({
        message: message.trim(),
        conversationId: conversationId,
        useWebSearch,
        maintainHistory
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
        sources: response.sources,
        usedWebSearch: response.usedWebSearch
      };

      setMessages(prev => [...prev, assistantMessage]);
      setConversationId(response.conversationId);

    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert(
        'Error',
        'Failed to send message. Please check your connection and try again.'
      );
      
      // Remove the user message if the request failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear the conversation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setConversationId('');
          }
        }
      ]
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageItem message={item} />
  );

  const renderWelcomeScreen = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeTitle}>Welcome to DocuChat!</Text>
      <Text style={styles.welcomeSubtitle}>
        Ask questions about the company policy document
      </Text>
      
      <View style={styles.suggestedContainer}>
        <Text style={styles.suggestedTitle}>Try asking:</Text>
        {suggestedQuestions.map((question, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestedButton}
            onPress={() => sendMessage(question)}
            disabled={isLoading}
          >
            <Text style={styles.suggestedButtonText}>{question}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>DocuChat</Text>
      <Text style={styles.headerSubtitle}>AI Document Assistant</Text>
      
      <View style={styles.settingsContainer}>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Web Search</Text>
          <Switch
            value={useWebSearch}
            onValueChange={setUseWebSearch}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={useWebSearch ? '#007bff' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Memory</Text>
          <Switch
            value={maintainHistory}
            onValueChange={setMaintainHistory}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={maintainHistory ? '#007bff' : '#f4f3f4'}
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {messages.length === 0 ? (
          renderWelcomeScreen()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(_, index) => index.toString()}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007bff" />
            <Text style={styles.loadingText}>AI is thinking...</Text>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
               style={[styles.textInput, { maxHeight: 100 }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask a question about the document..."
              placeholderTextColor="#999"
              multiline
              editable={!isLoading}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? '...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearConversation}
              disabled={isLoading}
            >
              <Text style={styles.clearButtonText}>Clear Conversation</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
  },
  settingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  chatContainer: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  suggestedContainer: {
    width: '100%',
    maxWidth: 400,
  },
  suggestedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  suggestedButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  suggestedButtonText: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'left',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6c757d',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    padding: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#fff',
  },
  sendButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ChatScreen;