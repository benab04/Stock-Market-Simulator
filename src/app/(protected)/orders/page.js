'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import moment from 'moment-timezone';

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, total: 0, pages: 1 });
    const [filters, setFilters] = useState({
        status: '',
        symbol: '',
        type: '',
    });

    const { data: session } = useSession();

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                page: pagination.currentPage,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
            });

            const response = await fetch(`/api/orders?${queryParams}`);
            if (!response.ok) throw new Error('Failed to fetch orders');

            const data = await response.json();
            console.log('Fetched data:', data); // Debug log
            setOrders(data.orders);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchOrders();
        }
    }, [session, pagination.currentPage, filters]);

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

    const formatDateTime = (timestamp) => {
        if (!timestamp) return 'Invalid Date';

        // Convert to Asia/Kolkata timezone and format
        return moment(timestamp)
            .tz('Asia/Kolkata')
            .format('DD/MM/YYYY hh:mm A');
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Invalid Date';

        // Convert to Asia/Kolkata timezone and format date only
        return moment(timestamp)
            .tz('Asia/Kolkata')
            .format('DD/MM/YYYY');
    };

    if (loading) {
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
            <h1 className="text-3xl font-bold mb-8">Order History</h1>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <select
                    value={filters.type}
                    onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-2"
                >
                    <option value="">All Types</option>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                </select>

                <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-2"
                >
                    <option value="">All Status</option>
                    <option value="executed">Executed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                </select>

                <input
                    type="text"
                    placeholder="Search by Symbol"
                    value={filters.symbol}
                    onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-2"
                />
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
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
                                    No orders found
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-800/50">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm">
                                                {formatDate(order.timestamp)}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {moment(order.timestamp).tz('Asia/Kolkata').format('hh:mm A')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium">{order.symbol}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOrderTypeStyle(order.type)}`}>
                                            {order.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4">{order.quantity.toLocaleString()}</td>
                                    <td className="p-4">₹{order.price.toFixed(2)}</td>
                                    <td className="p-4">₹{order.total.toFixed(2)}</td>
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
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                        disabled={pagination.currentPage === 1}
                        className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 bg-gray-800 rounded-lg">
                        Page {pagination.currentPage} of {pagination.pages}
                    </span>
                    <button
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                        disabled={pagination.currentPage === pagination.pages}
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