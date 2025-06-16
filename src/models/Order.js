import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    stockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
        required: true
    },
    type: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'EXECUTED', 'CANCELLED'],
        default: 'PENDING'
    },
    userId: {
        type: String,
        required: true
    }
});

// Add compound index for faster aggregation
orderSchema.index({ stockId: 1, timestamp: 1, type: 1 });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default Order; 