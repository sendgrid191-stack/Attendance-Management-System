import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dbInstance, { hashPassword, Employee, AttendanceRecord } from "./server/db.js";
import { matchFace } from "./server/faceRecognition.js";

const app = express();
const PORT = 3000;

// Increase request size limits for base64 image uploads
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// JWT native token utilities
function generateToken(email: string): string {
  const secret = process.env.GEMINI_API_KEY || "fallback_attendance_system_secret";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const secret = process.env.GEMINI_API_KEY || "fallback_attendance_system_secret";
    const expectedSignature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    if (expectedSignature !== signature) return null;
    const doc = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (doc.exp < Date.now()) return null; // Expired
    return doc;
  } catch {
    return null;
  }
}

// Admin Authentication Middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized. Authentication token is missing." });
    return;
  }
  const token = authHeader.substring(7);
  const validated = verifyToken(token);
  if (!validated) {
    res.status(401).json({ error: "Unauthorized. Token is invalid or expired." });
    return;
  }
  
  const db = dbInstance.read();
  const adminDoc = db.admins.find(a => a.email === validated.email);
  if (!adminDoc) {
    res.status(401).json({ error: "Unauthorized. Admin user no longer exists." });
    return;
  }

  (req as any).admin = adminDoc;
  next();
}

// ----------------------------------------------------
// API ROUTES FIRST
// ----------------------------------------------------

// Admin login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const db = dbInstance.read();
  const matchedAdmin = db.admins.find(a => a.email.toLowerCase() === email.toLowerCase());

  if (!matchedAdmin || matchedAdmin.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const token = generateToken(matchedAdmin.email);
  dbInstance.logAction("ADMIN_LOGIN", matchedAdmin.email, "Admin successfully logged in.");
  
  res.json({
    token,
    admin: {
      id: matchedAdmin.id,
      name: matchedAdmin.name,
      email: matchedAdmin.email,
      role: matchedAdmin.role
    }
  });
});

// Admin verify session / me
app.get("/api/auth/me", requireAdmin, (req, res) => {
  const admin = (req as any).admin;
  res.json({
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });
});

// GET Employees list
app.get("/api/employees", requireAdmin, (req, res) => {
  const db = dbInstance.read();
  const includeFace = req.query.include_face === "true";
  
  // Return employees without heavy face photo and profilePhoto unless explicitly requested
  const result = db.employees.map(emp => {
    const copy = { ...emp };
    if (!includeFace) {
      delete copy.faceData;
    }
    return copy;
  });
  
  res.json(result);
});

// POST Register New Employee
app.post("/api/employees", requireAdmin, (req, res) => {
  const { employeeId, name, department, designation, email, phone, joiningDate, status, profilePhoto } = req.body;
  const admin = (req as any).admin;

  if (!employeeId || !name || !department || !designation || !email) {
    res.status(400).json({ error: "Employee ID, Full Name, Department, Designation, and Email are required." });
    return;
  }

  const db = dbInstance.read();
  
  // Check uniqueness of Employee ID
  const duplicateId = db.employees.find(e => e.employeeId.toUpperCase() === employeeId.toUpperCase());
  if (duplicateId) {
    res.status(400).json({ error: `An employee with ID '${employeeId}' already exists.` });
    return;
  }

  // Check uniqueness of Email
  const duplicateEmail = db.employees.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (duplicateEmail) {
    res.status(400).json({ error: `An employee with Email '${email}' already exists.` });
    return;
  }

  const newEmployee: Employee = {
    id: crypto.randomUUID(),
    employeeId: employeeId.toUpperCase().trim(),
    name: name.trim(),
    department: department.trim(),
    designation: designation.trim(),
    email: email.toLowerCase().trim(),
    phone: phone || "",
    joiningDate: joiningDate || new Date().toISOString().split("T")[0],
    status: status === "Inactive" ? "Inactive" : "Active",
    profilePhoto: profilePhoto || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.employees.push(newEmployee);
  dbInstance.write(db);
  dbInstance.logAction(
    "EMPLOYEE_CREATE", 
    admin.email, 
    `Registered new employee ${newEmployee.name} (${newEmployee.employeeId})`
  );

  res.status(201).json(newEmployee);
});

// PUT Edit Employee
app.put("/api/employees/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { employeeId, name, department, designation, email, phone, joiningDate, status, profilePhoto } = req.body;
  const admin = (req as any).admin;

  const db = dbInstance.read();
  const empIdx = db.employees.findIndex(e => e.id === id);
  if (empIdx === -1) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  // Check uniqueness of Employee ID if changed
  if (db.employees[empIdx].employeeId !== employeeId) {
    const duplicateId = db.employees.find(e => e.employeeId.toUpperCase() === employeeId.toUpperCase() && e.id !== id);
    if (duplicateId) {
      res.status(400).json({ error: `An employee with ID '${employeeId}' already exists.` });
      return;
    }
  }

  // Check uniqueness of Email if changed
  if (db.employees[empIdx].email.toLowerCase() !== email.toLowerCase()) {
    const duplicateEmail = db.employees.find(e => e.email.toLowerCase() === email.toLowerCase() && e.id !== id);
    if (duplicateEmail) {
      res.status(400).json({ error: `An employee with Email '${email}' already exists.` });
      return;
    }
  }

  const original = db.employees[empIdx];
  const updatedEmployee: Employee = {
    ...original,
    employeeId: employeeId.toUpperCase().trim(),
    name: name.trim(),
    department: department.trim(),
    designation: designation.trim(),
    email: email.toLowerCase().trim(),
    phone: phone || "",
    joiningDate: joiningDate || original.joiningDate,
    status: status === "Inactive" ? "Inactive" : "Active",
    profilePhoto: profilePhoto || original.profilePhoto,
    updatedAt: new Date().toISOString()
  };

  db.employees[empIdx] = updatedEmployee;
  dbInstance.write(db);
  dbInstance.logAction(
    "EMPLOYEE_UPDATE", 
    admin.email, 
    `Updated details for employee ${updatedEmployee.name} (${updatedEmployee.employeeId})`
  );

  res.json(updatedEmployee);
});

// DELETE Employee
app.delete("/api/employees/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const admin = (req as any).admin;

  const db = dbInstance.read();
  const empIdx = db.employees.findIndex(e => e.id === id);
  if (empIdx === -1) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const employeeName = db.employees[empIdx].name;
  const employeeId = db.employees[empIdx].employeeId;

  // Cascade delete all of this employee's attendance records as requested by the user
  const initialRecordsLength = db.attendance_records.length;
  db.attendance_records = db.attendance_records.filter(r => r.employeeId !== employeeId);
  const deletedRecordsCount = initialRecordsLength - db.attendance_records.length;

  db.employees.splice(empIdx, 1);
  dbInstance.write(db);
  dbInstance.logAction(
    "EMPLOYEE_DELETE",
    admin.email,
    `De-registered employee ${employeeName} (${employeeId}), deleted ${deletedRecordsCount} associated attendance records, and removed facial templates.`
  );

  res.json({ message: "Employee profile and all associated attendance records successfully removed." });
});

// POST Register face data template
app.post("/api/employees/:id/face", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { faceData, profilePhoto } = req.body;
  const admin = (req as any).admin;

  if (!faceData) {
    res.status(400).json({ error: "Webcam captured face snapshot data is required." });
    return;
  }

  const db = dbInstance.read();
  const empIdx = db.employees.findIndex(e => e.id === id);
  if (empIdx === -1) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  db.employees[empIdx].faceData = faceData;
  if (profilePhoto) {
    db.employees[empIdx].profilePhoto = profilePhoto;
  }
  db.employees[empIdx].updatedAt = new Date().toISOString();

  dbInstance.write(db);
  dbInstance.logAction(
    "FACIAL_TEMPLATE_REGISTER",
    admin.email,
    `Registered biometric facial template for ${db.employees[empIdx].name} (${db.employees[empIdx].employeeId}).`
  );

  res.json({ message: "Facial template registered successfully." });
});

// GET Attendance Records (Reporting)
app.get("/api/attendance/records", requireAdmin, (req, res) => {
  const db = dbInstance.read();
  const { search, department, date, startDate, endDate } = req.query as Record<string, string>;

  let list = db.attendance_records.map(rec => {
    const employee = db.employees.find(e => e.employeeId === rec.employeeId);
    return {
      ...rec,
      employeeName: employee ? employee.name : "Unknown Employee",
      employeeEmail: employee ? employee.email : "",
      department: employee ? employee.department : "Unknown",
      designation: employee ? employee.designation : "Unknown"
    };
  });

  // Filters
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(r => 
      r.employeeName.toLowerCase().includes(s) || 
      r.employeeId.toLowerCase().includes(s) ||
      r.employeeEmail.toLowerCase().includes(s)
    );
  }

  if (department) {
    list = list.filter(r => r.department.toLowerCase() === department.toLowerCase());
  }

  if (date) {
    list = list.filter(r => r.date === date);
  }

  if (startDate && endDate) {
    list = list.filter(r => r.date >= startDate && r.date <= endDate);
  }

  // Sort by date desc, then checkInTime desc
  list.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.checkInTime || "").localeCompare(a.checkInTime || "");
  });

  res.json(list);
});

// DELETE Individual Attendance Record
app.delete("/api/attendance/records/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const admin = (req as any).admin;

  const db = dbInstance.read();
  const recIdx = db.attendance_records.findIndex(r => r.id === id);
  if (recIdx === -1) {
    res.status(404).json({ error: "Attendance record not found." });
    return;
  }

  const record = db.attendance_records[recIdx];
  const employee = db.employees.find(e => e.employeeId === record.employeeId);
  const empName = employee ? employee.name : record.employeeId;

  db.attendance_records.splice(recIdx, 1);
  dbInstance.write(db);
  dbInstance.logAction(
    "ATTENDANCE_RECORD_DELETE",
    admin.email,
    `Deleted attendance record of ${empName} (${record.employeeId}) for date ${record.date}`
  );

  res.json({ message: "Attendance record successfully deleted." });
});

// POST Manual Attendance Correction
app.post("/api/attendance/manual", requireAdmin, (req, res) => {
  const { employeeId, date, checkInTime, checkOutTime, status, reason } = req.body;
  const admin = (req as any).admin;

  if (!employeeId || !date || !status || !reason) {
    res.status(400).json({ error: "Employee ID, Date, status, and correction reason are required." });
    return;
  }

  const db = dbInstance.read();
  const emp = db.employees.find(e => e.employeeId === employeeId);
  if (!emp) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  // Check if attendance already exists for this date
  const recIdx = db.attendance_records.findIndex(r => r.employeeId === employeeId && r.date === date);

  let workingHours: number | undefined;
  if (checkInTime && checkOutTime) {
    const [h1, m1, s1] = checkInTime.split(":").map(Number);
    const [h2, m2, s2] = checkOutTime.split(":").map(Number);
    const inSec = h1 * 3600 + m1 * 60 + (s1 || 0);
    const outSec = h2 * 3600 + m2 * 60 + (s2 || 0);
    if (outSec > inSec) {
      workingHours = Number(((outSec - inSec) / 3600).toFixed(2));
    }
  }

  if (recIdx !== -1) {
    // Audit previous record
    const original = db.attendance_records[recIdx];
    db.attendance_records[recIdx] = {
      ...original,
      checkInTime: checkInTime || original.checkInTime,
      checkOutTime: checkOutTime || original.checkOutTime,
      totalWorkingHours: workingHours || original.totalWorkingHours,
      status,
      updatedAt: new Date().toISOString()
    };
    dbInstance.write(db);
    dbInstance.logAction(
      "ATTENDANCE_CORRECT",
      admin.email,
      `Manually corrected attendance for ${emp.name} on ${date}. Check-In: ${checkInTime}, Check-Out: ${checkOutTime}. Reason: ${reason}`
    );
  } else {
    // Create new
    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      employeeId,
      date,
      checkInTime,
      checkOutTime,
      totalWorkingHours: workingHours,
      status,
      scanConfidence: 100, // Manual bypass is certified by admin
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.attendance_records.push(newRecord);
    dbInstance.write(db);
    dbInstance.logAction(
      "ATTENDANCE_CORRECT",
      admin.email,
      `Manually created attendance for ${emp.name} on ${date}. Status: ${status}. Reason: ${reason}`
    );
  }

  res.json({ message: "Attendance record successfully corrected." });
});

// GET Settings
app.get("/api/settings", (req, res) => {
  const db = dbInstance.read();
  res.json(db.settings);
});

// POST Update Settings
app.post("/api/settings", requireAdmin, (req, res) => {
  const { officeStartTime, officeHalfDayTime, officeEndTime, antiSpoofingLevel } = req.body;
  const admin = (req as any).admin;

  if (!officeStartTime || !officeHalfDayTime || !officeEndTime) {
    res.status(400).json({ error: "Office start time, half-day threshold, and office end time are required." });
    return;
  }

  const db = dbInstance.read();
  db.settings = {
    officeStartTime,
    officeHalfDayTime,
    officeEndTime,
    antiSpoofingLevel: antiSpoofingLevel || "Medium"
  };

  dbInstance.write(db);
  dbInstance.logAction(
    "SETTINGS_UPDATE",
    admin.email,
    `Updated workplace configure timings: Start: ${officeStartTime}, HalfDay: ${officeHalfDayTime}, End: ${officeEndTime}`
  );

  res.json(db.settings);
});

// GET Audit Logs
app.get("/api/audit-logs", requireAdmin, (req, res) => {
  const db = dbInstance.read();
  // Sort desc by timestamp
  const sorted = [...db.audit_logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json(sorted);
});

// GET Attendance Statistics
app.get("/api/attendance/stats", requireAdmin, (req, res) => {
  const db = dbInstance.read();
  const todayStr = new Date().toISOString().split("T")[0];
  
  const activeEmployees = db.employees.filter(e => e.status === "Active");
  const totalEmployeesCount = activeEmployees.length;

  const todaysRecords = db.attendance_records.filter(r => r.date === todayStr);
  const presentToday = todaysRecords.filter(r => r.status === "Present").length;
  const lateToday = todaysRecords.filter(r => r.status === "Late").length;
  const halfDayToday = todaysRecords.filter(r => r.status === "Half Day").length;
  
  const checkedInCount = todaysRecords.length; // Total who scanned today
  const absentCount = Math.max(0, totalEmployeesCount - checkedInCount);

  // Weekly Trend statistics
  // Let's compute date keys for the last 7 days
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().split("T")[0]);
  }

  const weeklyTrend = last7Days.map(dateKey => {
    const records = db.attendance_records.filter(r => r.date === dateKey);
    const presentCount = records.filter(r => ["Present", "Late", "Half Day"].includes(r.status)).length;
    
    // Day name
    const dateObj = new Date(dateKey + "T00:00:00");
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    
    return {
      date: dateKey,
      day: dayName,
      present: presentCount,
      absent: Math.max(0, totalEmployeesCount - presentCount)
    };
  });

  // Department distribution
  const departments = Array.from(new Set(db.employees.map(e => e.department)));
  const deptDistribution = departments.map(dept => {
    const employeesInDept = db.employees.filter(e => e.department === dept && e.status === "Active");
    const empIds = employeesInDept.map(e => e.employeeId);
    const presentInDeptCount = db.attendance_records.filter(r => r.date === todayStr && empIds.includes(r.employeeId)).length;
    
    return {
      department: dept,
      total: employeesInDept.length,
      present: presentInDeptCount
    };
  });

  // Recent scans logs
  const recentAttendanceLog = todaysRecords.map(rec => {
    const emp = db.employees.find(e => e.employeeId === rec.employeeId);
    return {
      id: rec.id,
      employeeId: rec.employeeId,
      name: emp ? emp.name : "Unknown",
      department: emp ? emp.department : "",
      checkInTime: rec.checkInTime,
      checkOutTime: rec.checkOutTime,
      status: rec.status,
      confidence: rec.scanConfidence
    };
  });

  res.json({
    totalEmployees: totalEmployeesCount,
    presentToday: presentToday + lateToday + halfDayToday,
    presentOnTime: presentToday,
    lateToday,
    halfDayToday,
    absentToday: absentCount,
    weeklyTrend,
    deptDistribution,
    recentLogs: recentAttendanceLog
  });
});

// ----------------------------------------------------
// THE FACIAL RECOGNITION ATTENDANCE ENDPOINT
// ----------------------------------------------------
app.post("/api/attendance/scan", async (req, res) => {
  try {
    const { image, targetId, feature, clientLocalDate, clientLocalTime } = req.body;

    if (!image) {
      res.status(400).json({ error: "Webcam photo capture is missing." });
      return;
    }

    const db = dbInstance.read();
    
    // 1. Gather suitable candidates for matching
    let candidates: Employee[] = [];
    if (targetId) {
      // Specifically verify face against this target Employee ID
      const matchEmp = db.employees.find(e => e.employeeId.toUpperCase() === targetId.toUpperCase() || e.id === targetId);
      if (!matchEmp) {
        res.status(404).json({ error: `Employee matching ID ${targetId} is not found.` });
        return;
      }
      candidates = [matchEmp];
    } else {
      // General lookup: find all Active employees who have registered faceData
      candidates = db.employees.filter(e => e.status === "Active" && e.faceData);
    }

    const activeCandidates = candidates.filter(e => e.status === "Active");

    if (activeCandidates.length === 0) {
      res.status(400).json({
        error: "Recognition failed",
        message: "No active employees with registered biometric face templates found. Please register employee faces in the admin portal."
      });
      return;
    }

    // 2. Perform AI face matching with high-speed feature pre-filter and fallback
    const matchResult = await matchFace(
      image, 
      activeCandidates.map(c => ({
        employeeId: c.employeeId,
        name: c.name,
        department: c.department,
        faceData: c.faceData!
      })),
      feature
    );

    // Antispoofing validation trigger
    if (matchResult.isSpoof) {
      dbInstance.logAction(
        "SECURITY_ALERT",
        "SCAN_TERMINAL",
        `POSSIBLE SPOOFING SUSPECTED: Captured scan flagged by Gemini as static print/screen re-playback. Detail: ${matchResult.spoofDetails}`
      );
      res.status(400).json({
        error: "Liveness verification failed",
        message: "Anti-Spoofing Verification Failed: A mock physical image or digital screen was suspected. Please look directly into the camera.",
        details: matchResult.spoofDetails
      });
      return;
    }

    if (!matchResult.matched || !matchResult.employeeId) {
      res.status(400).json({
        error: "Face not recognized",
        message: "Face was not matched against registered company employees. Please position yourself correctly or register in the admin portal."
      });
      return;
    }

    // 3. Process matched employee Check-In or Check-Out
    const matchedEmp = db.employees.find(e => e.employeeId === matchResult.employeeId);
    if (!matchedEmp) {
      res.status(404).json({ error: "Scanned profile data error." });
      return;
    }

    const now = new Date();
    // Default fallback to server ISO if not passed by client
    const dateStr = clientLocalDate || now.toISOString().split("T")[0]; 
    const timeStr = clientLocalTime || now.toTimeString().split(" ")[0]; 

    // Determine hours and minutes based on local time string
    const [cHour, cMin] = timeStr.split(":").map(Number);
    const currentMinutes = (isNaN(cHour) ? now.getHours() : cHour) * 60 + (isNaN(cMin) ? now.getMinutes() : cMin);
    
    // Determine late/status based on timings
    const { officeStartTime, officeHalfDayTime } = db.settings;

    const [startHour, startMin] = officeStartTime.split(":").map(Number);
    const startMinutesLimit = startHour * 60 + startMin;

    const [halfHour, halfMin] = officeHalfDayTime.split(":").map(Number);
    const halfMinutesLimit = halfHour * 60 + halfMin;

    let calculatedStatus: "Present" | "Late" | "Half Day" = "Present";
    if (currentMinutes > halfMinutesLimit) {
      calculatedStatus = "Half Day";
    } else if (currentMinutes > startMinutesLimit) {
      calculatedStatus = "Late";
    }

    // Find existing record for today
    const existingRecordIdx = db.attendance_records.findIndex(r => r.employeeId === matchedEmp.employeeId && r.date === dateStr);

    if (existingRecordIdx === -1) {
      // Check-In (First capture)
      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        employeeId: matchedEmp.employeeId,
        date: dateStr,
        checkInTime: timeStr,
        status: calculatedStatus,
        scanConfidence: matchResult.confidence,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      db.attendance_records.push(newRecord);
      dbInstance.write(db);
      dbInstance.logAction(
        "ATTENDANCE_CHECK_IN",
        matchedEmp.name,
        `Marked CHECK-IN facial scan for ${matchedEmp.name} at ${timeStr}. Status: ${calculatedStatus}. Confidence: ${matchResult.confidence}%`
      );

      res.json({
        success: true,
        action: "CHECK_IN",
        employee: {
          employeeId: matchedEmp.employeeId,
          name: matchedEmp.name,
          department: matchedEmp.department,
          designation: matchedEmp.designation,
          email: matchedEmp.email,
          profilePhoto: matchedEmp.profilePhoto
        },
        time: timeStr,
        date: dateStr,
        status: calculatedStatus,
        confidence: matchResult.confidence,
        message: `Welcome ${matchedEmp.name}! Check-In registered at ${timeStr}.`
      });
    } else {
      const record = db.attendance_records[existingRecordIdx];
      
      // Check-Out (Second capture)
      if (record.checkInTime && !record.checkOutTime) {
        // Calculate working hours using the client-provided timeStr
        const [h1, m1, s1] = record.checkInTime.split(":").map(Number);
        const [h2, m2, s2] = timeStr.split(":").map(Number);

        const inSeconds = h1 * 3600 + m1 * 60 + s1;
        let outSeconds = (isNaN(h2) ? now.getHours() : h2) * 3600 + (isNaN(m2) ? now.getMinutes() : m2) * 60 + (isNaN(s2) ? now.getSeconds() : s2);
        if (outSeconds < inSeconds) {
          // Compensate if check-out crosses a midnight boundary relative to check-in
          outSeconds += 24 * 3600;
        }
        const workingHours = Number(((outSeconds - inSeconds) / 3600).toFixed(2));

        record.checkOutTime = timeStr;
        record.totalWorkingHours = workingHours;
        record.updatedAt = now.toISOString();

        db.attendance_records[existingRecordIdx] = record;
        dbInstance.write(db);
        dbInstance.logAction(
          "ATTENDANCE_CHECK_OUT",
          matchedEmp.name,
          `Marked CHECK-OUT facial scan for ${matchedEmp.name} at ${timeStr}. Total working hours: ${workingHours} hrs.`
        );

        res.json({
          success: true,
          action: "CHECK_OUT",
          employee: {
            employeeId: matchedEmp.employeeId,
            name: matchedEmp.name,
            department: matchedEmp.department,
            designation: matchedEmp.designation,
            email: matchedEmp.email,
            profilePhoto: matchedEmp.profilePhoto
          },
          time: timeStr,
          date: dateStr,
          checkInTime: record.checkInTime,
          checkOutTime: timeStr,
          totalWorkingHours: workingHours,
          status: record.status,
          confidence: matchResult.confidence,
          message: `Goodbye ${matchedEmp.name}! Check-Out registered at ${timeStr}. Calculated Working Hours: ${workingHours}h.`
        });
      } else {
        // Both Check-In and Check-Out already filled
        res.status(400).json({
          error: "Already completed",
          message: `Attendance already completed for today. Employee ${matchedEmp.name} has already checked in and checked out today.`
        });
      }
    }
  } catch (err: any) {
    console.error("Critical server error during facial scan handler:", err);
    res.status(500).json({
      error: "Server processing error",
      message: `An unexpected server error occurred: ${err?.message || err || "Internal server error"}`
    });
  }
});

// ----------------------------------------------------
// VITE OR STATIC MIDDLEWARE SETUP
// ----------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
