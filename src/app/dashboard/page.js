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
    const [selectedStock, setSelectedStock] = useState(null);
    const [selectedTimeFrame, setSelectedTimeFrame] = useState('5min');

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
                console.log('Loading historical data for:', selectedStock, selectedTimeFrame);
                const response = await fetch(`/api/stockHistory?symbol=${selectedStock}&timeframe=${selectedTimeFrame}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch historical data');
                }
                const historicalData = await response.json();
                console.log('Received historical data:', historicalData);

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
                    console.log('Updating chart with data:', dataRef.current[selectedStock]);
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
                eventSource = new EventSource('/api/stockData');

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

                        // Fetch new historical data to update the chart
                        try {
                            const response = await fetch(`/api/stockHistory?symbol=${selectedStock}&timeframe=${selectedTimeFrame}`);
                            if (!response.ok) {
                                throw new Error('Failed to fetch historical data');
                            }
                            const historicalData = await response.json();

                            if (historicalData.candles?.length > 0 && isMounted) {
                                // Update the stored candles data
                                dataRef.current[selectedStock] = historicalData.candles;
                                // Update the chart with new data
                                updateChart(selectedStock);

                                // IMPORTANT: Update price indicator AFTER chart redraw
                                // Use setTimeout to ensure it runs after the chart rendering is complete
                                setTimeout(() => {
                                    updatePriceIndicator(stockUpdate.price);
                                }, 50);
                            }
                        } catch (error) {
                            console.error('Error updating historical data:', error);
                            // Even if chart update fails, try to update price indicator
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

        // Calculate optimal candle width based on available space and data length
        const containerWidth = svgRef.current.clientWidth || 1200;
        const availableWidth = containerWidth - margin.left - margin.right;
        const totalCandles = data.length;

        // Calculate candle width to fill the available space
        const spacing = 2; // Space between candles
        const candleWidth = Math.max(3, Math.min(20, (availableWidth - (totalCandles * spacing)) / totalCandles));

        // Calculate final width based on candle requirements
        const width = Math.max(availableWidth, totalCandles * (candleWidth + spacing));
        const height = 400;
        const volumeHeight = 100;

        const maxPrice = d3.max(data, d => d.high) * 1.001;
        const minPrice = d3.min(data, d => d.low) * 0.999;
        const pricePadding = (maxPrice - minPrice) * 0.05;

        // Create SVG with updated dimensions
        const svg = d3.select(svgRef.current)
            .attr('width', '100%')
            .attr('height', height + margin.top + margin.bottom + volumeHeight)
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + volumeHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales with better time distribution
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => new Date(d.startTime)))
            .range([candleWidth / 2, width - candleWidth / 2]); // Adjust range to center candles

        const yScale = d3.scaleLinear()
            .domain([minPrice - pricePadding, maxPrice + pricePadding])
            .range([height, 0])
            .nice();

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.volume) * 1.05])
            .range([volumeHeight, 0])
            .nice();

        // Store scales for price indicator updates
        scaleRef.current = { xScale, yScale, width, margin };

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
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'url(#chart-gradient)');

        // Add grid
        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .ticks(Math.min(12, Math.floor(width / 100)))
                .tickSize(-height)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke', '#1f2937')
                .attr('stroke-opacity', 0.1)
                .attr('stroke-width', 1));

        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .ticks(8)
                .tickSize(-width)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke', '#1f2937')
                .attr('stroke-opacity', 0.1)
                .attr('stroke-width', 1));

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .attr('class', 'text-xs')
            .call(d3.axisBottom(xScale)
                .ticks(Math.min(12, Math.floor(width / 100)))
                .tickFormat(d3.timeFormat('%H:%M')))
            .selectAll('text')
            .style('fill', '#9ca3af')
            .attr('transform', 'rotate(-45)')
            .attr('text-anchor', 'end')
            .attr('dy', '0.5em');

        svg.append('g')
            .attr('class', 'text-xs')
            .call(d3.axisLeft(yScale)
                .tickFormat(d => `₹${d.toFixed(2)}`))
            .selectAll('text')
            .style('fill', '#9ca3af');

        // Draw volume bars
        const volumeGroup = svg.append('g')
            .attr('transform', `translate(0,${height + 40})`);

        // Add volume title
        volumeGroup.append('text')
            .attr('x', -margin.left)
            .attr('y', -10)
            .attr('fill', '#9ca3af')
            .attr('font-size', '11px')
            .text('Volume');

        // Draw volume bars with consistent spacing
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

        // Draw candlesticks with consistent spacing
        const candlesticks = svg.selectAll('.candlestick')
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
            .attr('stroke', d => d.close >= d.open ? '#22c55e' : '#ef4444')
            .attr('stroke-width', 1);

        // Draw candle bodies
        candlesticks.append('rect')
            .attr('class', 'candle')
            .attr('x', d => xScale(new Date(d.startTime)) - candleWidth / 2)
            .attr('y', d => yScale(Math.max(d.open, d.close)))
            .attr('width', candleWidth)
            .attr('height', d => Math.max(
                Math.abs(yScale(d.open) - yScale(d.close)),
                1
            ))
            .attr('fill', d => d.close >= d.open ? '#22c55e' : '#ef4444')
            .attr('stroke', d => d.close >= d.open ? '#16a34a' : '#dc2626')
            .attr('stroke-width', 1)
            .attr('rx', 0.5);

        // Add tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'absolute hidden bg-gray-900 text-white p-2 rounded shadow-lg text-xs')
            .style('pointer-events', 'none');

        candlesticks.on('mouseover', (event, d) => {
            tooltip
                .style('display', 'block')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .html(`
                    <div class="space-y-1">
                        <div class="font-semibold">${new Date(d.startTime).toLocaleTimeString()}</div>
                        <div>O: ₹${d.open.toFixed(2)}</div>
                        <div>H: ₹${d.high.toFixed(2)}</div>
                        <div>L: ₹${d.low.toFixed(2)}</div>
                        <div>C: ₹${d.close.toFixed(2)}</div>
                        <div>Vol: ${d.volume.toLocaleString()}</div>
                    </div>
                `);
        })
            .on('mouseout', () => {
                tooltip.style('display', 'none');
            });

        // Draw current price indicator - this will be called at the end of chart creation
        const currentStock = stocks.find(s => s.symbol === symbol);
        const currentPrice = currentStock?.currentPrice;
        if (currentPrice) {
            // Use setTimeout to ensure the price indicator is drawn after all other elements
            setTimeout(() => {
                updatePriceIndicator(currentPrice);
            }, 10);
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