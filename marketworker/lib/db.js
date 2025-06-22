// lib/db.js
import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

// Enhanced connection options for stability
const connectionOptions = {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    bufferCommands: false, // Disable mongoose buffering
    useNewUrlParser: true,
    useUnifiedTopology: true,
    heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
};

async function dbConnect() {
    try {
        if (cached.conn) {
            // Check if the connection is still alive
            if (mongoose.connection.readyState === 1) {
                return cached.conn;
            } else {
                // Connection is stale, reset it
                cached.conn = null;
                cached.promise = null;
            }
        }

        if (!cached.promise) {
            cached.promise = mongoose.connect(MONGODB_URI, connectionOptions);
        }

        cached.conn = await cached.promise;

        // Add connection event listeners
        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
            cached.conn = null;
            cached.promise = null;
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

        return cached.conn;
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        cached.conn = null;
        cached.promise = null;
        throw error;
    }
}

// Graceful disconnect function
export async function dbDisconnect() {
    try {
        if (cached.conn) {
            await mongoose.disconnect();
            cached.conn = null;
            cached.promise = null;
        }
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
    }
}

// Health check function
export function getConnectionStatus() {
    return {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        states: {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        }
    };
}

export default dbConnect;