import mongoose from 'mongoose';
import Stock from '../src/models/Stock';

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
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing stocks
        await Stock.deleteMany({});
        console.log('Cleared existing stocks');

        // Insert new stocks
        const result = await Stock.insertMany(stocks);
        console.log(`Seeded ${result.length} stocks`);

        // Initialize price history for each stock
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
        console.log('Database seeding completed');
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase(); 