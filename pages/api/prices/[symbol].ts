import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const symbol = req.query.symbol as string;

  const url = `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`;

  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": process.env.ALPACA_API_KEY!,
      "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY!,
    },
  });

  const data = await response.json();
  const quote = data?.quote;

  if (!quote) {
    return res.status(500).json({ error: "No quote data" });
  }

  const mid = (quote.bp + quote.ap) / 2;

  res.status(200).json({ price: mid });
}
