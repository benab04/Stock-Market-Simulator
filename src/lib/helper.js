// Helper function to convert JSON to CSV
export const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    // Get headers from the first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        // Headers row
        headers.join(','),
        // Data rows
        ...data.map(row =>
            headers.map(header => {
                const value = row[header];
                // Handle values that might contain commas or quotes
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    return csvContent;
};


// Helper function to convert orders to CSV
export const convertOrdersToCSV = (orders, summary) => {
    // Define CSV headers
    const headers = [
        'Order ID',
        'User Name',
        'User Email',
        'User Role',
        'Stock Symbol',
        'Company Name',
        'Order Type',
        'Quantity',
        'Price',
        'Total Value',
        'Status',
        'Timestamp',
        'Current Stock Price',
        'P&L Indicator'
    ];

    // // Create summary section
    // const summarySection = summary ? [
    //     '# ORDER HISTORY SUMMARY',
    //     `# Generated on: ${new Date().toLocaleString()}`,
    //     `# Total Orders: ${summary.totalOrders}`,
    //     `# Buy Orders: ${summary.totalBuyOrders}`,
    //     `# Sell Orders: ${summary.totalSellOrders}`,
    //     `# Executed Orders: ${summary.executedOrders}`,
    //     `# Pending Orders: ${summary.pendingOrders}`,
    //     `# Cancelled Orders: ${summary.cancelledOrders}`,
    //     `# Total Volume: ₹${summary.totalVolume?.toLocaleString() || 0}`,
    //     '',
    //     '# DETAILED ORDER DATA'
    // ].join('\n') + '\n' : '';

    // Convert orders to CSV rows
    const csvRows = orders.map(order => [
        order.orderId || '',
        `"${order.userName || 'Unknown'}"`,
        order.userEmail || '',
        order.userRole || 'user',
        order.stockSymbol || '',
        `"${order.companyName || 'Unknown'}"`,
        order.type || '',
        order.quantity || 0,
        order.price || 0,
        order.totalValue || 0,
        order.status || '',
        order.formattedTimestamp || order.timestamp || '',
        order.currentStockPrice || 0,
        order.pnlIndicator || ''
    ]);

    // Combine headers and rows
    const csvContent =
        // summarySection +
        headers.join(',') + '\n' +
        csvRows.map(row => row.join(',')).join('\n');

    return csvContent;
};


export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(amount);
};

export const getPnlColor = (pnl) => {
    const value = parseFloat(pnl);
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-gray-400';
};