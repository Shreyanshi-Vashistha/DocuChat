export interface TextSplitterOptions {
  chunkSize: number;
  chunkOverlap: number;
  separator?: string;
}

export class TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separator: string;

  constructor(options: TextSplitterOptions) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
    this.separator = options.separator || '\n\n';
  }

  splitText(text: string): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(this.separator);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > this.chunkSize) {
        // If we have a current chunk, add it to chunks
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          
          // Start new chunk with overlap from previous chunk
          const overlapText = this.getOverlapText(currentChunk);
          currentChunk = overlapText + paragraph;
        } else {
          // Single paragraph is larger than chunk size, split it
          const splitParagraph = this.splitLargeParagraph(paragraph);
          chunks.push(...splitParagraph.slice(0, -1));
          currentChunk = splitParagraph[splitParagraph.length - 1];
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? this.separator : '') + paragraph;
      }
    }

    // Add the last chunk if it exists
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  private getOverlapText(text: string): string {
    if (text.length <= this.chunkOverlap) {
      return text + this.separator;
    }
    
    // Try to find a natural break point (sentence ending)
    const overlapText = text.slice(-this.chunkOverlap);
    const sentenceEnd = overlapText.lastIndexOf('.');
    
    if (sentenceEnd > this.chunkOverlap * 0.5) {
      return text.slice(-(this.chunkOverlap - sentenceEnd)) + this.separator;
    }
    
    return overlapText + this.separator;
  }

  private splitLargeParagraph(paragraph: string): string[] {
    const chunks: string[] = [];
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim());
    let currentChunk = '';

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '.';
      
      if (currentChunk.length + sentenceWithPunctuation.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentenceWithPunctuation;
        } else {
          // Single sentence is too large, force split by words
          chunks.push(sentenceWithPunctuation);
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
