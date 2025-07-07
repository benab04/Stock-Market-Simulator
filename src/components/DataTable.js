import React from 'react';

export default function DataTable({ data, columns, loading, emptyMessage, tableTitle, totalCount }) {
    return (
        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <span>{tableTitle}</span>
                    <span className="text-sm text-gray-400">({totalCount})</span>
                </h2>
            </div>

            <div className="overflow-x-auto">
                {loading && data.length === 0 ? (
                    <div className="p-8">
                        <div className="animate-pulse space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-gray-700 rounded"></div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-700 text-left">
                                {columns.map((column, index) => (
                                    <th key={index} className="p-4 font-semibold text-sm">{column.header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                                        {loading ? `Loading ${tableTitle.toLowerCase()}...` : emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                                        {columns.map((column, colIndex) => (
                                            <td key={colIndex} className="p-4">
                                                {column.render ? column.render(item) : item[column.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
