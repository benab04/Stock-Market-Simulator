'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import TradeForm from '@/components/TradeForm';

export default function Dashboard() {
    const svgRef = useRef(null);
    const dataRef = useRef({});
    const scaleRef = useRef({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [selectedStock, setSelectedStock] = useState('HDFCBANK');
    const [selectedTimeFrame, setSelectedTimeFrame] = useState('5min');
    const [viewRange, setViewRange] = useState({
        start: null,
        end: null
    });

    const stockUpdateRoute = process.env.NEXT_PUBLIC_STOCK_UPDATE_ROUTE || '/api/stockData';

    // Constants for time windows
    const TIME_WINDOWS = {
        '5min': { hours: 2, candleWidth: 10 },
        '30min': { hours: 12, candleWidth: 15 },
        '2hour': { hours: 48, candleWidth: 20 }
    };

    // Function to fetch data for a specific time range
    const fetchDataForRange = async (symbol, timeframe, start, end) => {
        try {
            const response = await fetch(
                `/api/stockHistory?symbol=${symbol}&timeframe=${timeframe}&start=${start.toISOString()}&end=${end.toISOString()}`
            );
            if (!response.ok) {
                throw new Error('Failed to fetch historical data');
            }
            const data = await response.json();
            return data.candles || [];
        } catch (error) {
            console.error('Error fetching range data:', error);
            return [];
        }
    };

    // Function to merge new data with existing data without duplicates
    const mergeData = (existingData, newData) => {
        const allData = [...existingData];
        newData.forEach(newCandle => {
            if (!allData.some(existing => existing.startTime === newCandle.startTime)) {
                allData.push(newCandle);
            }
        });
        return allData.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    };

    const isDataInCurrentView = (newData, currentTransform, xScale) => {
        if (!currentTransform || !newData.length) return false;

        const currentXScale = currentTransform.rescaleX(xScale);
        const viewDomain = currentXScale.domain();
        const newDataTime = new Date(newData[newData.length - 1].startTime);

        return newDataTime >= viewDomain[0] && newDataTime <= viewDomain[1];
    };


    const updateChartData = (symbol, newCandles) => {
        if (!svgRef.current || !dataRef.current[symbol]) return;

        const svg = d3.select(svsgRef.current).select('g');
        const { xScale, yScale, currentTransform, currentXScale } = scaleRef.current;

        // Use current scale or original scale
        const activeXScale = currentXScale || xScale;
        const candleWidth = TIME_WINDOWS[selectedTimeFrame].candleWidth;

        // Update candlesticks
        const candlesticks = svg.select('.chart-content')
            .selectAll('.candlestick')
            .data(newCandles, d => d.startTime);

        // Enter new candlesticks
        const enterGroup = candlesticks.enter()
            .append('g')
            .attr('class', 'candlestick');

        enterGroup.append('line')
            .attr('class', 'wick');

        enterGroup.append('rect')
            .attr('class', 'candle');

        // Update all candlesticks (existing + new)
        const allCandlesticks = enterGroup.merge(candlesticks);

        allCandlesticks.select('line.wick')
            .attr('x1', d => activeXScale(new Date(d.startTime)))
            .attr('x2', d => activeXScale(new Date(d.startTime)))
            .attr('y1', d => yScale(d.high))
            .attr('y2', d => yScale(d.low))
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444');

        allCandlesticks.select('rect.candle')
            .attr('x', d => activeXScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => yScale(Math.max(d.open, d.close)))
            .attr('width', candleWidth)
            .attr('height', d => Math.max(Math.abs(yScale(d.open) - yScale(d.close)), 1))
            .attr('fill', d => d.close >= d.open ? '#22c55e' : '#ef4444');

        // Update volume bars similarly
        const volumeGroup = svg.select('.volume-group');
        const volumeScale = scaleRef.current.volumeScale;

        const volumeBars = volumeGroup.selectAll('.volume-bar')
            .data(newCandles, d => d.startTime);

        const enterVolume = volumeBars.enter()
            .append('rect')
            .attr('class', 'volume-bar');

        enterVolume.merge(volumeBars)
            .attr('x', d => activeXScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => volumeScale(d.volume))
            .attr('width', candleWidth)
            .attr('height', d => volumeScale.range()[0] - volumeScale(d.volume))
            .attr('fill', d => d.close >= d.open ? '#22c55e40' : '#ef444440')
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444')
            .attr('stroke-width', 0.5);

        // Remove old candlesticks that are no longer in data
        candlesticks.exit().remove();
        volumeBars.exit().remove();
    };


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
    }, []);

    // Load historical data when selected stock or timeframe changes
    useEffect(() => {
        async function loadHistoricalData() {
            try {
                setIsLoading(true);
                const end = new Date();
                const start = new Date(end.getTime() - (TIME_WINDOWS[selectedTimeFrame].hours * 60 * 60 * 1000));

                setViewRange({ start, end });

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
                    return;
                }

                // Store the candles data
                dataRef.current[selectedStock] = historicalData.candles;

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

                if (selectedStock) {
                    updateChart(selectedStock);
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error loading historical data:', error);
                setError('Failed to load historical data');
                setIsLoading(false);
            }
        }

        if (selectedStock) {
            loadHistoricalData();
        }
    }, [selectedStock, selectedTimeFrame]);

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

            // Use existing scales from the chart
            const { xScale, yScale, width, margin } = scaleRef.current;
            if (!xScale || !yScale || !width) {
                console.log('Price indicator update skipped - missing scales');
                return;
            }

            console.log('Updating price indicator for', selectedStock, 'with price', currentPrice);

            // Remove existing price indicators
            svg.selectAll('.current-price-line').remove();
            svg.selectAll('.price-label-group').remove();

            const priceLineY = yScale(currentPrice);
            const priceColor = currentPrice >= lastCandle.open ? '#22c55e' : '#ef4444';

            // Draw price line
            svg.append('line')
                .attr('class', 'current-price-line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', priceLineY)
                .attr('y2', priceLineY)
                .attr('stroke', priceColor)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .attr('opacity', 0.8);

            // Add price label with better positioning
            const priceLabel = svg.append('g')
                .attr('class', 'price-label-group')
                .attr('transform', `translate(${width + 25}, ${priceLineY})`);

            // Add background rectangle
            const labelText = `₹${currentPrice.toFixed(2)}`;
            const padding = 8;
            const textWidth = labelText.length * 8 + padding * 2;

            priceLabel.append('rect')
                .attr('x', -padding)
                .attr('y', -12)
                .attr('width', textWidth)
                .attr('height', 24)
                .attr('fill', priceColor)
                .attr('rx', 4)
                .attr('opacity', 0.9);

            // Add text
            priceLabel.append('text')
                .attr('fill', 'white')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('alignment-baseline', 'middle')
                .attr('text-anchor', 'start')
                .text(labelText);

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
                eventSource = new EventSource(stockUpdateRoute);

                eventSource.onmessage = async (event) => {
                    if (!isMounted) return;

                    const updates = JSON.parse(event.data);
                    const stockUpdate = updates.find(u => u.symbol === selectedStock);

                    if (stockUpdate) {
                        // Update current prices in state
                        setStocks(prevStocks => {
                            return prevStocks.map(stock => {
                                if (stock.symbol === stockUpdate.symbol) {
                                    return {
                                        ...stock,
                                        currentPrice: stockUpdate.price
                                    };
                                }
                                return stock;
                            });
                        });

                        // Fetch new historical data
                        try {
                            const response = await fetch(`/api/stockHistory?symbol=${selectedStock}&timeframe=${selectedTimeFrame}`);
                            if (!response.ok) {
                                throw new Error('Failed to fetch historical data');
                            }
                            const historicalData = await response.json();

                            if (historicalData.candles?.length > 0 && isMounted) {
                                const newCandles = historicalData.candles;
                                const oldCandles = dataRef.current[selectedStock] || [];

                                // Check if we need to update the chart or just store data
                                const { currentTransform, xScale } = scaleRef.current;
                                const shouldUpdateChart = !currentTransform || isDataInCurrentView(newCandles, currentTransform, xScale);

                                // Always update stored data
                                dataRef.current[selectedStock] = newCandles;

                                if (shouldUpdateChart) {
                                    // Update chart preserving zoom/pan
                                    updateChartData(selectedStock, newCandles);

                                    // Update price indicator
                                    setTimeout(() => {
                                        updatePriceIndicator(stockUpdate.price);
                                    }, 50);
                                } else {
                                    // Just update price indicator without chart redraw
                                    updatePriceIndicator(stockUpdate.price);
                                }
                            }
                        } catch (error) {
                            console.error('Error updating historical data:', error);
                            // Still update price indicator
                            updatePriceIndicator(stockUpdate.price);
                        }
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('SSE error:', error);
                    if (eventSource.readyState === EventSource.CLOSED && isMounted) {
                        setTimeout(setupSSE, 5000); // Try to reconnect after 5 seconds
                    }
                };
            } catch (error) {
                console.error('Error setting up SSE:', error);
                if (isMounted) {
                    setTimeout(setupSSE, 5000); // Try to reconnect after 5 seconds
                }
            }
        }

        setupSSE();

        return () => {
            isMounted = false;
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [isLoading, selectedStock, selectedTimeFrame]);

    const timeFrameButtons = (
        <div className="flex space-x-2 mb-4">
            <button
                className={`px-4 py-2 rounded ${selectedTimeFrame === '5min' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setSelectedTimeFrame('5min')}
            >
                5 Min
            </button>
            <button
                className={`px-4 py-2 rounded ${selectedTimeFrame === '30min' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setSelectedTimeFrame('30min')}
            >
                30 Min
            </button>
            <button
                className={`px-4 py-2 rounded ${selectedTimeFrame === '2hour' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setSelectedTimeFrame('2hour')}
            >
                2 Hour
            </button>
        </div>
    );

    const updateChart = (symbol) => {
        if (!svgRef.current || !dataRef.current[symbol]?.length) return;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();
        const data = dataRef.current[symbol];

        // Set up dimensions with better spacing for price labels
        const margin = { top: 30, right: 120, bottom: 120, left: 80 };
        const containerWidth = svgRef.current.clientWidth || 1200;
        const width = containerWidth - margin.left - margin.right;
        const height = 400;
        const volumeHeight = 100;

        // Use fixed candle width based on timeframe
        const candleWidth = TIME_WINDOWS[selectedTimeFrame].candleWidth;

        const maxPrice = d3.max(data, d => d.high) * 1.001;
        const minPrice = d3.min(data, d => d.low) * 0.999;
        const pricePadding = (maxPrice - minPrice) * 0.05;

        // Create main SVG
        const svg = d3.select(svgRef.current)
            .attr('width', '100%')
            .attr('height', height + margin.top + margin.bottom + volumeHeight)
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + volumeHeight}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => new Date(d.startTime)))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([minPrice - pricePadding, maxPrice + pricePadding])
            .range([height, 0]);

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.volume) * 1.05])
            .range([volumeHeight, 0]);

        // Store scales for price indicator updates
        scaleRef.current = { xScale, yScale, width, margin };

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
            .attr('id', 'chart-gradient')
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
            .attr('fill', 'url(#chart-gradient)');

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
            xGrid.call(d3.axisBottom(currentXScale)
                .ticks(Math.min(12, Math.floor(width / 100)))
                .tickSize(-height)
                .tickFormat('')
            )
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line')
                    .attr('stroke', '#1f2937')
                    .attr('stroke-opacity', 0.1));

            yGrid.call(d3.axisLeft(yScale)
                .ticks(8)
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
        const updateAxes = (currentXScale) => {
            xAxis.call(d3.axisBottom(currentXScale)
                .ticks(Math.min(12, Math.floor(width / 100)))
                .tickFormat(d3.timeFormat('%H:%M')));

            yAxis.call(d3.axisLeft(yScale)
                .tickFormat(d => `₹${d.toFixed(2)}`));
        };

        // Initial axes setup
        updateAxes(xScale);

        // Setup zoom/pan behavior - FIXED VERSION
        const zoom = d3.zoom()
            .scaleExtent([0.5, 10])
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

                contentGroup.selectAll('.volume-bar')
                    .attr('x', d => newXScale(new Date(d.startTime)) - candleWidth / 2);

                updateAxes(newXScale);
                updateGrid(newXScale);

                // Store the current transform
                scaleRef.current.currentTransform = transform;
                scaleRef.current.currentXScale = newXScale;

                // Check if we need to fetch data for the new view area
                const viewDomain = newXScale.domain();
                const currentData = dataRef.current[selectedStock] || [];
                const dataTimeRange = currentData.length > 0 ? [
                    new Date(currentData[0].startTime),
                    new Date(currentData[currentData.length - 1].startTime)
                ] : [null, null];

                // If panned outside current data range, fetch more data
                if (currentData.length > 0 &&
                    (viewDomain[0] < dataTimeRange[0] || viewDomain[1] > dataTimeRange[1])) {
                    // Debounce the fetch to avoid too many requests
                    clearTimeout(scaleRef.current.fetchTimeout);
                    scaleRef.current.fetchTimeout = setTimeout(async () => {
                        try {
                            const expandedStart = new Date(Math.min(viewDomain[0], dataTimeRange[0]).getTime() - (60000 * 30)); // 30 min buffer
                            const expandedEnd = new Date(Math.max(viewDomain[1], dataTimeRange[1]).getTime() + (60000 * 30));

                            const newData = await fetchDataForRange(selectedStock, selectedTimeFrame, expandedStart, expandedEnd);
                            if (newData.length > 0) {
                                const mergedData = mergeData(currentData, newData);
                                dataRef.current[selectedStock] = mergedData;
                                updateChartData(selectedStock, mergedData);
                            }
                        } catch (error) {
                            console.error('Error fetching expanded data range:', error);
                        }
                    }, 500);
                }
            });

        // Apply zoom behavior to a transparent overlay
        const overlay = svg.append('rect')
            .attr('class', 'zoom-overlay')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'transparent')
            .attr('cursor', 'move')
            .call(zoom);

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
        candlesticks.on('mouseover', (event, d) => {
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

        // Update price indicator if needed
        if (stocks.find(s => s.symbol === symbol)?.currentPrice) {
            updatePriceIndicator(stocks.find(s => s.symbol === symbol).currentPrice);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex">
            {/* Sidebar */}
            <div className="w-64 bg-gray-800 p-6">
                <h2 className="text-xl font-bold text-white mb-6">Stocks</h2>
                <div className="space-y-2">
                    {stocks.map((stock) => (
                        <button
                            key={stock.symbol}
                            onClick={() => setSelectedStock(stock.symbol)}
                            className={`w-full text-left px-4 py-2 rounded 
                                ${selectedStock === stock.symbol
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span>{stock.symbol}</span>
                                <span className={`text-sm ${stock.currentPrice > (stock.previousClose || 0)
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                    }`}>
                                    ₹{stock.currentPrice?.toFixed(2)}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-8">
                {isLoading ? (
                    <div className="flex justify-center items-center h-screen">
                        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-center">{error}</div>
                ) : (
                    <div className="space-y-8">
                        <h1 className="text-3xl font-bold text-white">Stock Price Dashboard</h1>

                        <div className="grid grid-cols-1 gap-8">
                            <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center space-x-6">
                                        <h2 className="text-xl text-white font-semibold">
                                            {selectedStock ? selectedStock : 'Select a Stock'}
                                        </h2>
                                        <div className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-400">
                                            Updates every 30s
                                        </div>
                                        <div className="px-3 py-1 bg-blue-700 rounded text-sm text-blue-200">
                                            Click and drag to pan • Scroll to zoom
                                        </div>
                                    </div>
                                    {timeFrameButtons}
                                </div>

                                {selectedStock ? (
                                    <div>
                                        <div className="relative overflow-x-auto">
                                            <svg ref={svgRef} className="w-full h-[600px]" />
                                        </div>
                                        <TradeForm
                                            stock={stocks.find(s => s.symbol === selectedStock)}
                                            onTrade={(data) => {
                                                console.log('Trade executed:', data);
                                                // You could update user balance here if needed
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex justify-center items-center h-96 text-gray-400">
                                        Select a stock to view chart
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}