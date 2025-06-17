'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function Portfolio() {
    const { data: session } = useSession();
    const [portfolioData, setPortfolioData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                const response = await fetch('/api/portfolio');
                if (!response.ok) {
                    throw new Error('Failed to fetch portfolio');
                }
                const data = await response.json();
                setPortfolioData(data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (session) {
            fetchPortfolio();
            // Refresh portfolio data every minute
            const intervalId = setInterval(fetchPortfolio, 60000);
            return () => clearInterval(intervalId);
        }
    }, [session]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 p-8">
                <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg">
                    <p className="text-red-200">{error}</p>
                </div>
            </div>
        );
    }

    if (!portfolioData) return null;

    const { summary, holdings } = portfolioData;

    return (
        <div className="min-h-screen bg-gray-900 p-8">
            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-300 mb-2">Total Invested</h2>
                    <p className="text-3xl font-bold text-white">
                        ₹{summary.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-300 mb-2">Current Value</h2>
                    <p className="text-3xl font-bold text-white">
                        ₹{summary.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-300 mb-2">Available Balance</h2>
                    <p className="text-3xl font-bold text-emerald-400">
                        ₹{summary.availableBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-300 mb-2">Total P&L</h2>
                    <div>
                        <p className={`text-3xl font-bold ${summary.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ₹{summary.totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-lg ${summary.totalPnLPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {summary.totalPnLPercentage.toFixed(2)}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Holdings Table */}
            {holdings.length === 0 ? (
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 text-center">
                    <h2 className="text-xl font-semibold text-white mb-4">No Holdings</h2>
                    <p className="text-gray-400">Your portfolio is empty. Start trading to see your holdings here.</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Stock</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Quantity</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Avg. Price</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Current Price</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Invested Value</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Current Value</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">P&L</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Allocation %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {holdings.map((holding) => {
                                // Calculate allocation based on total invested amount, not portfolio value
                                const allocation = (holding.investedValue / summary.totalInvested) * 100;
                                return (
                                    <tr key={holding.symbol} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-white">{holding.symbol}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                                            {holding.quantity}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                                            ₹{holding.averagePrice.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                                            ₹{holding.currentPrice.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                                            ₹{holding.investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                                            ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm ${holding.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            <div>₹{holding.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                                            <div>{holding.pnlPercentage.toFixed(2)}%</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                                            {allocation.toFixed(2)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
