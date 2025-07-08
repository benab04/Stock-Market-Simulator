# Stock Trading Simulator

## Architecture

![High Level Architecture view](./readme_files/High%20Level%20Architecture.png)

_Figure 1: High level architecture view showcasing different layers._

This is a real-time stock trading simulator built with Next.js, featuring live candlestick charts, real-time price updates, portfolio tracking, and simulated trading.

## Features

### 1. Authentication & Authorization

- Secure user authentication using NextAuth.js
- Protected routes for authenticated users
- Persistent sessions and token management

### 2. Real-time Trading Dashboard

![Trading Dashboard](./readme_files/Dashboard%20view.png)
_Figure 2: Real-time trading dashboard with live candlestick charts and trading form._

- Live candlestick charts with multiple timeframes
- Real-time price updates via Server-Sent Events (SSE)
- Trade execution with market and limit orders
- Live balance updates

### 3. Portfolio Management

- Real-time portfolio valuation
- Detailed P&L tracking (realized and unrealized)
- Portfolio allocation visualization
- Transaction history
- Current holdings with live price updates

## Architecture

### API Routes

#### Authentication

- `/api/auth/[...nextauth]` - NextAuth.js authentication endpoints
- `/api/auth/register` - User registration
- `/api/auth/login` - User login

#### Trading & Portfolio

- `/api/trade` - Execute trades (POST)
- `/api/portfolio` - Get portfolio summary and holdings (GET)
- `/api/orders` - Manage and view orders (GET, POST)
- `/api/user/balance` - Get and update user balance (GET, PUT)

#### Market Data

- `/api/stockData` - Real-time stock price updates (SSE)
- `/api/stockHistory` - Historical price data (GET)
- `/api/stocks` - List available stocks (GET)

![Route Exploration](./readme_files/Route%20Exploration.png)
_Figure 3: Route exploration obtained through Google Analytics._

### Real-time Update Mechanisms

#### 1. Server-Sent Events (SSE)

The application uses SSE for real-time price updates:

```javascript
// In dashboard/page.js
eventSource = new EventSource("/api/stockData");
```

#### 2. Portfolio Updates

The portfolio page implements real-time updates through:

1. Initial data fetch on page load
2. SSE subscription for price updates
3. Automatic recalculation of portfolio value and P&L
4. WebSocket connection for trade confirmations

### Database Models

#### User Model

- Stores user profile, authentication, and balance information
- Optimized queries for frequent balance updates

#### Order Model

- Tracks all user trades and orders
- Indexed for efficient portfolio aggregation
- Supports market and limit orders

#### Stock Model

- Maintains current price and metadata
- Optimized for high-frequency price updates

## Performance Considerations

### API Optimization

1. **Connection Pooling**: MongoDB connections are pooled to reduce overhead
2. **Caching**: Frequently accessed data is cached at various levels:

   - In-memory cache for current prices
   - Redis cache for historical data
   - Browser caching for static assets

3. **Query Optimization**:
   - Aggregation pipelines for portfolio calculations
   - Indexed fields for frequent queries
   - Selective field projection to reduce payload size

### Memory Management

1. Stock data is streamed in chunks to prevent memory spikes
2. Historical data is paginated and loaded on demand
3. SSE connections are monitored and cleaned up properly

### Build and Deployment

1. Tailwind CSS optimizations:

   - JIT mode enabled
   - Unused styles purged in production
   - Critical CSS inlined

2. Next.js optimizations:
   - Static pages where possible
   - Dynamic imports for large components
   - API routes configured for optimal Vercel deployment

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```env
# Application
MONGODB_URI = your_mongodb_uri
NEXTAUTH_SECRET = your_nextjs_secret_key
NEXTAUTH_URL = your_deployed_url OR http://localhost:3000 (dev)
UPSTASH_REDIS_REST_URL = upstash_url
UPSTASH_REDIS_REST_TOKEN = upstash_redis_token
NEXT_PUBLIC_STOCK_UPDATE_ROUTE = /api/stockData  OR /api/stockData/upstash
NEXT_PUBLIC_AVATAR_ALLOWED = true/false
ADMIN_SECRET = your_admin_secret_key
CONTINUOUS_ENGINE = true/false
REGISTER_ALLOWED = true/false

# Database seeding
CLEAR_DATABASE = true/false
SEED_INITIAL_VALUES = true/false

# Analytics
GOOGLE_ANALYTICS_ID = your_analytics_id

```

4. Seed initial stock data:

```bash
npm run seed
```

5. Start the development server:

```bash
npm run dev
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
