import * as fs from "fs/promises";
import { TextSplitter } from "../utils/textSplitter";

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    section?: string;
    title?: string;
    wordCount: number;
    preview: string;
  };
}

export class DocumentService {
  private chunks: DocumentChunk[] = [];
  private textSplitter: TextSplitter;
  private documentContent: string = "";
  private documentSections: Map<string, string> = new Map();

  constructor() {
    this.textSplitter = new TextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
    });
  }

  async loadDocument(filePath: string): Promise<void> {
    try {
      this.documentContent = await fs.readFile(filePath, "utf-8");
      this.extractSections();
      const textChunks = this.textSplitter.splitText(this.documentContent);

      let charPosition = 0;
      this.chunks = textChunks.map((chunk, index) => {
        const startChar = charPosition;
        const endChar = startChar + chunk.length;
        charPosition = endChar - this.textSplitter["chunkOverlap"];

        const section = this.findSectionForChunk(chunk);
        const wordCount = chunk
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        const preview = this.createPreview(chunk);

        return {
          id: `chunk_${index}`,
          content: chunk,
          metadata: {
            source: filePath,
            chunkIndex: index,
            startChar,
            endChar,
            section,
            title: this.extractTitleFromChunk(chunk),
            wordCount,
            preview,
          },
        };
      });

      this.printChunkStats();
    } catch (error) {
      throw error;
    }
  }

  private extractSections(): void {
    this.documentSections.clear();

    const sectionMatches = this.documentContent.match(/^\d+\.\s+([A-Z\s]+)/gm);
    if (sectionMatches) {
      sectionMatches.forEach((match) => {
        const title = match.replace(/^\d+\.\s+/, "").trim();
        this.documentSections.set(title, match);
      });
    }

    const headerMatches = this.documentContent.match(/^[A-Z][A-Z\s:]+$/gm);
    if (headerMatches) {
      headerMatches.forEach((header) => {
        if (header.length > 5 && header.length < 50) {
          this.documentSections.set(header, header);
        }
      });
    }
  }

  private findSectionForChunk(chunk: string): string | undefined {
    for (const [sectionName] of this.documentSections) {
      const sectionWords = sectionName.toLowerCase().split(/\s+/);
      const chunkLower = chunk.toLowerCase();
      const matches = sectionWords.filter(
        (word) => word.length > 3 && chunkLower.includes(word)
      );

      if (matches.length >= Math.min(2, sectionWords.length * 0.5)) {
        return sectionName;
      }
    }

    const lines = chunk.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.match(/^\d+\.\s+[A-Z]/)) {
        return trimmedLine.replace(/^\d+\.\s+/, "");
      }
    }

    return undefined;
  }

  private extractTitleFromChunk(chunk: string): string | undefined {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines.slice(0, 3)) {
      if (line.match(/^\d+\.\s+[A-Z]/) || line.match(/^[A-Z][A-Z\s:]+$/)) {
        return line.replace(/^\d+\.\s+/, "");
      }

      if (line.match(/^[A-Z][a-z].*:$/) && line.length < 50) {
        return line.replace(/:$/, "");
      }
    }

    return undefined;
  }

  private createPreview(chunk: string): string {
    const sentences = chunk.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const firstSentence = sentences[0]?.trim();

    if (firstSentence && firstSentence.length > 20) {
      return firstSentence.length > 100
        ? firstSentence.substring(0, 100) + "..."
        : firstSentence + ".";
    }

    return chunk.substring(0, 100) + "...";
  }

  private printChunkStats(): void {
    const avgWordCount =
      this.chunks.reduce((sum, chunk) => sum + chunk.metadata.wordCount, 0) /
      this.chunks.length;
    const chunksWithSections = this.chunks.filter(
      (chunk) => chunk.metadata.section
    ).length;
    const chunksWithTitles = this.chunks.filter(
      (chunk) => chunk.metadata.title
    ).length;
  }

  getChunks(): DocumentChunk[] {
    return this.chunks;
  }

  getChunkById(id: string): DocumentChunk | undefined {
    return this.chunks.find((chunk) => chunk.id === id);
  }

  getChunksBySection(section: string): DocumentChunk[] {
    return this.chunks.filter((chunk) =>
      chunk.metadata.section?.toLowerCase().includes(section.toLowerCase())
    );
  }

  getSections(): string[] {
    return Array.from(this.documentSections.keys());
  }

  searchChunks(query: string): DocumentChunk[] {
    const queryLower = query.toLowerCase();
    return this.chunks.filter(
      (chunk) =>
        chunk.content.toLowerCase().includes(queryLower) ||
        chunk.metadata.section?.toLowerCase().includes(queryLower) ||
        chunk.metadata.title?.toLowerCase().includes(queryLower)
    );
  }

  getDocumentStats(): {
    totalChunks: number;
    totalWords: number;
    sections: string[];
    averageChunkSize: number;
  } {
    const totalWords = this.chunks.reduce(
      (sum, chunk) => sum + chunk.metadata.wordCount,
      0
    );
    const averageChunkSize = totalWords / this.chunks.length;

    return {
      totalChunks: this.chunks.length,
      totalWords,
      sections: this.getSections(),
      averageChunkSize: Math.round(averageChunkSize),
    };
  }
}
