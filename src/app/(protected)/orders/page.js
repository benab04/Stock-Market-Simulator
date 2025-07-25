'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { commafy, formatDate } from '@/lib/helper';

// Custom hook for debouncing
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, total: 0, pages: 1 });
    const [filters, setFilters] = useState({
        status: '',
        symbol: '',
        type: '',
    });
    const [mounted, setMounted] = useState(false);

    const { data: session } = useSession();
    const abortControllerRef = useRef(null);

    // Ensure component is mounted on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Debounce the symbol search with 500ms delay
    const debouncedSymbol = useDebounce(filters.symbol, 500);

    // Create a memoized filters object that only changes when non-symbol filters or debounced symbol changes
    const effectiveFilters = useMemo(() => ({
        status: filters.status,
        symbol: debouncedSymbol,
        type: filters.type,
    }), [filters.status, filters.type, debouncedSymbol]);

    const fetchOrders = useCallback(async (page = 1, currentFilters = effectiveFilters) => {
        // Don't fetch if not mounted or no session
        if (!mounted || !session) return;

        // Cancel any ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        try {
            setLoading(true);
            setError(null);

            const queryParams = new URLSearchParams({
                page: page.toString(),
                ...Object.fromEntries(Object.entries(currentFilters).filter(([_, v]) => v))
            });

            const response = await fetch(`/api/orders?${queryParams}`, {
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error('Failed to fetch orders');

            const data = await response.json();
            setOrders(data.orders);
            setPagination({
                currentPage: page,
                total: data.pagination.total,
                pages: data.pagination.pages
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [effectiveFilters, mounted, session]);

    // Single effect to handle all data fetching
    useEffect(() => {
        if (!mounted || !session) return;

        // When filters change, reset to page 1
        const shouldResetPage =
            filters.status !== '' ||
            debouncedSymbol !== '' ||
            filters.type !== '';

        const pageToFetch = shouldResetPage && (
            filters.status !== '' ||
            debouncedSymbol !== filters.symbol || // Check if debounced value is different
            filters.type !== ''
        ) ? 1 : pagination.currentPage;

        fetchOrders(pageToFetch, effectiveFilters);

        // Cleanup function to abort request on unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [mounted, session, effectiveFilters, pagination.currentPage, fetchOrders]);

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));

        // Reset pagination when non-symbol filters change immediately
        if (filterType !== 'symbol') {
            setPagination(prev => ({ ...prev, currentPage: 1 }));
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages && newPage !== pagination.currentPage) {
            setPagination(prev => ({ ...prev, currentPage: newPage }));
        }
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'executed': return 'text-green-500';
            case 'pending': return 'text-yellow-500';
            case 'cancelled': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getOrderTypeStyle = (type) => {
        return type.toLowerCase() === 'buy'
            ? 'bg-green-500/10 text-green-500'
            : 'bg-red-500/10 text-red-500';
    };




    // Don't render anything until mounted (prevents SSR issues)
    if (!mounted) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-800 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (loading && orders.length === 0) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-800 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                    <p className="text-red-500">Error: {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Order History</h1>
                {loading && orders.length > 0 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span>Loading...</span>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Types</option>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                </select>

                <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Status</option>
                    <option value="executed">Executed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                </select>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search by Symbol"
                        value={filters.symbol}
                        onChange={(e) => handleFilterChange('symbol', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {filters.symbol && debouncedSymbol !== filters.symbol && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto relative">
                {loading && orders.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm z-10 rounded-lg">
                        <div className="h-2 bg-blue-500 animate-pulse rounded-full"></div>
                    </div>
                )}
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-left">
                            <th className="p-4 font-semibold">Date & Time</th>
                            <th className="p-4 font-semibold">Symbol</th>
                            <th className="p-4 font-semibold">Type</th>
                            <th className="p-4 font-semibold">Quantity</th>
                            <th className="p-4 font-semibold">Price</th>
                            <th className="p-4 font-semibold">Total</th>
                            <th className="p-4 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-gray-400">
                                    {loading ? 'Loading orders...' : 'No orders found'}
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm">
                                                {formatDate(order.timestamp, 'DD/MM/YYYY')}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {formatDate(order.timestamp, 'hh:mm:ss A')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium">{order.symbol}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOrderTypeStyle(order.type)}`}>
                                            {order.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4">{commafy(order.quantity, 0)}</td>
                                    <td className="p-4">{commafy(order.price, 2, 'INR')}</td>
                                    <td className="p-4">{commafy(order.total, 2, 'INR')}</td>
                                    <td className="p-4">
                                        <span className={getStatusColor(order.status)}>
                                            {order.status.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="mt-6 flex justify-center space-x-2">
                    <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage === 1 || loading}
                        className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 bg-gray-800 rounded-lg">
                        Page {pagination.currentPage} of {pagination.pages}
                    </span>
                    <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage === pagination.pages || loading}
                        className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Show total orders count */}
            {pagination.total > 0 && (
                <div className="mt-4 text-center text-gray-400 text-sm">
                    Showing {orders.length} of {pagination.total} orders
                </div>
            )}
        </div>
    );
}

// Export with dynamic import to prevent SSR issues
export default OrdersPage;