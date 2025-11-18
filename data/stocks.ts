export type StockMeta = {
  ticker: string;
  name: string;
  sector: "technology" | "healthcare" | "finance" | "energy" | "consumer" | "industrial" | "utilities";
  volatility: "low" | "medium" | "high";
  basePrice: number;
  volume: string;
};

export const STOCK_UNIVERSE: StockMeta[] = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "technology", volatility: "low", basePrice: 175.0, volume: "53.2M" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "technology", volatility: "low", basePrice: 378.9, volume: "28.5M" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "technology", volatility: "medium", basePrice: 142.6, volume: "32.1M" },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "technology", volatility: "high", basePrice: 495.3, volume: "45.3M" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "consumer", volatility: "high", basePrice: 248.2, volume: "98.7M" },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "consumer", volatility: "medium", basePrice: 134.6, volume: "61.4M" },
  { ticker: "META", name: "Meta Platforms", sector: "technology", volatility: "medium", basePrice: 312.4, volume: "21.3M" },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "consumer", volatility: "medium", basePrice: 410.2, volume: "8.7M" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "finance", volatility: "low", basePrice: 146.5, volume: "10.2M" },
  { ticker: "BAC", name: "Bank of America", sector: "finance", volatility: "medium", basePrice: 32.4, volume: "45.8M" },
  { ticker: "V", name: "Visa Inc.", sector: "finance", volatility: "low", basePrice: 245.3, volume: "6.1M" },
  { ticker: "MA", name: "Mastercard Inc.", sector: "finance", volatility: "medium", basePrice: 393.2, volume: "3.9M" },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "healthcare", volatility: "low", basePrice: 510.7, volume: "3.4M" },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "healthcare", volatility: "medium", basePrice: 34.6, volume: "28.3M" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "healthcare", volatility: "low", basePrice: 152.8, volume: "7.6M" },
  { ticker: "XOM", name: "Exxon Mobil", sector: "energy", volatility: "medium", basePrice: 115.9, volume: "20.5M" },
  { ticker: "CVX", name: "Chevron Corp.", sector: "energy", volatility: "medium", basePrice: 165.4, volume: "8.9M" },
  { ticker: "NEE", name: "NextEra Energy", sector: "utilities", volatility: "low", basePrice: 72.1, volume: "12.6M" },
  { ticker: "GE", name: "General Electric", sector: "industrial", volatility: "medium", basePrice: 117.8, volume: "6.7M" },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "industrial", volatility: "medium", basePrice: 265.3, volume: "3.5M" },
  { ticker: "BA", name: "Boeing Co.", sector: "industrial", volatility: "high", basePrice: 197.6, volume: "5.8M" },
  { ticker: "NKE", name: "Nike Inc.", sector: "consumer", volatility: "medium", basePrice: 105.4, volume: "9.2M" },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "consumer", volatility: "low", basePrice: 58.6, volume: "13.4M" },
  { ticker: "PEP", name: "PepsiCo Inc.", sector: "consumer", volatility: "low", basePrice: 181.2, volume: "4.7M" },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "technology", volatility: "medium", basePrice: 540.3, volume: "2.9M" },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "technology", volatility: "medium", basePrice: 218.9, volume: "6.3M" },
  { ticker: "ORCL", name: "Oracle Corp.", sector: "technology", volatility: "low", basePrice: 108.4, volume: "7.1M" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "technology", volatility: "high", basePrice: 112.7, volume: "56.1M" },
  { ticker: "INTC", name: "Intel Corp.", sector: "technology", volatility: "medium", basePrice: 34.5, volume: "38.4M" },
  { ticker: "CSCO", name: "Cisco Systems", sector: "technology", volatility: "low", basePrice: 53.1, volume: "19.5M" },
];

export const STOCK_MAP = STOCK_UNIVERSE.reduce<Record<string, StockMeta>>((acc, stock) => {
  acc[stock.ticker] = stock;
  return acc;
}, {});

export const MAX_STOCK_PRICE = Math.ceil(
  Math.max(...STOCK_UNIVERSE.map((stock) => stock.basePrice)) / 50,
) * 50 + 100;
