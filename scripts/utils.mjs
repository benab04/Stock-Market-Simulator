import * as XLSX from 'xlsx';

/**
 * Utility function to parse Excel file and convert to stock JSON format
 * Works in both Node.js and browser environments
 * @param {string|File|Buffer|ArrayBuffer|Uint8Array} excelInput - File path (Node.js), File object, or buffer
 * @param {string} sheetName - Name of the sheet to parse (optional, defaults to first sheet)
 * @returns {Promise<Array>} Array of stock objects in the required format
 */
export async function parseExcelToStockJSON(excelInput, sheetName = null) {
    try {
        let workbook;

        // Handle different input types
        if (typeof excelInput === 'string') {
            // File path - Node.js environment
            try {
                // Try to import fs dynamically for Node.js
                const fs = await import('fs');
                const fileBuffer = fs.readFileSync(excelInput);
                workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            } catch (fsError) {
                throw new Error('File path input is only supported in Node.js environment. In browser, use File object or buffer.');
            }
        } else if (excelInput instanceof File) {
            // File object - browser environment
            const fileBuffer = await excelInput.arrayBuffer();
            workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        } else if (excelInput instanceof ArrayBuffer || excelInput instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(excelInput))) {
            // Buffer/ArrayBuffer
            workbook = XLSX.read(excelInput, { type: 'buffer' });
        } else {
            throw new Error('Invalid file input. Expected file path (Node.js), File object, Buffer, ArrayBuffer, or Uint8Array');
        }

        // Get the sheet name (use first sheet if not specified)
        const targetSheet = sheetName || workbook.SheetNames[0];

        if (!workbook.Sheets[targetSheet]) {
            throw new Error(`Sheet "${targetSheet}" not found in the Excel file`);
        }

        // Convert sheet to JSON
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], {
            header: 1, // Use first row as headers
            defval: '' // Default value for empty cells
        });

        if (rawData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
        }

        // Extract headers and normalize them
        const headers = rawData[0].map(header =>
            String(header).trim().toLowerCase().replace(/\s+/g, '')
        );

        // Define expected column mappings
        const columnMappings = {
            'symbol': ['symbol'],
            'name': ['name', 'companyname', 'stockname'],
            'sector': ['sector', 'industry'],
            'price': ['price', 'currentprice', 'stockprice'],
            'risk': ['risk', 'risklevel'],
            'description': ['description', 'desc', 'details'],
            'circuitlevel': ['circuitlevel', 'circuit'],
            'volatilityfactor': ['volatilityfactor', 'volatility', 'volfactor']
        };

        // Find column indices
        const columnIndices = {};
        for (const [field, possibleNames] of Object.entries(columnMappings)) {
            const index = possibleNames.reduce((foundIndex, name) => {
                if (foundIndex !== -1) return foundIndex;
                return headers.findIndex(header => header.includes(name));
            }, -1);

            if (index === -1) {
                throw new Error(`Required column not found for field: ${field}. Expected one of: ${possibleNames.join(', ')}`);
            }
            columnIndices[field] = index;
        }

        // Process data rows
        const stocks = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];

            // Skip empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            try {
                const stock = {
                    symbol: validateAndFormatSymbol(row[columnIndices.symbol]),
                    name: validateAndFormatName(row[columnIndices.name]),
                    sector: validateAndFormatSector(row[columnIndices.sector]),
                    currentPrice: validateAndFormatPrice(row[columnIndices.price]),
                    riskLevel: validateAndFormatRiskLevel(row[columnIndices.risk]),
                    description: validateAndFormatDescription(row[columnIndices.description]),
                    circuitLimit: validateAndFormatCircuitLimit(row[columnIndices.circuitlevel]),
                    volatilityFactor: validateAndFormatVolatilityFactor(row[columnIndices.volatilityfactor]),
                    priceHistory: [],
                    candles_5min: [],
                    candles_30min: [],
                    candles_2hour: []
                };

                stocks.push(stock);
            } catch (error) {
                console.warn(`Skipping row ${i + 1}: ${error.message}`);
                continue;
            }
        }

        if (stocks.length === 0) {
            throw new Error('No valid stock data found in the Excel file');
        }

        console.log(`Successfully parsed ${stocks.length} stocks from Excel file`);
        return stocks;

    } catch (error) {
        console.error('Error parsing Excel file:', error.message);
        throw error;
    }
}

/**
 * Alternative function that accepts buffer/file content directly
 * @param {Buffer|ArrayBuffer|Uint8Array} fileBuffer - Excel file buffer
 * @param {string} sheetName - Name of the sheet to parse (optional)
 * @returns {Array} Array of stock objects in the required format
 */
export function parseExcelBufferToStockJSON(fileBuffer, sheetName = null) {
    try {
        // Read the Excel file from buffer
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Get the sheet name (use first sheet if not specified)
        const targetSheet = sheetName || workbook.SheetNames[0];

        if (!workbook.Sheets[targetSheet]) {
            throw new Error(`Sheet "${targetSheet}" not found in the Excel file`);
        }

        // Convert sheet to JSON
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], {
            header: 1,
            defval: ''
        });

        if (rawData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
        }

        // Extract headers and normalize them
        const headers = rawData[0].map(header =>
            String(header).trim().toLowerCase().replace(/\s+/g, '')
        );

        // Define expected column mappings
        const columnMappings = {
            'symbol': ['symbol'],
            'name': ['name', 'companyname', 'stockname'],
            'sector': ['sector', 'industry'],
            'price': ['price', 'currentprice', 'stockprice'],
            'risk': ['risk', 'risklevel'],
            'description': ['description', 'desc', 'details'],
            'circuitlevel': ['circuitlevel', 'circuit'],
            'volatilityfactor': ['volatilityfactor', 'volatility', 'volfactor']
        };

        // Find column indices
        const columnIndices = {};
        for (const [field, possibleNames] of Object.entries(columnMappings)) {
            const index = possibleNames.reduce((foundIndex, name) => {
                if (foundIndex !== -1) return foundIndex;
                return headers.findIndex(header => header.includes(name));
            }, -1);

            if (index === -1) {
                throw new Error(`Required column not found for field: ${field}. Expected one of: ${possibleNames.join(', ')}`);
            }
            columnIndices[field] = index;
        }

        // Process data rows
        const stocks = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];

            // Skip empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            try {
                const stock = {
                    symbol: validateAndFormatSymbol(row[columnIndices.symbol]),
                    name: validateAndFormatName(row[columnIndices.name]),
                    sector: validateAndFormatSector(row[columnIndices.sector]),
                    currentPrice: validateAndFormatPrice(row[columnIndices.price]),
                    riskLevel: validateAndFormatRiskLevel(row[columnIndices.risk]),
                    description: validateAndFormatDescription(row[columnIndices.description]),
                    circuitLimit: validateAndFormatCircuitLimit(row[columnIndices.circuitlevel]),
                    volatilityFactor: validateAndFormatVolatilityFactor(row[columnIndices.volatilityfactor]),
                    priceHistory: [],
                    candles_5min: [],
                    candles_30min: [],
                    candles_2hour: []
                };

                stocks.push(stock);
            } catch (error) {
                console.warn(`Skipping row ${i + 1}: ${error.message}`);
                continue;
            }
        }

        if (stocks.length === 0) {
            throw new Error('No valid stock data found in the Excel file');
        }

        console.log(`Successfully parsed ${stocks.length} stocks from Excel buffer`);
        return stocks;

    } catch (error) {
        console.error('Error parsing Excel buffer:', error.message);
        throw error;
    }
}

/**
 * Helper function to validate the expected Excel format
 * Works in both Node.js and browser environments
 * @param {string|File|Buffer|ArrayBuffer|Uint8Array} excelInput - File path (Node.js), File object, or buffer
 * @param {string} sheetName - Name of the sheet to validate (optional)
 * @returns {Promise<Object>} Validation result with structure info
 */
export async function validateExcelFormat(excelInput, sheetName = null) {
    try {
        let workbook;

        // Handle different input types
        if (typeof excelInput === 'string') {
            // File path - Node.js environment
            try {
                // Try to import fs dynamically for Node.js
                const fs = await import('fs');
                const fileBuffer = fs.readFileSync(excelInput);
                workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            } catch (fsError) {
                throw new Error('File path input is only supported in Node.js environment. In browser, use File object or buffer.');
            }
        } else if (excelInput instanceof File) {
            // File object - browser environment
            const fileBuffer = await excelInput.arrayBuffer();
            workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        } else if (excelInput instanceof ArrayBuffer || excelInput instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(excelInput))) {
            // Buffer/ArrayBuffer
            workbook = XLSX.read(excelInput, { type: 'buffer' });
        } else {
            throw new Error('Invalid file input. Expected file path (Node.js), File object, Buffer, ArrayBuffer, or Uint8Array');
        }
        const targetSheet = sheetName || workbook.SheetNames[0];

        if (!workbook.Sheets[targetSheet]) {
            return {
                valid: false,
                error: `Sheet "${targetSheet}" not found`,
                availableSheets: workbook.SheetNames
            };
        }

        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], {
            header: 1,
            defval: ''
        });

        if (rawData.length < 1) {
            return {
                valid: false,
                error: 'Excel file appears to be empty'
            };
        }

        const headers = rawData[0].map(header => String(header).trim());

        return {
            valid: true,
            sheetName: targetSheet,
            availableSheets: workbook.SheetNames,
            headers: headers,
            dataRowCount: rawData.length - 1,
            sampleData: rawData.slice(1, 4) // First 3 data rows as sample
        };

    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

// Validation and formatting functions
function validateAndFormatSymbol(value) {
    if (!value || String(value).trim() === '') {
        throw new Error('Symbol is required');
    }
    return String(value).trim().toUpperCase();
}

function validateAndFormatName(value) {
    if (!value || String(value).trim() === '') {
        throw new Error('Name is required');
    }
    return String(value).trim();
}

function validateAndFormatSector(value) {
    if (!value || String(value).trim() === '') {
        throw new Error('Sector is required');
    }
    return String(value).trim();
}

function validateAndFormatPrice(value) {
    const price = parseFloat(value);
    if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price: ${value}. Must be a positive number`);
    }
    return price;
}

function validateAndFormatRiskLevel(value) {
    const validRiskLevels = ['Low', 'Medium', 'High'];
    const riskLevel = String(value).trim();

    // Case-insensitive matching
    const matchedRiskLevel = validRiskLevels.find(
        level => level.toLowerCase() === riskLevel.toLowerCase()
    );

    if (!matchedRiskLevel) {
        throw new Error(`Invalid risk level: ${value}. Must be one of: ${validRiskLevels.join(', ')}`);
    }

    return matchedRiskLevel;
}

function validateAndFormatDescription(value) {
    if (!value || String(value).trim() === '') {
        throw new Error('Description is required');
    }
    return String(value).trim();
}

function validateAndFormatCircuitLimit(value) {
    const circuitLimit = parseFloat(value);
    if (isNaN(circuitLimit) || circuitLimit < 0) {
        throw new Error(`Invalid circuit limit: ${value}. Must be a non-negative number`);
    }
    return circuitLimit;
}

function validateAndFormatVolatilityFactor(value) {
    const volatilityFactor = parseFloat(value);
    if (isNaN(volatilityFactor) || volatilityFactor < 0) {
        throw new Error(`Invalid volatility factor: ${value}. Must be a non-negative number`);
    }
    return volatilityFactor;
}