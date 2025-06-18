import { useState } from 'react';

export default function TradeForm({ stock, onTrade }) {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleTrade = async (type) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stockSymbol: stock.symbol,
                    quantity,
                    type
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to execute trade');
            }

            onTrade?.(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const totalValue = stock?.currentPrice ? (stock.currentPrice * quantity).toFixed(2) : '0.00';

    return (
        <div className="mt-8 bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white flex items-center">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                        Trade {stock?.symbol}
                    </span>
                </h3>
                <div className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1 rounded-full">
                    Live Trading
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Quantity
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-gray-800/50 border border-gray-600/50 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                                placeholder="Enter quantity"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-sm">Current Price</span>
                            <span className="text-white font-medium">₹{stock?.currentPrice?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Total Value</span>
                            <span className="text-lg font-semibold text-blue-400">₹{totalValue}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleTrade('BUY')}
                            disabled={loading}
                            className="group relative px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/25"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Processing...
                                </div>
                            ) : (
                                <>
                                    <span className="relative z-10">Buy</span>
                                    <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => handleTrade('SELL')}
                            disabled={loading}
                            className="group relative px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/25"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Processing...
                                </div>
                            ) : (
                                <>
                                    <span className="relative z-10">Sell</span>
                                    <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm animate-pulse">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}