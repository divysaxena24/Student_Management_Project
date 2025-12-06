const express = require("express");
const router = express.Router();
const Student = require("../models/Student");

// STUDENT LOGIN PAGE
router.get("/login", (req, res) => {
    res.render("student/login", { error: null });
});

// STUDENT LOGIN HANDLER
router.post("/login", async (req, res) => {
    const { roll } = req.body;

    const student = await Student.findOne({ roll });

    if (!student) {
        return res.render("student/login", { error: "Student not found!" });
    }

    res.redirect(`/student/${roll}`);
});

// STUDENT VIEW PAGE
router.get("/:roll", async (req, res) => {
    const student = await Student.findOne({ roll: req.params.roll });
    res.render("student/view", { student });
});

module.exports = router;
