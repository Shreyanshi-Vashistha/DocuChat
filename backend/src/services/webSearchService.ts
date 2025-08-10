import axios from 'axios';

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

export class WebSearchService {
  private readonly stockApiKey: string;
  private readonly newsApiKey: string;
  private readonly searchApiKey: string;

  constructor() {
    // In production, these should come from environment variables
    this.stockApiKey = process.env.FINNHUB_API_KEY || '';
    this.newsApiKey = process.env.NEWS_API_KEY || '';
    this.searchApiKey = process.env.BRAVE_SEARCH_API_KEY || '';
  }

  async search(query: string): Promise<string[]> {
    try {
      console.log(`Web search query: ${query}`);
      
      // Detect query type and route to appropriate service
      const queryLower = query.toLowerCase();
      
      // Stock-related queries
      if (this.isStockQuery(query)) {
        return await this.handleStockQuery(query);
      }
      
      // News and current events
      if (this.isNewsQuery(query)) {
        return await this.handleNewsQuery(query);
      }
      
      // General web search
      return await this.handleGeneralSearch(query);
      
    } catch (error) {
      console.error('Web search error:', error);
      return [`Web search encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }

  private isStockQuery(query: string): boolean {
    const stockPatterns = [
      /stock price/i,
      /share price/i,
      /market value/i,
      /current price of \w+/i,
      /how.*performed/i,
      /\b[A-Z]{2,5}\b.*price/i, // Stock symbols
      /nasdaq|nyse|dow jones/i,
      /earnings|dividend|market cap/i
    ];
    
    return stockPatterns.some(pattern => pattern.test(query));
  }

  private isNewsQuery(query: string): boolean {
    const newsPatterns = [
      /news about|latest news/i,
      /what.*happening|current events/i,
      /recent.*development/i,
      /today.*news|breaking news/i
    ];
    
    return newsPatterns.some(pattern => pattern.test(query));
  }

  private async handleStockQuery(query: string): Promise<string[]> {
    try {
      // Extract stock symbol from query
      const symbolMatch = query.match(/\b([A-Z]{2,5})\b/);
      const symbol = symbolMatch ? symbolMatch[1] : this.extractStockSymbolFromText(query);
      
      if (!symbol) {
        return ['Could not identify a stock symbol in your query. Please specify a stock ticker symbol (e.g., AAPL, TSLA, MSFT).'];
      }

      // Try to get real stock data if API key is available
      if (this.stockApiKey) {
        const stockData = await this.fetchRealStockData(symbol);
        if (stockData) {
          return this.formatStockData(stockData);
        }
      }

      // Fallback to enhanced mock data
      return this.generateEnhancedMockStockData(symbol);

    } catch (error) {
      console.error('Stock query error:', error);
      return [`Error fetching stock data for your query: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }

  private async fetchRealStockData(symbol: string): Promise<StockQuote | null> {
    try {
      // Example using Finnhub API (replace with your preferred stock API)
      const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
        params: {
          symbol: symbol,
          token: this.stockApiKey
        },
        timeout: 5000
      });

      const data = response.data;
      
      if (data && data.c) { // c = current price
        return {
          symbol: symbol,
          price: data.c,
          change: data.d, // daily change
          changePercent: data.dp, // daily change percent
          volume: data.v || 0,
          dayHigh: data.h,
          dayLow: data.l
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch real stock data for ${symbol}:`, error);
      return null;
    }
  }

  private generateEnhancedMockStockData(symbol: string): string[] {
    // Generate more realistic mock data based on well-known stocks
    const stockInfo: { [key: string]: { basePrice: number; volatility: number; name: string } } = {
      'AAPL': { basePrice: 175, volatility: 0.02, name: 'Apple Inc.' },
      'TSLA': { basePrice: 240, volatility: 0.05, name: 'Tesla Inc.' },
      'MSFT': { basePrice: 380, volatility: 0.015, name: 'Microsoft Corporation' },
      'GOOGL': { basePrice: 140, volatility: 0.02, name: 'Alphabet Inc.' },
      'AMZN': { basePrice: 145, volatility: 0.025, name: 'Amazon.com Inc.' },
      'NVDA': { basePrice: 450, volatility: 0.04, name: 'NVIDIA Corporation' }
    };

    const info = stockInfo[symbol] || { basePrice: 100, volatility: 0.03, name: `${symbol} Corporation` };
    const priceVariation = (Math.random() - 0.5) * 2 * info.volatility;
    const currentPrice = info.basePrice * (1 + priceVariation);
    const change = info.basePrice * priceVariation;
    const changePercent = priceVariation * 100;

    return [
      `Stock Quote for ${symbol} (${info.name}):`,
      `Current Price: $${currentPrice.toFixed(2)}`,
      `Change: ${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`,
      `Volume: ${Math.floor(Math.random() * 50000000 + 1000000).toLocaleString()}`,
      `Day High: $${(currentPrice * 1.02).toFixed(2)}`,
      `Day Low: $${(currentPrice * 0.98).toFixed(2)}`,
      `Note: This is simulated data for demonstration. In production, this would connect to a real stock market API.`,
      `For real-time data, consider integrating with APIs like Finnhub, Alpha Vantage, or Yahoo Finance.`
    ];
  }

  private formatStockData(stock: StockQuote): string[] {
    const changeSymbol = stock.change >= 0 ? '+' : '';
    const changePercentSymbol = stock.changePercent >= 0 ? '+' : '';
    
    return [
      `Real-time stock data for ${stock.symbol}:`,
      `Current Price: $${stock.price.toFixed(2)}`,
      `Change: ${changeSymbol}$${stock.change.toFixed(2)} (${changePercentSymbol}${stock.changePercent.toFixed(2)}%)`,
      `Volume: ${stock.volume.toLocaleString()}`,
      `Day High: $${stock.dayHigh.toFixed(2)}`,
      `Day Low: $${stock.dayLow.toFixed(2)}`,
      stock.marketCap ? `Market Cap: ${stock.marketCap}` : '',
      `Data provided by real-time stock market API.`
    ].filter(line => line.length > 0);
  }

  private extractStockSymbolFromText(text: string): string | null {
    // Common stock mentions
    const stockMentions: { [key: string]: string } = {
      'apple': 'AAPL',
      'tesla': 'TSLA',
      'microsoft': 'MSFT',
      'google': 'GOOGL',
      'alphabet': 'GOOGL',
      'amazon': 'AMZN',
      'nvidia': 'NVDA',
      'meta': 'META',
      'facebook': 'META'
    };

    const textLower = text.toLowerCase();
    for (const [company, symbol] of Object.entries(stockMentions)) {
      if (textLower.includes(company)) {
        return symbol;
      }
    }

    return null;
  }

  private async handleNewsQuery(query: string): Promise<string[]> {
    try {
      // If we have a news API key, fetch real news
      if (this.newsApiKey) {
        const newsData = await this.fetchRealNews(query);
        if (newsData && newsData.length > 0) {
          return this.formatNewsData(newsData);
        }
      }

      // Fallback to mock news data
      return this.generateMockNewsData(query);
      
    } catch (error) {
      console.error('News query error:', error);
      return [`Error fetching news for your query: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }

  private async fetchRealNews(query: string): Promise<NewsResult[]> {
    try {
      // Example using NewsAPI (replace with your preferred news API)
      const response = await axios.get(`https://newsapi.org/v2/everything`, {
        params: {
          q: query,
          sortBy: 'publishedAt',
          pageSize: 3,
          apiKey: this.newsApiKey
        },
        timeout: 5000
      });

      if (response.data && response.data.articles) {
        return response.data.articles.map((article: any) => ({
          title: article.title,
          summary: article.description || article.content?.substring(0, 200) + '...',
          url: article.url,
          publishedAt: article.publishedAt,
          source: article.source.name
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch real news:', error);
      return [];
    }
  }

  private generateMockNewsData(query: string): string[] {
    return [
      `Mock news results for "${query}":`,
      `• Breaking: Technology sector shows mixed results amid market volatility (MockNews - 2 hours ago)`,
      `• Market Analysis: Experts weigh in on current economic trends (Financial Mock - 4 hours ago)`,
      `• Industry Update: Latest developments in the business world (Mock Business Today - 6 hours ago)`,
      `Note: This is mock news data for demonstration. In production, integrate with real news APIs like NewsAPI, Guardian API, or Reuters API.`
    ];
  }

  private formatNewsData(news: NewsResult[]): string[] {
    const formatted = [`Recent news results:`];
    
    news.forEach((article, index) => {
      const publishedDate = new Date(article.publishedAt).toLocaleString();
      formatted.push(`${index + 1}. ${article.title}`);
      formatted.push(`   ${article.summary}`);
      formatted.push(`   Source: ${article.source} - ${publishedDate}`);
      formatted.push('');
    });

    return formatted;
  }

  private async handleGeneralSearch(query: string): Promise<string[]> {
    // Placeholder for general web search
    // In production, integrate with Brave Search API, SerpAPI, or custom scraping
    
    if (this.searchApiKey) {
      // Example implementation with Brave Search API
      try {
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
          headers: {
            'X-Subscription-Token': this.searchApiKey,
            'Accept': 'application/json'
          },
          params: {
            q: query,
            count: 3
          },
          timeout: 5000
        });

        if (response.data && response.data.web && response.data.web.results) {
          return this.formatGeneralSearchResults(response.data.web.results);
        }
      } catch (error) {
        console.error('Brave search API error:', error);
      }
    }

    // Enhanced mock search results
    return [
      `Web search results for "${query}":`,
      `• Comprehensive information about ${query} - Detailed explanation and current insights from authoritative sources.`,
      `• Latest updates on ${query} - Recent developments and expert analysis from industry leaders.`,
      `• ${query}: Complete guide and best practices - In-depth coverage of key concepts and practical applications.`,
      `Note: This is mock web search data for demonstration. In production, integrate with search APIs like Brave Search, SerpAPI, or implement custom web scraping.`
    ];
  }

  private formatGeneralSearchResults(results: any[]): string[] {
    const formatted = [`Web search results:`];
    
    results.slice(0, 3).forEach((result, index) => {
      formatted.push(`${index + 1}. ${result.title}`);
      formatted.push(`   ${result.description || 'No description available'}`);
      formatted.push(`   URL: ${result.url}`);
      formatted.push('');
    });

    return formatted;
  }
}