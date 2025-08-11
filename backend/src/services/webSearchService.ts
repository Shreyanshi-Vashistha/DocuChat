import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: string;
  dayHigh: number;
  dayLow: number;
}

interface NewsResult {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export class WebSearchService {
  private readonly stockApiKey: string;
  private readonly searchApiKey: string;

  constructor() {
    this.stockApiKey = process.env.ALPHA_VANTAGE_API_KEY || "";
    this.searchApiKey = process.env.SERPAPI_KEY || "";
    console.log(
      "Alpha Key:",
      process.env.ALPHA_VANTAGE_API_KEY ? "Set" : "Not set"
    );
    console.log("SerpAPI Key:", process.env.SERPAPI_KEY ? "Set" : "Not set");
  }

  async search(query: string): Promise<string[]> {
    try {
      if (this.isStockQuery(query)) {
        return await this.handleStockQuery(query);
      }
      return await this.handleGeneralSearch(query);
    } catch (error) {
      return [
        `Web search encountered an error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ];
    }
  }

  private isStockQuery(query: string): boolean {
    const stockPatterns = [
      /stock price/i,
      /share price/i,
      /market value/i,
      /current price of \w+/i,
      /how.*performed/i,
      /\b[A-Z]{2,5}\b.*price/i,
      /nasdaq|nyse|dow jones/i,
      /earnings|dividend|market cap/i,
    ];

    return stockPatterns.some((pattern) => pattern.test(query));
  }

  private async handleStockQuery(query: string): Promise<string[]> {
    try {
      const symbolMatch = query.match(/\b([A-Z]{2,5})\b/);
      const symbol = symbolMatch
        ? symbolMatch[1]
        : this.extractStockSymbolFromText(query);

      if (!symbol) {
        return [
          "Could not identify a stock symbol in your query. Please specify a stock ticker symbol (e.g., AAPL, TSLA, MSFT).",
        ];
      }
      if (this.stockApiKey) {
        console.log("Using Alpha Vantage API for stock data");
        const stockData = await this.fetchRealStockData(symbol);
        if (stockData) {
          return this.formatStockData(stockData);
        }
      }
      return this.generateEnhancedMockStockData(symbol);
    } catch (error) {
      return [
        `Error fetching stock data for your query: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ];
    }
  }

  private async fetchRealStockData(symbol: string): Promise<StockQuote | null> {
    try {
      const response = await axios.get("https://www.alphavantage.co/query", {
        params: {
          function: "GLOBAL_QUOTE",
          symbol: symbol,
          apikey: this.stockApiKey,
        },
        timeout: 60000,
      });

      const data = response.data["Global Quote"];

      if (data && data["05. price"]) {
        return {
          symbol: symbol,
          price: parseFloat(data["05. price"]),
          change: parseFloat(data["09. change"]),
          changePercent: parseFloat(
            data["10. change percent"].replace("%", "")
          ),
          volume: parseInt(data["06. volume"], 10),
          dayHigh: parseFloat(data["03. high"]),
          dayLow: parseFloat(data["04. low"]),
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch real stock data for ${symbol}:`, error);
      return null;
    }
  }

  private generateEnhancedMockStockData(symbol: string): string[] {
    const stockInfo: {
      [key: string]: { basePrice: number; volatility: number; name: string };
    } = {
      AAPL: { basePrice: 175, volatility: 0.02, name: "Apple Inc." },
      TSLA: { basePrice: 240, volatility: 0.05, name: "Tesla Inc." },
      MSFT: {
        basePrice: 380,
        volatility: 0.015,
        name: "Microsoft Corporation",
      },
      GOOGL: { basePrice: 140, volatility: 0.02, name: "Alphabet Inc." },
      AMZN: { basePrice: 145, volatility: 0.025, name: "Amazon.com Inc." },
      NVDA: { basePrice: 450, volatility: 0.04, name: "NVIDIA Corporation" },
    };

    const info = stockInfo[symbol] || {
      basePrice: 100,
      volatility: 0.03,
      name: `${symbol} Corporation`,
    };
    const priceVariation = (Math.random() - 0.5) * 2 * info.volatility;
    const currentPrice = info.basePrice * (1 + priceVariation);
    const change = info.basePrice * priceVariation;
    const changePercent = priceVariation * 100;

    return [
      `Stock Quote for ${symbol} (${info.name}):`,
      `Current Price: $${currentPrice.toFixed(2)}`,
      `Change: ${change >= 0 ? "+" : ""}$${change.toFixed(2)} (${
        changePercent >= 0 ? "+" : ""
      }${changePercent.toFixed(2)}%)`,
      `Volume: ${Math.floor(
        Math.random() * 50000000 + 1000000
      ).toLocaleString()}`,
      `Day High: $${(currentPrice * 1.02).toFixed(2)}`,
      `Day Low: $${(currentPrice * 0.98).toFixed(2)}`,
      `Source: Mock Stock API - For demo purposes`,
      `Note: This is simulated data. In production, this would connect to a real stock market API.`,
    ];
  }

  private formatStockData(stock: StockQuote): string[] {
    const changeSymbol = stock.change >= 0 ? "+" : "";
    const changePercentSymbol = stock.changePercent >= 0 ? "+" : "";

    return [
      `Real-time stock data for ${stock.symbol}:`,
      `Current Price: $${stock.price.toFixed(2)}`,
      `Change: ${changeSymbol}$${stock.change.toFixed(
        2
      )} (${changePercentSymbol}${stock.changePercent.toFixed(2)}%)`,
      `Volume: ${stock.volume.toLocaleString()}`,
      `Day High: $${stock.dayHigh.toFixed(2)}`,
      `Day Low: $${stock.dayLow.toFixed(2)}`,
      stock.marketCap ? `Market Cap: ${stock.marketCap}` : "",
      `Source: Alpha Vantage API - Real-time data`,
    ].filter((line) => line.length > 0);
  }

  private extractStockSymbolFromText(text: string): string | null {
    const stockMentions: { [key: string]: string } = {
      apple: "AAPL",
      tesla: "TSLA",
      microsoft: "MSFT",
      google: "GOOGL",
      alphabet: "GOOGL",
      amazon: "AMZN",
      nvidia: "NVDA",
      meta: "META",
      facebook: "META",
    };

    const textLower = text.toLowerCase();
    for (const [company, symbol] of Object.entries(stockMentions)) {
      if (textLower.includes(company)) {
        return symbol;
      }
    }

    return null;
  }
  private async handleGeneralSearch(query: string): Promise<string[]> {
    if (this.searchApiKey) {
      try {
        const response = await axios.get("https://serpapi.com/search", {
          params: {
            q: query,
            api_key: this.searchApiKey,
            engine: "google",
            num: 5,
            safe: "active",
          },
          timeout: 10000,
        });

        if (
          response.data &&
          response.data.organic_results &&
          response.data.organic_results.length > 0
        ) {
          return this.formatSerpApiResults(
            response.data.organic_results,
            query
          );
        } else {
          console.log("No organic results found in SerpAPI response");
        }
      } catch (error) {
        console.error("SerpAPI error:", error);
        if (error instanceof Error) {
          console.error("Error details:", error.message);
        }
      }
    } else {
      console.log("No SerpAPI key available");
    }
    return this.generateEnhancedMockWebResults(query);
  }
  private formatSerpApiResults(results: any[], query: string): string[] {
    const formatted = [
      `Web search results for "${query}" (via Google Search):\n`,
    ];

    results.slice(0, 3).forEach((result, index) => {
      const title = result.title || "No title available";
      const snippet =
        result.snippet || result.description || "No description available";
      const url = result.link || result.url || "No URL available";
      const source = this.extractDomainFromUrl(url);

      formatted.push(
        `${index + 1}. ${title}`,
        `Summary: ${snippet}`,
        `Source: ${source}`,
        `URL: ${url}`,
        ""
      );
    });

    formatted.push(`Search performed: ${new Date().toLocaleString()}`);
    formatted.push(`Results powered by Google Search API`);

    return formatted;
  }

  private generateEnhancedMockWebResults(query: string): string[] {
    const mockDomains = [
      "wikipedia.org",
      "reuters.com",
      "bbc.com",
      "cnn.com",
      "techcrunch.com",
      "forbes.com",
      "bloomberg.com",
    ];

    const mockResults = mockDomains.slice(0, 3).map((domain, index) => {
      const encodedQuery = encodeURIComponent(
        query.toLowerCase().replace(/\s+/g, "-")
      );
      return {
        title: `${query} - Comprehensive Guide and Latest Information`,
        snippet: `Detailed information about ${query} including recent developments, expert analysis, and comprehensive coverage of key topics related to your search.`,
        url: `https://www.${domain}/articles/${encodedQuery}-${Date.now()}`,
        source: domain,
      };
    });

    const formatted = [`Mock web search results for "${query}":\n`];

    mockResults.forEach((result, index) => {
      formatted.push(
        `${index + 1}. ${result.title}`,
        `Summary: ${result.snippet}`,
        `Source: ${result.source}`,
        `URL: ${result.url}`,
        ""
      );
    });

    formatted.push(
      `Note: These are mock search results for demonstration purposes.`
    );
    formatted.push(
      `In production, integrate with real search APIs like SerpAPI, Brave Search, or custom scraping.`
    );
    formatted.push(`Search performed: ${new Date().toLocaleString()}`);

    return formatted;
  }

  private extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch (error) {
      return "Unknown source";
    }
  }
}
