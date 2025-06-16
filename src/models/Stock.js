import mongoose from 'mongoose';

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
        default: 3000 // Default V value for price calculation
    },
    priceHistory: [priceHistorySchema],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Add index for faster queries
stockSchema.index({ symbol: 1 });

const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

export default Stock; 