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

    return (
        <div className="mt-4 space-y-4">
            <div className="flex items-center space-x-4">
                <label className="text-gray-300">Quantity:</label>
                <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-gray-700 text-white px-3 py-1 rounded w-24"
                />
            </div>

            <div className="flex space-x-4">
                <button
                    onClick={() => handleTrade('BUY')}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    Buy
                </button>
                <button
                    onClick={() => handleTrade('SELL')}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                    Sell
                </button>
            </div>

            {error && (
                <div className="text-red-500 text-sm">{error}</div>
            )}
        </div>
    );
}
