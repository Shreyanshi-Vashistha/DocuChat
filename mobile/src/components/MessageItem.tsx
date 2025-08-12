import React from "react";
import Ionicons from "react-native-vector-icons/Ionicons";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
  contextUsed?: "document" | "web" | "both";
}

interface MessageItemProps {
  message: Message;
  messageIndex: number;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, messageIndex }) => {
  const isUser = message.role === "user";

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showSources = () => {
    if (!message.sources || message.sources.length === 0) return;

    const sourcesText = message.sources.join("\n• ");
    Alert.alert("Sources & References", `• ${sourcesText}`, [{ text: "OK" }], {
      cancelable: true,
    });
  };

  const getContextIcon = () => {
    if (!message.contextUsed) return null;

    switch (message.contextUsed) {
      case "document":
        return (
          <Ionicons name="document-text-outline" size={18} color="#007BFF" />
        );
      case "web":
        return <Ionicons name="globe-outline" size={18} color="#007BFF" />;
      case "both":
        return (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="document-text-outline" size={18} color="#007BFF" />
            <Ionicons
              name="globe-outline"
              size={18}
              color="#007BFF"
              style={{ marginLeft: 4 }}
            />
          </View>
        );
      default:
        return null;
    }
  };
  const getContextDescription = () => {
    if (!message.contextUsed) return "";

    switch (message.contextUsed) {
      case "document":
        return "From company documents";
      case "web":
        return "From web search";
      case "both":
        return "From documents + web search";
      default:
        return "";
    }
  };

  const formatContent = (content: string) => {
    const lines = content.split("\n");
    return lines
      .map((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null;
        if (
          trimmedLine.startsWith("•") ||
          trimmedLine.startsWith("-") ||
          /^\d+\./.test(trimmedLine)
        ) {
          return (
            <Text
              key={index}
              style={[
                styles.contentText,
                isUser ? styles.userContentText : styles.assistantContentText,
                styles.bulletPoint,
              ]}
            >
              {trimmedLine}
            </Text>
          );
        }

        return (
          <Text
            key={index}
            style={[
              styles.contentText,
              isUser ? styles.userContentText : styles.assistantContentText,
            ]}
          >
            {trimmedLine}
          </Text>
        );
      })
      .filter(Boolean);
  };

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <View style={styles.messageHeader}>
          <View style={styles.roleContainer}>
            <Text
              style={[
                styles.roleText,
                isUser ? styles.userRoleText : styles.assistantRoleText,
              ]}
            >
              <Ionicons
                name={isUser ? "person-outline" : "sparkles-outline"}
                size={20}
               
              />
              {isUser ? " You" : "DocuChat AI"}
            </Text>
            {!isUser && message.contextUsed && (
              <Text style={styles.contextIcon}>{getContextIcon()}</Text>
            )}
          </View>
          <Text
            style={[
              styles.timestampText,
              isUser ? styles.userTimestampText : styles.assistantTimestampText,
            ]}
          >
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>
        <View style={styles.contentContainer}>
          {formatContent(message.content)}
        </View>
        {!isUser && message.contextUsed && (
          <View style={[styles.contextInfo, styles.assistantContextInfo]}>
            <Text style={styles.contextText}>{getContextDescription()}</Text>
          </View>
        )}

        {message.sources && message.sources.length > 0 && (
          <TouchableOpacity
            style={[
              styles.sourcesButton,
              isUser ? styles.userSourcesButton : styles.assistantSourcesButton,
            ]}
            onPress={showSources}
          >
            <Text
              style={[
                styles.sourcesButtonText,
                isUser
                  ? styles.userSourcesButtonText
                  : styles.assistantSourcesButtonText,
              ]}
            >
              <Ionicons name="reader-outline" size={24} color="#007bff" /> View
              Sources ({message.sources.length})
            </Text>
          </TouchableOpacity>
        )}
        {message.usedWebSearch && (
          <View
            style={[
              styles.webSearchIndicator,
              isUser
                ? styles.userWebSearchIndicator
                : styles.assistantWebSearchIndicator,
            ]}
          >
            <Text
              style={[
                styles.webSearchText,
                isUser
                  ? styles.userWebSearchText
                  : styles.assistantWebSearchText,
              ]}
            >
              Enhanced with real-time web search
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
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: "#007bff",
  },
  assistantBubble: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  userRoleText: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  assistantRoleText: {
    color: "#495057",
  },
  contextIcon: {
    fontSize: 10,
  },
  timestampText: {
    fontSize: 11,
  },
  userTimestampText: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  assistantTimestampText: {
    color: "#6c757d",
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  userContentText: {
    color: "#fff",
  },
  assistantContentText: {
    color: "#212529",
  },
  bulletPoint: {
    marginLeft: 8,
    marginBottom: 6,
  },
  contextInfo: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  assistantContextInfo: {
    backgroundColor: "rgba(0, 123, 255, 0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#007bff",
  },
  contextText: {
    fontSize: 12,
    color: "#495057",
    fontStyle: "italic",
  },
  sourcesButton: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  userSourcesButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  assistantSourcesButton: {
    backgroundColor: "#e9ecef",
    borderColor: "#ced4da",
  },
  sourcesButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  userSourcesButtonText: {
    color: "#fff",
  },
  assistantSourcesButtonText: {
    color: "#495057",
  },
  webSearchIndicator: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  userWebSearchIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderLeftColor: "rgba(255, 255, 255, 0.5)",
  },
  assistantWebSearchIndicator: {
    backgroundColor: "rgba(23, 162, 184, 0.1)",
    borderLeftColor: "#17a2b8",
  },
  webSearchText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  userWebSearchText: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  assistantWebSearchText: {
    color: "#17a2b8",
  },
  debugText: {
    fontSize: 10,
    color: "#adb5bd",
    textAlign: "center",
    paddingBottom: 4,
  },
});

export default MessageItem;
