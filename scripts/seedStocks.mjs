import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { createRequire } from 'module';

// Load environment variables
dotenv.config();

// Set up require for ES modules
const require = createRequire(import.meta.url);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the Stock Schema directly in this file to avoid import issues
const priceHistorySchema = new mongoose.Schema({
    timestamp: { type: Date, required: true },
    price: { type: Number, required: true }
});

// Schema for OHLC candles
const candlestickSchema = new mongoose.Schema({
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: 0 }
});

const stockSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    sector: {
        type: String,
        required: true,
        trim: true
    },
    currentPrice: {
        type: Number,
        required: true
    },
    riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    circuitLimit: {
        type: Number,
        required: true
    },
    volatilityFactor: {
        type: Number,
        required: true,
        default: 3000 // Default V value for price calculation
    },
    // Raw price history (1-minute ticks)
    priceHistory: [priceHistorySchema],
    // OHLC candles for different timeframes
    candles_5min: [candlestickSchema],
    candles_30min: [candlestickSchema],
    candles_2hour: [candlestickSchema],
    // Timestamps for the last price update in each timeframe
    lastCandle_5min: { type: Date },
    lastCandle_30min: { type: Date },
    lastCandle_2hour: { type: Date },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for faster queries
stockSchema.index({ symbol: 1 });
stockSchema.index({ symbol: 1, "priceHistory.timestamp": -1 });
stockSchema.index({ symbol: 1, "candles_5min.startTime": -1 });
stockSchema.index({ symbol: 1, "candles_30min.startTime": -1 });
stockSchema.index({ symbol: 1, "candles_2hour.startTime": -1 });

// Create the Stock model
const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

if (process.env.MONGODB_URI) {
    console.log('Using MONGODB_URI from environment variables');
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksimulator';
const CLEAR_DATABASE = process.env.CLEAR_DATABASE === 'true' || false;
const SEED_INITIAL_VALUES = process.env.SEED_INITIAL_VALUES === 'true' || false;

const stocks = [
    {
        symbol: 'HDFCBANK',
        name: 'HDFC Bank',
        sector: 'Banking',
        currentPrice: 1500,            // Replace with live price
        riskLevel: 'Low',
        description: 'India’s largest private‑sector bank by assets offering retail & corporate banking services. :contentReference[oaicite:1]{index=1}',
        circuitLimit: 5,
        volatilityFactor: 40,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'ICICIBANK',
        name: 'ICICI Bank',
        sector: 'Banking',
        currentPrice: 950,              // Replace with live price
        riskLevel: 'Low',
        description: 'Leading private‑sector bank in India, with extensive retail, corporate, and investment banking operations. :contentReference[oaicite:2]{index=2}',
        circuitLimit: 5,
        volatilityFactor: 45,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'INFY',
        name: 'Infosys',
        sector: 'IT Services',
        currentPrice: 1450,             // Replace with live price
        riskLevel: 'Medium',
        description: 'Global leader in consulting, digital and next‑gen tech services with ~317k employees. :contentReference[oaicite:3]{index=3}',
        circuitLimit: 7,
        volatilityFactor: 50,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        sector: 'IT Services',
        currentPrice: 3300,             // Replace with live price
        riskLevel: 'Low',
        description: 'Global IT services & consulting firm, part of Tata Group, operating in 46 countries. :contentReference[oaicite:4]{index=4}',
        circuitLimit: 5,
        volatilityFactor: 35,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'RELIANCE',
        name: 'Reliance Industries',
        sector: 'Conglomerate',
        currentPrice: 2600,             // Replace with live price
        riskLevel: 'Low',
        description: 'Diversified Fortune 500 conglomerate across energy, petrochemicals, retail, telecom & digital platforms. :contentReference[oaicite:5]{index=5}',
        circuitLimit: 5,
        volatilityFactor: 45,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'LT',
        name: 'Larsen & Toubro',
        sector: 'Engineering & Construction',
        currentPrice: 2400,             // Replace with live price
        riskLevel: 'Medium',
        description: 'Multinational conglomerate in engineering, construction, manufacturing, IT services and financial services. :contentReference[oaicite:6]{index=6}',
        circuitLimit: 6,
        volatilityFactor: 55,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'HINDUNILVR',
        name: 'Hindustan Unilever',
        sector: 'FMCG',
        currentPrice: 2300,             // Replace with live price
        riskLevel: 'Low',
        description: 'India’s largest FMCG company with 50+ brands across home & personal care, foods & refreshments. :contentReference[oaicite:7]{index=7}',
        circuitLimit: 5,
        volatilityFactor: 30,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'MARUTI',
        name: 'Maruti Suzuki',
        sector: 'Automotive',
        currentPrice: 900,              // Replace with live price
        riskLevel: 'Medium',
        description: 'India’s largest passenger vehicle manufacturer, strong in small cars and SUVs. :contentReference[oaicite:8]{index=8}',
        circuitLimit: 7,
        volatilityFactor: 50,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'BAJFINANCE',
        name: 'Bajaj Finance',
        sector: 'Financial Services',
        currentPrice: 7000,             // Replace with live price
        riskLevel: 'Medium',
        description: 'India’s largest non‑bank lender, offering consumer & SME finance; spun off housing finance IPO. :contentReference[oaicite:9]{index=9}',
        circuitLimit: 6,
        volatilityFactor: 60,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    },
    {
        symbol: 'TITAN',
        name: 'Titan Company',
        sector: 'Consumer Durables',
        currentPrice: 3500,             // Replace with live price
        riskLevel: 'Medium',
        description: 'Leading jewellery, watch & eyewear maker in India; part of Tata Group. (Use similar sourcing)',
        circuitLimit: 6,
        volatilityFactor: 45,
        priceHistory: [],
        candles_5min: [],
        candles_30min: [],
        candles_2hour: []
    }
];

// Function to generate realistic candlestick data
function generateCandlestickData(stock, timeframe, numberOfCandles) {
    const candles = [];
    const currentTime = new Date();

    // Define time intervals in milliseconds
    const timeIntervals = {
        '5min': 5 * 60 * 1000,
        '30min': 30 * 60 * 1000,
        '2hour': 2 * 60 * 60 * 1000
    };

    const interval = timeIntervals[timeframe];

    // Calculate volatility based on risk level and volatility factor
    const baseVolatility = stock.volatilityFactor / 10000; // Convert to percentage
    let volatilityMultiplier = 1;

    switch (stock.riskLevel) {
        case 'Low':
            volatilityMultiplier = 0.8;
            break;
        case 'Medium':
            volatilityMultiplier = 1.2;
            break;
        case 'High':
            volatilityMultiplier = 2.0;
            break;
    }

    const volatility = baseVolatility * volatilityMultiplier;

    // Start from a more variable price range
    let currentPrice = stock.currentPrice * (0.7 + Math.random() * 0.6); // Start 70-130% of current price

    // Market phases for more realistic movement
    const phases = ['bullish', 'bearish', 'sideways', 'volatile'];
    let currentPhase = phases[Math.floor(Math.random() * phases.length)];
    let phaseCounter = 0;
    const phaseLength = Math.floor(Math.random() * 20) + 10; // Phase lasts 10-30 candles

    // Generate candles going backwards in time
    for (let i = numberOfCandles - 1; i >= 0; i--) {
        const startTime = new Date(currentTime.getTime() - (i + 1) * interval);
        const endTime = new Date(currentTime.getTime() - i * interval);

        // Change market phase periodically
        if (phaseCounter >= phaseLength) {
            currentPhase = phases[Math.floor(Math.random() * phases.length)];
            phaseCounter = 0;
        }
        phaseCounter++;

        // Generate realistic OHLC values
        const open = currentPrice;

        // Apply phase-based movement
        let phaseBias = 0;
        let phaseVolatilityMultiplier = 1;

        switch (currentPhase) {
            case 'bullish':
                phaseBias = volatility * 0.3; // Slight upward bias
                phaseVolatilityMultiplier = 0.8;
                break;
            case 'bearish':
                phaseBias = -volatility * 0.3; // Slight downward bias
                phaseVolatilityMultiplier = 0.8;
                break;
            case 'sideways':
                phaseBias = 0;
                phaseVolatilityMultiplier = 0.6;
                break;
            case 'volatile':
                phaseBias = (Math.random() - 0.5) * volatility * 0.5;
                phaseVolatilityMultiplier = 1.8;
                break;
        }

        // Generate random price movement
        const randomMovement = (Math.random() - 0.5) * 2 * volatility * open * phaseVolatilityMultiplier;
        const biasedMovement = phaseBias * open;

        // Add some mean reversion towards a reasonable range
        const distanceFromTarget = (stock.currentPrice - open) / stock.currentPrice;
        const meanReversion = distanceFromTarget * 0.05 * open;

        const close = Math.max(
            open + randomMovement + biasedMovement + meanReversion,
            open * 0.85 // Prevent drops more than 15%
        );

        // Generate more realistic high and low
        const volatilityRange = volatility * open * phaseVolatilityMultiplier;

        // High and low should represent the extremes during the period
        const maxOfOpenClose = Math.max(open, close);
        const minOfOpenClose = Math.min(open, close);

        // Generate high with more realistic range
        const highExtension = Math.random() * volatilityRange * 0.8; // Up to 80% of volatility range
        const high = maxOfOpenClose + highExtension;

        // Generate low with more realistic range
        const lowExtension = Math.random() * volatilityRange * 0.8; // Up to 80% of volatility range
        const low = Math.max(minOfOpenClose - lowExtension, minOfOpenClose * 0.95); // Don't go below 95% of min

        // Ensure high is actually higher than low (safety check)
        const finalHigh = Math.max(high, low + open * 0.001); // At least 0.1% difference
        const finalLow = Math.min(low, finalHigh - open * 0.001);

        // Generate realistic volume based on timeframe and volatility
        let baseVolume;
        switch (timeframe) {
            case '5min':
                baseVolume = Math.floor(Math.random() * 15000) + 2000;
                break;
            case '30min':
                baseVolume = Math.floor(Math.random() * 80000) + 10000;
                break;
            case '2hour':
                baseVolume = Math.floor(Math.random() * 400000) + 50000;
                break;
        }

        // Higher volatility and larger price movements = higher volume
        const priceChange = Math.abs(close - open) / open;
        const volumeMultiplier = 1 + priceChange * 3; // Volume increases with price movement
        const volume = Math.floor(baseVolume * volumeMultiplier);

        candles.push({
            startTime,
            endTime,
            open: Math.round(open * 100) / 100,
            high: Math.round(finalHigh * 100) / 100,
            low: Math.round(finalLow * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume
        });

        // Update current price for next iteration
        currentPrice = close;
    }

    return candles;
}


// Function to generate price history data
function generatePriceHistory(stock, candles5min) {
    const priceHistory = [];

    // Generate price history from 5-minute candles
    candles5min.forEach(candle => {
        // Add multiple price points within each 5-minute candle
        const ticksPerCandle = 5;

        for (let i = 0; i < ticksPerCandle; i++) {
            const timestamp = new Date(candle.startTime.getTime() + i * 60 * 1000);
            let price;

            if (i === 0) {
                price = candle.open;
            } else if (i === ticksPerCandle - 1) {
                price = candle.close;
            } else {
                // Create realistic price movement within the candle
                const progress = i / (ticksPerCandle - 1);

                // Use a more complex interpolation
                const basePrice = candle.open + (candle.close - candle.open) * progress;

                // Add some randomness within the high-low range
                const range = candle.high - candle.low;
                const randomFactor = (Math.random() - 0.5) * 0.6; // ±30% of range
                const variation = range * randomFactor;

                price = basePrice + variation;

                // Ensure price stays within candle bounds
                price = Math.max(candle.low, Math.min(candle.high, price));
            }

            priceHistory.push({
                timestamp,
                price: Math.round(price * 100) / 100
            });
        }
    });

    return priceHistory;
}

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');

        console.log(`SEED_INITIAL_VALUES: ${SEED_INITIAL_VALUES}`);

        if (CLEAR_DATABASE) {
            // Clear entire database if flag is set to true
            console.log('CLEAR_DATABASE is true - Clearing existing stocks...');
            await Stock.deleteMany({});
            console.log('Cleared existing stocks');

            // Insert all stocks
            console.log('Inserting all stocks...');
            const result = await Stock.insertMany(stocks);
            console.log(`Seeded ${result.length} stocks successfully`);

            // Initialize price history for all stocks
            if (SEED_INITIAL_VALUES) {
                await initializePriceHistoryWithInitialValues(result);
            } else {
                await initializePriceHistoryForStocks(result);
            }
        } else {
            // Check for existing stocks and only add new ones
            console.log('CLEAR_DATABASE is false - Checking for existing stocks...');

            // Get all existing stock symbols
            const existingStocks = await Stock.find({}, { symbol: 1 });
            const existingSymbols = existingStocks.map(stock => stock.symbol);
            console.log(`Found ${existingSymbols.length} existing stocks:`, existingSymbols);

            // Filter out stocks that already exist
            const newStocks = stocks.filter(stock => !existingSymbols.includes(stock.symbol));
            console.log(`Found ${newStocks.length} new stocks to add`);

            if (newStocks.length > 0) {
                // Insert only new stocks
                console.log('Inserting new stocks...');
                const result = await Stock.insertMany(newStocks);
                console.log(`Seeded ${result.length} new stocks successfully`);

                // Initialize price history only for new stocks
                if (SEED_INITIAL_VALUES) {
                    await initializePriceHistoryWithInitialValues(result);
                } else {
                    await initializePriceHistoryForStocks(result);
                }
            } else {
                console.log('No new stocks to add - all stocks already exist in database');
            }
        }

        await mongoose.disconnect();
        console.log('Database seeding completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Helper function to initialize price history and candles for stocks with initial values
async function initializePriceHistoryWithInitialValues(stocksToInitialize) {
    console.log('Initializing price history with 500 candles for each timeframe...');
    const currentTime = new Date();

    for (const stock of stocksToInitialize) {
        console.log(`Generating realistic data for ${stock.symbol}...`);

        // Generate 500 candles for each timeframe using the improved function
        const candles5min = generateCandlestickData(stock, '5min', 500);
        const candles30min = generateCandlestickData(stock, '30min', 500);
        const candles2hour = generateCandlestickData(stock, '2hour', 500);

        // Generate price history from 5-minute candles
        const priceHistory = generatePriceHistory(stock, candles5min);

        // Calculate the timestamps for last candles
        const lastCandle5min = candles5min[candles5min.length - 1].endTime;
        const lastCandle30min = candles30min[candles30min.length - 1].endTime;
        const lastCandle2hour = candles2hour[candles2hour.length - 1].endTime;

        // Update the stock with generated data
        await Stock.findByIdAndUpdate(stock._id, {
            $set: {
                priceHistory: priceHistory,
                candles_5min: candles5min,
                candles_30min: candles30min,
                candles_2hour: candles2hour,
                lastCandle_5min: lastCandle5min,
                lastCandle_30min: lastCandle30min,
                lastCandle_2hour: lastCandle2hour,
                lastUpdated: currentTime
            }
        });

        console.log(`✓ Generated realistic data for ${stock.symbol}: ${priceHistory.length} price points, ${candles5min.length} 5min candles, ${candles30min.length} 30min candles, ${candles2hour.length} 2hour candles`);
    }

    console.log(`Initialized comprehensive price history and candles for ${stocksToInitialize.length} stocks`);
}

// Helper function to initialize price history and candles for stocks (minimal)
async function initializePriceHistoryForStocks(stocksToInitialize) {
    console.log('Initializing basic price history...');
    const currentTime = new Date();

    for (const stock of stocksToInitialize) {
        // Add initial price history entry (matches priceHistorySchema)
        const initialPriceHistory = {
            timestamp: currentTime,
            price: stock.currentPrice
        };

        // Add initial candle for each timeframe
        const initialCandle = {
            startTime: currentTime,
            endTime: new Date(currentTime.getTime() + 5 * 60 * 1000), // 5 minutes later
            open: stock.currentPrice,
            high: stock.currentPrice,
            low: stock.currentPrice,
            close: stock.currentPrice,
            volume: 0
        };

        await Stock.findByIdAndUpdate(stock._id, {
            $push: {
                priceHistory: initialPriceHistory,
                candles_5min: initialCandle,
                candles_30min: {
                    ...initialCandle,
                    endTime: new Date(currentTime.getTime() + 30 * 60 * 1000) // 30 minutes
                },
                candles_2hour: {
                    ...initialCandle,
                    endTime: new Date(currentTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours
                }
            },
            $set: {
                lastCandle_5min: currentTime,
                lastCandle_30min: currentTime,
                lastCandle_2hour: currentTime,
                lastUpdated: currentTime
            }
        });
    }
    console.log(`Initialized basic price history and candles for ${stocksToInitialize.length} stocks`);
}

// Run the seeding function
seedDatabase();