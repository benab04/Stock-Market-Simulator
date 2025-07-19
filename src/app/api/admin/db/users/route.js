import { withAuth } from '@/lib/auth';
import User from '@/models/User';
import Stock from '@/models/Stock';
import dbConnect from '@/lib/db';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Function to generate a random password
function generatePassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// Function to parse Excel file from buffer
function parseExcelFile(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
}

// Function to create Excel file with user data and passwords
function createExcelFile(userData) {
    const worksheet = XLSX.utils.json_to_sheet(userData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Function to validate and get stock information
async function validateStock(stockSymbol) {
    if (!stockSymbol || stockSymbol.trim() === '') {
        return null;
    }

    try {
        const stock = await Stock.findOne({ symbol: stockSymbol.trim().toUpperCase() });
        return stock;
    } catch (error) {
        console.error(`Error validating stock ${stockSymbol}:`, error);
        return null;
    }
}

// Function to update user portfolio
async function updateUserPortfolio(user, stockSymbol, sharesHeld) {
    try {
        const stock = await validateStock(stockSymbol);
        if (!stock) {
            return { success: false, error: `Invalid stock symbol: ${stockSymbol}` };
        }

        const quantity = parseInt(sharesHeld);
        if (isNaN(quantity) || quantity <= 0) {
            return { success: false, error: `Invalid shares quantity: ${sharesHeld}` };
        }

        // Check if user already has this stock in portfolio
        const existingHoldingIndex = user.portfolio.findIndex(
            holding => holding.stockSymbol.toLowerCase() === stock.symbol.toLowerCase()
        );

        const investedValue = stock.currentPrice * quantity;

        if (existingHoldingIndex >= 0) {
            // Update existing holding
            const existingHolding = user.portfolio[existingHoldingIndex];
            const totalQuantity = existingHolding.quantity + quantity;
            const totalInvestedValue = existingHolding.investedValue + investedValue;
            const newAveragePrice = totalInvestedValue / totalQuantity;

            user.portfolio[existingHoldingIndex] = {
                stockSymbol: stock.symbol,
                quantity: totalQuantity,
                averagePrice: newAveragePrice,
                buyPrice: newAveragePrice,
                investedValue: totalInvestedValue
            };
        } else {
            // Add new holding
            user.portfolio.push({
                stockSymbol: stock.symbol,
                quantity: quantity,
                averagePrice: stock.currentPrice,
                buyPrice: stock.currentPrice,
                investedValue: investedValue
            });
        }

        return { success: true, stock: stock.symbol, quantity };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export const POST = withAuth(async (req) => {
    try {
        await dbConnect();

        // Verify admin secret and permissions
        if (!ADMIN_SECRET) {
            return new Response(
                JSON.stringify({ error: 'Admin secret is not set' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const userRole = req.ctx.user.role;
        if (!userRole || userRole !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Admin privileges required' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Get form data from the request
        const formData = await req.formData();
        const file = formData.get('file');
        const secret = formData.get('secret');
        const clearDatabase = formData.get('clearDatabase') === 'true';

        if (secret !== ADMIN_SECRET) {
            return new Response(
                JSON.stringify({ error: 'Invalid admin secret' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!file) {
            return new Response(
                JSON.stringify({ error: 'No file uploaded' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (clearDatabase) {
            // Clear existing users if requested
            await User.deleteMany({ role: 'user' });
            console.log('Existing users cleared');
        }

        // Convert file to buffer and parse
        const buffer = Buffer.from(await file.arrayBuffer());
        const userData = parseExcelFile(buffer);

        if (!userData || userData.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No user data found in the file' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate required columns
        const requiredColumns = ['Email', 'Name'];
        const firstRow = userData[0];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));

        if (missingColumns.length > 0) {
            return new Response(
                JSON.stringify({
                    error: `Missing required columns: ${missingColumns.join(', ')}`
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const results = [];
        const errors = [];

        // Process each user
        for (let i = 0; i < userData.length; i++) {
            const row = userData[i];

            try {
                // Validate email format
                const emailRegex = /^\S+@\S+\.\S+$/;
                if (!emailRegex.test(row.Email)) {
                    errors.push(`Row ${i + 1}: Invalid email format - ${row.Email}`);
                    continue;
                }

                // Check if user already exists
                let existingUser = await User.findOne({ email: row.Email.toLowerCase() });
                let password;
                let isNewUser = false;

                if (existingUser && !clearDatabase) {
                    // User exists and we're not clearing database
                    // We'll use the existing user and update their portfolio if needed
                    password = "*** EXISTING USER ***"; // Placeholder for display
                } else if (existingUser && clearDatabase) {
                    // This shouldn't happen since we cleared the database, but handle it just in case
                    errors.push(`Row ${i + 1}: User with email ${row.Email} already exists after database clear`);
                    continue;
                } else {
                    // Create new user
                    password = generatePassword();
                    isNewUser = true;

                    existingUser = new User({
                        name: `${row['Name']}`.trim(),
                        email: row.Email.toLowerCase(),
                        password: password, // This will be hashed by the pre-save middleware
                        role: 'user',
                        status: 'ACTIVE',
                        portfolio: []
                    });
                }

                // Handle portfolio updates if Key Investor and Shares Held fields exist
                const portfolioUpdates = [];
                if (row['Key Investor'] && row['Shares Held']) {
                    const portfolioResult = await updateUserPortfolio(
                        existingUser,
                        row['Key Investor'],
                        row['Shares Held']
                    );

                    if (portfolioResult.success) {
                        portfolioUpdates.push(`${portfolioResult.stock}: ${portfolioResult.quantity} shares`);
                    } else {
                        errors.push(`Row ${i + 1}: Portfolio update failed - ${portfolioResult.error}`);
                    }
                }

                // Save the user (new or updated)
                await existingUser.save();

                // Prepare result for Excel file
                const resultRow = {
                    Email: row.Email,
                    'Name': row['Name'],
                    Password: password,
                    Status: isNewUser ? 'NEW USER' : 'EXISTING USER UPDATED',
                };

                // Add portfolio information if available
                if (row['Key Investor']) {
                    resultRow['Key Investor'] = row['Key Investor'];
                }
                if (row['Shares Held']) {
                    resultRow['Shares Held'] = row['Shares Held'];
                }
                if (portfolioUpdates.length > 0) {
                    resultRow['Portfolio Updates'] = portfolioUpdates.join('; ');
                }

                results.push(resultRow);

                console.log(`${isNewUser ? 'User created' : 'User updated'}: ${existingUser.email}${portfolioUpdates.length > 0 ? ` - Portfolio: ${portfolioUpdates.join('; ')}` : ''}`);

            } catch (error) {
                console.error(`Error processing user for row ${i + 1}:`, error);
                errors.push(`Row ${i + 1}: Failed to process user - ${error.message}`);
            }
        }

        if (results.length === 0) {
            return new Response(
                JSON.stringify({
                    error: 'No users were processed successfully',
                    details: errors
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Create Excel file with results
        const excelBuffer = createExcelFile(results);

        // Create response with Excel file
        const response = new Response(excelBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="users_with_passwords_${new Date().getTime()}.xlsx"`,
                'Content-Length': excelBuffer.length.toString()
            }
        });

        // Log summary
        console.log(`Bulk user processing completed:`);
        console.log(`- Successfully processed: ${results.length} users`);
        console.log(`- Errors: ${errors.length}`);
        if (errors.length > 0) {
            console.log('Errors:', errors);
        }

        return response;

    } catch (error) {
        console.error('Error in bulk user creation:', error);
        return new Response(
            JSON.stringify({
                error: 'Failed to process bulk user creation',
                details: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});

// Handle OPTIONS for CORS
export const OPTIONS = async () => {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
};