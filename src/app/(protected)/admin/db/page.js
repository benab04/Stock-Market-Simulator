'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { convertToCSV, convertOrdersToCSV, formatCurrency, getPnlColor, formatDate } from '@/lib/helper';

export default function AdminDBPage() {
    const [loading, setLoading] = useState({
        stocks: false,
        users: false
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState({
        stocks: null,
        users: null
    });
    const [showSecretPrompt, setShowSecretPrompt] = useState({
        stocks: false,
        users: false
    });
    const [adminSecrets, setAdminSecrets] = useState({
        stocks: '',
        users: ''
    });
    const [clearOptions, setClearOptions] = useState({
        stocks: false,
        users: false
    });
    const { data: session } = useSession();
    const [resetDBLoading, setResetDBLoading] = useState(false);
    const [downloadingUsers, setDownloadingUsers] = useState(false);
    const [downloadingOrders, setDownloadingOrders] = useState(false);
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (session?.user?.role !== 'admin') {
            setError('You do not have permission to access this page');
            return;
        }
    }, [session])

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



    const handleResetDB = async () => {
        const adminSecret = prompt(`
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

        Enter admin secret to confirm:
    `);

        if (!adminSecret || adminSecret.trim() === '') {
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

    const handleFileSelection = (type, file) => {
        if (!file) return;

        if (!file.name.endsWith('.xlsx')) {
            setError('Please upload an Excel (.xlsx) file');
            return;
        }

        setSelectedFiles(prev => ({ ...prev, [type]: file }));
        setShowSecretPrompt(prev => ({ ...prev, [type]: true }));
        setError(null);
    };

    const handleUpload = async (type) => {
        const file = selectedFiles[type];
        const secret = adminSecrets[type];

        if (!file) {
            setError('Please select a file');
            return;
        }

        if (!secret) {
            setError('Please enter admin secret');
            return;
        }

        setLoading(prev => ({ ...prev, [type]: true }));
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('secret', secret);
        formData.append('clearDatabase', clearOptions[type]);

        try {
            const response = await fetch(`/api/admin/db/${type}`, {
                method: 'POST',
                body: formData
            });

            if (type === 'users' && response.ok) {
                // Handle Excel file download for users
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `users_with_passwords_${new Date().getTime()}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setSuccess('Users created successfully! Excel file with passwords downloaded.');
            } else {
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `Failed to upload ${type}`);
                }

                setSuccess(`Successfully uploaded ${type} data`);
            }

            // Reset form
            setSelectedFiles(prev => ({ ...prev, [type]: null }));
            setShowSecretPrompt(prev => ({ ...prev, [type]: false }));
            setAdminSecrets(prev => ({ ...prev, [type]: '' }));
            setClearOptions(prev => ({ ...prev, [type]: false }));

            // Clear the file input
            const fileInput = document.getElementById(`${type}File`);
            if (fileInput) fileInput.value = '';

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(prev => ({ ...prev, [type]: false }));
        }
    };

    const cancelUpload = (type) => {
        setSelectedFiles(prev => ({ ...prev, [type]: null }));
        setShowSecretPrompt(prev => ({ ...prev, [type]: false }));
        setAdminSecrets(prev => ({ ...prev, [type]: '' }));
        setClearOptions(prev => ({ ...prev, [type]: false }));

        const fileInput = document.getElementById(`${type}File`);
        if (fileInput) fileInput.value = '';
    };

    const downloadTemplate = (type) => {
        if (type === 'users') {
            // Create users template
            const data = [
                ['Email', 'First Name', 'Last Name'],
                ['john.doe@example.com', 'John', 'Doe'],
                ['jane.smith@example.com', 'Jane', 'Smith']
            ];

            // Create a simple CSV content for download
            const csvContent = data.map(row => row.join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'users_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            // For stocks, use existing template logic
            const templates = {
                stocks: '/templates/stocks_template.xlsx'
            };
            window.open(templates[type], '_blank');
        }
    };

    const renderUploadSection = (type, title, color) => (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-gray-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
                <button
                    onClick={() => downloadTemplate(type)}
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center space-x-1 self-start sm:self-auto"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download Template</span>
                </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
                Upload {type} data in Excel format (.xlsx)
                {type === 'users' && '. Passwords will be auto-generated.'}
            </p>

            <div className="space-y-4">
                {/* File Input */}
                <input
                    type="file"
                    id={`${type}File`}
                    accept=".xlsx"
                    onChange={(e) => handleFileSelection(type, e.target.files[0])}
                    className="block w-full text-sm text-gray-400
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-full file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-500 file:text-white
                                            hover:file:bg-blue-600
                                            file:cursor-pointer file:transition-colors"
                    style={{
                        [`file:bg-${color}-500`]: true,
                        [`hover:file:bg-${color}-600`]: true
                    }}
                />

                {/* Admin Secret Prompt */}
                {showSecretPrompt[type] && (
                    <div className="bg-gray-700/50 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-200">Confirm Upload</h3>
                            <button
                                onClick={() => cancelUpload(type)}
                                className="text-gray-400 hover:text-gray-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="text-sm text-gray-400">
                            Selected file: <span className="text-white font-medium">{selectedFiles[type]?.name}</span>
                        </div>

                        {/* Clear existing checkbox */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id={`clear${type}`}
                                checked={clearOptions[type]}
                                onChange={(e) => setClearOptions(prev => ({ ...prev, [type]: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <label htmlFor={`clear${type}`} className="text-sm text-gray-300">
                                Clear existing {type} before upload
                            </label>
                        </div>

                        {/* Admin Secret Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Admin Secret
                            </label>
                            <input
                                type="password"
                                value={adminSecrets[type]}
                                onChange={(e) => setAdminSecrets(prev => ({ ...prev, [type]: e.target.value }))}
                                placeholder="Enter admin secret"
                                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={() => handleUpload(type)}
                                disabled={loading[type]}
                                className={`flex-1 px-4 py-2 bg-${color}-500 hover:bg-${color}-600 disabled:bg-${color}-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm`}
                            >
                                {loading[type] ? 'Uploading...' : `${title}`}
                            </button>
                            <button
                                onClick={() => cancelUpload(type)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>

                        {/* Loading Indicator */}
                        {loading[type] && (
                            <div className="flex items-center space-x-2">
                                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 border-${color}-500`}></div>
                                <span className="text-sm text-gray-400">
                                    {type === 'users' ? 'Creating users and generating passwords...' : `Uploading ${type}...`}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {session?.user?.role === 'admin' ? (
                <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold">Database Management</h1>
                                <p className="text-gray-400 mt-1 text-sm sm:text-base">Upload and manage database records</p>
                            </div>

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


                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                                <p className="text-red-400 text-sm sm:text-base">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6">
                                <p className="text-green-400 text-sm sm:text-base">{success}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {renderUploadSection('stocks', 'Upload Stocks', 'blue')}
                            {renderUploadSection('users', 'Bulk Add Users', 'green')}
                        </div>

                        {/* Instructions */}
                        <div className="mt-8 bg-gray-800/30 rounded-xl p-4 sm:p-6 border border-gray-700/30">
                            <h3 className="text-lg font-semibold mb-4">Instructions</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-md font-semibold text-blue-400 mb-2">Stocks Upload</h4>
                                    <ul className="list-disc list-inside space-y-1 text-gray-400 text-sm">
                                        <li>Download the template first to see the required format</li>
                                        <li>Required columns: Symbol, Name, Current Price, Volatility Factor</li>
                                        <li>Only .xlsx files are supported</li>
                                        <li>Make sure all required fields are filled</li>
                                        <li>Use "Clear existing stocks" to replace all data</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-md font-semibold text-green-400 mb-2">Users Upload</h4>
                                    <ul className="list-disc list-inside space-y-1 text-gray-400 text-sm">
                                        <li>Required columns: Email, Name</li>
                                        <li>Passwords will be auto-generated (12 characters)</li>
                                        <li>Users start with ₹50,00,00,000 balance</li>
                                        <li>Download will contain passwords for distribution</li>
                                        <li>Duplicate emails will be skipped with error report</li>
                                        <li>Use "Clear existing users" to replace all data</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
                    <div className="max-w-6xl mx-auto">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                                <p className="text-red-400">{error}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}