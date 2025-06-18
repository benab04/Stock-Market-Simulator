import mongoose from 'mongoose';

// Schema for raw price updates (1-minute ticks)
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
    }, volatilityFactor: {
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

// Add compound indexes for faster queries on historical data
stockSchema.index({ symbol: 1, "priceHistory.timestamp": -1 });
stockSchema.index({ symbol: 1, "candles_5min.startTime": -1 });
stockSchema.index({ symbol: 1, "candles_30min.startTime": -1 });
stockSchema.index({ symbol: 1, "candles_2hour.startTime": -1 });

const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

export default Stock; 