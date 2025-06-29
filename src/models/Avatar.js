import mongoose from 'mongoose';

const avatarSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    }
});


const Avatar = mongoose.models.Avatar || mongoose.model('Avatar', avatarSchema);

export default Avatar; 