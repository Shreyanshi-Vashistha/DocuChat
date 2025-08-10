import * as fs from 'fs/promises';
import { TextSplitter } from '../utils/textSplitter';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export class DocumentService {
  private chunks: DocumentChunk[] = [];
  private textSplitter: TextSplitter;

  constructor() {
    this.textSplitter = new TextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
  }

  async loadDocument(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const textChunks = this.textSplitter.splitText(content);
      
      this.chunks = textChunks.map((chunk, index) => ({
        id: `chunk_${index}`,
        content: chunk,
        metadata: {
          source: filePath,
          chunkIndex: index,
          startChar: index * 800, // Approximate
          endChar: index * 800 + chunk.length
        }
      }));
      
      console.log(`Document loaded: ${this.chunks.length} chunks created`);
    } catch (error) {
      console.error('Error loading document:', error);
      throw error;
    }
  }

  getChunks(): DocumentChunk[] {
    return this.chunks;
  }

  getChunkById(id: string): DocumentChunk | undefined {
    return this.chunks.find(chunk => chunk.id === id);
  }
}