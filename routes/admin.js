const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const XLSX = require('xlsx');

// Middleware to protect admin routes
function checkAuth(req, res, next) {
    if (req.session.isAdmin) next();
    else res.redirect("/admin/login");
}

// LOGIN PAGE
router.get("/login", (req, res) => {
    res.render("admin/login", { error: null });
});

// LOGIN POST
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "admin") {
        req.session.isAdmin = true;
        return res.redirect("/admin/dashboard");
    }

    res.render("admin/login", { error: "Invalid username or password!" });
});

// LOGOUT
router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/admin/login");
});

// DASHBOARD
router.get("/dashboard", checkAuth, async (req, res) => {
    const search = req.query.search || "";

    let query = {};

    if (search) {
        // If search is a number, try matching roll
        if (!isNaN(search)) {
            query = {
                $or: [
                    { roll: Number(search) },
                    { name: { $regex: search, $options: "i" } }
                ]
            };
        } else {
            // Otherwise search only by name (case-insensitive)
            query = { name: { $regex: search, $options: "i" } };
        }
    }

    const students = await Student.find(query).sort({ roll: 1 });

    // Calculate summary statistics
    const totalStudents = students.length;
    const totalMarks = students.reduce((sum, student) => sum + student.marks, 0);
    const averageMarks = totalStudents > 0 ? (totalMarks / totalStudents).toFixed(2) : 0;
    const highestMarks = students.length > 0 ? Math.max(...students.map(s => s.marks)) : 0;
    const courses = [...new Set(students.map(s => s.course))];
    const coursesOffered = courses.length;

    res.render("admin/dashboard", {
        students,
        search,
        totalStudents,
        averageMarks,
        highestMarks,
        coursesOffered
    });
});

// ATTENDANCE PAGE
router.get("/attendance", checkAuth, async (req, res) => {
    const today = new Date();
    // Set to start of day for comparison
    today.setHours(0, 0, 0, 0);

    // Get all students
    const students = await Student.find().sort({ roll: 1 });

    // Get attendance records for today
    const attendanceRecords = await Attendance.find({
        date: {
            $gte: new Date(today.setHours(0, 0, 0, 0)),
            $lt: new Date(today.setHours(23, 59, 59, 999))
        }
    });

    // Create a map of studentId to attendance status
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
        attendanceMap[record.studentId.toString()] = record.status;
    });

    res.render("admin/attendance", {
        students,
        attendanceMap,
        today: new Date().toISOString().split('T')[0]
    });
});

// MARK ATTENDANCE
router.post("/attendance", checkAuth, async (req, res) => {
    const { date, attendance } = req.body;
    const attendanceDate = new Date(date);

    // Clear any existing attendance for this date
    await Attendance.deleteMany({
        date: {
            $gte: new Date(attendanceDate.setHours(0, 0, 0, 0)),
            $lt: new Date(attendanceDate.setHours(23, 59, 59, 999))
        }
    });

    // Save new attendance records
    for (const studentId in attendance) {
        await Attendance.create({
            studentId,
            date: new Date(date),
            status: attendance[studentId]
        });
    }

    res.redirect("/admin/attendance");
});

// VIEW ATTENDANCE REPORT
router.get("/attendance/report", checkAuth, async (req, res) => {
    const students = await Student.find().sort({ roll: 1 });

    // Get attendance for all students
    const attendanceRecords = await Attendance.find().sort({ date: -1, studentId: 1 });

    // Group by student
    const studentAttendance = {};
    students.forEach(student => {
        studentAttendance[student._id.toString()] = {
            student: student,
            attendance: []
        };
    });

    attendanceRecords.forEach(record => {
        const studentId = record.studentId.toString();
        if (studentAttendance[studentId]) {
            studentAttendance[studentId].attendance.push(record);
        }
    });

    res.render("admin/attendance_report", {
        studentAttendance: Object.values(studentAttendance),
        students
    });
});

// ADD STUDENT
router.post("/add", checkAuth, async (req, res) => {
    await Student.create(req.body);
    res.redirect("/admin/dashboard");
});

// LOAD EDIT PAGE
router.get("/edit/:id", checkAuth, async (req, res) => {
    const student = await Student.findById(req.params.id);
    res.render("admin/edit", { student });
});

// UPDATE STUDENT
router.post("/edit/:id", checkAuth, async (req, res) => {
    await Student.findByIdAndUpdate(req.params.id, req.body);
    res.redirect("/admin/dashboard");
});

// DELETE STUDENT
router.post("/delete/:id", checkAuth, async (req, res) => {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect("/admin/dashboard");
});

// EXPORT TO EXCEL
router.get("/export-excel", checkAuth, async (req, res) => {
    try {
        // Get all students from database
        const students = await Student.find().sort({ roll: 1 });

        // Create worksheet with student data
        const worksheetData = students.map((student, index) => ({
            'S.No.': index + 1,
            'Name': student.name,
            'Roll Number': student.roll,
            'Course': student.course,
            'Marks': student.marks
        }));

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);

        // Set column widths for better appearance
        const colWidths = [
            {wch: 10}, // S.No.
            {wch: 25}, // Name
            {wch: 15}, // Roll Number
            {wch: 20}, // Course
            {wch: 15}  // Marks
        ];
        worksheet['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

        // Generate Excel buffer
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=students_data.xlsx');

        // Send the Excel file
        res.send(buffer);
    } catch (err) {
        console.error('Error exporting to Excel:', err);
        res.status(500).send('Error exporting to Excel');
    }
});

module.exports = router;
