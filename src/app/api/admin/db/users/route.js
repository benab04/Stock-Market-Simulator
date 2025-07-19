import { withAuth } from '@/lib/auth';
import User from '@/models/User';
import Market from '@/models/Market';
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
                const existingUser = await User.findOne({ email: row.Email.toLowerCase() });
                if (existingUser) {
                    errors.push(`Row ${i + 1}: User with email ${row.Email} already exists`);
                    continue;
                }

                // Generate password
                const password = generatePassword();

                // Create user
                const user = new User({
                    name: `${row['Name']}`.trim(),
                    email: row.Email.toLowerCase(),
                    password: password, // This will be hashed by the pre-save middleware
                    role: 'user',
                    status: 'ACTIVE'
                });

                await user.save();

                // Add to results for Excel file
                results.push({
                    Email: row.Email,
                    'Name': row['Name'],
                    Password: password
                });

                console.log(`User created: ${user.email}`);

            } catch (error) {
                console.error(`Error creating user for row ${i + 1}:`, error);
                errors.push(`Row ${i + 1}: Failed to create user - ${error.message}`);
            }
        }

        if (results.length === 0) {
            return new Response(
                JSON.stringify({
                    error: 'No users were created successfully',
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
        console.log(`Bulk user creation completed:`);
        console.log(`- Successfully created: ${results.length} users`);
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