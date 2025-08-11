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
    this.separator = options.separator || "\n\n";
  }

  splitText(text: string): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(this.separator);
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          const overlapText = this.getOverlapText(currentChunk);
          currentChunk = overlapText + paragraph;
        } else {
          const splitParagraph = this.splitLargeParagraph(paragraph);
          chunks.push(...splitParagraph.slice(0, -1));
          currentChunk = splitParagraph[splitParagraph.length - 1];
        }
      } else {
        currentChunk += (currentChunk ? this.separator : "") + paragraph;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  private getOverlapText(text: string): string {
    if (text.length <= this.chunkOverlap) {
      return text + this.separator;
    }

    const overlapText = text.slice(-this.chunkOverlap);
    const sentenceEnd = overlapText.lastIndexOf(".");

    if (sentenceEnd > this.chunkOverlap * 0.5) {
      return text.slice(-(this.chunkOverlap - sentenceEnd)) + this.separator;
    }

    return overlapText + this.separator;
  }

  private splitLargeParagraph(paragraph: string): string[] {
    const chunks: string[] = [];
    const sentences = paragraph.split(/[.!?]+/).filter((s) => s.trim());
    let currentChunk = "";

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + ".";

      if (
        currentChunk.length + sentenceWithPunctuation.length >
        this.chunkSize
      ) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentenceWithPunctuation;
        } else {
          chunks.push(sentenceWithPunctuation);
        }
      } else {
        currentChunk += (currentChunk ? " " : "") + sentenceWithPunctuation;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
