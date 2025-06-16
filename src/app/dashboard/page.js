'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function Dashboard() {
    const svgRef = useRef(null);
    const [selectedStock, setSelectedStock] = useState('ABINFD');
    const [stocks, setStocks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const dataRef = useRef({});

    // Load historical data first
    useEffect(() => {
        async function loadHistoricalData() {
            try {
                const response = await fetch('/api/stockHistory');
                if (!response.ok) {
                    throw new Error('Failed to fetch historical data');
                }
                const historicalData = await response.json();

                // Initialize data for all stocks
                const initialStocks = historicalData.map(stock => ({
                    symbol: stock.symbol,
                    currentPrice: stock.currentPrice,
                    netOrderQuantity: 0
                }));
                setStocks(initialStocks);

                // Initialize price history for all stocks
                historicalData.forEach(stock => {
                    dataRef.current[stock.symbol] = stock.priceHistory;
                });

                // Update initial chart
                if (selectedStock) {
                    updateChart(selectedStock);
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error loading historical data:', error);
                setError(error.message);
                setIsLoading(false);
            }
        }

        loadHistoricalData();
    }, []); // Run once on component mount

    // Set up real-time updates only after historical data is loaded
    useEffect(() => {
        if (isLoading) return; // Don't set up SSE until historical data is loaded

        // Set up SSE connection
        const eventSource = new EventSource('/api/stockData');

        eventSource.onmessage = (event) => {
            const updates = JSON.parse(event.data);
            console.log('Received updates:', updates);

            // Update data for all stocks
            updates.forEach(update => {
                dataRef.current[update.symbol] = [...(dataRef.current[update.symbol] || []), update.priceHistory].slice(-20);
            });

            // Update stocks list if needed
            setStocks(prevStocks => {
                const newStocks = updates.map(u => ({
                    symbol: u.symbol,
                    currentPrice: u.price,
                    netOrderQuantity: u.netOrderQuantity
                }));
                return newStocks;
            });

            // Update chart if the selected stock was updated
            if (selectedStock && dataRef.current[selectedStock]) {
                updateChart(selectedStock);
            }
        };

        // Cleanup SSE connection
        return () => eventSource.close();
    }, [isLoading, selectedStock]); // Depend on isLoading and selectedStock

    const updateChart = (symbol) => {
        if (!svgRef.current || !dataRef.current[symbol]?.length) return;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        const data = dataRef.current[symbol];

        // Set up dimensions with better spacing
        const margin = { top: 20, right: 60, bottom: 100, left: 80 };
        const width = 1000 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;
        const volumeHeight = 80;

        // Create SVG with better dimensions
        const svg = d3.select(svgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom + volumeHeight)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create tooltip with better styling
        const tooltip = d3.select('body').append('div')
            .attr('class', 'absolute hidden bg-gray-800 text-white p-3 rounded-lg shadow-xl text-sm border border-gray-700')
            .style('pointer-events', 'none')
            .style('z-index', 100);

        // Calculate price range with padding
        const priceExtent = d3.extent(data, d => [d.low, d.high]).flat();
        const priceRange = priceExtent[1] - priceExtent[0];
        const pricePadding = priceRange * 0.1;

        // Set up scales with better padding
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => new Date(d.timestamp)))
            .range([0, width])
            .nice();

        const yScale = d3.scaleLinear()
            .domain([priceExtent[0] - pricePadding, priceExtent[1] + pricePadding])
            .range([height, 0])
            .nice();

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.volume) * 1.1])
            .range([volumeHeight, 0])
            .nice();

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

        // Add grid lines with better styling
        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .ticks(10)
                .tickSize(-height)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke', '#374151')
                .attr('stroke-dasharray', '2,2'));

        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .ticks(10)
                .tickSize(-width)
                .tickFormat('')
            )
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke', '#374151')
                .attr('stroke-dasharray', '2,2'));

        // Add axes with better styling
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .attr('class', 'text-xs')
            .call(d3.axisBottom(xScale)
                .tickFormat(d3.timeFormat('%H:%M:%S')))
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

        // Draw volume bars with better styling
        const volumeGroup = svg.append('g')
            .attr('transform', `translate(0,${height + 20})`);

        volumeGroup.selectAll('.volume-bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'volume-bar')
            .attr('x', d => xScale(new Date(d.timestamp)) - 4)
            .attr('y', d => volumeScale(d.volume))
            .attr('width', 8)
            .attr('height', d => volumeHeight - volumeScale(d.volume))
            .attr('fill', d => d.open > d.close ? '#ef444480' : '#22c55e80')
            .attr('rx', 2); // Rounded corners

        // Volume axis with better styling
        volumeGroup.append('g')
            .attr('class', 'text-xs')
            .call(d3.axisLeft(volumeScale)
                .ticks(3)
                .tickFormat(d => d3.format('.2s')(d)))
            .selectAll('text')
            .style('fill', '#9ca3af');

        // Draw candlesticks with better styling
        const candlesticks = svg.selectAll('.candlestick')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'candlestick');

        // Draw wicks with better styling
        candlesticks.append('line')
            .attr('x1', d => xScale(new Date(d.timestamp)))
            .attr('x2', d => xScale(new Date(d.timestamp)))
            .attr('y1', d => yScale(d.high))
            .attr('y2', d => yScale(d.low))
            .attr('stroke', d => d.open > d.close ? '#ef4444' : '#22c55e')
            .attr('stroke-width', 1.5);

        // Draw bodies with better styling
        candlesticks.append('rect')
            .attr('x', d => xScale(new Date(d.timestamp)) - 5)
            .attr('y', d => yScale(Math.max(d.open, d.close)))
            .attr('width', 10)
            .attr('height', d => Math.abs(yScale(d.open) - yScale(d.close)) || 1)
            .attr('fill', d => d.open > d.close ? '#ef4444' : '#22c55e')
            .attr('stroke', d => d.open > d.close ? '#ef4444' : '#22c55e')
            .attr('stroke-width', 1)
            .attr('rx', 1) // Slightly rounded corners
            .on('mouseover', (event, d) => {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.95)
                    .style('display', 'block');

                tooltip.html(`
                    <div class="space-y-2">
                        <div class="font-bold text-lg">${new Date(d.timestamp).toLocaleTimeString()}</div>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span class="text-gray-400">Open:</span>
                            <span class="text-right">₹${d.open.toFixed(2)}</span>
                            <span class="text-gray-400">High:</span>
                            <span class="text-right">₹${d.high.toFixed(2)}</span>
                            <span class="text-gray-400">Low:</span>
                            <span class="text-right">₹${d.low.toFixed(2)}</span>
                            <span class="text-gray-400">Close:</span>
                            <span class="text-right">₹${d.close.toFixed(2)}</span>
                            <span class="text-gray-400">Volume:</span>
                            <span class="text-right">${d3.format(',')(d.volume)}</span>
                        </div>
                    </div>
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0)
                    .style('display', 'none');
            });

        // Add price line
        const line = d3.line()
            .x(d => xScale(new Date(d.timestamp)))
            .y(d => yScale(d.close))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('class', 'price-line')
            .attr('fill', 'none')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 1.5)
            .attr('d', line);
    };

    return (
        <div className="min-h-screen bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-8">Stock Price Dashboard</h1>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-500 text-white p-4 rounded-lg mb-8">
                        Error: {error}
                    </div>
                ) : (
                    <>
                        {/* Stock Selection and Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {stocks.map(stock => (
                                <div
                                    key={stock.symbol}
                                    className={`p-4 rounded-lg cursor-pointer transition-all ${selectedStock === stock.symbol
                                        ? 'bg-gray-700 border-2 border-blue-500'
                                        : 'bg-gray-800 hover:bg-gray-750'
                                        }`}
                                    onClick={() => setSelectedStock(stock.symbol)}
                                >
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-semibold text-white">{stock.symbol}</h3>
                                        <span className={`text-sm ${stock.netOrderQuantity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            Net Orders: {stock.netOrderQuantity}
                                        </span>
                                    </div>
                                    <p className="text-2xl font-bold text-white mt-2">
                                        ₹{stock.currentPrice.toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Chart Container */}
                        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl text-white">Real-time Candlestick Chart</h2>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                        <span className="text-gray-400 text-sm">Bullish</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                        <span className="text-gray-400 text-sm">Bearish</span>
                                    </div>
                                    <p className="text-gray-400 text-sm">Updates every 30 seconds</p>
                                </div>
                            </div>
                            <div className="relative">
                                <svg ref={svgRef} className="w-full" />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 