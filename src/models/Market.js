import mongoose from 'mongoose';

const marketSchema = new mongoose.Schema({
    status: {
        type: Boolean,
        required: true
    },
    admin: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    ]
});


const Market = mongoose.models.Market || mongoose.model('Market', marketSchema);

export default Market; 