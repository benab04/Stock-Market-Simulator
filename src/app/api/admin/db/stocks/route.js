import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Stock from '@/models/Stock';
import * as xlsx from 'xlsx';

// Function to generate realistic candlestick data (copied from seed script)
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

// Function to generate price history data from 5-minute candles
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

// Helper function to initialize price history and candles with comprehensive data (matches seed)
async function initializePriceHistoryWithInitialValues(stocksToInitialize) {
    console.log('Initializing price history with 500 candles for each timeframe...');
    const currentTime = new Date();
    const results = [];

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
        const stockUpdate = {
            ...stock,
            priceHistory: priceHistory,
            candles_5min: candles5min,
            candles_30min: candles30min,
            candles_2hour: candles2hour,
            lastCandle_5min: lastCandle5min,
            lastCandle_30min: lastCandle30min,
            lastCandle_2hour: lastCandle2hour,
            lastUpdated: currentTime
        };

        results.push(stockUpdate);

        console.log(`✓ Generated realistic data for ${stock.symbol}: ${priceHistory.length} price points, ${candles5min.length} 5min candles, ${candles30min.length} 30min candles, ${candles2hour.length} 2hour candles`);
    }

    console.log(`Initialized comprehensive price history and candles for ${stocksToInitialize.length} stocks`);
    return results;
}

// Helper function to initialize basic price history and candles (matches seed)
async function initializePriceHistoryForStocks(stocksToInitialize) {
    console.log('Initializing basic price history...');
    const currentTime = new Date();
    const results = [];

    for (const stock of stocksToInitialize) {
        // Add initial price history entry (matches priceHistorySchema)
        const initialPriceHistory = [{
            timestamp: currentTime,
            price: stock.currentPrice
        }];

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

        const stockUpdate = {
            ...stock,
            priceHistory: initialPriceHistory,
            candles_5min: [initialCandle],
            candles_30min: [{
                ...initialCandle,
                endTime: new Date(currentTime.getTime() + 30 * 60 * 1000) // 30 minutes
            }],
            candles_2hour: [{
                ...initialCandle,
                endTime: new Date(currentTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours
            }],
            lastCandle_5min: currentTime,
            lastCandle_30min: currentTime,
            lastCandle_2hour: currentTime,
            lastUpdated: currentTime
        };

        results.push(stockUpdate);
    }

    console.log(`Initialized basic price history and candles for ${stocksToInitialize.length} stocks`);
    return results;
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const generateHistoricalData = formData.get('generateHistoricalData') === 'true' || false; // Default false
        const clearDatabase = formData.get('clearDatabase') === 'false' ? false : true; // Default true

        console.log("Received file:", file?.name);
        console.log("Generate historical data:", generateHistoricalData);
        console.log("Clear database:", clearDatabase);

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Convert file buffer to workbook
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, {
            cellStyles: true,
            cellFormulas: true,
            cellDates: true,
            cellNF: true,
            sheetStubs: true
        });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON with header row
        const rawData = xlsx.utils.sheet_to_json(sheet);

        if (!rawData || rawData.length === 0) {
            return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
        }

        console.log(`Found ${rawData.length} rows in Excel file`);

        await dbConnect();

        // Validate and transform data with better error handling
        const validStocks = [];
        const errors = [];

        rawData.forEach((row, index) => {
            try {
                // Handle different possible column names and formats
                const symbol = (row.Symbol || row.symbol || row.SYMBOL || '').toString().toUpperCase().trim();
                const name = (row.Name || row.name || row.NAME || '').toString().trim();
                const sector = (row.Sector || row.sector || row.SECTOR || '').toString().trim();
                const currentPrice = parseFloat(row['Current Price'] || row.currentPrice || row.price || row.Price || 0);
                const riskLevel = (row.Risk || row.riskLevel || row['Risk Level'] || 'Medium').toString().trim();
                const description = (row.Description || row.description || row.DESC || '').toString().trim();
                const circuitLimit = parseInt(row['Circuit Limit'] || row.circuitLimit || row['Circuit'] || 5);
                const volatilityFactor = parseInt(row['Volatility Factor'] || row.volatilityFactor || row.volatility || 50);

                // Validate required fields
                if (!symbol) {
                    errors.push(`Row ${index + 2}: Missing symbol`);
                    return;
                }
                if (!name) {
                    errors.push(`Row ${index + 2}: Missing name for symbol ${symbol}`);
                    return;
                }
                if (currentPrice <= 0) {
                    errors.push(`Row ${index + 2}: Invalid current price for ${symbol}`);
                    return;
                }
                if (!['Low', 'Medium', 'High'].includes(riskLevel)) {
                    errors.push(`Row ${index + 2}: Invalid risk level for ${symbol}. Must be Low, Medium, or High`);
                    return;
                }

                const stockData = {
                    symbol,
                    name,
                    sector: sector || 'General',
                    currentPrice,
                    riskLevel,
                    description: description || `Stock information for ${name}`,
                    circuitLimit: circuitLimit || 5,
                    volatilityFactor: volatilityFactor || 50,
                    priceHistory: [],
                    candles_5min: [],
                    candles_30min: [],
                    candles_2hour: []
                };

                validStocks.push(stockData);
            } catch (error) {
                errors.push(`Row ${index + 2}: Error processing data - ${error.message}`);
            }
        });

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
        }

        if (validStocks.length === 0) {
            return NextResponse.json({
                error: 'No valid stock data found',
                details: errors.length > 0 ? errors.slice(0, 10) : ['No valid rows in the uploaded file']
            }, { status: 400 });
        }

        console.log(`Found ${validStocks.length} valid stocks to process`);

        // Follow the exact seeding logic
        if (clearDatabase) {
            // Clear entire database if flag is set to true
            console.log('clearDatabase is true - Clearing existing stocks...');
            await Stock.deleteMany({});
            console.log('Cleared existing stocks');

            // Insert all stocks
            console.log('Inserting all stocks...');
            const result = await Stock.insertMany(validStocks);
            console.log(`Seeded ${result.length} stocks successfully`);

            // Initialize price history for all stocks based on generateHistoricalData flag
            let finalStocks;
            if (generateHistoricalData) {
                finalStocks = await initializePriceHistoryWithInitialValues(result);
            } else {
                finalStocks = await initializePriceHistoryForStocks(result);
            }

            // Update all stocks with their initialized data
            const bulkOps = finalStocks.map(stock => ({
                updateOne: {
                    filter: { _id: stock._id },
                    update: { $set: stock }
                }
            }));

            await Stock.bulkWrite(bulkOps);

            return NextResponse.json({
                success: true,
                message: `Successfully processed ${validStocks.length} stocks`,
                details: {
                    totalProcessed: validStocks.length,
                    newStocks: validStocks.length,
                    updatedStocks: 0,
                    historicalDataGenerated: generateHistoricalData,
                    clearedDatabase: true,
                    errors: errors.length > 0 ? errors.slice(0, 5) : []
                }
            });

        } else {
            // Check for existing stocks and only add new ones
            console.log('clearDatabase is false - Checking for existing stocks...');

            // Get all existing stock symbols
            const existingStocks = await Stock.find({}, { symbol: 1 });
            const existingSymbols = existingStocks.map(stock => stock.symbol);
            console.log(`Found ${existingSymbols.length} existing stocks:`, existingSymbols);

            // Filter out stocks that already exist
            const newStocks = validStocks.filter(stock => !existingSymbols.includes(stock.symbol));
            console.log(`Found ${newStocks.length} new stocks to add`);

            if (newStocks.length > 0) {
                // Insert only new stocks
                console.log('Inserting new stocks...');
                const result = await Stock.insertMany(newStocks);
                console.log(`Seeded ${result.length} new stocks successfully`);

                // Initialize price history only for new stocks
                let finalStocks;
                if (generateHistoricalData) {
                    finalStocks = await initializePriceHistoryWithInitialValues(result);
                } else {
                    finalStocks = await initializePriceHistoryForStocks(result);
                }

                // Update new stocks with their initialized data
                const bulkOps = finalStocks.map(stock => ({
                    updateOne: {
                        filter: { _id: stock._id },
                        update: { $set: stock }
                    }
                }));

                await Stock.bulkWrite(bulkOps);

                return NextResponse.json({
                    success: true,
                    message: `Successfully processed ${newStocks.length} new stocks`,
                    details: {
                        totalProcessed: newStocks.length,
                        newStocks: newStocks.length,
                        updatedStocks: 0,
                        skippedExisting: validStocks.length - newStocks.length,
                        historicalDataGenerated: generateHistoricalData,
                        clearedDatabase: false,
                        errors: errors.length > 0 ? errors.slice(0, 5) : []
                    }
                });
            } else {
                console.log('No new stocks to add - all stocks already exist in database');
                return NextResponse.json({
                    success: true,
                    message: 'No new stocks to add - all stocks already exist in database',
                    details: {
                        totalProcessed: 0,
                        newStocks: 0,
                        updatedStocks: 0,
                        skippedExisting: validStocks.length,
                        historicalDataGenerated: false,
                        clearedDatabase: false,
                        errors: errors.length > 0 ? errors.slice(0, 5) : []
                    }
                });
            }
        }

    } catch (error) {
        console.error('Stock upload error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process stock data',
                details: error.message
            },
            { status: 500 }
        );
    }
}