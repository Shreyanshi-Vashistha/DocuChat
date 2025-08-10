export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
  contextUsed?: 'document' | 'web' | 'both';
}

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: string | null;
  keyTopics?: string[];
  summary?: string;
  createdAt?: string;
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
  contextUsed?: 'document' | 'web' | 'both';
}

export interface ConversationHistory {
  conversationId: string;
  messages: Message[];
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  title: string;
  summary: string;
  keyTopics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface StockData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume?: string;
  marketCap?: string;
  dayHigh?: string;
  dayLow?: string;
  lastUpdated: string;
  source?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface ChatSettings {
  useWebSearch: boolean;
  maintainHistory: boolean;
  maxHistoryLength: number;
}

export interface SearchResult {
  content: string;
  source: string;
  chunkIndex: number;
  score?: number;
}