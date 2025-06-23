import React from 'react';

const MobileStocksList = ({ stocks, selectedStock, onStockSelect }) => {
    return (
        <div className="lg:hidden bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl p-4 mt-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Stock List
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
                {stocks.map((stock) => {
                    const isSelected = selectedStock === stock.symbol;
                    const priceChange = stock.currentPrice - (stock.previousPrice || 0);
                    const isPositive = priceChange >= 0;

                    return (
                        <button
                            key={stock.symbol}
                            onClick={() => onStockSelect(stock.symbol)}
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
                                        <svg
                                            className={`w-3 h-3 mr-1 ${isPositive ? 'rotate-0' : 'rotate-180'}`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 4.414 6.707 7.707a1 1 0 01-1.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {Math.abs(priceChange).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full bg-gray-600/30 rounded-full h-1">
                                <div
                                    className={`h-1 rounded-full transition-all duration-500 ${isSelected
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                                            : 'bg-gray-500'
                                        }`}
                                    style={{ width: isSelected ? '100%' : '0%' }}
                                ></div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileStocksList;