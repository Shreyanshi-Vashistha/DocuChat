import { Router, Request, Response } from "express";
import { WebSearchService } from "../services/webSearchService";

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
  contextUsed?: "document" | "web" | "both";
}

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
  usedWebSearch?: boolean;
  contextUsed?: "document" | "web" | "both";
}

interface ConversationMetadata {
  title: string;
  summary: string;
  keyTopics: string[];
  createdAt: string;
  updatedAt: string;
}

const conversations: Map<string, StoredMessage[]> = new Map();
const conversationMetadata: Map<string, ConversationMetadata> = new Map();
const webSearchService = new WebSearchService();

function generateConversationId(): string {
  return "conv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

function shouldTryWebSearch(response: string, question: string): boolean {
  const insufficientIndicators = [
    "don't have enough information",
    "couldn't find",
    "not mentioned",
    "no information",
    "unable to find",
    "not available in the context",
    "don't know",
    "cannot find",
  ];

  const responseLower = response.toLowerCase();
  const questionLower = question.toLowerCase();

  const stockPatterns = [
    /stock price/i,
    /share price/i,
    /market value/i,
    /current price of \w+/i,
    /how.*performed/i,
    /\b[A-Z]{2,5}\b.*price/i,
    /nasdaq|nyse|dow jones/i,
  ];

  const isStockQuery = stockPatterns.some((pattern) =>
    pattern.test(questionLower)
  );
  const currentEventPatterns = [
    /current|today|now|recent|latest|this (week|month|year)/i,
    /what.*happening|news about/i,
    /update.*on|status.*of/i,
  ];

  const isCurrentEventQuery = currentEventPatterns.some((pattern) =>
    pattern.test(questionLower)
  );

  const hasInsufficientResponse = insufficientIndicators.some((indicator) =>
    responseLower.includes(indicator)
  );

  return (
    hasInsufficientResponse ||
    response.length < 50 ||
    isStockQuery ||
    isCurrentEventQuery
  );
}

function generateConversationTitle(firstMessage: string): string {
  const cleanMessage = firstMessage.replace(/[^\w\s]/g, "").trim();
  const words = cleanMessage.split(" ").slice(0, 6);
  let title = words.join(" ");

  if (title.length > 50) {
    title = title.substring(0, 47) + "...";
  }

  return title.charAt(0).toUpperCase() + title.slice(1) || "New Conversation";
}

function extractKeyTopics(messages: StoredMessage[]): string[] {
  const topics = new Set<string>();
  const topicKeywords = [
    "vacation",
    "sick leave",
    "benefits",
    "insurance",
    "remote work",
    "policy",
    "hours",
    "overtime",
    "performance",
    "review",
    "training",
    "development",
    "reimbursement",
    "expense",
    "equipment",
    "technology",
    "security",
    "stock",
    "price",
    "market",
    "nasdaq",
    "nyse",
  ];

  messages.forEach((msg) => {
    if (msg.role === "user") {
      const content = msg.content.toLowerCase();
      topicKeywords.forEach((keyword) => {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      });
    }
  });

  return Array.from(topics).slice(0, 5);
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      message,
      conversationId = generateConversationId(),
      useWebSearch = true,
      maintainHistory = true,
    }: ChatRequest = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: "Message is required and cannot be empty",
      });
    }

    let conversation = conversations.get(conversationId);
    if (!conversation) {
      conversation = [];
      conversations.set(conversationId, conversation);
    }

    const isFirstMessage = conversation.length === 0;

    //Search for relevant document chunks
    const similarChunks = await req.vectorService.similaritySearch(message, 5);

    // Filter chunks with reasonable similarity scores
    const relevantChunks = similarChunks.filter(
      (result: { score: number }) => result.score > 0.1
    );

    const contextWithMetadata = relevantChunks.map(
      (result: {
        chunk: {
          content: any;
          metadata: { source: string; chunkIndex: number };
        };
      }) => ({
        content: result.chunk.content,
        source: `${result.chunk.metadata.source.split("/").pop()} (Section ${
          result.chunk.metadata.chunkIndex + 1
        })`,
        chunkIndex: result.chunk.metadata.chunkIndex,
      })
    );

    let response: string;
    let sources: string[] = [];
    let usedWebSearch = false;
    let contextUsed: "document" | "web" | "both" = "document";
    let conversationContext = "";
    if (maintainHistory && conversation.length > 0) {
      const recentMessages = conversation.slice(-4);
      conversationContext =
        "\n\nRecent conversation context:\n" +
        recentMessages
          .map(
            (msg) =>
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n");
    }

    //Generate response using LLM with document context
    if (contextWithMetadata.length > 0) {
      const llmResponse = await req.llmService.generateResponse(
        message + conversationContext,
        contextWithMetadata,
        maintainHistory
      );
      response = llmResponse.answer;
      sources = llmResponse.sources;

      //Enhanced web search logic
      if (useWebSearch && shouldTryWebSearch(response, message)) {
        try {
          const webResults = await webSearchService.search(message);

          if (webResults.length > 0) {
            const webContext = webResults.map((result, index) => ({
              content: `Web Source ${index + 1}: ${result}`,
              source: `Web Search Result ${index + 1}`,
              chunkIndex: index,
            }));
            const combinedContext = [...contextWithMetadata, ...webContext];

            const webResponse = await req.llmService.generateResponse(
              `${message} (Note: Use both document context and web search results to provide a comprehensive answer. Include URLs when available from web sources.)`,
              combinedContext,
              false
            );

            response = webResponse.answer;
            const webSources = webResults
              .filter((result) => result.includes("URL:"))
              .map((result) => {
                const lines = result.split("\n");
                const titleLine = lines.find(
                  (line) =>
                    !line.startsWith("Summary:") &&
                    !line.startsWith("Source:") &&
                    !line.startsWith("URL:") &&
                    line.trim().length > 0
                );
                const urlLine = lines.find((line) => line.startsWith("URL:"));
                const sourceLine = lines.find((line) =>
                  line.startsWith("Source:")
                );

                if (titleLine && urlLine) {
                  const cleanSource = sourceLine
                    ? sourceLine.replace("Source:", "").trim()
                    : "Web Source";
                  return `${titleLine.trim()} (${cleanSource}) - ${urlLine.trim()}`;
                }
                return result.split("\n")[0];
              });

            sources = [...new Set([...sources, ...webSources])];
            usedWebSearch = true;
            contextUsed = contextWithMetadata.length > 0 ? "both" : "web";
          }
        } catch (webError) {
          console.error("Web search failed:", webError);
        }
      }
    } else {
      console.log("No relevant document chunks found");

      if (useWebSearch) {
        try {
          const webResults = await webSearchService.search(message);

          if (webResults.length > 0) {
            const webContext = webResults.map((result, index) => ({
              content: `Web Source ${index + 1}: ${result}`,
              source: `Web Search Result ${index + 1}`,
              chunkIndex: index,
            }));

            const webResponse = await req.llmService.generateResponse(
              `${message} (Based on web search results, provide a comprehensive answer and include source URLs when available.)`,
              webContext,
              false
            );

            response = `Based on web search: ${webResponse.answer}`;
            sources = webResults
              .filter((result) => result.includes("URL:"))
              .map((result) => {
                const lines = result.split("\n");
                const titleLine = lines.find(
                  (line) =>
                    !line.startsWith("Summary:") &&
                    !line.startsWith("Source:") &&
                    !line.startsWith("URL:") &&
                    line.trim().length > 0
                );
                const urlLine = lines.find((line) => line.startsWith("URL:"));
                const sourceLine = lines.find((line) =>
                  line.startsWith("Source:")
                );

                if (titleLine && urlLine) {
                  const cleanSource = sourceLine
                    ? sourceLine.replace("Source:", "").trim()
                    : "Web Source";
                  return `${titleLine.trim()} (${cleanSource}) - ${urlLine.trim()}`;
                }
                return "Web Search Result";
              });

            usedWebSearch = true;
            contextUsed = "web";
          } else {
            response =
              "I couldn't find relevant information in the loaded documents or through web search to answer your question.";
          }
        } catch (webError) {
          response =
            "I couldn't find relevant information in the loaded documents to answer your question. Web search is currently unavailable.";
        }
      } else {
        response =
          "I couldn't find relevant information in the loaded documents to answer your question. You may want to enable web search for broader results.";
      }
    }

    const timestamp = new Date().toISOString();

    conversation.push({
      role: "user",
      content: message,
      timestamp,
      sources: [],
      usedWebSearch: false,
      contextUsed: undefined,
    });

    conversation.push({
      role: "assistant",
      content: response,
      timestamp,
      sources: sources || [],
      usedWebSearch: usedWebSearch || false,
      contextUsed: contextUsed || undefined,
    });

    if (isFirstMessage) {
      conversationMetadata.set(conversationId, {
        title: generateConversationTitle(message),
        summary:
          message.length > 100 ? message.substring(0, 100) + "..." : message,
        keyTopics: extractKeyTopics([
          { role: "user", content: message, timestamp },
        ]),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } else {
      const metadata = conversationMetadata.get(conversationId);
      if (metadata) {
        metadata.keyTopics = extractKeyTopics(conversation);
        metadata.updatedAt = timestamp;
      }
    }

    const chatResponse: ChatResponse = {
      response,
      sources,
      conversationId,
      timestamp,
      usedWebSearch,
      contextUsed,
    };

    res.json(chatResponse);
  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({
      error: "An error occurred while processing your message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/history/:conversationId", (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const history = conversations.get(conversationId) || [];
    const metadata = conversationMetadata.get(conversationId);

    res.json({
      conversationId,
      messages: history,
      metadata,
    });
  } catch (error) {
    console.error("Error retrieving conversation history:", error);
    res.status(500).json({
      error: "Failed to retrieve conversation history",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/conversations", (req: Request, res: Response) => {
  try {
    const conversationList = Array.from(conversations.keys()).map((id) => {
      const messages = conversations.get(id) || [];
      const lastMessage = messages[messages.length - 1];
      const metadata = conversationMetadata.get(id);

      return {
        id,
        title: metadata?.title || "Untitled Conversation",
        messageCount: messages.length,
        lastActivity: lastMessage ? lastMessage.timestamp : null,
        keyTopics: metadata?.keyTopics || [],
        summary: metadata?.summary || "",
        createdAt: metadata?.createdAt,
      };
    });

    conversationList.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return (
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
    });

    res.json({ conversations: conversationList });
  } catch (error) {
    console.error("Error retrieving conversations list:", error);
    res.status(500).json({
      error: "Failed to retrieve conversations",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.delete("/history/:conversationId", (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const existed = conversations.has(conversationId);

    conversations.delete(conversationId);
    conversationMetadata.delete(conversationId);
    req.llmService.clearHistory();

    res.json({
      success: true,
      message: "Conversation history cleared",
    });
  } catch (error) {
    console.error("Error clearing conversation history:", error);
    res.status(500).json({
      error: "Failed to clear conversation history",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/stock/:symbol", async (req: Request, res: Response) => {
  const { symbol } = req.params;

  try {
    const mockStockData = {
      symbol: symbol.toUpperCase(),
      price: (Math.random() * 1000 + 50).toFixed(2),
      change: ((Math.random() - 0.5) * 20).toFixed(2),
      changePercent: ((Math.random() - 0.5) * 10).toFixed(2),
      volume: Math.floor(Math.random() * 10000000).toLocaleString(),
      marketCap: (Math.random() * 1000 + 100).toFixed(1) + "B",
      dayHigh: (Math.random() * 1100 + 100).toFixed(2),
      dayLow: (Math.random() * 900 + 50).toFixed(2),
      lastUpdated: new Date().toISOString(),
      source: "Mock API - Replace with real stock API",
    };

    res.json(mockStockData);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch stock data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
