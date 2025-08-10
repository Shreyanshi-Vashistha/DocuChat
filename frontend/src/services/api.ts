import axios from 'axios';
import { 
  ChatRequest, 
  ChatResponse, 
  ConversationHistory, 
  ConversationsResponse,
  StockData 
} from '../types';

// const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';


const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for LLM responses
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - the server took too long to respond');
    }
    
    if (!error.response) {
      throw new Error('Network error - please check your connection');
    }
    
    const message = error.response.data?.error || 
                   error.response.data?.message || 
                   `HTTP ${error.response.status}: ${error.response.statusText}`;
    
    throw new Error(message);
  }
);

export const chatApi = {
  // Send a chat message
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post('/chat', request);
    return response.data;
  },

  // Get conversation history
  getConversationHistory: async (conversationId: string): Promise<ConversationHistory> => {
    const response = await apiClient.get(`/chat/history/${conversationId}`);
    return response.data;
  },

  // Clear conversation history
  clearConversationHistory: async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/chat/history/${conversationId}`);
  },

  // Get all conversations
  getConversations: async (): Promise<ConversationsResponse> => {
    const response = await apiClient.get('/chat/conversations');
    return response.data;
  },

  // Get stock data (bonus feature)
  getStockData: async (symbol: string): Promise<StockData> => {
    const response = await apiClient.get(`/chat/stock/${symbol}`);
    return response.data;
  },

  // Health check
  healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiClient.get('/health');
    return response.data;
  }
};

export default chatApi;