interface ChatRequest {
  message: string;
  conversationId?: string;
  useWebSearch?: boolean;
  maintainHistory?: boolean;
}

interface ChatResponse {
  response: string;
  sources: string[];
  conversationId: string;
  timestamp: string;
  usedWebSearch?: boolean;
}

interface ConversationHistory {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    sources?: string[];
    usedWebSearch?: boolean;
  }>;
}

interface ConversationsResponse {
  conversations: Array<{
    id: string;
    messageCount: number;
    lastActivity: string | null;
  }>;
}

interface StockData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  lastUpdated: string;
}

// Configuration
const API_BASE_URL = 'http://localhost:5001/api'; 
const REQUEST_TIMEOUT = 60000; 

class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const makeRequest = async (
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: object;
    timeout?: number;
  } = {}
): Promise<any> => {
  const { method = 'GET', body, timeout = REQUEST_TIMEOUT } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    console.log(`API Request: ${method} ${API_BASE_URL}${endpoint}`);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Use the default error message if JSON parsing fails
      }
      
      throw new ApiError(errorMessage, response.status);
    }

    const data = await response.json();
    console.log(`API Response: ${response.status} ${endpoint}`);
    return data;

  } catch (error: unknown) {
  clearTimeout(timeoutId);

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout - the server took too long to respond');
    }

    if (error instanceof ApiError) {
      throw error;
    }

    if (
      error.message.includes('Network request failed') ||
      error.message.includes('fetch')
    ) {
      throw new ApiError('Network error - please check your connection and ensure the server is running');
    }

    throw new ApiError(error.message || 'An unknown error occurred');
  } else {
    // Handle non-Error throwables (rare, but possible)
    throw new ApiError('An unexpected error occurred');
  }
}
};

export const chatApi = {
  // Send a chat message
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    return await makeRequest('/chat', {
      method: 'POST',
      body: request,
    });
  },

  // Get conversation history
  getConversationHistory: async (conversationId: string): Promise<ConversationHistory> => {
    return await makeRequest(`/chat/history/${conversationId}`);
  },

  // Clear conversation history
  clearConversationHistory: async (conversationId: string): Promise<void> => {
    await makeRequest(`/chat/history/${conversationId}`, {
      method: 'DELETE',
    });
  },

  // Get all conversations
  getConversations: async (): Promise<ConversationsResponse> => {
    return await makeRequest('/chat/conversations');
  },

  // Get stock data (bonus feature)
  getStockData: async (symbol: string): Promise<StockData> => {
    return await makeRequest(`/chat/stock/${symbol}`);
  },

  // Health check
  healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
    return await makeRequest('/health');
  }
};

export default chatApi;