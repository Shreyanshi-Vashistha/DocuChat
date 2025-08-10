import { DocumentChunk } from './documentService';

export interface SimilarityResult {
  chunk: DocumentChunk;
  score: number;
}

export class VectorService {
  private embeddings: Map<string, number[]> = new Map();
  private chunks: DocumentChunk[] = [];
  private vocabulary: Set<string> = new Set();
  private idfScores: Map<string, number> = new Map();
  private sectionKeywords: Map<string, string[]> = new Map();

  async indexChunks(chunks: DocumentChunk[]): Promise<void> {
    this.chunks = chunks;
    this.buildVocabulary();
    this.calculateIDF();
    this.buildSectionKeywords();
    
    // Create embeddings for each chunk
    for (const chunk of chunks) {
      const embedding = this.createTFIDFEmbedding(chunk.content);
      this.embeddings.set(chunk.id, embedding);
    }
    
    console.log(`✅ Indexed ${chunks.length} chunks`);
    console.log(`📊 Vocabulary: ${this.vocabulary.size} words`);
    console.log(`🏷️ Sections: ${Array.from(this.sectionKeywords.keys()).join(', ')}`);
  }

  async similaritySearch(query: string, topK: number = 3): Promise<SimilarityResult[]> {
    const queryEmbedding = this.createTFIDFEmbedding(query);
    const similarities: SimilarityResult[] = [];

    for (const chunk of this.chunks) {
      const chunkEmbedding = this.embeddings.get(chunk.id);
      if (chunkEmbedding) {
        // Calculate multiple similarity metrics
        const cosineSim = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        const keywordSim = this.calculateKeywordSimilarity(query, chunk.content);
        const semanticSim = this.calculateSemanticSimilarity(query, chunk.content);
        const sectionSim = this.calculateSectionSimilarity(query, chunk);
        
        // Weighted combination with emphasis on keyword and section matching
        const score = (cosineSim * 0.25) + (keywordSim * 0.35) + (semanticSim * 0.2) + (sectionSim * 0.2);
        
        similarities.push({ chunk, score });
      }
    }

    // Sort by similarity score and return top K
    const results = similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`🔍 Search for "${query}":`, 
      results.map(r => ({ 
        score: r.score.toFixed(3),
        section: r.chunk.metadata.section || 'No section',
        preview: r.chunk.content.substring(0, 60) + '...' 
      }))
    );

    return results;
  }

  private buildVocabulary(): void {
    this.vocabulary.clear();
    
    for (const chunk of this.chunks) {
      const words = this.extractWords(chunk.content);
      words.forEach(word => this.vocabulary.add(word));
    }
  }

  private buildSectionKeywords(): void {
    this.sectionKeywords.clear();
    
    // Define keywords for each section based on the company policy document
    this.sectionKeywords.set('COMPANY OVERVIEW', ['company', 'docuchat', 'mission', 'technology', 'ai', 'document', 'processing', 'chatbot', 'founded', 'innovation']);
    this.sectionKeywords.set('WORKING HOURS AND TIME OFF', ['hours', 'working', 'time', 'vacation', 'sick', 'leave', 'holiday', 'pto', 'days', 'off']);
    this.sectionKeywords.set('BENEFITS PACKAGE', ['benefits', 'health', 'insurance', 'retirement', '401k', 'medical', 'dental', 'vision', 'development', 'training']);
    this.sectionKeywords.set('CODE OF CONDUCT', ['conduct', 'behavior', 'ethics', 'harassment', 'discrimination', 'respect', 'professional', 'confidentiality']);
    this.sectionKeywords.set('REMOTE WORK POLICY', ['remote', 'work', 'home', 'flexible', 'telecommute', 'virtual', 'internet', 'workspace']);
    this.sectionKeywords.set('PERFORMANCE REVIEWS', ['performance', 'review', 'evaluation', 'annual', 'feedback', 'goals', 'development', 'salary', 'promotion']);
    this.sectionKeywords.set('TECHNOLOGY AND SECURITY', ['technology', 'security', 'equipment', 'laptop', 'password', 'authentication', 'software', 'breach']);
    this.sectionKeywords.set('EXPENSE REIMBURSEMENT', ['expense', 'reimbursement', 'travel', 'business', 'receipt', 'entertainment', 'approval']);
    this.sectionKeywords.set('COMMUNICATION POLICIES', ['communication', 'email', 'slack', 'messaging', 'video', 'conferencing', 'response']);
    this.sectionKeywords.set('TERMINATION PROCEDURES', ['termination', 'resignation', 'employment', 'notice', 'layoffs', 'exit', 'interview']);
  }

  private calculateIDF(): void {
    this.idfScores.clear();
    const totalDocs = this.chunks.length;
    
    for (const word of this.vocabulary) {
      const docsContaining = this.chunks.filter(chunk => 
        this.extractWords(chunk.content).includes(word)
      ).length;
      
      const idf = Math.log(totalDocs / (docsContaining + 1));
      this.idfScores.set(word, idf);
    }
  }

  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those', 'i',
      'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
      'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
      'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
      'what', 'which', 'who', 'whom', 'whose', 'am', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
      'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall'
    ]);
    
    return stopWords.has(word);
  }

  private createTFIDFEmbedding(text: string): number[] {
    const words = this.extractWords(text);
    const termFreq: Map<string, number> = new Map();
    
    // Calculate term frequencies
    words.forEach(word => {
      termFreq.set(word, (termFreq.get(word) || 0) + 1);
    });
    
    // Create embedding vector
    const embedding = new Array(Math.min(this.vocabulary.size, 500)).fill(0);
    const vocabArray = Array.from(this.vocabulary).slice(0, 500);
    
    vocabArray.forEach((word, index) => {
      const tf = termFreq.get(word) || 0;
      const idf = this.idfScores.get(word) || 0;
      embedding[index] = tf * idf;
    });
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  private calculateKeywordSimilarity(query: string, text: string): number {
    const queryWords = this.extractWords(query);
    const textWords = this.extractWords(text);
    
    if (queryWords.length === 0) return 0;
    
    const matches = queryWords.filter(word => textWords.includes(word));
    let similarity = matches.length / queryWords.length;
    
    // Boost score for exact phrase matches
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    if (textLower.includes(queryLower)) {
      similarity = Math.min(1.0, similarity + 0.4);
    }
    
    return similarity;
  }

  private calculateSemanticSimilarity(query: string, text: string): number {
    const queryWords = this.extractWords(query);
    const textWords = this.extractWords(text);
    
    // Enhanced semantic groups for company policy context
    const semanticGroups = new Map([
      ['vacation', ['holiday', 'leave', 'time', 'off', 'pto', 'break', 'days']],
      ['sick', ['illness', 'medical', 'health', 'doctor', 'hospital', 'leave']],
      ['benefits', ['insurance', 'health', 'retirement', '401k', 'dental', 'vision', 'coverage']],
      ['work', ['job', 'employment', 'career', 'position', 'role', 'working', 'hours']],
      ['remote', ['home', 'telecommute', 'virtual', 'distance', 'flexible']],
      ['policy', ['rule', 'regulation', 'procedure', 'guideline', 'requirement']],
      ['hours', ['time', 'schedule', 'shift', 'workday', 'working']],
      ['employee', ['worker', 'staff', 'personnel', 'team', 'member']],
      ['company', ['organization', 'business', 'employer', 'firm', 'docuchat']],
      ['training', ['education', 'learning', 'development', 'course', 'professional']],
      ['salary', ['pay', 'wage', 'compensation', 'money', 'payment']],
      ['review', ['evaluation', 'assessment', 'performance', 'feedback']],
      ['insurance', ['health', 'medical', 'dental', 'vision', 'coverage']],
      ['technology', ['equipment', 'laptop', 'computer', 'software', 'security']],
      ['expense', ['reimbursement', 'cost', 'travel', 'business', 'receipt']]
    ]);
    
    let semanticScore = 0;
    
    queryWords.forEach(queryWord => {
      if (textWords.includes(queryWord)) {
        semanticScore += 1;
      } else {
        // Check for semantic relationships
        const relatedTerms = semanticGroups.get(queryWord) || [];
        const hasRelated = textWords.some(textWord => 
          relatedTerms.includes(textWord) || 
          relatedTerms.some(term => textWord.includes(term))
        );
        if (hasRelated) {
          semanticScore += 0.6;
        }
      }
    });
    
    return queryWords.length > 0 ? Math.min(1.0, semanticScore / queryWords.length) : 0;
  }

  private calculateSectionSimilarity(query: string, chunk: DocumentChunk): number {
    const queryWords = this.extractWords(query);
    const chunkSection = chunk.metadata.section;
    
    if (!chunkSection) return 0;
    
    // Direct section name matching
    const sectionWords = this.extractWords(chunkSection);
    const directMatch = queryWords.filter(word => 
      sectionWords.includes(word)
    ).length / Math.max(queryWords.length, 1);
    
    // Keyword-based section matching
    const sectionKeywords = this.sectionKeywords.get(chunkSection) || [];
    const keywordMatch = queryWords.filter(word => 
      sectionKeywords.includes(word)
    ).length / Math.max(queryWords.length, 1);
    
    return Math.max(directMatch, keywordMatch * 0.8);
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    
    return mag1 && mag2 ? dotProduct / (mag1 * mag2) : 0;
  }

  // Debug methods
  getVocabularySize(): number {
    return this.vocabulary.size;
  }

  getTopWords(limit: number = 20): string[] {
    const wordFreq: Map<string, number> = new Map();
    
    this.chunks.forEach(chunk => {
      const words = this.extractWords(chunk.content);
      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
    });
    
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  getSectionStats(): { [section: string]: number } {
    const stats: { [section: string]: number } = {};
    
    this.chunks.forEach(chunk => {
      const section = chunk.metadata.section || 'No Section';
      stats[section] = (stats[section] || 0) + 1;
    });
    
    return stats;
  }
}