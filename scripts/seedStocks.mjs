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
const CLEAR_DATABASE = process.env.CLEAR_DATABASE || false;

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


// const stocks = [
//     {
//         symbol: 'ABINFD',
//         name: 'Abhinava InfoTech',
//         sector: 'IT Services',
//         currentPrice: 1750,
//         riskLevel: 'Low',
//         description: 'Large-cap IT services leader, stable EPS, bluechip favorite.',
//         circuitLimit: 5,
//         volatilityFactor: 50,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'TECHST',
//         name: 'TechStar Solutions',
//         sector: 'Technology',
//         currentPrice: 850,
//         riskLevel: 'Medium',
//         description: 'Mid-cap technology solutions provider with growing market share.',
//         circuitLimit: 7,
//         volatilityFactor: 30,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'QSTART',
//         name: 'Quantum Startups',
//         sector: 'Technology',
//         currentPrice: 250,
//         riskLevel: 'High',
//         description: 'Small-cap quantum computing startup with high growth potential.',
//         circuitLimit: 10,
//         volatilityFactor: 100,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'RELPOW',
//         name: 'Reliance Power Corp',
//         sector: 'Energy',
//         currentPrice: 2450,
//         riskLevel: 'Low',
//         description: 'Dominant energy conglomerate with diversified power generation portfolio.',
//         circuitLimit: 5,
//         volatilityFactor: 45,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'MEDIPL',
//         name: 'MediPlus Healthcare',
//         sector: 'Healthcare',
//         currentPrice: 1200,
//         riskLevel: 'Medium',
//         description: 'Leading pharmaceutical company with strong R&D capabilities.',
//         circuitLimit: 6,
//         volatilityFactor: 35,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'BANKOR',
//         name: 'Bankor Financial',
//         sector: 'Banking',
//         currentPrice: 3200,
//         riskLevel: 'Low',
//         description: 'Premier private sector bank with robust digital banking services.',
//         circuitLimit: 4,
//         volatilityFactor: 40,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'SOLREN',
//         name: 'Solar Renaissance',
//         sector: 'Renewable Energy',
//         currentPrice: 680,
//         riskLevel: 'Medium',
//         description: 'Mid-cap solar energy company riding the green transition wave.',
//         circuitLimit: 8,
//         volatilityFactor: 60,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'FOODCH',
//         name: 'FoodChain Industries',
//         sector: 'FMCG',
//         currentPrice: 1500,
//         riskLevel: 'Low',
//         description: 'Established FMCG giant with strong brand portfolio and distribution network.',
//         circuitLimit: 5,
//         volatilityFactor: 25,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'AUTODR',
//         name: 'AutoDrive Motors',
//         sector: 'Automotive',
//         currentPrice: 950,
//         riskLevel: 'Medium',
//         description: 'Automotive manufacturer focusing on electric and autonomous vehicles.',
//         circuitLimit: 7,
//         volatilityFactor: 55,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'STEELX',
//         name: 'SteelX Corporation',
//         sector: 'Steel & Metal',
//         currentPrice: 1850,
//         riskLevel: 'Medium',
//         description: 'Large-cap steel producer with integrated operations and export focus.',
//         circuitLimit: 6,
//         volatilityFactor: 70,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'FINEXP',
//         name: 'FinExpress Services',
//         sector: 'Financial Services',
//         currentPrice: 420,
//         riskLevel: 'High',
//         description: 'Emerging fintech company offering digital lending and payment solutions.',
//         circuitLimit: 10,
//         volatilityFactor: 90,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'TEXTIL',
//         name: 'Textile Masters Ltd',
//         sector: 'Textiles',
//         currentPrice: 340,
//         riskLevel: 'Medium',
//         description: 'Mid-cap textile manufacturer with strong export credentials.',
//         circuitLimit: 8,
//         volatilityFactor: 45,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'PHARMO',
//         name: 'PharmaOmega Research',
//         sector: 'Pharmaceuticals',
//         currentPrice: 2100,
//         riskLevel: 'Low',
//         description: 'Blue-chip pharmaceutical company with global presence and patent portfolio.',
//         circuitLimit: 5,
//         volatilityFactor: 35,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'BIOTER',
//         name: 'BioTerra Sciences',
//         sector: 'Biotechnology',
//         currentPrice: 180,
//         riskLevel: 'High',
//         description: 'Small-cap biotech firm developing breakthrough gene therapy treatments.',
//         circuitLimit: 12,
//         volatilityFactor: 120,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'REALST',
//         name: 'RealEstate Titans',
//         sector: 'Real Estate',
//         currentPrice: 1320,
//         riskLevel: 'Medium',
//         description: 'Large real estate developer with premium residential and commercial projects.',
//         circuitLimit: 6,
//         volatilityFactor: 50,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'RETAILX',
//         name: 'RetailX Supermart',
//         sector: 'Retail',
//         currentPrice: 780,
//         riskLevel: 'Medium',
//         description: 'Multi-format retail chain with strong omnichannel presence.',
//         circuitLimit: 7,
//         volatilityFactor: 40,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'CEMCON',
//         name: 'Cement Consolidated',
//         sector: 'Cement',
//         currentPrice: 2800,
//         riskLevel: 'Low',
//         description: 'Market leading cement manufacturer with pan-India presence.',
//         circuitLimit: 4,
//         volatilityFactor: 30,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'AGRITECH',
//         name: 'AgriTech Innovations',
//         sector: 'Agriculture',
//         currentPrice: 520,
//         riskLevel: 'High',
//         description: 'Agricultural technology startup focused on precision farming solutions.',
//         circuitLimit: 10,
//         volatilityFactor: 85,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'LOGIST',
//         name: 'Logistics Pro',
//         sector: 'Logistics',
//         currentPrice: 890,
//         riskLevel: 'Medium',
//         description: 'Integrated logistics service provider with tech-enabled supply chain solutions.',
//         circuitLimit: 7,
//         volatilityFactor: 55,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     },
//     {
//         symbol: 'MINPOW',
//         name: 'Mineral Power Corp',
//         sector: 'Mining',
//         currentPrice: 1650,
//         riskLevel: 'Medium',
//         description: 'Diversified mining company with coal, iron ore and precious metals operations.',
//         circuitLimit: 6,
//         volatilityFactor: 75,
//         priceHistory: [],
//         candles_5min: [],
//         candles_30min: [],
//         candles_2hour: []
//     }
// ];

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');

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
            await initializePriceHistoryForStocks(result);
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
                await initializePriceHistoryForStocks(result);
            } else {
                console.log('No new stocks to add - all stocks already exist in database');
            }

            // Optionally update existing stocks (uncomment if you want to update existing stock data)
            /*
            if (existingSymbols.length > 0) {
                console.log('Updating existing stocks...');
                for (const stock of stocks) {
                    if (existingSymbols.includes(stock.symbol)) {
                        await Stock.findOneAndUpdate(
                            { symbol: stock.symbol },
                            {
                                name: stock.name,
                                sector: stock.sector,
                                currentPrice: stock.currentPrice,
                                riskLevel: stock.riskLevel,
                                description: stock.description,
                                circuitLimit: stock.circuitLimit,
                                volatilityFactor: stock.volatilityFactor,
                                lastUpdated: new Date()
                            }
                        );
                    }
                }
                console.log('Updated existing stocks');
            }
            */
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

// Helper function to initialize price history and candles for stocks
async function initializePriceHistoryForStocks(stocksToInitialize) {
    console.log('Initializing price history...');
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
    console.log(`Initialized price history and candles for ${stocksToInitialize.length} stocks`);
}
// Run the seeding function
seedDatabase();