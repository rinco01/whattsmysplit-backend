const mongoose = require('mongoose')
const Schema = mongoose.Schema;

const UserVerificationSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    uniqueString: {
        type: String,
        required: true
    },
    createdAt: Date,
    expiresAt : Date
});

const UserVerification = mongoose.model("UserVerification", UserVerificationSchema)

module.exports = UserVerification
