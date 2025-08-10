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
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
}

// Store conversation histories (in production, use a proper database)
const conversations: Map<string, StoredMessage[]> = new Map();
const webSearchService = new WebSearchService();

// Generate conversation ID
function generateConversationId(): string {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function shouldTryWebSearch(response: string): boolean {
  const indicators = [
    "don't have enough information",
    "couldn't find",
    "not mentioned",
    "no information",
    "unable to find",
    "not available in the context"
  ];

  const responseLower = response.toLowerCase();
  return indicators.some(indicator => responseLower.includes(indicator)) || 
         response.length < 50;
}


// Main chat endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      message,
      conversationId = generateConversationId(),
      useWebSearch = false,
      maintainHistory = true
    }: ChatRequest = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and cannot be empty'
      });
    }

    console.log(`Processing message: "${message}" for conversation: ${conversationId}`);

    // Step 1: Search for relevant document chunks
    const similarChunks = await req.vectorService.similaritySearch(message, 5);
    console.log(`Found ${similarChunks.length} relevant chunks with scores:`, 
      similarChunks.map((r: { score: number; chunk: { content: string; }; }) => ({ score: r.score.toFixed(3), preview: r.chunk.content.substring(0, 100) + '...' }))
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

    // Step 2: Generate response using LLM
    if (contextWithMetadata.length > 0) {
      console.log(`Using ${contextWithMetadata.length} relevant chunks for context`);
      
      const llmResponse = await req.llmService.generateResponse(
        message,
        contextWithMetadata,
        maintainHistory
      );
      response = llmResponse.answer;
      sources = llmResponse.sources;

      // Step 3: If no good answer and web search is enabled, try web search
      if (useWebSearch && shouldTryWebSearch(response)) {
        console.log('LLM response seems insufficient, attempting web search...');
        const webResults = await webSearchService.search(message);
        
        if (webResults.length > 0) {
          const webContext = webResults.map((result, index) => ({
            content: result,
            source: `Web Search Result ${index + 1}`,
            chunkIndex: index
          }));
          
          const webResponse = await req.llmService.generateResponse(
            `${message} (Note: Use web search results to supplement or replace the previous answer if it's more accurate)`,
            webContext,
            false // Don't maintain history for web search responses
          );
          response = `${webResponse.answer}`;
          sources = [...sources, ...webResponse.sources];
          usedWebSearch = true;
        }
      }
    } else {
      console.log('No relevant document chunks found');
      response = "I couldn't find relevant information in the loaded documents to answer your question. The search didn't return any matching content from the company policy document.";
      
      if (useWebSearch) {
        console.log('No document matches, attempting web search...');
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
        }
      }
    }

    // Store conversation history
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, []);
      console.log(`Created new conversation: ${conversationId}`);
    }
    
    const conversation = conversations.get(conversationId)!;
    const timestamp = new Date().toISOString();
    
    // Add user message
    conversation.push({
      role: 'user',
      content: message,
      timestamp
    });
    
    // Add assistant message
    conversation.push({
      role: 'assistant',
      content: response,
      timestamp,
      sources,
      usedWebSearch
    });

    console.log(`Conversation ${conversationId} now has ${conversation.length} messages`);

    const chatResponse: ChatResponse = {
      response,
      sources,
      conversationId,
      timestamp,
      usedWebSearch
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


// Get conversation history
router.get('/history/:conversationId', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const history = conversations.get(conversationId) || [];
    
    console.log(`Retrieving history for conversation ${conversationId}: ${history.length} messages`);
    
    res.json({
      conversationId,
      messages: history
    });
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation history',
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

// Get all conversations
router.get('/conversations', (req: Request, res: Response) => {
  try {
    const conversationList = Array.from(conversations.keys()).map(id => {
      const messages = conversations.get(id) || [];
      const lastMessage = messages[messages.length - 1];
      
      return {
        id,
        messageCount: messages.length,
        lastActivity: lastMessage ? lastMessage.timestamp : null
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

// Debug endpoint to see conversation details
router.get('/debug/conversations', (req: Request, res: Response) => {
  const debug = Array.from(conversations.entries()).map(([id, messages]) => ({
    id,
    messageCount: messages.length,
    messages: messages.map(msg => ({
      role: msg.role,
      contentPreview: msg.content.substring(0, 100),
      timestamp: msg.timestamp,
      sources: msg.sources
    }))
  }));
  
  res.json({ conversations: debug });
});

// Stock data endpoint (bonus feature)
router.get('/stock/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  
  try {
    // Mock stock data - in production, integrate with a real API like Alpha Vantage, Yahoo Finance, etc.
    const mockStockData = {
      symbol: symbol.toUpperCase(),
      price: (Math.random() * 1000 + 50).toFixed(2),
      change: ((Math.random() - 0.5) * 20).toFixed(2),
      changePercent: ((Math.random() - 0.5) * 10).toFixed(2),
      lastUpdated: new Date().toISOString()
    };

    res.json(mockStockData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch stock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;