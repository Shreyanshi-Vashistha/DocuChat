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

// Store conversation histories (in production, use a proper database)
const conversations: Map<string, any[]> = new Map();
const webSearchService = new WebSearchService();

// Generate conversation ID
function generateConversationId(): string {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    console.log(`Processing message: ${message}`);

    // Step 1: Search for relevant document chunks
    const similarChunks = await req.vectorService.similaritySearch(message, 3);
    const contextChunks = similarChunks.map(result => result.chunk.content);
    
    console.log(`Found ${similarChunks.length} relevant chunks`);

    let response: string;
    let sources: string[] = [];
    let usedWebSearch = false;

    // Step 2: Generate response using LLM
    if (contextChunks.length > 0) {
      const llmResponse = await req.llmService.generateResponse(
        message,
        contextChunks,
        maintainHistory
      );
      response = llmResponse.answer;
      sources = llmResponse.sources;

      // Step 3: If no good answer and web search is enabled, try web search
      if (useWebSearch && (
        response.toLowerCase().includes("don't have enough information") ||
        response.toLowerCase().includes("couldn't find") ||
        response.length < 50
      )) {
        console.log('Attempting web search...');
        const webResults = await webSearchService.search(message);
        
        if (webResults.length > 0) {
          const webResponse = await req.llmService.generateResponse(
            message,
            webResults,
            false // Don't maintain history for web search responses
          );
          response = `Based on web search: ${webResponse.answer}`;
          sources = [...sources, ...webResponse.sources];
          usedWebSearch = true;
        }
      }
    } else {
      response = "I couldn't find relevant information in the loaded document to answer your question.";
      
      if (useWebSearch) {
        console.log('No document matches, attempting web search...');
        const webResults = await webSearchService.search(message);
        
        if (webResults.length > 0) {
          const webResponse = await req.llmService.generateResponse(
            message,
            webResults,
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
    }
    
    const conversation = conversations.get(conversationId)!;
    conversation.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    conversation.push({
      role: 'assistant',
      content: response,
      sources,
      timestamp: new Date().toISOString(),
      usedWebSearch
    });

    const chatResponse: ChatResponse = {
      response,
      sources,
      conversationId,
      timestamp: new Date().toISOString(),
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
  const { conversationId } = req.params;
  const history = conversations.get(conversationId) || [];
  
  res.json({
    conversationId,
    messages: history
  });
});

// Clear conversation history
router.delete('/history/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  conversations.delete(conversationId);
  req.llmService.clearHistory();
  
  res.json({
    success: true,
    message: 'Conversation history cleared'
  });
});

// Get all conversations
router.get('/conversations', (req: Request, res: Response) => {
  const conversationList = Array.from(conversations.keys()).map(id => ({
    id,
    messageCount: conversations.get(id)?.length || 0,
    lastActivity: conversations.get(id)?.slice(-1)[0]?.timestamp || null
  }));

  res.json({ conversations: conversationList });
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