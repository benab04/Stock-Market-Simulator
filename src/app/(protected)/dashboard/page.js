'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import TradeForm from '@/components/TradeForm';
import MobileStocksList from '@/components/MobileStocksView';
import { stockCache } from '@/lib/stockCache';

export default function Dashboard() {
    const svgRef = useRef(null);
    const dataRef = useRef({});
    const scaleRef = useRef({});
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [selectedStock, setSelectedStock] = useState('ABINFD');
    const [selectedTimeFrame, setSelectedTimeFrame] = useState('5min');
    const [viewRange, setViewRange] = useState({
        start: null,
        end: null
    });

    // Constants for time windows
    const TIME_WINDOWS = {
        '5min': { hours: 48, candleWidth: 5 },
        '30min': { hours: 48, candleWidth: 12 },
        '2hour': { hours: 48, candleWidth: 20 }
    };
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;




    // Load stocks on mount
    useEffect(() => {
        async function loadStocks() {
            try {
                const response = await fetch('/api/stocks');
                if (!response.ok) {
                    throw new Error('Failed to fetch stocks');
                }
                const stocksData = await response.json();
                setStocks(stocksData);
                setIsLoading(false);
            } catch (error) {
                console.error('Error loading stocks:', error);
                setError('Failed to load stocks');
                setIsLoading(false);
            }
        }

        loadStocks();
    }, []);    // Load historical data when selected stock or timeframe changes
    useEffect(() => {
        async function loadHistoricalData() {
            if (!selectedStock) return;

            try {
                setIsLoading(true);
                setError(null); // Clear any previous errors

                const end = new Date();
                const start = new Date(end.getTime() - (TIME_WINDOWS[selectedTimeFrame].hours * 60 * 60 * 1000));

                setViewRange({ start, end });

                // Try to get data from cache first
                const cachedData = stockCache.get(selectedStock, selectedTimeFrame);
                if (cachedData) {
                    console.log('📦 Using cached data for', selectedStock);
                    dataRef.current[selectedStock] = cachedData;
                    updateChart(selectedStock);
                    setIsLoading(false);
                    return;
                }

                console.log('🌐 Fetching from API for', selectedStock);
                const response = await fetch(
                    `/api/stockHistory?symbol=${selectedStock}&timeframe=${selectedTimeFrame}&start=${start.toISOString()}&end=${end.toISOString()}`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch historical data');
                }

                const historicalData = await response.json();

                if (!historicalData.candles || historicalData.candles.length === 0) {
                    console.warn('No candles data received');
                    setError('No historical data available');
                    setIsLoading(false);
                    return;
                }                // Store the candles data and cache it
                const candles = historicalData.candles;
                dataRef.current[selectedStock] = candles;

                // Cache the new data
                if (candles && candles.length > 0) {
                    stockCache.set(selectedStock, selectedTimeFrame, candles);
                }

                // Update the stocks list with current prices
                setStocks(prevStocks => {
                    const updatedStocks = [...prevStocks];
                    const stockIndex = updatedStocks.findIndex(s => s.symbol === selectedStock);
                    if (stockIndex >= 0) {
                        updatedStocks[stockIndex] = {
                            ...updatedStocks[stockIndex],
                            currentPrice: historicalData.currentPrice
                        };
                    }
                    return updatedStocks;
                });

                // Always update chart after data is loaded
                setTimeout(() => {
                    updateChart(selectedStock);
                    setIsLoading(false);
                }, 300);

            } catch (error) {
                console.error('Error loading historical data:', error);
                setError('Failed to load historical data');
                setIsLoading(false);
            }
        }

        loadHistoricalData();
    }, [selectedStock, selectedTimeFrame]);

    // useEffect(() => {
    //     async function fetchViewRangeData() {
    //         if (!selectedStock || !viewRange.start || !viewRange.end) return;

    //         try {
    //             const { start, end } = viewRange;
    //             const startTime = start.getTime();
    //             const endTime = end.getTime();

    //             // Get existing data for this stock
    //             const existingData = dataRef.current[selectedStock] || [];

    //             // Check if we need data for this range
    //             let needsData = false;

    //             if (existingData.length === 0) {
    //                 needsData = true;
    //             } else {
    //                 const existingTimes = existingData.map(d => new Date(d.startTime).getTime());
    //                 const minExisting = Math.min(...existingTimes);
    //                 const maxExisting = Math.max(...existingTimes);

    //                 needsData = startTime < minExisting || endTime > maxExisting;
    //             }

    //             if (!needsData) {
    //                 console.log('📊 Complete data already exists for view range');
    //                 return;
    //             }

    //             // Check cache
    //             const cachedData = stockCache.get(selectedStock, selectedTimeFrame);
    //             if (cachedData && cachedData.length > 0) {
    //                 const cachedTimes = cachedData.map(d => new Date(d.startTime).getTime());
    //                 const minCached = Math.min(...cachedTimes);
    //                 const maxCached = Math.max(...cachedTimes);

    //                 if (startTime >= minCached && endTime <= maxCached) {
    //                     console.log('📦 Cache covers the view range');
    //                     return;
    //                 }
    //             }

    //             console.log('🌐 Fetching additional data from API for', selectedStock);

    //             const response = await fetch(
    //                 `/api/stockHistory?symbol=${selectedStock}&timeframe=${selectedTimeFrame}&start=${start.toISOString()}&end=${end.toISOString()}`
    //             );

    //             if (!response.ok) {
    //                 throw new Error('Failed to fetch view range data');
    //             }

    //             const rangeData = await response.json();

    //             if (!rangeData.candles || rangeData.candles.length === 0) {
    //                 console.warn('No candles data received for view range');
    //                 return;
    //             }

    //             const newCandles = rangeData.candles;

    //             // Merge with existing data without duplicates
    //             const existingStartTimes = new Set(existingData.map(d => d.startTime));
    //             const uniqueNewCandles = newCandles.filter(candle => !existingStartTimes.has(candle.startTime));

    //             if (uniqueNewCandles.length === 0) {
    //                 console.log('📊 No new unique candles to add');
    //                 return;
    //             }

    //             // Merge and sort
    //             const mergedData = [...existingData, ...uniqueNewCandles];
    //             mergedData.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    //             // Cache the complete merged data
    //             stockCache.set(selectedStock, selectedTimeFrame, mergedData);

    //             // Use updateChartData to update the chart while preserving zoom/pan
    //             updateChartData(selectedStock, mergedData);

    //             console.log(`📈 Added ${uniqueNewCandles.length} new candles to ${selectedStock}, total: ${mergedData.length}`);

    //         } catch (error) {
    //             console.error('Error fetching view range data:', error);
    //         }
    //     }

    //     const timeoutId = setTimeout(fetchViewRangeData, 500);
    //     return () => clearTimeout(timeoutId);
    // }, [viewRange, selectedStock, selectedTimeFrame]);

    // Function to update price indicator in real-time
    const updatePriceIndicator = (currentPrice) => {
        if (!svgRef.current || !selectedStock || !dataRef.current[selectedStock]?.length) {
            console.log('Price indicator update skipped - missing requirements');
            return;
        }

        try {
            const svg = d3.select(svgRef.current).select('g');
            if (!svg.node()) {
                console.log('Price indicator update skipped - no SVG node');
                return;
            }

            const data = dataRef.current[selectedStock];
            const lastCandle = data[data.length - 1];

            // Use current scales (with transform if active)
            const { yScale, width, currentXScale, xScale } = scaleRef.current;
            const activeXScale = currentXScale || xScale;

            if (!activeXScale || !yScale || !width) {
                console.log('Price indicator update skipped - missing scales');
                return;
            }

            // Check if current price line would be visible in current view
            const [visibleStart, visibleEnd] = activeXScale.domain();
            const lastCandleTime = new Date(lastCandle.startTime);

            // Only show price indicator if we're viewing recent data
            if (lastCandleTime < visibleStart) {
                console.log('Price indicator not shown - viewing historical data');
                return;
            }

            console.log('Updating price indicator for', selectedStock, 'with price', currentPrice);

            // Remove existing price indicators
            svg.selectAll('.current-price-line').remove();
            svg.selectAll('.price-label-group').remove();

            const priceLineY = yScale(currentPrice);
            const priceColor = currentPrice >= lastCandle.open ? '#22c55e' : '#ef4444';

            // Check if mobile view
            const isMobile = window.innerWidth < 768;

            // Draw price line
            svg.append('line')
                .attr('class', 'current-price-line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', priceLineY)
                .attr('y2', priceLineY)
                .attr('stroke', priceColor)
                .attr('stroke-width', isMobile ? 1.5 : 1)
                .attr('stroke-dasharray', isMobile ? '3,3' : '2,2')
                .attr('opacity', 0.8);

            // Add price label with mobile-responsive positioning
            const labelOffset = isMobile ? 10 : 25;
            const priceLabel = svg.append('g')
                .attr('class', 'price-label-group')
                .attr('transform', `translate(${width + labelOffset}, ${priceLineY})`);

            const labelText = `₹${currentPrice.toFixed(2)}`;
            const padding = isMobile ? 6 : 8;
            const fontSize = isMobile ? 10 : 12;
            const textWidth = labelText.length * (isMobile ? 6 : 8) + padding * 2;

            // Adjust label positioning if it would go off-screen
            const labelHeight = isMobile ? 20 : 24;
            let adjustedY = 0;

            // Check if label would be cut off at top or bottom
            if (priceLineY < labelHeight / 2) {
                adjustedY = labelHeight / 2 - priceLineY;
            } else if (priceLineY > (scaleRef.current.height || 400) - labelHeight / 2) {
                adjustedY = (scaleRef.current.height || 400) - labelHeight / 2 - priceLineY;
            }

            priceLabel.attr('transform', `translate(${width + labelOffset}, ${priceLineY + adjustedY})`);

            priceLabel.append('rect')
                .attr('x', -padding)
                .attr('y', -(labelHeight / 2))
                .attr('width', textWidth)
                .attr('height', labelHeight)
                .attr('fill', priceColor)
                .attr('rx', isMobile ? 3 : 4)
                .attr('opacity', 0.9);

            priceLabel.append('text')
                .attr('fill', 'white')
                .attr('font-size', `${fontSize}px`)
                .attr('font-weight', 'bold')
                .attr('alignment-baseline', 'middle')
                .attr('text-anchor', 'start')
                .text(labelText);

            // Add mobile-specific touch indicator (small dot at the price line start)
            if (isMobile) {
                svg.append('circle')
                    .attr('class', 'current-price-line')
                    .attr('cx', 0)
                    .attr('cy', priceLineY)
                    .attr('r', 3)
                    .attr('fill', priceColor)
                    .attr('opacity', 0.9);
            }

            console.log('Price indicator updated successfully');
        } catch (error) {
            console.error('Error updating price indicator:', error);
        }
    };
    // Set up real-time updates
    useEffect(() => {
        if (isLoading || !selectedStock) return;

        let eventSource;
        let isMounted = true;

        async function setupSSE() {
            try {
                eventSource = new EventSource('/api/stockData');

                eventSource.onmessage = async (event) => {
                    if (!isMounted) return;

                    const updates = JSON.parse(event.data);

                    // Update all stocks in state
                    setStocks(prevStocks => {
                        return prevStocks.map(stock => {
                            const stockUpdate = updates.find(u => u.symbol === stock.symbol);
                            if (stockUpdate) {
                                return {
                                    ...stock,
                                    currentPrice: stockUpdate.price,
                                    previousPrice: stockUpdate.previousPrice || stock.currentPrice, // Fallback to current if no previous
                                    lastUpdated: Date.now()
                                };
                            }
                            return stock;
                        });
                    });

                    // Only update chart and price indicator for the currently selected stock
                    const selectedStockUpdate = updates.find(u => u.symbol === selectedStock);
                    if (selectedStockUpdate && selectedStock) {
                        try {
                            // Fetch new historical data only for selected stock
                            const response = await fetch(`/api/stockHistory?symbol=${selectedStock}&timeframe=${selectedTimeFrame}`);
                            if (!response.ok) {
                                throw new Error('Failed to fetch historical data');
                            }
                            const historicalData = await response.json();

                            if (historicalData.candles?.length > 0 && isMounted) {
                                // Update chart data for selected stock
                                updateChartData(selectedStock, historicalData.candles);

                                // Update price indicator with a small delay
                                setTimeout(() => {
                                    updatePriceIndicator(selectedStockUpdate.price);
                                }, 50);
                            }
                        } catch (error) {
                            console.error('Error updating historical data for selected stock:', error);
                            // Even if chart update fails, try to update price indicator
                            updatePriceIndicator(selectedStockUpdate.price);
                        }
                    }

                    // Optional: Trigger any callbacks for stock list UI updates
                    if (typeof onStockListUpdate === 'function') {
                        onStockListUpdate(updates);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('SSE error:', error);
                    if (eventSource.readyState === EventSource.CLOSED && isMounted) {
                        console.log('SSE connection closed, attempting to reconnect...');
                        setTimeout(setupSSE, 1000); // Try to reconnect after 1 second
                    }
                };

                // Optional: Add connection opened handler
                eventSource.onopen = () => {
                    console.log('SSE connection established');
                };

            } catch (error) {
                console.error('Error setting up SSE:', error);
                if (isMounted) {
                    setTimeout(setupSSE, 5000); // Try to reconnect after 5 seconds
                }
            }
        }

        // Enhanced cleanup function
        function cleanupSSE() {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        }

        // Call this in your component's cleanup/unmount
        setupSSE();

        return () => {
            isMounted = false;
            // if (eventSource) {
            //     eventSource.close();
            // }
            cleanupSSE();
        };
    }, [isLoading, selectedStock, selectedTimeFrame]);

    const timeFrameButtons = (
        <div className="flex flex-wrap gap-2">
            {[
                { value: '5min', label: '5M', description: '5 Minutes' },
                { value: '30min', label: '30M', description: '30 Minutes' },
                { value: '2hour', label: '2H', description: '2 Hours' },
            ].map((timeFrame) => (
                <button
                    key={timeFrame.value}
                    className={`group relative px-4 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 ${selectedTimeFrame === timeFrame.value
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500/50'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white border border-gray-600/30 hover:border-gray-500/50'
                        }`}
                    onClick={() => setSelectedTimeFrame(timeFrame.value)}
                    title={timeFrame.description}
                >
                    <span className="relative z-10">{timeFrame.label}</span>
                    {selectedTimeFrame === timeFrame.value && (
                        <div className="absolute inset-0 bg-white/10 rounded-lg"></div>
                    )}
                    <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-200 ${selectedTimeFrame === timeFrame.value ? 'w-full' : 'group-hover:w-full'
                        }`}></div>
                </button>
            ))}
        </div>
    );


    const updateChartData = (symbol, newData) => {
        if (!svgRef.current || !scaleRef.current.xScale) {
            console.log('UpdateChartData called but requirements not met');
            return;
        }

        const { currentTransform, currentXScale } = scaleRef.current;
        const activeXScale = currentXScale || scaleRef.current.xScale;

        // Get current visible time range
        const [visibleStart, visibleEnd] = activeXScale.domain();

        // Check if new data falls within visible range
        const newDataInView = newData.filter(candle => {
            const candleTime = new Date(candle.startTime);
            return candleTime >= visibleStart && candleTime <= visibleEnd;
        });

        // Always update stored data
        dataRef.current[symbol] = newData;

        // If no new data in view, still update price indicator but skip chart redraw
        if (newDataInView.length === 0) {
            console.log('New data outside visible range, skipping chart update');
            return;
        }

        const svg = d3.select(svgRef.current).select('g');
        const contentGroup = svg.select('.chart-content');
        const volumeGroup = svg.select('.volume-group');

        if (!contentGroup.node() || !volumeGroup.node()) {
            console.log('Chart groups not found, doing full chart update');
            updateChart(symbol);
            return;
        }

        const candleWidth = TIME_WINDOWS[selectedTimeFrame].candleWidth;
        const { yScale } = scaleRef.current;

        // Update scales domains for new data range
        const maxPrice = d3.max(newData, d => d.high) * 1.001;
        const minPrice = d3.min(newData, d => d.low) * 0.999;
        const pricePadding = (maxPrice - minPrice) * 0.05;

        yScale.domain([minPrice - pricePadding, maxPrice + pricePadding]);

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(newData, d => d.volume) * 1.05])
            .range([100, 0]); // volumeHeight = 100

        // Update candlesticks
        const candlesticks = contentGroup.selectAll('.candlestick')
            .data(newData, d => d.startTime);

        // Remove old candlesticks
        candlesticks.exit().remove();

        // Add new candlesticks
        const newCandlesticks = candlesticks.enter()
            .append('g')
            .attr('class', 'candlestick');

        // Merge existing and new
        const allCandlesticks = newCandlesticks.merge(candlesticks);

        // Update wicks
        allCandlesticks.selectAll('line.wick').remove();
        allCandlesticks.append('line')
            .attr('class', 'wick')
            .attr('x1', d => activeXScale(new Date(d.startTime)))
            .attr('x2', d => activeXScale(new Date(d.startTime)))
            .attr('y1', d => yScale(d.high))
            .attr('y2', d => yScale(d.low))
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444');

        // Update candle bodies
        allCandlesticks.selectAll('rect.candle').remove();
        allCandlesticks.append('rect')
            .attr('class', 'candle')
            .attr('x', d => activeXScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => yScale(Math.max(d.open, d.close)))
            .attr('width', candleWidth)
            .attr('height', d => Math.max(Math.abs(yScale(d.open) - yScale(d.close)), 1))
            .attr('fill', d => d.close >= d.open ? '#22c55e' : '#ef4444');

        // Update volume bars
        const volumeBars = volumeGroup.selectAll('.volume-bar')
            .data(newData, d => d.startTime);

        volumeBars.exit().remove();

        const newVolumeBars = volumeBars.enter()
            .append('rect')
            .attr('class', 'volume-bar');

        newVolumeBars.merge(volumeBars)
            .attr('x', d => activeXScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => volumeScale(d.volume))
            .attr('width', candleWidth)
            .attr('height', d => 100 - volumeScale(d.volume))
            .attr('fill', d => d.close >= d.open ? '#22c55e40' : '#ef444440')
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444')
            .attr('stroke-width', 0.5);

        // Update Y-axis for new price range
        const yAxis = svg.select('.y-axis');
        if (yAxis.node()) {
            yAxis.call(d3.axisLeft(yScale).tickFormat(d => `₹${d.toFixed(2)}`));
        }

        // Update grid
        const yGrid = svg.select('.y-grid');
        if (yGrid.node()) {
            yGrid.call(d3.axisLeft(yScale)
                .ticks(8)
                .tickSize(-scaleRef.current.width)
                .tickFormat('')
            )
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line')
                    .attr('stroke', '#1f2937')
                    .attr('stroke-opacity', 0.1));
        }

        console.log('Chart data updated while preserving zoom/pan state');
    };


    const updateChart = (symbol) => {
        if (!svgRef.current || !dataRef.current[symbol]?.length) {
            console.log('UpdateChart called but missing requirements:', {
                svgRef: !!svgRef.current,
                data: !!dataRef.current[symbol]?.length
            });
            return;
        }

        console.log('Updating chart for', symbol, 'with', dataRef.current[symbol].length, 'data points');

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        // Reset scale reference to avoid stale data - THIS IS THE KEY FIX
        scaleRef.current = {
            currentTransform: null,
            currentXScale: null
        };

        const data = dataRef.current[symbol];
        if (!data || data.length === 0) return;

        // Get the latest timestamp
        const latestTime = d3.max(data, d => new Date(d.startTime));

        // Set initial view to show last 3 hours
        const initialStart = new Date(latestTime - FIVE_HOURS_MS);

        // Set up dimensions with better spacing for price labels
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth < 1024;

        const margin = {
            top: 30,
            right: isMobile ? 60 : 120, // Reduce right margin on mobile
            bottom: isMobile ? 80 : 120, // Reduce bottom margin on mobile
            left: isMobile ? 60 : 80 // Reduce left margin on mobile
        };
        const containerWidth = svgRef.current.clientWidth || (isMobile ? 350 : 1200);
        const width = containerWidth - margin.left - margin.right;

        const height = isMobile ? 300 : 400;
        const volumeHeight = isMobile ? 60 : 100;

        // Use fixed candle width based on timeframe
        const baseCandleWidth = TIME_WINDOWS[selectedTimeFrame].candleWidth;
        const candleWidth = isMobile ? Math.max(baseCandleWidth * 0.7, 3) : baseCandleWidth;

        const maxPrice = d3.max(data, d => d.high) * 1.001;
        const minPrice = d3.min(data, d => d.low) * 0.999;
        const pricePadding = (maxPrice - minPrice) * 0.05;

        // Create main SVG
        const svg = d3.select(svgRef.current)
            .attr('width', '100%')
            .attr('height', height + margin.top + margin.bottom + volumeHeight)
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + volumeHeight}`)
            .style('cursor', 'move')  // ADD THIS LINE
            .style('font-size', isMobile ? '10px' : '12px')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const xScale = d3.scaleTime()
            .domain([initialStart, latestTime])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([minPrice - pricePadding, maxPrice + pricePadding])
            .range([height, 0]);

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.volume) * 1.05])
            .range([volumeHeight, 0]);

        // Store scales for price indicator updates - PROPERLY INITIALIZE
        scaleRef.current = {
            xScale,
            yScale,
            width,
            margin,
            currentTransform: null,
            currentXScale: null
        };

        // Add clip path
        svg.append('defs')
            .append('clipPath')
            .attr('id', 'chart-area')
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height);

        // Create chart group with clip path
        const chartGroup = svg.append('g')
            .attr('clip-path', 'url(#chart-area)');

        // Add gradient background
        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', `chart-gradient-${symbol}`) // Make ID unique
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#1f2937')
            .attr('stop-opacity', 0.3);

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#1f2937')
            .attr('stop-opacity', 0);

        // Add background rectangle
        chartGroup.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', `url(#chart-gradient-${symbol})`);

        // Create chart content group
        const contentGroup = chartGroup.append('g')
            .attr('class', 'chart-content');

        // Add grid lines
        const xGrid = contentGroup.append('g')
            .attr('class', 'x-grid')
            .attr('transform', `translate(0,${height})`);

        const yGrid = contentGroup.append('g')
            .attr('class', 'y-grid');

        // Function to update grid
        const updateGrid = (currentXScale) => {
            const tickCount = isMobile ? 4 : Math.min(12, Math.floor(width / 100));

            xGrid.call(d3.axisBottom(currentXScale)
                .ticks(tickCount)
                .tickSize(-height)
                .tickFormat('')
            )
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line')
                    .attr('stroke', '#1f2937')
                    .attr('stroke-opacity', 0.1));

            yGrid.call(d3.axisLeft(yScale)
                .ticks(isMobile ? 5 : 8)
                .tickSize(-width)
                .tickFormat('')
            )
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line')
                    .attr('stroke', '#1f2937')
                    .attr('stroke-opacity', 0.1));
        };

        // Initial grid setup
        updateGrid(xScale);

        // Add candlesticks
        const candlesticks = contentGroup.selectAll('.candlestick')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'candlestick');

        // Draw wicks
        candlesticks.append('line')
            .attr('class', 'wick')
            .attr('x1', d => xScale(new Date(d.startTime)))
            .attr('x2', d => xScale(new Date(d.startTime)))
            .attr('y1', d => yScale(d.high))
            .attr('y2', d => yScale(d.low))
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444');

        // Draw candle bodies
        candlesticks.append('rect')
            .attr('class', 'candle')
            .attr('x', d => xScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => yScale(Math.max(d.open, d.close)))
            .attr('width', candleWidth)
            .attr('height', d => Math.max(Math.abs(yScale(d.open) - yScale(d.close)), 1))
            .attr('fill', d => d.close >= d.open ? '#22c55e' : '#ef4444');



        // Add volume bars
        const volumeGroup = chartGroup.append('g')
            .attr('class', 'volume-group')
            .attr('transform', `translate(0,${height + 40})`);

        volumeGroup.selectAll('.volume-bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'volume-bar')
            .attr('x', d => xScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => volumeScale(d.volume))
            .attr('width', candleWidth)
            .attr('height', d => volumeHeight - volumeScale(d.volume))
            .attr('fill', d => d.close >= d.open ? '#22c55e40' : '#ef444440')
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444')
            .attr('stroke-width', 0.5);

        // Add axes
        const xAxis = svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        const yAxis = svg.append('g')
            .attr('class', 'y-axis');



        // Function to update axes
        // const updateAxes = (currentXScale) => {
        //     const tickCount = isMobile ? 4 : Math.min(12, Math.floor(width / 100));

        //     xAxis.call(d3.axisBottom(currentXScale)
        //         .ticks(tickCount)
        //         .tickFormat(isMobile ? d3.timeFormat('%H:%M') : d3.timeFormat('%d/%m %H:%M')));

        //     yAxis.call(d3.axisLeft(yScale)
        //         .ticks(isMobile ? 5 : 8)
        //         .tickFormat(d => isMobile ? `₹${d.toFixed(0)}` : `₹${d.toFixed(2)}`));
        // };


        // // Initial axes setup
        // updateAxes(xScale);


        const updateAxes = (currentXScale) => {
            const tickCount = isMobile ? 4 : Math.min(12, Math.floor(width / 100));

            // Get all tick values first to process them in order
            const tickValues = currentXScale.ticks(tickCount);

            // Create a fresh formatter for each update (important for zoom/pan)
            const smartDateFormatter = (d, i) => {
                const currentDate = d3.timeFormat('%d/%m')(d);
                const currentTime = d3.timeFormat('%H:%M')(d);

                // Check if this is the first tick or if date changed from previous
                if (i === 0) {
                    return `${currentDate}\n${currentTime}`;
                }

                // Compare with previous tick in the current tick array
                const prevDate = d3.timeFormat('%d/%m')(tickValues[i - 1]);

                if (currentDate !== prevDate) {
                    return `${currentDate}\n${currentTime}`;
                } else {
                    return currentTime;
                }
            };

            // Use tickValues with explicit formatting to ensure order
            xAxis.call(d3.axisBottom(currentXScale)
                .tickValues(tickValues)
                .tickFormat(smartDateFormatter));

            // Style the x-axis labels for better readability across all devices
            xAxis.selectAll('text')
                .style('font-size', isMobile ? '10px' : '12px')
                .style('text-anchor', 'middle')
                .each(function (d, i) {
                    const text = d3.select(this);
                    const textContent = text.text();

                    // If text contains newline (date + time), split into two lines
                    if (textContent.includes('\n')) {
                        const lines = textContent.split('\n');
                        text.text(''); // Clear original text

                        text.append('tspan')
                            .attr('x', 0)
                            .attr('dy', '0.7em')
                            .style('font-size', isMobile ? '10px' : '12px')
                            .text(lines[1]);

                        text.append('tspan')
                            .attr('x', 0)
                            .attr('dy', '1.6em')
                            .style('font-weight', 'bold')
                            .style('font-size', isMobile ? '9px' : '11px')
                            .style('fill', '#666')
                            .text(lines[0]);

                    }
                });

            yAxis.call(d3.axisLeft(yScale)
                .ticks(isMobile ? 5 : 8)
                .tickFormat(d => isMobile ? `₹${d.toFixed(0)}` : `₹${d.toFixed(2)}`));
        };

        // Fixed implementation that works with zoom/pan
        const updateAxesFixed = (currentXScale) => {
            const tickCount = isMobile ? 4 : Math.min(12, Math.floor(width / 100));

            // Get all tick values first to process them in order
            const tickValues = currentXScale.ticks(tickCount);

            // Create a fresh formatter for each update (important for zoom/pan)
            const smartDateFormatter = (d, i) => {
                const currentDate = d3.timeFormat('%d/%m')(d);
                const currentTime = d3.timeFormat('%H:%M')(d);

                // Check if this is the first tick or if date changed from previous
                if (i === 0) {
                    return `${currentDate}\n${currentTime}`;
                }

                // Compare with previous tick in the current tick array
                const prevDate = d3.timeFormat('%d/%m')(tickValues[i - 1]);

                if (currentDate !== prevDate) {
                    return `${currentDate}\n${currentTime}`;
                } else {
                    return currentTime;
                }
            };

            // Use tickValues with explicit formatting to ensure order
            xAxis.call(d3.axisBottom(currentXScale)
                .tickValues(tickValues)
                .tickFormat(smartDateFormatter));

            // Style the x-axis labels for better readability across all devices
            xAxis.selectAll('text')
                .style('font-size', isMobile ? '10px' : '12px')
                .style('text-anchor', 'middle')
                .each(function (d, i) {
                    const text = d3.select(this);
                    const textContent = text.text();

                    // If text contains newline (date + time), split into two lines
                    if (textContent.includes('\n')) {
                        const lines = textContent.split('\n');
                        text.text(''); // Clear original text

                        text.append('tspan')
                            .attr('x', 0)
                            .attr('dy', '0.7em')
                            .style('font-size', isMobile ? '10px' : '12px')
                            .text(lines[1]);

                        text.append('tspan')
                            .attr('x', 0)
                            .attr('dy', '1.6em')
                            .style('font-weight', 'bold')
                            .style('font-size', isMobile ? '9px' : '11px')
                            .style('fill', '#666')
                            .text(lines[0]);



                    }
                });

            yAxis.call(d3.axisLeft(yScale)
                .ticks(isMobile ? 5 : 8)
                .tickFormat(d => isMobile ? `₹${d.toFixed(0)}` : `₹${d.toFixed(2)}`));
        };
        // Use the main implementation
        updateAxes(xScale);


        // Setup zoom/pan behavior
        const zoom = d3.zoom()
            .scaleExtent([isMobile ? 2 : 0.5, 10])
            .extent([[0, 0], [width, height]])
            .on('zoom', (event) => {

                const transform = event.transform;
                const newXScale = transform.rescaleX(xScale);

                // Update candlesticks position
                contentGroup.selectAll('.candlestick')
                    .selectAll('line.wick')
                    .attr('x1', d => newXScale(new Date(d.startTime)))
                    .attr('x2', d => newXScale(new Date(d.startTime)));

                contentGroup.selectAll('.candlestick')
                    .selectAll('rect.candle')
                    .attr('x', d => newXScale(new Date(d.startTime)) - candleWidth / 2);

                // Update volume bars position
                volumeGroup.selectAll('.volume-bar')
                    .attr('x', d => newXScale(new Date(d.startTime)) - candleWidth / 2);

                // Update axes and grid
                updateAxesFixed(newXScale);
                updateGrid(newXScale);

                // Store the current transform and scale for live updates
                scaleRef.current.currentTransform = transform;
                scaleRef.current.currentXScale = newXScale;
            })
        // .on('end', (event) => {
        //     // Only update viewRange when zoom/pan ends
        //     const transform = event.transform;
        //     const newXScale = transform.rescaleX(xScale);
        //     const visibleStart = newXScale.invert(0);
        //     const visibleEnd = newXScale.invert(width);

        //     setViewRange({
        //         start: visibleStart,
        //         end: visibleEnd
        //     });
        // });

        // Apply zoom behavior to a transparent overlay
        // const overlay = svg.append('rect')
        //     .attr('class', 'zoom-overlay')
        //     .attr('width', width)
        //     .attr('height', height)
        //     .attr('fill', 'transparent')
        //     .attr('cursor', 'move')
        //     .call(zoom);

        // // CRITICAL FIX: Reset zoom to identity transform
        // overlay.call(zoom.transform, d3.zoomIdentity);
        svg.call(zoom);

        // Also reset the stored transform in scaleRef
        scaleRef.current.currentTransform = null;
        scaleRef.current.currentXScale = null;

        // Add tooltip
        const tooltip = d3.select('body')
            .selectAll('.chart-tooltip')
            .data([null])
            .join('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('display', 'none')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '100');

        // Add tooltip behavior
        candlesticks
            .style('cursor', 'crosshair')
            .on('mouseover', (event, d) => {
                const timeStr = new Date(d.startTime).toLocaleTimeString();
                tooltip.style('display', 'block')
                    .html(`
            Time: ${timeStr}<br/>
            Open: ₹${d.open.toFixed(2)}<br/>
            High: ₹${d.high.toFixed(2)}<br/>
            Low: ₹${d.low.toFixed(2)}<br/>
            Close: ₹${d.close.toFixed(2)}<br/>
            Volume: ${d.volume.toLocaleString()}
        `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mousemove', (event) => {
                tooltip.style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', () => {
                tooltip.style('display', 'none');
            });

        console.log('Chart updated successfully for', symbol);

        // Update price indicator if needed
        const stockData = stocks.find(s => s.symbol === symbol);
        if (stockData?.currentPrice) {
            setTimeout(() => {
                updatePriceIndicator(stockData.currentPrice);
            }, 100);
        }
    };


    // useEffect(() => {
    //     const handleScroll = () => {
    //         const scrollY = window.scrollY;
    //         setIsScrolled(scrollY > 0);

    //         // Reset click state when scrolled back to top
    //         if (scrollY === 0) {
    //             setIsHeaderClicked(false);
    //         }
    //     };

    //     window.addEventListener('scroll', handleScroll);
    //     return () => window.removeEventListener('scroll', handleScroll);
    // }, []);


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col lg:flex-row">
            {/* Mobile Header */}
            {/* <div
                className={`lg:hidden bg-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 p-4 z-40  transition-all duration-300 ${isScrolled || isHeaderClicked
                    ? 'fixed top-0 left-0 right-0'
                    : 'fixed top-12 left-0 right-0'
                    }`}
            // onClick={() => setIsHeaderClicked(!isHeaderClicked)}
            >
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Stock Dashboard
                    </h1>
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the header click
                            setMobileMenuOpen(!mobileMenuOpen);
                            setIsHeaderClicked(!isHeaderClicked);
                        }}
                        className="lg:hidden p-2 rounded-lg bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-600/50 transition-all duration-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div> */}

            {/* Sidebar */}
            <div className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-40 w-80 lg:w-64 xl:w-72 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 transition-transform duration-300 ease-in-out h-full lg:h-screen flex flex-col`}>
                <div className="p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
                    <div className="hidden lg:block mb-6">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                            Stock Dashboard
                        </h2>
                        <p className="text-gray-400 text-sm">Live market data</p>
                    </div>

                    <div className="space-y-3">
                        {stocks.map((stock) => {
                            const isSelected = selectedStock === stock.symbol;
                            const priceChange = stock.currentPrice - (stock.previousPrice || 0);
                            const isPositive = priceChange >= 0;

                            return (
                                <button
                                    key={stock.symbol}
                                    onClick={() => {
                                        setSelectedStock(stock.symbol);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 border backdrop-blur-sm group hover:scale-[1.02] ${isSelected
                                        ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10'
                                        : 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50 hover:border-gray-600/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className={`font-semibold text-lg ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                                {stock.symbol}
                                            </span>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {stock.name || 'Stock Name'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                                ₹{stock.currentPrice?.toFixed(2) || '0.00'}
                                            </div>
                                            <div className={`text-xs flex items-center justify-end ${isPositive ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                <svg className={`w-3 h-3 mr-1 ${isPositive ? 'rotate-0' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 4.414 6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                                {Math.abs(priceChange).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-600/30 rounded-full h-1">
                                        <div
                                            className={`h-1 rounded-full transition-all duration-500 ${isSelected ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-500'
                                                }`}
                                            style={{ width: isSelected ? '100%' : '0%' }}
                                        ></div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {mobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
                    onClick={() => setMobileMenuOpen(false)}
                ></div>
            )}

            {/* Main content */}
            <div className="flex-1 p-2 lg:p-8 overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center h-[calc(100vh-8rem)] lg:h-screen">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 lg:h-20 lg:w-20 border-4 border-gray-600"></div>
                            <div className="animate-spin rounded-full h-16 w-16 lg:h-20 lg:w-20 border-t-4 border-blue-500 absolute top-0 left-0"></div>
                        </div>
                        <p className="text-gray-400 mt-4 text-sm lg:text-base">Loading market data...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col justify-center items-center h-[calc(100vh-8rem)] lg:h-screen">
                        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center max-w-md">
                            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <h3 className="text-red-400 font-semibold mb-2">Error Loading Data</h3>
                            <p className="text-gray-400 text-sm">{error}</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 lg:space-y-8 h-full">
                        {/* Header */}
                        {/* <div className="hidden lg:block">
                            <h1 className="text-3xl xl:text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent mb-2">
                                Stock Market Dashboard
                            </h1>
                            <p className="text-gray-400">Real-time market analysis and trading</p>
                        </div> */}

                        {/* Chart and Trade Form Section */}
                        <div className="flex-1 flex flex-col xl:flex-row gap-4 lg:gap-8 min-h-0">
                            {/* Chart Section */}
                            <div className="flex-1 bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl flex flex-col min-h-0">
                                <div className="p-3 lg:p-6 border-b border-gray-700/50">
                                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-6">
                                            <h2 className="text-xl lg:text-2xl text-white font-semibold flex items-center">
                                                {selectedStock ? (
                                                    <>
                                                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                                            {selectedStock}
                                                        </span>
                                                        <span className="ml-3 text-sm lg:text-base text-gray-400">
                                                            ₹{stocks.find(s => s.symbol === selectedStock)?.currentPrice?.toFixed(2) || '0.00'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-400">Select a Stock</span>
                                                )}
                                            </h2>
                                            <div className="flex flex-wrap gap-2">
                                                <div className="px-3 py-1 bg-gray-700/50 rounded-full text-xs text-gray-400 flex items-center">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                                    Live Updates
                                                </div>
                                                <div className="px-3 py-1 bg-blue-700/30 border border-blue-600/30 rounded-full text-xs text-blue-300">
                                                    Interactive Chart
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {timeFrameButtons}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 p-2 sm:p-1 lg:p-6  min-h-0">
                                    {selectedStock ? (
                                        <div className="h-full flex flex-col">
                                            <div className="flex-1 min-h-0 relative">
                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 to-transparent rounded-xl"></div>
                                                <div className="relative h-full overflow-hidden rounded-xl">
                                                    <svg
                                                        ref={svgRef}
                                                        className="w-full h-full"
                                                        style={{
                                                            minHeight: window.innerWidth < 768 ? '350px' : window.innerWidth < 1024 ? '450px' : '500px',
                                                            fontSize: window.innerWidth < 768 ? '10px' : '12px'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col justify-center items-center h-full text-center">
                                            <div className="mb-6">
                                                <svg className="w-16 h-16 lg:w-20 lg:w-20 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-xl lg:text-2xl font-semibold text-gray-400 mb-2">
                                                Select a Stock
                                            </h3>
                                            <p className="text-gray-500 max-w-md">
                                                Choose a stock from the sidebar to view its chart and start trading
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Trade Form Section - Now on the right */}
                            {selectedStock && (
                                <div className="xl:w-70 xl:flex-shrink-0">
                                    <TradeForm
                                        stock={stocks.find(s => s.symbol === selectedStock)}
                                        onTrade={(data) => {
                                            console.log('Trade executed:', data);
                                        }}
                                    />
                                    {/* Mobile Stocks List - appears below TradeForm on mobile */}
                                    <MobileStocksList
                                        stocks={stocks}
                                        selectedStock={selectedStock}
                                        onStockSelect={setSelectedStock}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}