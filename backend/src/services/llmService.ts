import axios from 'axios';

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
  section?: string;
}

export class LLMService {
  private ollamaUrl = 'http://localhost:11434';
  private model = 'llama3.2';
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
      const contextWithMeta = this.normalizeContext(context);
      
      if (!this.isOllamaAvailable) {
        console.log('Ollama not available, using enhanced fallback');
        return this.enhancedFallbackResponse(question, contextWithMeta);
      }

      const systemPrompt = this.createSystemPrompt(contextWithMeta);
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ];

      if (maintainHistory && this.conversationHistory.length > 0) {
        messages.push(...this.conversationHistory.slice(-6));
      }

      messages.push({ role: 'user', content: question });

      console.log('Sending request to Ollama...');
      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false
      }, { timeout: 30000 });

      const answer = response.data.message.content;

      if (maintainHistory) {
        this.conversationHistory.push(
          { role: 'user', content: question },
          { role: 'assistant', content: answer }
        );

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
      console.log('✅ Ollama is available');
    } catch (error) {
      this.isOllamaAvailable = false;
      console.log('❌ Ollama is not available, will use enhanced fallback responses');
    }
  }

  private normalizeContext(context: string[] | ContextWithMetadata[]): ContextWithMetadata[] {
    if (context.length === 0) return [];

    if (typeof context[0] === 'object' && 'content' in context[0]) {
      return context as ContextWithMetadata[];
    }

    return (context as string[]).map((content, index) => ({
      content,
      source: `Document Section ${index + 1}`,
      chunkIndex: index,
      section: this.extractSectionFromContent(content)
    }));
  }

  private extractSectionFromContent(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\.\s+[A-Z]/)) {
        return trimmed.replace(/^\d+\.\s+/, '');
      }
      if (trimmed.match(/^[A-Z][A-Z\s:]+$/) && trimmed.length < 50) {
        return trimmed.replace(/:$/, '');
      }
    }
    return undefined;
  }

  private createSystemPrompt(contextWithMeta: ContextWithMetadata[]): string {
    if (contextWithMeta.length === 0) {
      return `You are a helpful AI assistant for DocuChat Inc. Answer questions to the best of your ability.`;
    }

    const contextText = contextWithMeta
      .map((ctx, index) => {
        const sectionInfo = ctx.section ? ` - ${ctx.section}` : '';
        return `[Source ${index + 1}${sectionInfo}]\n${ctx.content}`;
      })
      .join('\n\n---\n\n');
    
    return `You are a helpful AI assistant for DocuChat Inc. Answer questions based ONLY on the provided company policy document context.

CONTEXT FROM COMPANY POLICY DOCUMENT:
${contextText}

INSTRUCTIONS:
- Provide detailed, accurate answers using ONLY the information from the context above
- If asked about policies, quote specific details from the relevant sections
- If the context doesn't contain enough information, clearly state: "I don't have enough information in the company policy document to answer that question completely."
- When referencing policies, mention the specific section (e.g., "According to the Benefits Package section...")
- Be helpful and professional, as you represent DocuChat Inc.
- Include specific details like numbers, timeframes, and requirements when available in the context`;
  }

  private enhancedFallbackResponse(question: string, contextWithMeta: ContextWithMetadata[]): LLMResponse {
    if (contextWithMeta.length === 0) {
      return {
        answer: "I couldn't find any relevant information in the company policy document to answer your question. Please try asking about topics covered in the employee handbook, such as vacation policies, benefits, working hours, or performance reviews.",
        sources: []
      };
    }

    // Improved keyword matching
    const questionWords = question.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));

    const scoredContexts = contextWithMeta.map(ctx => {
      const contentLower = ctx.content.toLowerCase();
      let score = 0;
      let matchedWords: string[] = [];
      let keyMatches = 0;

      questionWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length * 2; // Weight exact matches higher
          matchedWords.push(word);
          keyMatches++;
        }
        
        // Partial matches
        if (contentLower.includes(word)) {
          score += 0.5;
        }
      });

      // Boost score for section relevance
      if (ctx.section && questionWords.some(word => 
        ctx.section!.toLowerCase().includes(word))) {
        score += 3;
      }

      return { ...ctx, score, matchedWords, keyMatches };
    });

    const bestMatch = scoredContexts.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    if (bestMatch.score > 1) {
      // Extract the most relevant parts
      const sentences = bestMatch.content.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const relevantSentences = sentences.filter(sentence => 
        bestMatch.matchedWords.some(word => 
          sentence.toLowerCase().includes(word)
        )
      ).slice(0, 4); // Get more context

      let answer = '';
      if (relevantSentences.length > 0) {
        const sectionPrefix = bestMatch.section ? `According to the ${bestMatch.section} section: ` : 'Based on the company policy: ';
        answer = sectionPrefix + relevantSentences.join('. ').trim() + '.';
        
        // Add additional context if available
        if (relevantSentences.length < sentences.length) {
          const additionalContext = sentences.filter(s => 
            !relevantSentences.includes(s) && s.trim().length > 15
          ).slice(0, 2);
          
          if (additionalContext.length > 0) {
            answer += ' Additionally: ' + additionalContext.join('. ').trim() + '.';
          }
        }
      } else {
        answer = `Based on the company policy document: ${bestMatch.content.substring(0, 300)}...`;
      }

      return {
        answer,
        sources: [bestMatch.source]
      };
    }

    // No good matches found
    const availableSections = contextWithMeta
      .map(ctx => ctx.section)
      .filter(Boolean)
      .join(', ');
    
    return {
      answer: `I found some information in the company policy document, but it doesn't directly answer your question about "${question}". The available sections include: ${availableSections}. Please try asking more specifically about these topics, or rephrase your question.`,
      sources: contextWithMeta.map(ctx => ctx.source)
    };
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'what', 'how', 'when', 'where', 'why', 'is', 'are', 'was', 'were'
    ]);
    return stopWords.has(word);
  }

  private generateSourceLabels(contextWithMeta: ContextWithMetadata[]): string[] {
    return contextWithMeta.map(ctx => {
      if (ctx.section) {
        return `Company Policy - ${ctx.section}`;
      }
      return ctx.source;
    });
  }

  clearHistory(): void {
    this.conversationHistory = [];
    console.log('✅ Conversation history cleared');
  }

  getHistoryLength(): number {
    return this.conversationHistory.length;
  }
}