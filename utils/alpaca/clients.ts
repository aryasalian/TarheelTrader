import Alpaca from "@alpacahq/alpaca-trade-api";

// Initialize Alpaca client with API keys from environment variables
export const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY || "",
  secretKey: process.env.ALPACA_SECRET_KEY || "",
  paper: true, // Use paper trading
  usePolygon: false,
});
