import { DocumentChunk } from './documentService';

export interface SimilarityResult {
  chunk: DocumentChunk;
  score: number;
}

export class VectorService {
  private embeddings: Map<string, number[]> = new Map();
  private chunks: DocumentChunk[] = [];

  async indexChunks(chunks: DocumentChunk[]): Promise<void> {
    this.chunks = chunks;
    
    // Simple TF-IDF-like embedding simulation
    // In a real implementation, you'd use proper embeddings from Ollama or other services
    for (const chunk of chunks) {
      const embedding = this.createSimpleEmbedding(chunk.content);
      this.embeddings.set(chunk.id, embedding);
    }
    
    console.log(`Indexed ${chunks.length} chunks`);
  }

  async similaritySearch(query: string, topK: number = 3): Promise<SimilarityResult[]> {
    const queryEmbedding = this.createSimpleEmbedding(query);
    const similarities: SimilarityResult[] = [];

    for (const chunk of this.chunks) {
      const chunkEmbedding = this.embeddings.get(chunk.id);
      if (chunkEmbedding) {
        const score = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        similarities.push({ chunk, score });
      }
    }

    // Sort by similarity score (descending) and return top K
    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private createSimpleEmbedding(text: string): number[] {
    // Simple word frequency-based embedding
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCounts: { [key: string]: number } = {};
    
    // Count word frequencies
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    // Create a fixed-size vector (100 dimensions)
    const embedding = new Array(100).fill(0);
    const vocabulary = Object.keys(wordCounts);
    
    vocabulary.forEach((word, index) => {
      const dimension = this.hashString(word) % 100;
      embedding[dimension] += wordCounts[word];
    });

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    
    return mag1 && mag2 ? dotProduct / (mag1 * mag2) : 0;
  }
}