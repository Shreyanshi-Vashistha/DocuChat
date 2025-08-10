import { Router, Request, Response } from 'express';
import { WebSearchService } from '../services/webSearchService';

const router = Router();

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
  contextUsed?: 'document' | 'web' | 'both';
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
  contextUsed?: 'document' | 'web' | 'both';
}

interface ConversationMetadata {
  title: string;
  summary: string;
  keyTopics: string[];
  createdAt: string;
  updatedAt: string;
}

// Enhanced conversation storage with metadata
const conversations: Map<string, StoredMessage[]> = new Map();
const conversationMetadata: Map<string, ConversationMetadata> = new Map();
const webSearchService = new WebSearchService();

// Generate conversation ID
function generateConversationId(): string {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Enhanced logic to determine when web search should be used
function shouldTryWebSearch(response: string, question: string): boolean {
  const insufficientIndicators = [
    "don't have enough information",
    "couldn't find",
    "not mentioned",
    "no information",
    "unable to find",
    "not available in the context",
    "don't know",
    "cannot find"
  ];

  const responseLower = response.toLowerCase();
  const questionLower = question.toLowerCase();
  
  // Check for stock-related queries
  const stockPatterns = [
    /stock price/i,
    /share price/i,
    /market value/i,
    /current price of \w+/i,
    /how.*performed/i,
    /\b[A-Z]{2,5}\b.*price/i, // Stock symbols
    /nasdaq|nyse|dow jones/i
  ];
  
  const isStockQuery = stockPatterns.some(pattern => pattern.test(questionLower));
  
  // Check for current events or time-sensitive queries
  const currentEventPatterns = [
    /current|today|now|recent|latest|this (week|month|year)/i,
    /what.*happening|news about/i,
    /update.*on|status.*of/i
  ];
  
  const isCurrentEventQuery = currentEventPatterns.some(pattern => pattern.test(questionLower));
  
  // Insufficient response indicators
  const hasInsufficientResponse = insufficientIndicators.some(indicator => 
    responseLower.includes(indicator)
  );
  
  return hasInsufficientResponse || response.length < 50 || isStockQuery || isCurrentEventQuery;
}


function generateConversationTitle(firstMessage: string): string {
  const cleanMessage = firstMessage
  const words = cleanMessage.split(' ').slice(0, 6);
  let title = words.join(' ');
  
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  return title.charAt(0).toUpperCase() + title.slice(1) || 'New Conversation';
}

// Extract key topics from conversation
function extractKeyTopics(messages: StoredMessage[]): string[] {
  const topics = new Set<string>();
  const topicKeywords = [
    'vacation', 'sick leave', 'benefits', 'insurance', 'remote work', 'policy',
    'hours', 'overtime', 'performance', 'review', 'training', 'development',
    'reimbursement', 'expense', 'equipment', 'technology', 'security',
    'stock', 'price', 'market', 'nasdaq', 'nyse'
  ];
  
  messages.forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      topicKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      });
    }
  });
  
  return Array.from(topics).slice(0, 5); // Limit to 5 key topics
}

// Enhanced main chat endpoint with memory and web search
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      message,
      conversationId = generateConversationId(),
      useWebSearch = true, // Default to true for better UX
      maintainHistory = true
    }: ChatRequest = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and cannot be empty'
      });
    }

    console.log(`Processing message: "${message}" for conversation: ${conversationId}`);

    // Get conversation history for enhanced context
    const conversation = conversations.get(conversationId) || [];
    const isFirstMessage = conversation.length === 0;

    // Step 1: Search for relevant document chunks
    const similarChunks = await req.vectorService.similaritySearch(message, 5);
    console.log(`Found ${similarChunks.length} relevant chunks with scores:`, 
      similarChunks.map((r: { score: number; chunk: { content: string; }; }) => ({ 
        score: r.score.toFixed(3), 
        preview: r.chunk.content.substring(0, 100) + '...' 
      }))
    );

    // Filter chunks with reasonable similarity scores
    const relevantChunks = similarChunks.filter((result: { score: number; }) => result.score > 0.1);
    
    const contextWithMetadata = relevantChunks.map((result: { chunk: { content: any; metadata: { source: string; chunkIndex: number; }; }; }) => ({
      content: result.chunk.content,
      source: `${result.chunk.metadata.source.split('/').pop()} (Section ${result.chunk.metadata.chunkIndex + 1})`,
      chunkIndex: result.chunk.metadata.chunkIndex
    }));

    let response: string;
    let sources: string[] = [];
    let usedWebSearch = false;
    let contextUsed: 'document' | 'web' | 'both' = 'document';

    // Step 2: Generate response using LLM with document context
    if (contextWithMetadata.length > 0) {
      console.log(`Using ${contextWithMetadata.length} relevant chunks for context`);
      
      // Build enhanced context with conversation history
      let conversationContext = '';
      if (maintainHistory && conversation.length > 0) {
        const recentMessages = conversation.slice(-4); // Last 2 exchanges
        conversationContext = '\n\nRecent conversation context:\n' + 
          recentMessages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
      }
      
      const llmResponse = await req.llmService.generateResponse(
        message + conversationContext,
        contextWithMetadata,
        maintainHistory
      );
      response = llmResponse.answer;
      sources = llmResponse.sources;

      // Step 3: Enhanced web search logic
      if (useWebSearch && shouldTryWebSearch(response, message)) {
        console.log('Response seems insufficient or requires web search, attempting web search...');
        
        try {
          const webResults = await webSearchService.search(message);
          
          if (webResults.length > 0) {
            const webContext = webResults.map((result, index) => ({
              content: result,
              source: `Web Search Result ${index + 1}`,
              chunkIndex: index
            }));
            
            // Combine document and web context for comprehensive response
            const combinedContext = [...contextWithMetadata, ...webContext];
            
            const webResponse = await req.llmService.generateResponse(
              `${message} (Note: Use both document context and web search results to provide a comprehensive answer. If web results are more current or relevant, prioritize them.)`,
              combinedContext,
              false
            );
            
            response = webResponse.answer;
            sources = [...new Set([...sources, ...webResponse.sources])]; // Remove duplicates
            usedWebSearch = true;
            contextUsed = contextWithMetadata.length > 0 ? 'both' : 'web';
          }
        } catch (webError) {
          console.error('Web search failed:', webError);
          // Continue with document-only response
        }
      }
    } else {
      console.log('No relevant document chunks found');
      
      if (useWebSearch) {
        console.log('No document matches, attempting web search...');
        
        try {
          const webResults = await webSearchService.search(message);
          
          if (webResults.length > 0) {
            const webContext = webResults.map((result, index) => ({
              content: result,
              source: `Web Search Result ${index + 1}`,
              chunkIndex: index
            }));
            
            const webResponse = await req.llmService.generateResponse(
              message,
              webContext,
              false
            );
            response = `Based on web search: ${webResponse.answer}`;
            sources = webResponse.sources;
            usedWebSearch = true;
            contextUsed = 'web';
          } else {
            response = "I couldn't find relevant information in the loaded documents or through web search to answer your question.";
          }
        } catch (webError) {
          console.error('Web search failed:', webError);
          response = "I couldn't find relevant information in the loaded documents to answer your question. Web search is currently unavailable.";
        }
      } else {
        response = "I couldn't find relevant information in the loaded documents to answer your question. You may want to enable web search for broader results.";
      }
    }

    // Store conversation history with enhanced metadata
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, []);
      console.log(`Created new conversation: ${conversationId}`);
    }
    
    const timestamp = new Date().toISOString();
    
    // Add user message
    conversation.push({
      role: 'user',
      content: message,
      timestamp
    });
    
    // Add assistant message with enhanced metadata
    conversation.push({
      role: 'assistant',
      content: response,
      timestamp,
      sources,
      usedWebSearch,
      contextUsed
    });

    // Update conversation metadata
    if (isFirstMessage) {
      conversationMetadata.set(conversationId, {
        title: generateConversationTitle(message),
        summary: message.length > 100 ? message.substring(0, 100) + '...' : message,
        keyTopics: extractKeyTopics([{ role: 'user', content: message, timestamp }]),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    } else {
      const metadata = conversationMetadata.get(conversationId);
      if (metadata) {
        metadata.keyTopics = extractKeyTopics(conversation);
        metadata.updatedAt = timestamp;
      }
    }

    console.log(`Conversation ${conversationId} now has ${conversation.length} messages`);

    const chatResponse: ChatResponse = {
      response,
      sources,
      conversationId,
      timestamp,
      usedWebSearch,
      contextUsed
    };

    res.json(chatResponse);

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'An error occurred while processing your message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced conversation history endpoint
router.get('/history/:conversationId', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const history = conversations.get(conversationId) || [];
    const metadata = conversationMetadata.get(conversationId);
    
    console.log(`Retrieving history for conversation ${conversationId}: ${history.length} messages`);
    
    res.json({
      conversationId,
      messages: history,
      metadata
    });
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced conversations list with proper titles
router.get('/conversations', (req: Request, res: Response) => {
  try {
    const conversationList = Array.from(conversations.keys()).map(id => {
      const messages = conversations.get(id) || [];
      const lastMessage = messages[messages.length - 1];
      const metadata = conversationMetadata.get(id);
      
      return {
        id,
        title: metadata?.title || 'Untitled Conversation',
        messageCount: messages.length,
        lastActivity: lastMessage ? lastMessage.timestamp : null,
        keyTopics: metadata?.keyTopics || [],
        summary: metadata?.summary || '',
        createdAt: metadata?.createdAt
      };
    });

    // Sort by last activity (most recent first)
    conversationList.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    console.log(`Retrieved ${conversationList.length} conversations`);

    res.json({ conversations: conversationList });
  } catch (error) {
    console.error('Error retrieving conversations list:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear conversation history
router.delete('/history/:conversationId', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const existed = conversations.has(conversationId);
    
    conversations.delete(conversationId);
    conversationMetadata.delete(conversationId);
    req.llmService.clearHistory();
    
    console.log(`Cleared conversation ${conversationId} (existed: ${existed})`);
    
    res.json({
      success: true,
      message: 'Conversation history cleared'
    });
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    res.status(500).json({
      error: 'Failed to clear conversation history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced stock data endpoint with real API integration ready
router.get('/stock/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  
  try {
    // In production, replace with real API like Alpha Vantage, Finnhub, or Yahoo Finance
    // Example: const response = await axios.get(`https://api.finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`);
    
    // Enhanced mock data with more realistic patterns
    const mockStockData = {
      symbol: symbol.toUpperCase(),
      price: (Math.random() * 1000 + 50).toFixed(2),
      change: ((Math.random() - 0.5) * 20).toFixed(2),
      changePercent: ((Math.random() - 0.5) * 10).toFixed(2),
      volume: Math.floor(Math.random() * 10000000).toLocaleString(),
      marketCap: (Math.random() * 1000 + 100).toFixed(1) + 'B',
      dayHigh: (Math.random() * 1100 + 100).toFixed(2),
      dayLow: (Math.random() * 900 + 50).toFixed(2),
      lastUpdated: new Date().toISOString(),
      source: 'Mock API - Replace with real stock API'
    };

    res.json(mockStockData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch stock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint with enhanced information
router.get('/debug/conversations', (req: Request, res: Response) => {
  const debug = Array.from(conversations.entries()).map(([id, messages]) => {
    const metadata = conversationMetadata.get(id);
    return {
      id,
      title: metadata?.title || 'Untitled',
      messageCount: messages.length,
      keyTopics: metadata?.keyTopics || [],
      createdAt: metadata?.createdAt,
      messages: messages.map(msg => ({
        role: msg.role,
        contentPreview: msg.content.substring(0, 100),
        timestamp: msg.timestamp,
        sources: msg.sources,
        usedWebSearch: msg.usedWebSearch,
        contextUsed: msg.contextUsed
      }))
    };
  });
  
  res.json({ conversations: debug });
});

export default router;