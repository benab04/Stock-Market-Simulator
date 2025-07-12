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
const marketSchema = new mongoose.Schema({
    status: {
        type: Boolean,
        required: true
    },
    admin: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    ]
});


const Market = mongoose.models.Market || mongoose.model('Market', marketSchema);

if (process.env.MONGODB_URI) {
    console.log('Using MONGODB_URI from environment variables');
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksimulator';
const CLEAR_DATABASE = process.env.CLEAR_DATABASE === 'true' || false;


async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');


        if (CLEAR_DATABASE) {
            // Clear entire database if flag is set to true
            console.log('CLEAR_DATABASE is true - Clearing existing market data...');
            await Market.deleteMany({});
            console.log('Market collection cleared');

            // Seed the market with initial data
            console.log('Seeding market with initial data...');
            const marketData = {
                status: true,
                admin: [] // Initially empty, can be populated later
            };
            const market = new Market(marketData);
            await market.save();
            console.log('Market seeded successfully');

        } else {
            // If CLEAR_DATABASE is false, check if market already exists
            const existingMarket = await Market.findOne({});
            if (!existingMarket) {
                console.log('No existing market found. Seeding with initial data...');
                const marketData = {
                    status: true,
                    admin: [] // Initially empty, can be populated later
                };
                const market = new Market(marketData);
                await market.save();
                console.log('Market seeded successfully');
            } else {
                console.log('Market already exists. Skipping seeding.');
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

// Run the seeding function
seedDatabase();