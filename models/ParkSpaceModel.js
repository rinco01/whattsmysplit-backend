const mongoose = require('mongoose')
const Schema = mongoose.Schema;

const ParkSpaceSchema = new Schema({
    park_number:  {
        type: String,
        required: true
    },
    availability:  {
        type: String,
        required: true
    },
    ModTime :  {
        type: Date,
        required: true
    },
});

const User = mongoose.model("ParkSpace", ParkSpaceSchema)

module.exports = ParkSpace
