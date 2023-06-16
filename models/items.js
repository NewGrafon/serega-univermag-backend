const mongoose = require("mongoose");

const items = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    category: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    weight: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    image: {
        type: Object || null,
        required: false,
        default: null
    },
    created: {
        type: Date,
        required: true,
        unique: false,
        default: Date.now()
    }
});

module.exports = mongoose.model("items",items);