import axios from "axios";
import {
  ChatRequest,
  ChatResponse,
  ConversationHistory,
  ConversationsResponse,
  StockData,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (config.url?.includes("/chat")) {
      config.timeout = 300000;
    } else if (config.url?.includes("/stock")) {
      config.timeout = 10000;
    } else {
      config.timeout = 30000;
    }

    return config;
  },
  (error) => {
    console.error(" API Request Error:", error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API Response Error:", error.response?.data || error.message);

    if (error.code === "ECONNABORTED") {
      throw new Error(
        "Request timeout - the server took too long to respond. This might happen with complex web searches."
      );
    }

    if (error.code === "ERR_NETWORK" || error.code === "ECONNREFUSED") {
      throw new Error(
        "Network error - please check that the backend server is running on port 5001"
      );
    }

    if (!error.response) {
      throw new Error(
        "Network error - please check your connection and server status"
      );
    }

    const message =
      error.response.data?.error ||
      error.response.data?.message ||
      `HTTP ${error.response.status}: ${error.response.statusText}`;

    throw new Error(message);
  }
);

export const chatApi = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    try {
      const response = await apiClient.post("/chat", request);
      return response.data;
    } catch (error) {
      console.error("Chat API Error:", error);
      if (error instanceof Error && error.message.includes("Network error")) {
        throw new Error(
          "Unable to connect to the chat server. Please ensure the backend is running and try again."
        );
      }

      throw error;
    }
  },

  getConversationHistory: async (
    conversationId: string
  ): Promise<ConversationHistory> => {
    try {
      const response = await apiClient.get(`/chat/history/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error("Get History Error:", error);
      throw error;
    }
  },

  clearConversationHistory: async (conversationId: string): Promise<void> => {
    try {
      await apiClient.delete(`/chat/history/${conversationId}`);
    } catch (error) {
      console.error("Clear History Error:", error);
      throw error;
    }
  },

  getConversations: async (): Promise<ConversationsResponse> => {
    try {
      const response = await apiClient.get("/chat/conversations");
      return response.data;
    } catch (error) {
      console.error("Get Conversations Error:", error);
      throw error;
    }
  },

  getStockData: async (symbol: string): Promise<StockData> => {
    try {
      const response = await apiClient.get(`/chat/stock/${symbol}`);
      return response.data;
    } catch (error) {
      console.error("Stock Data Error:", error);
      throw error;
    }
  },

  healthCheck: async (): Promise<{
    status: string;
    timestamp: string;
    services?: {
      llm: boolean;
      vector: boolean;
      webSearch: boolean;
    };
  }> => {
    try {
      const response = await apiClient.get("/health");
      return response.data;
    } catch (error) {
      console.error("Health Check Error:", error);
      throw error;
    }
  },

  testWebSearch: async (
    query: string
  ): Promise<{ results: string[]; success: boolean }> => {
    try {
      const response = await apiClient.post("/chat/test-websearch", { query });
      return response.data;
    } catch (error) {
      console.error("Web Search Test Error:", error);
      throw error;
    }
  },

  getStats: async (): Promise<{
    totalConversations: number;
    totalMessages: number;
    webSearchUsage: number;
    documentUsage: number;
  }> => {
    try {
      const response = await apiClient.get("/chat/stats");
      return response.data;
    } catch (error) {
      console.error("Stats Error:", error);
      throw error;
    }
  },
};

export const apiUtils = {
  checkConnection: async (): Promise<boolean> => {
    try {
      await chatApi.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  },

  formatError: (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unknown error occurred";
  },

  detectStockQuery: (query: string): string | null => {
    const stockPatterns = [
      /\b([A-Z]{2,5})\b.*(?:stock|price|shares?)/i,
      /(?:stock|price|shares?) of ([A-Z]{2,5})\b/i,
      /\b(AAPL|TSLA|MSFT|GOOGL|AMZN|NVDA|META)\b/i,
    ];

    for (const pattern of stockPatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }

    return null;
  },

  retryRequest: async <T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        if (attempt === maxRetries) {
          throw lastError;
        }

        console.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms...`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }

    throw lastError!;
  },
};

export default chatApi;
