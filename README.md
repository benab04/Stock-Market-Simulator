# Stock Trading Simulator

This is a real-time stock trading simulator built with Next.js, featuring live candlestick charts and real-time price updates.

## Real-time Candlestick Updates

The frontend implements a sophisticated real-time update system for candlesticks and price indicators. Here's how it works:

### 1. Server-Sent Events (SSE) Setup

```javascript
// In dashboard/page.js
eventSource = new EventSource("/api/stockData");
```

### 2. Data Flow Process

#### a. Price Updates (Every 30 seconds)

1. Server sends price updates via SSE
2. Frontend receives updates in `onmessage` handler
3. Current price is immediately updated in the UI
4. Price indicator (line and label) is updated in real-time

#### b. Candlestick Updates

1. After price update, frontend fetches new historical data
2. Candlesticks are aggregated on the backend based on timeframe
3. Complete chart is redrawn with new data

### 3. Key Functions

#### Price Indicator Updates

```javascript
const updatePriceIndicator = (currentPrice) => {
  // Uses stored scales from the main chart
  const { xScale, yScale, width } = scaleRef.current;

  // Updates price line and label in real-time
  // without waiting for candlestick updates
};
```

#### Chart Updates

```javascript
const updateChart = (symbol) => {
  // Redraws entire chart with new data
  // Stores scales for price indicator updates
  scaleRef.current = { xScale, yScale, width };
};
```

### 4. Update Process Flow

1. **Initial Load**

   - Fetches initial stock list
   - Loads historical data for selected stock
   - Creates initial chart

2. **Real-time Updates**

   - New price received → Update price indicator
   - Fetch new historical data
   - Update candlesticks if new candle formed
   - Store new scales for future updates

3. **Timeframe Changes**
   - User selects new timeframe
   - Fetches new historical data
   - Redraws chart with new candle intervals

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
