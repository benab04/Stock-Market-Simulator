import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Get current directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Avatar schema
const avatarSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    }
});

const Avatar = mongoose.models.Avatar || mongoose.model('Avatar', avatarSchema);

// Function to convert image to base64
function imageToBase64(imagePath) {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64String = imageBuffer.toString('base64');
        const ext = path.extname(imagePath).toLowerCase();

        // Determine MIME type
        let mimeType;
        switch (ext) {
            case '.jpg':
            case '.jpeg':
                mimeType = 'image/jpeg';
                break;
            case '.png':
                mimeType = 'image/png';
                break;
            case '.gif':
                mimeType = 'image/gif';
                break;
            case '.webp':
                mimeType = 'image/webp';
                break;
            case '.svg':
                mimeType = 'image/svg+xml';
                break;
            default:
                mimeType = 'image/jpeg'; // Default fallback
        }

        return `data:${mimeType};base64,${base64String}`;
    } catch (error) {
        console.error(`Error converting ${imagePath} to base64:`, error.message);
        return null;
    }
}

// Function to get all image files from directory
function getImageFiles(directoryPath) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    try {
        const files = fs.readdirSync(directoryPath);
        return files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
        });
    } catch (error) {
        console.error(`Error reading directory ${directoryPath}:`, error.message);
        return [];
    }
}

// Main seeding function
async function seedAvatars() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksimulator');
        console.log('Connected to MongoDB successfully!');

        // Clear existing avatars (optional - remove this if you want to keep existing ones)
        console.log('Clearing existing avatars...');
        await Avatar.deleteMany({});
        console.log('Existing avatars cleared.');

        // Path to avatars directory
        const avatarsPath = path.join(__dirname, '..', 'src', 'assets', 'characters');
        console.log(`Looking for images in: ${avatarsPath}`);

        // Check if directory exists
        if (!fs.existsSync(avatarsPath)) {
            console.error(`Directory not found: ${avatarsPath}`);
            process.exit(1);
        }

        // Get all image files
        const imageFiles = getImageFiles(avatarsPath);
        console.log(`Found ${imageFiles.length} image files:`, imageFiles);

        if (imageFiles.length === 0) {
            console.log('No image files found in the directory.');
            process.exit(0);
        }

        // Process each image
        const avatars = [];
        for (const imageFile of imageFiles) {
            const imagePath = path.join(avatarsPath, imageFile);
            console.log(`Processing: ${imageFile}`);

            const base64Image = imageToBase64(imagePath);
            if (base64Image) {
                avatars.push({
                    image: base64Image
                });
                console.log(`✓ Successfully processed: ${imageFile}`);
            } else {
                console.log(`✗ Failed to process: ${imageFile}`);
            }
        }

        // Insert avatars into database
        if (avatars.length > 0) {
            console.log(`\nInserting ${avatars.length} avatars into database...`);
            const result = await Avatar.insertMany(avatars);
            console.log(`✓ Successfully inserted ${result.length} avatars into the database!`);
        } else {
            console.log('No avatars to insert.');
        }

    } catch (error) {
        console.error('Error seeding avatars:', error);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
    }
}

// Run the seeding function
seedAvatars();