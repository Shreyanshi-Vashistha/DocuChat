
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

  async indexChunks(chunks: DocumentChunk[]): Promise<void> {
    this.chunks = chunks;
    this.buildVocabulary();
    this.calculateIDF();
    
    // Create embeddings for each chunk
    for (const chunk of chunks) {
      const embedding = this.createTFIDFEmbedding(chunk.content);
      this.embeddings.set(chunk.id, embedding);
    }
    
    console.log(`Indexed ${chunks.length} chunks with vocabulary of ${this.vocabulary.size} words`);
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
        
        // Weighted combination of similarity scores
        const score = (cosineSim * 0.4) + (keywordSim * 0.4) + (semanticSim * 0.2);
        
        similarities.push({ chunk, score });
      }
    }

    // Sort by similarity score (descending) and return top K
    const results = similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`Similarity search for "${query}": found ${results.length} results with scores:`, 
      results.map(r => ({ score: r.score.toFixed(3), preview: r.chunk.content.substring(0, 50) + '...' }))
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
      'what', 'which', 'who', 'whom', 'whose', 'this', 'that', 'these', 'those', 'am',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
      'do', 'does', 'did', 'doing', 'will', 'would', 'should', 'could', 'can', 'may',
      'might', 'must', 'shall'
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
    const similarity = matches.length / queryWords.length;
    
    // Boost score for exact phrase matches
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    if (textLower.includes(queryLower)) {
      return Math.min(1.0, similarity + 0.3);
    }
    
    return similarity;
  }

  private calculateSemanticSimilarity(query: string, text: string): number {
    // Simple semantic similarity based on related terms
    const queryWords = this.extractWords(query);
    const textWords = this.extractWords(text);
    
    // Define some basic semantic relationships
    const semanticGroups = new Map([
      ['vacation', ['holiday', 'leave', 'time off', 'pto', 'break']],
      ['sick', ['illness', 'medical', 'health', 'doctor', 'hospital']],
      ['benefits', ['insurance', 'health', 'retirement', '401k', 'dental', 'vision']],
      ['work', ['job', 'employment', 'career', 'position', 'role']],
      ['remote', ['home', 'telecommute', 'virtual', 'distance']],
      ['policy', ['rule', 'regulation', 'procedure', 'guideline', 'requirement']],
      ['hours', ['time', 'schedule', 'shift', 'workday']],
      ['employee', ['worker', 'staff', 'personnel', 'team member']],
      ['company', ['organization', 'business', 'employer', 'firm']],
      ['training', ['education', 'learning', 'development', 'course']]
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
          semanticScore += 0.5;
        }
      }
    });
    
    return queryWords.length > 0 ? Math.min(1.0, semanticScore / queryWords.length) : 0;
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
}