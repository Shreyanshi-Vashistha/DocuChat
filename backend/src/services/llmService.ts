import axios from 'axios';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  answer: string;
  sources: string[];
}

export class LLMService {
  private ollamaUrl = 'http://localhost:11434';
  private model = 'llama3.2'; // Default model
  private conversationHistory: ChatMessage[] = [];

  async generateResponse(
    question: string, 
    context: string[], 
    maintainHistory: boolean = true
  ): Promise<LLMResponse> {
    try {
      // Check if Ollama is available
      const isAvailable = await this.checkOllamaAvailability();
      if (!isAvailable) {
        return this.fallbackResponse(question, context);
      }

      const systemPrompt = this.createSystemPrompt(context);
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history if maintaining context
      if (maintainHistory && this.conversationHistory.length > 0) {
        messages.push(...this.conversationHistory.slice(-6)); // Keep last 3 exchanges
      }

      messages.push({ role: 'user', content: question });

      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false
      });

      const answer = response.data.message.content;

      // Update conversation history
      if (maintainHistory) {
        this.conversationHistory.push(
          { role: 'user', content: question },
          { role: 'assistant', content: answer }
        );
      }

      return {
        answer,
        sources: context.map((_, i) => `Document section ${i + 1}`)
      };

    } catch (error) {
      console.error('Error calling Ollama:', error);
      return this.fallbackResponse(question, context);
    }
  }

  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  private createSystemPrompt(context: string[]): string {
    const contextText = context.join('\n\n---\n\n');
    
    return `You are a helpful assistant that answers questions based on the provided document context. 
Use only the information from the context to answer questions. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${contextText}

Instructions:
- Provide accurate, concise answers based only on the context
- If you're unsure or the context doesn't contain the information, say "I don't have enough information in the provided context to answer that question."
- Include relevant details and be specific when possible
- Cite specific parts of the context when relevant`;
  }

  private fallbackResponse(question: string, context: string[]): LLMResponse {
    // Simple keyword matching fallback
    const questionLower = question.toLowerCase();
    const relevantContext = context.find(ctx => 
      questionLower.split(' ').some(word => 
        word.length > 3 && ctx.toLowerCase().includes(word)
      )
    );

    if (relevantContext) {
      return {
        answer: `Based on the document context, here's the relevant information: ${relevantContext.substring(0, 300)}...`,
        sources: ['Document section 1']
      };
    }

    return {
      answer: "I'm sorry, but I couldn't find relevant information in the provided document to answer your question. Please make sure Ollama is running locally or try rephrasing your question.",
      sources: []
    };
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}