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
    const [tradeModal, setTradeModal] = useState({
        isOpen: false,
        type: null, // 'BUY' or 'SELL'
    });
    const [tradeQuantity, setTradeQuantity] = useState(1);
    const [tradeError, setTradeError] = useState('');
    const [tradeLoading, setTradeLoading] = useState(false);
    const [userBalance, setUserBalance] = useState(0);

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

    // Effect to fetch user balance
    useEffect(() => {
        async function fetchBalance() {
            try {
                const response = await fetch('/api/user/balance');
                if (!response.ok) throw new Error('Failed to fetch balance');
                const data = await response.json();
                setUserBalance(data.balance);
            } catch (error) {
                console.error('Error fetching balance:', error);
            }
        }
        fetchBalance();
    }, []);

    const handleTrade = async (type) => {
        setTradeError('');
        setTradeLoading(true);

        try {
            const selectedStockData = stocks.find(s => s.symbol === selectedStock);
            if (!selectedStockData) {
                throw new Error('Selected stock not found');
            }

            const response = await fetch('/api/trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stockSymbol: selectedStock,
                    quantity: tradeQuantity,
                    type: type
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Trade failed');
            }

            // Update user balance
            setUserBalance(data.newBalance);

            // Close modal
            setTradeModal({ isOpen: false, type: null });
            setTradeQuantity(1);

            // Show success message
            alert('Trade executed successfully!');
        } catch (error) {
            setTradeError(error.message);
        } finally {
            setTradeLoading(false);
        }
    };

    // Function to calculate total cost
    const calculateTotal = () => {
        const stock = stocks.find(s => s.symbol === selectedStock);
        return stock ? (stock.currentPrice * tradeQuantity).toFixed(2) : '0.00';
    };

    const handleQuantityChange = (e) => {
        const value = parseInt(e.target.value) || 1;
        setTradeQuantity(Math.max(1, value));
    };

    return (
        <div className="min-h-screen bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Stock Price Dashboard</h1>
                    <div className="px-4 py-2 bg-gray-800 rounded-lg">
                        <span className="text-gray-400 mr-2">Balance:</span>
                        <span className="text-white font-semibold">
                            ₹{userBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-500 text-white p-4 rounded-lg mb-8">
                        Error: {error}
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-6">
                        {/* Stock List - Left Column */}
                        <div className="col-span-12 lg:col-span-3 space-y-4">
                            <div className="bg-gray-800 rounded-lg p-4">
                                <h2 className="text-lg font-semibold text-white mb-4">Stocks</h2>
                                <div className="space-y-2">
                                    {stocks.map(stock => (
                                        <div
                                            key={stock.symbol}
                                            className={`p-4 rounded-lg cursor-pointer transition-all ${
                                                selectedStock === stock.symbol
                                                    ? 'bg-gray-700 border border-blue-500'
                                                    : 'bg-gray-750 hover:bg-gray-700'
                                            }`}
                                            onClick={() => setSelectedStock(stock.symbol)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-semibold text-white">{stock.symbol}</h3>
                                                <span className={`text-sm px-2 py-1 rounded ${
                                                    stock.netOrderQuantity >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                    {stock.netOrderQuantity > 0 ? '+' : ''}{stock.netOrderQuantity}
                                                </span>
                                            </div>
                                            <p className="text-2xl font-bold text-white mt-2">
                                                ₹{stock.currentPrice.toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main Content - Right Column */}
                        <div className="col-span-12 lg:col-span-9 space-y-6">
                            {/* Trade Panel */}
                            <div className="bg-gray-800 rounded-lg p-6">
                                {selectedStock ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-6 mb-6">
                                            {/* Stock Info */}
                                            <div className="space-y-4">
                                                <h2 className="text-2xl font-bold text-white">{selectedStock}</h2>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div className="bg-gray-700 p-3 rounded-lg">
                                                        <div className="text-gray-400">Current Price</div>
                                                        <div className="text-xl font-bold text-white">
                                                            ₹{stocks.find(s => s.symbol === selectedStock)?.currentPrice.toFixed(2)}
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-700 p-3 rounded-lg">
                                                        <div className="text-gray-400">Net Orders</div>
                                                        <div className="text-xl font-bold text-white">
                                                            {stocks.find(s => s.symbol === selectedStock)?.netOrderQuantity}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Trade Controls */}
                                            <div className="space-y-4">
                                                <div className="flex space-x-4">
                                                    <button
                                                        onClick={() => setTradeModal({ isOpen: true, type: 'BUY' })}
                                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                                    >
                                                        Buy {selectedStock}
                                                    </button>
                                                    <button
                                                        onClick={() => setTradeModal({ isOpen: true, type: 'SELL' })}
                                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                                    >
                                                        Sell {selectedStock}
                                                    </button>
                                                </div>
                                                <div className="bg-gray-700 p-3 rounded-lg">
                                                    <div className="text-gray-400">Order Value (at current price)</div>
                                                    <div className="text-xl font-bold text-white">
                                                        ₹{(stocks.find(s => s.symbol === selectedStock)?.currentPrice * tradeQuantity).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400 py-8">
                                        Select a stock to start trading
                                    </div>
                                )}
                            </div>

                            {/* Chart Container */}
                            <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl text-white font-semibold">Real-time Price Chart</h2>
                                    <div className="flex items-center space-x-6">
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                            <span className="text-gray-400 text-sm">Bullish</span>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                            <span className="text-gray-400 text-sm">Bearish</span>
                                        </div>
                                        <div className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-400">
                                            Updates every 30s
                                        </div>
                                    </div>
                                </div>
                                <div className="relative">
                                    <svg ref={svgRef} className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Trade Modal */}
                {tradeModal.isOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">
                                {tradeModal.type === 'BUY' ? 'Buy' : 'Sell'} {selectedStock}
                            </h3>
                            
                            {tradeError && (
                                <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded mb-4">
                                    {tradeError}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        Quantity
                                    </label>
                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="number"
                                            min="1"
                                            value={tradeQuantity}
                                            onChange={handleQuantityChange}
                                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <div className="flex space-x-2">
                                            {[1, 5, 10, 25, 50].map(qty => (
                                                <button
                                                    key={qty}
                                                    onClick={() => setTradeQuantity(qty)}
                                                    className={`px-2 py-1 rounded text-sm ${
                                                        tradeQuantity === qty 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    {qty}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-750 rounded-lg p-4">
                                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                                        <span>Price per share</span>
                                        <span>₹{stocks.find(s => s.symbol === selectedStock)?.currentPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-white">
                                        <span>Total {tradeModal.type === 'BUY' ? 'Cost' : 'Value'}</span>
                                        <span>₹{calculateTotal()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 mt-6">
                                <button
                                    onClick={() => {
                                        setTradeModal({ isOpen: false, type: null });
                                        setTradeQuantity(1);
                                        setTradeError('');
                                    }}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleTrade(tradeModal.type)}
                                    disabled={tradeLoading}
                                    className={`px-6 py-2 rounded-lg ${
                                        tradeModal.type === 'BUY'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                    } text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                                >
                                    {tradeLoading
                                        ? 'Processing...'
                                        : `${tradeModal.type === 'BUY' ? 'Buy' : 'Sell'} Shares`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}