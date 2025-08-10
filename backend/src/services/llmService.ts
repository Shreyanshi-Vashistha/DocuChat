import axios from 'axios';
import { DocumentChunk } from './documentService';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  answer: string;
  sources: string[];
}

export interface ContextWithMetadata {
  content: string;
  source: string;
  chunkIndex: number;
}

export class LLMService {
  private ollamaUrl = 'http://localhost:11434';
  private model = 'llama3.2'; // Default model
  private conversationHistory: ChatMessage[] = [];
  private isOllamaAvailable = false;

  constructor() {
    this.checkOllamaAvailability();
  }

  async generateResponse(
    question: string, 
    context: string[] | ContextWithMetadata[], 
    maintainHistory: boolean = true
  ): Promise<LLMResponse> {
    try {
      // Normalize context to include metadata
      const contextWithMeta = this.normalizeContext(context);
      
      if (!this.isOllamaAvailable) {
        console.log('Ollama not available, using enhanced fallback');
        return this.enhancedFallbackResponse(question, contextWithMeta);
      }

      const systemPrompt = this.createSystemPrompt(contextWithMeta);
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history if maintaining context
      if (maintainHistory && this.conversationHistory.length > 0) {
        messages.push(...this.conversationHistory.slice(-6)); // Keep last 3 exchanges
      }

      messages.push({ role: 'user', content: question });

      console.log('Sending request to Ollama...');
      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false
      }, { timeout: 30000 });

      const answer = response.data.message.content;

      // Update conversation history
      if (maintainHistory) {
        this.conversationHistory.push(
          { role: 'user', content: question },
          { role: 'assistant', content: answer }
        );

        // Keep history manageable
        if (this.conversationHistory.length > 20) {
          this.conversationHistory = this.conversationHistory.slice(-16);
        }
      }

      return {
        answer,
        sources: this.generateSourceLabels(contextWithMeta)
      };

    } catch (error) {
      console.error('Error calling Ollama:', error);
      const contextWithMeta = this.normalizeContext(context);
      return this.enhancedFallbackResponse(question, contextWithMeta);
    }
  }

  private async checkOllamaAvailability(): Promise<void> {
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 3000 });
      this.isOllamaAvailable = true;
      console.log('Ollama is available');
    } catch (error) {
      this.isOllamaAvailable = false;
      console.log('Ollama is not available, will use fallback responses');
    }
  }

  private normalizeContext(context: string[] | ContextWithMetadata[]): ContextWithMetadata[] {
    if (context.length === 0) return [];

    // Check if context already has metadata
    if (typeof context[0] === 'object' && 'content' in context[0]) {
      return context as ContextWithMetadata[];
    }

    // Convert string array to ContextWithMetadata
    return (context as string[]).map((content, index) => ({
      content,
      source: `Document chunk ${index + 1}`,
      chunkIndex: index
    }));
  }

  private createSystemPrompt(contextWithMeta: ContextWithMetadata[]): string {
    if (contextWithMeta.length === 0) {
      return `You are a helpful assistant. Answer the user's question to the best of your ability. If you don't have enough information, say so clearly.`;
    }

    const contextText = contextWithMeta
      .map((ctx, index) => `[Source ${index + 1}: ${ctx.source}]\n${ctx.content}`)
      .join('\n\n---\n\n');
    
    return `You are a helpful assistant that answers questions based on the provided document context. 
Use only the information from the context to answer questions. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${contextText}

Instructions:
- Provide accurate, detailed answers based only on the context provided
- If you're unsure or the context doesn't contain the information, say "I don't have enough information in the provided context to answer that question."
- Include relevant details and be specific when possible
- Reference specific sections when relevant (e.g., "According to the company policy...")
- Maintain a helpful and professional tone`;
  }

  private enhancedFallbackResponse(question: string, contextWithMeta: ContextWithMetadata[]): LLMResponse {
    if (contextWithMeta.length === 0) {
      return {
        answer: "I couldn't find any relevant information in the loaded documents to answer your question. The document search didn't return any matching content.",
        sources: []
      };
    }

    // Enhanced keyword matching with better scoring
    const questionWords = question.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'but', 'for', 'are', 'with', 'from', 'this', 'that', 'what', 'how', 'when', 'where', 'why'].includes(word));

    const scoredContexts = contextWithMeta.map(ctx => {
      const contentLower = ctx.content.toLowerCase();
      let score = 0;
      let matchedWords: string[] = [];

      questionWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length;
          matchedWords.push(word);
        }
      });

      return { ...ctx, score, matchedWords };
    });

    const bestMatch = scoredContexts.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    if (bestMatch.score > 0) {
      // Extract relevant sentences containing matched words
      const sentences = bestMatch.content.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const relevantSentences = sentences.filter(sentence => 
        bestMatch.matchedWords.some(word => 
          sentence.toLowerCase().includes(word)
        )
      ).slice(0, 3);

      const answer = relevantSentences.length > 0 
        ? `Based on the document, here's what I found: ${relevantSentences.join('. ').trim()}.`
        : `Based on the document context: ${bestMatch.content.substring(0, 200)}...`;

      return {
        answer,
        sources: [bestMatch.source]
      };
    }

    // If no good matches, provide general guidance
    const firstContext = contextWithMeta[0];
    return {
      answer: `I found some potentially related information in the document, but it may not directly answer your question: ${firstContext.content.substring(0, 150)}... Please try rephrasing your question or ask about specific topics covered in the document.`,
      sources: [firstContext.source]
    };
  }

  private generateSourceLabels(contextWithMeta: ContextWithMetadata[]): string[] {
    return contextWithMeta.map(ctx => ctx.source);
  }

  clearHistory(): void {
    this.conversationHistory = [];
    console.log('Conversation history cleared');
  }

  getHistoryLength(): number {
    return this.conversationHistory.length;
  }
}