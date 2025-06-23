import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const portfolioSchema = new mongoose.Schema({
    stockSymbol: { type: String, required: true },
    quantity: { type: Number, required: true },
    averagePrice: { type: Number, required: true },
    buyPrice: { type: Number, required: true },
    investedValue: { type: Number, default: 0, required: true }
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false // Don't include password in normal queries
    },
    portfolio: [portfolioSchema],
    balance: {
        type: Number,
        default: 100000 // Starting balance of ₹100,000
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check if password is correct
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to get user's portfolio value
userSchema.methods.getPortfolioValue = async function () {
    let totalValue = 0;
    for (const holding of this.portfolio) {
        // You would typically get the current price from your stock model/service
        const stock = await mongoose.model('Stock').findOne({ symbol: holding.stockSymbol });
        if (stock) {
            totalValue += stock.currentPrice * holding.quantity;
        }
    }
    return totalValue;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User; 