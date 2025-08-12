import React, { useState, useEffect } from 'react';
import {
  Alert,
  BackHandler
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChatScreen from './src/components/ChatScreen';
import { chatApi } from './src/services/api';
import ConversationHistoryScreen from './src/components/ConversationHistory';

type Screen = 'chat' | 'history';

interface LoadedConversation {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    sources?: string[];
    usedWebSearch?: boolean;
    contextUsed?: "document" | "web" | "both";
  }>;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('chat');
  const [loadedConversation, setLoadedConversation] = useState<LoadedConversation | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentScreen === 'history') {
        setCurrentScreen('chat');
        return true; 
      }
      return false;
    });

    return () => backHandler.remove();
  }, [currentScreen]);

  const navigateToHistory = () => {
    setCurrentScreen('history');
  };

  const navigateToChat = () => {
    setCurrentScreen('chat');
    setLoadedConversation(null);
  };

  const loadConversation = async (conversationId: string) => {
    setIsLoadingConversation(true);
    try {
      const conversation = await chatApi.getConversationHistory(conversationId);
      setLoadedConversation({
        conversationId: conversation.conversationId,
        messages: conversation.messages || []
      });
      setCurrentScreen('chat');
    } catch (error) {
      console.error('Failed to load conversation:', error);
      Alert.alert(
        'Error',
        'Failed to load conversation. It may have been deleted.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'history':
        return (
          <ConversationHistoryScreen
            onConversationSelect={loadConversation}
            onBack={navigateToChat}
          />
        );
      case 'chat':
      default:
        return (
          <ChatScreen
            onNavigateToHistory={navigateToHistory}
            loadedConversation={loadedConversation}
            isLoadingConversation={isLoadingConversation}
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      {renderScreen()}
    </SafeAreaProvider>
  );
}