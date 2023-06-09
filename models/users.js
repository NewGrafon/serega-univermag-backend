const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const users = new mongoose.Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: false,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    accountType: {
        type: Number,
        required: true,
        default: 0
    },
    created: {
        type: Date,
        required: true,
        unique: false,
        default: Date.now()
    }
});
users.plugin(passportLocalMongoose);

module.exports = mongoose.model("users",users);