import { useState, useEffect } from 'react';

export default function TradeForm({ stock, onTrade }) {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [activeButton, setActiveButton] = useState(null);
    const [error, setError] = useState(null);
    const [successAlert, setSuccessAlert] = useState(null);

    const presetQuantities = [5, 10, 25, 50];

    useEffect(() => {
        if (successAlert) {
            const timer = setTimeout(() => {
                setSuccessAlert(null);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [successAlert]);

    const handleTrade = async (type) => {
        try {
            setLoading(true);
            setActiveButton(type);
            setError(null);
            setSuccessAlert(null);

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

            const totalValue = (stock.currentPrice * quantity).toFixed(2);
            setSuccessAlert({
                type,
                symbol: stock.symbol,
                quantity,
                totalValue
            });

            setQuantity(1);
            onTrade?.(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
            setActiveButton(null);
        }
    };

    const handleQuantityChange = (e) => {
        const value = e.target.value;
        if (value === '') {
            setQuantity('');
            return;
        }
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 1) {
            setQuantity(numValue);
        }
    };

    const handleQuantityBlur = () => {
        if (quantity === '' || quantity < 1) {
            setQuantity(1);
        }
    };

    const setPresetQuantity = (preset) => {
        setQuantity(preset);
    };

    const totalValue = stock?.currentPrice ? (stock.currentPrice * quantity).toFixed(2) : '0.00';

    return (
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 shadow-2xl h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                        Trade {stock?.symbol}
                    </span>
                </h3>
                <div className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                    Live
                </div>
            </div>

            {/* Success Alert */}
            {successAlert && (
                <div className="mb-4 bg-green-900/20 border border-green-700/50 rounded-lg p-3 text-green-400 animate-pulse">
                    <div className="flex items-start">
                        <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-green-300 text-sm">
                                {successAlert.type === 'BUY' ? 'Buy' : 'Sell'} Order Placed!
                            </div>
                            <div className="text-xs text-green-400 mt-1">
                                {successAlert.quantity} shares for ₹{successAlert.totalValue}
                            </div>
                        </div>
                        <button
                            onClick={() => setSuccessAlert(null)}
                            className="ml-2 text-green-400 hover:text-green-300 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {/* Quantity Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Quantity
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={handleQuantityChange}
                        onBlur={handleQuantityBlur}
                        className="w-full bg-gray-800/50 border border-gray-600/50 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                        placeholder="Enter quantity"
                    />
                </div>

                {/* Quick Quantity Buttons */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Quick Amount
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                        {presetQuantities.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setPresetQuantity(preset)}
                                className="px-3 py-2 text-sm bg-gray-800/50 border border-gray-600/30 text-gray-300 rounded-lg hover:bg-gray-700/50 hover:text-white transition-all duration-200"
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Price Info */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400 text-sm">Current Price</span>
                        <span className="text-white font-medium text-sm">₹{stock?.currentPrice?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Total Value</span>
                        <span className="text-base font-semibold text-blue-400">₹{totalValue}</span>
                    </div>
                </div>

                {/* Trade Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleTrade('BUY')}
                        disabled={loading || !quantity || quantity < 1}
                        className="group relative px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/25"
                    >
                        {loading && activeButton === 'BUY' ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                <span className="text-xs">Processing...</span>
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
                        disabled={loading || !quantity || quantity < 1}
                        className="group relative px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/25"
                    >
                        {loading && activeButton === 'SELL' ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                <span className="text-xs">Processing...</span>
                            </div>
                        ) : (
                            <>
                                <span className="relative z-10">Sell</span>
                                <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                            </>
                        )}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">
                        <div className="flex items-start">
                            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="flex-1 min-w-0">{error}</span>
                            <button
                                onClick={() => setError(null)}
                                className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}