import React, { useState, useRef, useEffect } from "react";
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
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { chatApi } from "../services/api";
import MessageItem from "./MessageItem";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
  contextUsed?: "document" | "web" | "both";
}

interface LoadedConversation {
  conversationId: string;
  messages: Message[];
}

interface ChatScreenProps {
  onNavigateToHistory?: () => void;
  loadedConversation?: LoadedConversation | null;
  isLoadingConversation?: boolean;
}

const { width } = Dimensions.get("window");

const ChatScreen: React.FC<ChatScreenProps> = ({
  onNavigateToHistory,
  loadedConversation,
  isLoadingConversation = false,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [maintainHistory, setMaintainHistory] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const suggestedQuestions = [
    "What are the company's vacation policies?",
    "How many sick days do employees get?",
    "What benefits does the company offer?",
    "What are the remote work requirements?",
    "What's the stock price of AAPL?",
    "Tell me about the code of conduct",
  ];

  const stockSymbols = ["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA"];

  useEffect(() => {
    if (loadedConversation) {
      setMessages(loadedConversation.messages);
      setConversationId(loadedConversation.conversationId);
    }
  }, [loadedConversation]);

  useEffect(() => {
    checkServerConnection();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const checkServerConnection = async () => {
    try {
      await chatApi.healthCheck();
      setIsConnected(true);
      setRetryCount(0);
    } catch (error) {
      setIsConnected(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: message.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const response = await chatApi.sendMessage({
        message: message.trim(),
        conversationId: conversationId,
        useWebSearch,
        maintainHistory,
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: response.response,
        timestamp: response.timestamp,
        sources: response.sources,
        usedWebSearch: response.usedWebSearch,
        contextUsed: response.contextUsed || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(response.conversationId);
      setIsConnected(true);
      setRetryCount(0);
    } catch (error) {
      console.error("Failed to send message:", error);
      setRetryCount((prev) => prev + 1);

      if (retryCount < 2) {
        Alert.alert(
          "Connection Error",
          "Failed to send message. Would you like to retry?",
          [
            {
              text: "Cancel",
              onPress: () => setMessages((prev) => prev.slice(0, -1)),
            },
            { text: "Retry", onPress: () => sendMessage(message) },
          ]
        );
      } else {
        Alert.alert(
          "Server Unavailable",
          "The DocuChat server appears to be offline. Please check that the backend server is running on http://localhost:5001",
          [
            {
              text: "OK",
              onPress: () => setMessages((prev) => prev.slice(0, -1)),
            },
          ]
        );
      }
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const sendStockQuery = async (symbol: string) => {
    const stockQuery = `What's the current stock price of ${symbol}?`;
    await sendMessage(stockQuery);
  };

  const clearConversation = () => {
    Alert.alert(
      "Clear Conversation",
      "Are you sure you want to clear the conversation? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setMessages([]);
            setConversationId("");
            if (conversationId) {
              chatApi
                .clearConversationHistory(conversationId)
                .catch(console.error);
            }
          },
        },
      ]
    );
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId("");
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <MessageItem message={item} messageIndex={index} />
    </Animated.View>
  );

  const renderConnectionStatus = () => {
    if (isConnected) return null;

    return (
      <View style={styles.connectionAlert}>
        <Text style={styles.connectionAlertText}>
          Server connection lost. Check if backend is running.
        </Text>
        <TouchableOpacity
          onPress={checkServerConnection}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLoadingConversation = () => {
    if (!isLoadingConversation) return null;

    return (
      <View style={styles.loadingConversationContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingConversationText}>
          Loading conversation...
        </Text>
      </View>
    );
  };

  const renderWelcomeScreen = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeTitle}>Welcome to DocuChat!</Text>
      <Text style={styles.welcomeSubtitle}>
        Ask questions about company policies or general topics. Here are some
        suggestions:
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

      <View style={styles.stockContainer}>
        <Text style={styles.stockTitle}>Quick Stock Quotes:</Text>

        {stockSymbols.map((symbol) => (
          <TouchableOpacity
            key={symbol}
            style={styles.stockButton}
            onPress={() => sendStockQuery(symbol)}
            disabled={isLoading}
          >
            <Text style={styles.stockButtonText}>{symbol}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>DocuChat</Text>
          <View
            style={[
              styles.statusIndicator,
              isConnected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          >
            <Text style={styles.statusText}>
              {isConnected ? "Connected" : "Disconnected"}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={startNewConversation}
            >
              <Text style={styles.headerButtonText}>New</Text>
            </TouchableOpacity>
          )}
          {onNavigateToHistory && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onNavigateToHistory}
            >
              <Text style={styles.headerButtonText}>History</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.headerSubtitle}>
        AI-powered document Q&A assistant
      </Text>

      {loadedConversation && (
        <View style={styles.conversationIndicator}>
          <Text style={styles.conversationIndicatorText}>
            Loaded conversation with {loadedConversation.messages.length}{" "}
            messages
          </Text>
        </View>
      )}
    </View>
  );

  if (isLoadingConversation) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        {renderHeader()}
        {renderLoadingConversation()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {renderHeader()}
      {renderConnectionStatus()}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
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
            <Text style={styles.loadingText}>
              {useWebSearch
                ? "Searching web and documents..."
                : "AI is thinking..."}
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInput, { maxHeight: 100 }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                !isConnected
                  ? "Server offline - check connection"
                  : "Ask about policies, stocks, or anything..."
              }
              placeholderTextColor={!isConnected ? "#dc3545" : "#999"}
              multiline
              editable={!isLoading && isConnected}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading || !isConnected) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading || !isConnected}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? "..." : "Send"}
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
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#dee2e6",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007bff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
    marginTop: 4,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusConnected: {
    backgroundColor: "#d4edda",
  },
  statusDisconnected: {
    backgroundColor: "#f8d7da",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#495057",
  },
  conversationIndicator: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: "center",
  },
  conversationIndicatorText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "500",
  },
  connectionAlert: {
    backgroundColor: "#fff3cd",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ffeaa7",
  },
  connectionAlertText: {
    color: "#856404",
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: "#ffc107",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "#212529",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingConversationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingConversationText: {
    fontSize: 16,
    color: "#6c757d",
  },
  settingsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: "#6c757d",
  },
  chatContainer: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007bff",
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 24,
  },
  suggestedContainer: {
    width: "100%",
    maxWidth: 400,
    marginBottom: 24,
  },
  suggestedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 12,
  },
  suggestedButton: {
    backgroundColor: "#fffbfb",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  suggestedButtonText: {
    fontSize: 14,
    color: "#495057",
    textAlign: "left",
  },
  stockContainer: {
    width: "100%",
    maxWidth: 400,
    marginBottom: 24,
  },
  stockTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 12,
  },

  stockButton: {
    backgroundColor: "#e3f2fd",
    borderWidth: 1,
    borderColor: "#2196f3",
    borderRadius: 8,
    padding: 12,

    marginBottom: 8,
  },
  stockButtonText: {
    fontSize: 14,
    color: "#1976d2",
    fontWeight: "600",
    textAlign: "center",
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#6c757d",
  },
  inputContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dee2e6",
    padding: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: "#fff",
  },
  sendButton: {
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#adb5bd",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  clearButton: {
    backgroundColor: "#dc3545",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ChatScreen;
