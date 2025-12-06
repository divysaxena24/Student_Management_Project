const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    name: String,
    roll: { type: Number, unique: true },
    course: String,
    marks: Number
});

module.exports = mongoose.model("Student", studentSchema);
