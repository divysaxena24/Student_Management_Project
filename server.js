const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true
}));

// MongoDB Connect
mongoose.connect("mongodb://127.0.0.1:27017/studentDB")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// Routes
const adminRoutes = require("./routes/admin");
const studentRoutes = require("./routes/student");

app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);

// Home → choice page
app.get("/", (req, res) => {
    res.render("choice");
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
