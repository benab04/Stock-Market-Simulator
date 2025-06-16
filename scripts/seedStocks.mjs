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
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true }
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
        default: 3000
    },
    priceHistory: [priceHistorySchema],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Create the Stock model
const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksimulator';

const stocks = [
    {
        symbol: 'ABINFD',
        name: 'Abhinava InfoTech',
        sector: 'IT Services',
        currentPrice: 1750,
        riskLevel: 'Low',
        description: 'Large-cap IT services leader, stable EPS, bluechip favorite.',
        circuitLimit: 5,
        volatilityFactor: 5000, // Bluechip stock
        priceHistory: []
    },
    {
        symbol: 'TECHST',
        name: 'TechStar Solutions',
        sector: 'Technology',
        currentPrice: 850,
        riskLevel: 'Medium',
        description: 'Mid-cap technology solutions provider with growing market share.',
        circuitLimit: 7,
        volatilityFactor: 3000, // Regular stock
        priceHistory: []
    },
    {
        symbol: 'QSTART',
        name: 'Quantum Startups',
        sector: 'Technology',
        currentPrice: 250,
        riskLevel: 'High',
        description: 'Small-cap quantum computing startup with high growth potential.',
        circuitLimit: 10,
        volatilityFactor: 1000, // Volatile small-cap
        priceHistory: []
    }
];

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');

        // Clear existing stocks
        console.log('Clearing existing stocks...');
        await Stock.deleteMany({});
        console.log('Cleared existing stocks');

        // Insert new stocks
        console.log('Inserting new stocks...');
        const result = await Stock.insertMany(stocks);
        console.log(`Seeded ${result.length} stocks successfully`);

        // Initialize price history for each stock
        console.log('Initializing price history...');
        for (const stock of result) {
            const initialPrice = {
                timestamp: new Date(),
                open: stock.currentPrice,
                high: stock.currentPrice,
                low: stock.currentPrice,
                close: stock.currentPrice,
                volume: 0
            };

            await Stock.findByIdAndUpdate(stock._id, {
                $push: { priceHistory: initialPrice }
            });
        }
        console.log('Initialized price history for all stocks');

        await mongoose.disconnect();
        console.log('Database seeding completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the seeding function
seedDatabase(); 