export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
}

export interface Conversation {
  id: string;
  messageCount: number;
  lastActivity: string | null;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  useWebSearch?: boolean;
  maintainHistory?: boolean;
}

export interface ChatResponse {
  response: string;
  sources: string[];
  conversationId: string;
  timestamp: string;
  usedWebSearch?: boolean;
}

export interface ConversationHistory {
  conversationId: string;
  messages: Message[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface StockData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  lastUpdated: string;
}