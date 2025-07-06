'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { convertToCSV, convertOrdersToCSV, formatCurrency, getPnlColor } from '@/lib/helper';
import DataTable from '@/components/DataTable';

function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminSecret, setAdminSecret] = useState('');
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [marketStatus, setMarketStatus] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [secretLoading, setSecretLoading] = useState(false);
    const [downloadingUsers, setDownloadingUsers] = useState(false);
    const [downloadingOrders, setDownloadingOrders] = useState(false);
    const [marketActionLoading, setMarketActionLoading] = useState(false);
    const [resetDBLoading, setResetDBLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'orders'

    const { data: session } = useSession();

    // Ensure component is mounted on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // // Auto-refresh data every 5 minutes
    // useEffect(() => {
    //     if (isAuthenticated) {
    //         const interval = setInterval(() => {
    //             console.log('Auto-refreshing data...');
    //             fetchUsers();
    //             fetchOrders();
    //             fetchMarketStatus();
    //         }, 5 * 60 * 1000); // 5 minutes

    //         return () => clearInterval(interval);
    //     }
    // }, [isAuthenticated]);

    const handleSignOut = async () => {
        await signOut({ callbackUrl: '/login' });
    };

    const handleResetDB = async () => {
        const confirmationText = "reset all";
        const userInput = prompt(`
            This action will permanently:
            - Delete ALL past orders and price history for all stocks
            - Remove ALL user holdings
            - Set balance to ₹50 Cr for all users
            - Clear entire trading history

            AUTOMATIC BACKUP:
            ✓ Current users will be downloaded automatically
            ✓ Order history will be downloaded automatically

            RECOMMENDATION:
            Manually download all data before proceeding.

            Type "${confirmationText}" to confirm this:
        `);
        if (!userInput || userInput.trim() === null) {
            return;
        }

        if (userInput.trim() !== confirmationText) {
            alert('Confirmation text does not match. Database reset cancelled.');
            return;
        }

        setResetDBLoading(true);
        setError(null);

        try {
            // If your download functions return promises, use this approach:
            await Promise.all([
                downloadOrderHistory(),
                downloadUserData()
            ]);

            console.log('All downloads completed successfully');

            const response = await fetch('/api/admin/data/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ secret: adminSecret }),
            });

            if (!response.ok) {
                throw new Error('Failed to reset database');
            }

            alert('Database reset successfully. All orders and price history have been cleared.');
            fetchUsers();
            fetchOrders();

        } catch (err) {
            if (err.message.includes('download')) {
                const proceedAnyway = confirm(
                    'Warning: Backup download failed. Do you want to proceed with the database reset anyway? This action cannot be undone.'
                );

                if (!proceedAnyway) {
                    alert('Database reset cancelled due to download failure.');
                    return;
                }

                // If user chooses to proceed, retry the database reset
                try {
                    const response = await fetch('/api/admin/data/reset', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ secret: adminSecret }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to reset database');
                    }

                    alert('Database reset successfully. All orders and price history have been cleared.');
                    fetchUsers();
                    fetchOrders();
                } catch (resetErr) {
                    setError(resetErr.message);
                }
            } else {
                setError(err.message);
            }
        } finally {
            setResetDBLoading(false);
        }
    };

    // Verify admin secret
    const verifySecret = async () => {
        if (!adminSecret.trim()) return;

        setSecretLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/secret', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ secret: adminSecret }),
            });

            if (!response.ok) {
                throw new Error('Invalid admin secret');
            }

            if (!session?.user?.role || session?.user?.role !== 'admin') {
                alert('You are now an admin. Please login to your account again.');
                handleSignOut();
            }
            else {
                setIsAuthenticated(true);
                fetchUsers();
                fetchOrders();
                fetchMarketStatus();
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setSecretLoading(false);
        }
    };

    // Fetch all users
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/data/users');
            if (!response.ok) throw new Error('Failed to fetch users');

            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch all orders
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/data/orders');
            if (!response.ok) throw new Error('Failed to fetch orders');

            const data = await response.json();
            setOrders(data.orders || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch market status
    const fetchMarketStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/market/status');
            if (!response.ok) throw new Error('Failed to fetch market status');

            const data = await response.json();
            setMarketStatus(data.status);
        } catch (err) {
            console.error('Failed to fetch market status:', err);
        }
    }, []);

    // Fixed download user data function
    const downloadUserData = async () => {
        setDownloadingUsers(true);
        try {
            const response = await fetch('/api/admin/data/users');
            if (!response.ok) throw new Error('Failed to download user data');

            // Get JSON data instead of blob
            const userData = await response.json();

            // Convert JSON to CSV
            const csvContent = convertToCSV(userData);

            // Create blob from CSV content
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `user-data-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError(err.message);
        } finally {
            setDownloadingUsers(false);
        }
    };

    // Download order history
    const downloadOrderHistory = async () => {
        setDownloadingOrders(true);
        try {
            const response = await fetch('/api/admin/data/orders');
            if (!response.ok) throw new Error('Failed to download order history');

            const orderData = await response.json();

            // Extract orders array from the response
            const orders = orderData.orders || [];

            if (orders.length === 0) {
                setError('No orders found to download');
                return;
            }

            // Convert orders to CSV format
            const csvContent = convertOrdersToCSV(orders, orderData.summary);

            // Create blob from CSV content
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `order-history-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Optional: Show success message with summary
            console.log(`Downloaded ${orders.length} orders successfully`);

        } catch (err) {
            setError(err.message);
        } finally {
            setDownloadingOrders(false);
        }
    };

    // Toggle market status
    const toggleMarketStatus = async () => {
        setMarketActionLoading(true);
        try {
            const newStatus = marketStatus === 'open' ? 'closed' : 'open';
            const response = await fetch('/api/admin/market/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    state: newStatus,
                    secret: adminSecret
                }),
            });

            if (!response.ok) throw new Error('Failed to update market status');

            setMarketStatus(newStatus);
        } catch (err) {
            setError(err.message);
        } finally {
            setMarketActionLoading(false);
        }
    };

    // Refresh data function
    const refreshData = () => {
        fetchUsers();
        fetchOrders();
        fetchMarketStatus();
    };

    // Define column configurations
    const userColumns = [
        {
            key: 'name',
            header: 'Name',
            render: (user) => <div className="font-medium text-white">{user.name}</div>
        },
        {
            key: 'email',
            header: 'Email',
            render: (user) => <div className="text-gray-300 text-sm">{user.email}</div>
        },
        {
            key: 'balance',
            header: 'Balance',
            render: (user) => <div className="font-medium text-white">{formatCurrency(user.balance)}</div>
        },
        {
            key: 'realized_pnl',
            header: 'Realized P&L',
            render: (user) => <div className={`font-medium ${getPnlColor(user.realized_pnl)}`}>{formatCurrency(user.realized_pnl)}</div>
        },
        {
            key: 'unrealized_pnl',
            header: 'Unrealized P&L',
            render: (user) => <div className={`font-medium ${getPnlColor(user.unrealized_pnl)}`}>{formatCurrency(user.unrealized_pnl)}</div>
        },
        {
            key: 'totalStocks',
            header: 'Total Stocks',
            render: (user) => <div className="font-medium text-white">{user.totalStocks?.toLocaleString() || 0}</div>
        }
    ];

    const orderColumns = [
        {
            key: 'user_name',
            header: 'User',
            render: (order) => <div className="font-medium text-white">{order.userName || 'N/A'}</div>
        },
        {
            key: 'ticker',
            header: 'Stock',
            render: (order) => <div className="font-medium text-blue-400">{order.stockSymbol}</div>
        },
        {
            key: 'order_type',
            header: 'Type',
            render: (order) => (
                <div className={`font-medium ${order.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    {order.type}
                </div>
            )
        },
        {
            key: 'quantity',
            header: 'Quantity',
            render: (order) => <div className="font-medium text-white">{order.quantity?.toLocaleString() || 0}</div>
        },
        {
            key: 'price',
            header: 'Price',
            render: (order) => <div className="font-medium text-white">{formatCurrency(order.price)}</div>
        },
        {
            key: 'total_amount',
            header: 'Total Amount',
            render: (order) => <div className="font-medium text-white">{formatCurrency(order.totalValue)}</div>
        },
        {
            key: 'created_at',
            header: 'Date',
            render: (order) => (
                <div className="text-gray-300 text-sm">
                    {order.timestamp ? new Date(order.timestamp).toLocaleDateString('en-GB') : 'N/A'}
                </div>
            )
        }
    ];

    // Don't render anything until mounted (prevents SSR issues)
    if (!mounted) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-800 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Admin authentication screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold mb-2">Admin Access</h1>
                            <p className="text-gray-400">Enter admin secret to continue</p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 mb-4">
                                <p className="text-red-500 text-sm">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <input
                                type="password"
                                placeholder="Admin Secret"
                                value={adminSecret}
                                onChange={(e) => setAdminSecret(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && verifySecret()}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={secretLoading}
                            />
                            <button
                                onClick={verifySecret}
                                disabled={secretLoading || !adminSecret.trim()}
                                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                            >
                                {secretLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <span>Access Dashboard</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main admin dashboard
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-gray-400 mt-1">Manage users and system settings</p>
                </div>

                {/* Market Status Indicator */}
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${marketStatus === 'open' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm font-medium">
                            Market {marketStatus === 'open' ? 'Open' : 'Closed'}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6">
                    <p className="text-red-500">{error}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <button
                    onClick={downloadUserData}
                    disabled={downloadingUsers}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    {downloadingUsers ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Downloading...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Download Users</span>
                            <span className="sm:hidden">Users</span>
                        </>
                    )}
                </button>

                <button
                    onClick={downloadOrderHistory}
                    disabled={downloadingOrders}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    {downloadingOrders ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Downloading...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Download Orders</span>
                            <span className="sm:hidden">Orders</span>
                        </>
                    )}
                </button>

                <button
                    onClick={toggleMarketStatus}
                    disabled={marketActionLoading}
                    className={`${marketStatus === 'open'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                        } disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2`}
                >
                    {marketActionLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Updating...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={marketStatus === 'open' ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V9a2 2 0 012-2h2a2 2 0 012 2v1"} />
                            </svg>
                            <span className="hidden sm:inline">
                                {marketStatus === 'open' ? 'Stop Market' : 'Start Market'}
                            </span>
                            <span className="sm:hidden">
                                {marketStatus === 'open' ? 'Stop' : 'Start'}
                            </span>
                        </>
                    )}
                </button>

                <button
                    onClick={refreshData}
                    disabled={loading}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Refreshing...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="hidden sm:inline">Refresh Data</span>
                            <span className="sm:hidden">Refresh</span>
                        </>
                    )}
                </button>
                <button
                    onClick={handleResetDB}
                    disabled={resetDBLoading}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    {resetDBLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Updating...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="hidden sm:inline">Reset DB</span>
                            <span className="sm:hidden">Reset DB</span>
                        </>
                    )}
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
                <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'users'
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        Users ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders'
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        Orders ({orders.length})
                    </button>
                </div>
            </div>

            {/* Data Table */}
            {activeTab === 'users' ? (
                <DataTable
                    data={users}
                    columns={userColumns}
                    loading={loading}
                    emptyMessage="No users found"
                    tableTitle="User Management"
                    totalCount={users.length}
                />
            ) : (
                <DataTable
                    data={orders}
                    columns={orderColumns}
                    loading={loading}
                    emptyMessage="No orders found"
                    tableTitle="Order History"
                    totalCount={orders.length}
                />
            )}
        </div>
    );
}

export default AdminPage;