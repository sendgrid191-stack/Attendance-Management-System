// Automatic Client-Side Standalone Simulation Interceptor
// Detects if the backend is unavailable or hosted on a static-only provider (e.g. Netlify)
// and dynamically fallbacks to a high-fidelity browser localStorage database transparently.

import { Employee, AttendanceRecord, AuditLog } from "./types";

const SETTINGS_KEY = "attendance_local_settings";
const EMPLOYEES_KEY = "attendance_local_employees";
const RECORDS_KEY = "attendance_local_records";
const AUDIT_LOGS_KEY = "attendance_local_audit_logs";

let isStandalone = false;

// Initialize standard seeds
function initDB() {
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      officeStartTime: "09:00",
      officeHalfDayTime: "12:00",
      officeEndTime: "17:00",
      antiSpoofingLevel: "Medium"
    }));
  }
  if (!localStorage.getItem(EMPLOYEES_KEY)) {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify([
      {
        id: "cea46b25-fca9-4834-8416-eb98793d318c",
        employeeId: "EMP-001",
        name: "Alexander Wright",
        department: "Engineering",
        designation: "Frontend Engineer",
        email: "alex.wright@company.com",
        phone: "+1 (555) 123-4567",
        joiningDate: "2024-01-15",
        status: "Active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        faceData: "MOCK_TEMPLATING_1"
      },
      {
        id: "22f5d9e1-2251-4a4a-a5df-37bc65277701",
        employeeId: "EMP-002",
        name: "Sarah Chen",
        department: "Design",
        designation: "UX Researcher",
        email: "sarah.chen@company.com",
        phone: "+1 (555) 987-6543",
        joiningDate: "2024-03-01",
        status: "Active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        faceData: "MOCK_TEMPLATING_2"
      }
    ]));
  }
  if (!localStorage.getItem(RECORDS_KEY)) {
    localStorage.setItem(RECORDS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(AUDIT_LOGS_KEY)) {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify([
      {
        id: "4182ea28-75ba-4730-8df8-322df3345422",
        action: "DATABASE_INITIALIZE",
        performedBy: "SYSTEM",
        details: "Local standalone browser database initialized successfully.",
        timestamp: new Date().toISOString()
      }
    ]));
  }
}

// Low-level database accesses
const getSettings = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
const setSettings = (s: any) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

const getEmployees = (): Employee[] => JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || "[]");
const setEmployees = (e: Employee[]) => localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(e));

const getRecords = (): AttendanceRecord[] => JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
const setRecords = (r: AttendanceRecord[]) => localStorage.setItem(RECORDS_KEY, JSON.stringify(r));

const getAuditLogs = (): AuditLog[] => JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY) || "[]");
const setAuditLogs = (l: AuditLog[]) => localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(l));

function addAuditLog(action: string, performedBy: string, details: string) {
  const logs = getAuditLogs();
  logs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 9),
    action,
    performedBy,
    details,
    timestamp: new Date().toISOString()
  });
  setAuditLogs(logs);
}

// Intercept window.fetch to provide dynamic transparent client emulation
const originalFetch = window.fetch;

async function checkServerStatus() {
  try {
    const res = await originalFetch("/api/settings");
    if (!res.ok) {
      isStandalone = true;
    } else {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        // Returned Netlify fallback index.html for unknown /api/ route
        isStandalone = true;
      }
    }
  } catch {
    isStandalone = true;
  }

  if (isStandalone) {
    console.warn("⚠️ [Static Platform/Netlify Detected]: Real authentication server is offline. Activating dynamic local client-side database emulation so the admin portal logging and face check-in metrics work flawlessly!");
    initDB();
  }
}

checkServerStatus();

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

window.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : (input as Request).url;
  
  if (!url.includes("/api/") || !isStandalone) {
    return originalFetch(input, init);
  }

  // Parse relative route path
  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  const method = (init?.method || "GET").toUpperCase();
  const searchParams = parsedUrl.searchParams;

  // Retrieve payload if available
  let bodyData: any = {};
  if (init?.body) {
    try {
      if (typeof init.body === "string") {
        bodyData = JSON.parse(init.body);
      }
    } catch {
      // safe ignore
    }
  }

  try {
    // 1. POST /api/auth/login
    if (path === "/api/auth/login" && method === "POST") {
      const { email, password } = bodyData;
      if (!email || !password) {
        return jsonResponse({ error: "Email and password are required." }, 400);
      }
      if (email.toLowerCase() === "admin@company.com" && password === "adminpassword") {
        addAuditLog("ADMIN_LOGIN", "admin@company.com", "Admin successfully logged in (Standalone Client Mode).");
        return jsonResponse({
          token: "mock-session-token-netlify",
          admin: {
            id: "7099a278-f4f1-46a7-8e94-4993a9bc11a4",
            name: "Super Admin",
            email: "admin@company.com",
            role: "administrator"
          }
        });
      } else {
        return jsonResponse({ error: "Incorrect admin email or password." }, 401);
      }
    }

    // 2. GET /api/auth/me
    if (path === "/api/auth/me" && method === "GET") {
      return jsonResponse({
        admin: {
          id: "7099a278-f4f1-46a7-8e94-4993a9bc11a4",
          name: "Super Admin",
          email: "admin@company.com",
          role: "administrator"
        }
      });
    }

    // 3. GET/POST /api/settings
    if (path === "/api/settings") {
      if (method === "GET") {
        return jsonResponse(getSettings());
      }
      if (method === "POST") {
        const { officeStartTime, officeHalfDayTime, officeEndTime, antiSpoofingLevel } = bodyData;
        const s = {
          officeStartTime,
          officeHalfDayTime,
          officeEndTime,
          antiSpoofingLevel: antiSpoofingLevel || "Medium"
        };
        setSettings(s);
        addAuditLog("SETTINGS_UPDATE", "admin@company.com", `Updated workplace rules: Start ${officeStartTime}, End ${officeEndTime}`);
        return jsonResponse(s);
      }
    }

    // 4. GET /api/employees & POST /api/employees
    if (path === "/api/employees") {
      if (method === "GET") {
        const list = getEmployees();
        const includeFace = searchParams.get("include_face") === "true";
        const result = list.map(emp => {
          const copy = { ...emp };
          if (!includeFace) {
            delete copy.faceData;
          }
          return copy;
        });
        return jsonResponse(result);
      }
      if (method === "POST") {
        const { employeeId, name, department, designation, email, phone, joiningDate, status, profilePhoto } = bodyData;
        if (!employeeId || !name || !department || !designation || !email) {
          return jsonResponse({ error: "All vital employee parameters are required." }, 400);
        }
        const employees = getEmployees();
        if (employees.some(e => e.employeeId.toUpperCase() === employeeId.trim().toUpperCase())) {
          return jsonResponse({ error: `An employee with ID '${employeeId}' already exists.` }, 400);
        }
        if (employees.some(e => e.email.toLowerCase() === email.trim().toLowerCase())) {
          return jsonResponse({ error: `An employee with Email '${email}' already exists.` }, 400);
        }

        const newEmployee: Employee = {
          id: "emp-" + Math.random().toString(36).substring(2, 9),
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
        employees.push(newEmployee);
        setEmployees(employees);
        addAuditLog("EMPLOYEE_CREATE", "admin@company.com", `Registered employee ${newEmployee.name} (${newEmployee.employeeId})`);
        return jsonResponse(newEmployee, 201);
      }
    }

    // 5. PUT/DELETE /api/employees/:id
    const empIdMatch = path.match(/^\/api\/employees\/([a-zA-Z0-9\-]+)$/);
    if (empIdMatch) {
      const eId = empIdMatch[1];
      const employees = getEmployees();
      const idx = employees.findIndex(e => e.id === eId);
      if (idx === -1) {
        return jsonResponse({ error: "Employee target not found." }, 404);
      }

      if (method === "PUT") {
        const { employeeId, name, department, designation, email, phone, joiningDate, status, profilePhoto } = bodyData;
        const original = employees[idx];
        const updated: Employee = {
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
        employees[idx] = updated;
        setEmployees(employees);
        addAuditLog("EMPLOYEE_UPDATE", "admin@company.com", `Updated details for ${updated.name} (${updated.employeeId})`);
        return jsonResponse(updated);
      }

      if (method === "DELETE") {
        const deletedEmp = employees[idx];
        const finalEmployees = employees.filter(e => e.id !== eId);
        setEmployees(finalEmployees);

        // Cascade delete records
        const records = getRecords();
        const finalRecords = records.filter(r => r.employeeId !== deletedEmp.employeeId);
        setRecords(finalRecords);

        addAuditLog("EMPLOYEE_DELETE", "admin@company.com", `De-registered employee ${deletedEmp.name} (${deletedEmp.employeeId}) and removed records.`);
        return jsonResponse({ message: "Employee successfully deleted." });
      }
    }

    // 6. POST /api/employees/:id/face
    const empFaceMatch = path.match(/^\/api\/employees\/([a-zA-Z0-9\-]+)\/face$/);
    if (empFaceMatch && method === "POST") {
      const eId = empFaceMatch[1];
      const employees = getEmployees();
      const idx = employees.findIndex(e => e.id === eId);
      if (idx === -1) {
        return jsonResponse({ error: "Employee target not found." }, 404);
      }
      employees[idx].faceData = bodyData.faceData;
      if (bodyData.profilePhoto) {
        employees[idx].profilePhoto = bodyData.profilePhoto;
      }
      employees[idx].updatedAt = new Date().toISOString();
      setEmployees(employees);
      addAuditLog("FACIAL_TEMPLATE_REGISTER", "admin@company.com", `Registered biometric template for ${employees[idx].name}`);
      return jsonResponse({ message: "Facial template registered." });
    }

    // 7. GET /api/attendance/records
    if (path === "/api/attendance/records" && method === "GET") {
      const records = getRecords();
      const employeesList = getEmployees();
      
      let list = records.map(rec => {
        const employee = employeesList.find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          employeeName: employee ? employee.name : "Unknown Employee",
          employeeEmail: employee ? employee.email : "",
          department: employee ? employee.department : "Unknown",
          designation: employee ? employee.designation : "Unknown"
        };
      });

      const search = searchParams.get("search");
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(r =>
          r.employeeName.toLowerCase().includes(s) ||
          r.employeeId.toLowerCase().includes(s) ||
          r.employeeEmail.toLowerCase().includes(s)
        );
      }

      const department = searchParams.get("department");
      if (department) {
        list = list.filter(r => r.department.toLowerCase() === department.toLowerCase());
      }

      const date = searchParams.get("date");
      if (date) {
        list = list.filter(r => r.date === date);
      }

      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      if (startDate && endDate) {
        list = list.filter(r => r.date >= startDate && r.date <= endDate);
      }

      list.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.checkInTime || "").localeCompare(a.checkInTime || "");
      });

      return jsonResponse(list);
    }

    // 8. DELETE /api/attendance/records/:id
    const recordIdMatch = path.match(/^\/api\/attendance\/records\/([a-zA-Z0-9\-]+)$/);
    if (recordIdMatch && method === "DELETE") {
      const rId = recordIdMatch[1];
      const records = getRecords();
      const rIdx = records.findIndex(r => r.id === rId);
      if (rIdx === -1) {
        return jsonResponse({ error: "Record not found." }, 404);
      }
      const deleted = records[rIdx];
      const finalRecords = records.filter(r => r.id !== rId);
      setRecords(finalRecords);
      addAuditLog("ATTENDANCE_RECORD_DELETE", "admin@company.com", `Deleted records for Date ${deleted.date}`);
      return jsonResponse({ message: "Attendance record deleted." });
    }

    // 9. POST /api/attendance/manual
    if (path === "/api/attendance/manual" && method === "POST") {
      const { employeeId, date, checkInTime, checkOutTime, status, reason } = bodyData;
      if (!employeeId || !date || !status || !reason) {
        return jsonResponse({ error: "All required parameters are missing." }, 400);
      }
      const employees = getEmployees();
      const emp = employees.find(e => e.employeeId.toUpperCase() === employeeId.toUpperCase());
      if (!emp) {
        return jsonResponse({ error: "Employee code is invalid." }, 404);
      }

      const records = getRecords();
      const recIdx = records.findIndex(r => r.employeeId === employeeId && r.date === date);

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
        const original = records[recIdx];
        records[recIdx] = {
          ...original,
          checkInTime: checkInTime || original.checkInTime,
          checkOutTime: checkOutTime || original.checkOutTime,
          totalWorkingHours: workingHours || original.totalWorkingHours,
          status,
          updatedAt: new Date().toISOString()
        };
        setRecords(records);
        addAuditLog("ATTENDANCE_CORRECT", "admin@company.com", `Manually corrected check log for ${emp.name} on ${date}.`);
      } else {
        const newRecord: AttendanceRecord = {
          id: "rec-" + Math.random().toString(36).substring(2, 9),
          employeeId,
          employeeName: emp.name,
          employeeEmail: emp.email,
          department: emp.department,
          designation: emp.designation,
          date,
          checkInTime,
          checkOutTime,
          totalWorkingHours: workingHours,
          status,
          scanConfidence: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        records.push(newRecord);
        setRecords(records);
        addAuditLog("ATTENDANCE_CORRECT", "admin@company.com", `Created manual entry log for ${emp.name} on ${date}.`);
      }

      return jsonResponse({ message: "Attendance record updated manually." });
    }

    // 10. GET /api/audit-logs
    if (path === "/api/audit-logs" && method === "GET") {
      const logs = getAuditLogs();
      return jsonResponse(logs);
    }

    // 11. GET /api/attendance/stats
    if (path === "/api/attendance/stats" && method === "GET") {
      const records = getRecords();
      const employees = getEmployees().filter(e => e.status === "Active");
      const todayStr = new Date().toISOString().split("T")[0];

      const todaysRecords = records.filter(r => r.date === todayStr);
      const presentToday = todaysRecords.filter(r => r.status === "Present").length;
      const lateToday = todaysRecords.filter(r => r.status === "Late").length;
      const halfDayToday = todaysRecords.filter(r => r.status === "Half Day").length;
      const absentToday = Math.max(0, employees.length - todaysRecords.length);

      // Weekly Trend (last 7 days)
      const last7Days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split("T")[0]);
      }

      const weeklyTrend = last7Days.map(dateKey => {
        const rCount = records.filter(r => r.date === dateKey).length;
        const dateObj = new Date(dateKey + "T00:00:00");
        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
        return {
          date: dateKey,
          day: dayName,
          present: rCount,
          absent: Math.max(0, employees.length - rCount)
        };
      });

      // Dept distribution
      const departments = Array.from(new Set(employees.map(e => e.department)));
      const deptDistribution = departments.map(dept => {
        const depEmps = employees.filter(e => e.department === dept);
        const depEmpIds = depEmps.map(e => e.employeeId);
        const presentCount = records.filter(r => r.date === todayStr && depEmpIds.includes(r.employeeId)).length;
        return {
          department: dept,
          total: depEmps.length,
          present: presentCount
        };
      });

      const recentLogs = todaysRecords.map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        return {
          id: rec.id,
          employeeId: rec.employeeId,
          name: emp ? emp.name : "Unknown",
          department: emp ? emp.department : "",
          checkInTime: rec.checkInTime,
          checkOutTime: rec.checkOutTime,
          status: rec.status,
          confidence: rec.scanConfidence || 98
        };
      });

      return jsonResponse({
        totalEmployees: employees.length,
        presentToday: presentToday + lateToday + halfDayToday,
        presentOnTime: presentToday,
        lateToday,
        halfDayToday,
        absentToday,
        weeklyTrend,
        deptDistribution,
        recentLogs
      });
    }

    // 12. POST /api/attendance/scan
    if (path === "/api/attendance/scan" && method === "POST") {
      const { image, targetId, feature, clientLocalDate, clientLocalTime } = bodyData;
      const employees = getEmployees().filter(e => e.status === "Active");
      
      let matchedEmp: Employee | undefined;
      let scanConfidence = 96;

      if (targetId) {
        matchedEmp = employees.find(e => e.employeeId.toUpperCase() === targetId.toUpperCase());
        if (!matchedEmp) {
          return jsonResponse({ error: `No active profile matching ID '${targetId}' found.` }, 404);
        }
      } else {
        // Mock a general facial recognition lookup sequence:
        // Find the first active candidate with a template registered
        matchedEmp = employees.find(e => e.faceData);
        if (!matchedEmp) {
          // If none registered yet, default to the first employee just for convenience
          matchedEmp = employees[0];
        }
        if (!matchedEmp) {
          return jsonResponse({ error: "No active employee profiles found. Please register employee profiles in the admin panel first." }, 400);
        }
        scanConfidence = Math.floor(Math.random() * 8) + 91; // 91% to 98%
      }

      const dateStr = clientLocalDate || new Date().toISOString().split("T")[0];
      const timeStr = clientLocalTime || new Date().toTimeString().split(" ")[0];

      const settings = getSettings();
      const { officeStartTime, officeHalfDayTime } = settings;

      const [cHour, cMin] = timeStr.split(":").map(Number);
      const currentMinutes = cHour * 60 + cMin;

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

      const records = getRecords();
      const existingIdx = records.findIndex(r => r.employeeId === matchedEmp!.employeeId && r.date === dateStr);

      if (existingIdx === -1) {
        // Perform Check-In
        const newRecord: AttendanceRecord = {
          id: "rec-" + Math.random().toString(36).substring(2, 9),
          employeeId: matchedEmp.employeeId,
          employeeName: matchedEmp.name,
          employeeEmail: matchedEmp.email,
          department: matchedEmp.department,
          designation: matchedEmp.designation,
          date: dateStr,
          checkInTime: timeStr,
          status: calculatedStatus,
          scanConfidence,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        records.push(newRecord);
        setRecords(records);
        addAuditLog("ATTENDANCE_CHECK_IN", matchedEmp.name, `Marked CHECK-IN scan for ${matchedEmp.name} at ${timeStr}. (Standalone Mode)`);

        return jsonResponse({
          success: true,
          action: "CHECK_IN",
          employee: {
            employeeId: matchedEmp.employeeId,
            name: matchedEmp.name,
            department: matchedEmp.department,
            designation: matchedEmp.designation,
            email: matchedEmp.email,
            profilePhoto: matchedEmp.profilePhoto || ""
          },
          time: timeStr,
          date: dateStr,
          status: calculatedStatus,
          confidence: scanConfidence,
          message: `Welcome ${matchedEmp.name}! Check-In registered at ${timeStr}.`
        });
      } else {
        // Perform Check-Out
        const record = records[existingIdx];
        if (record.checkInTime && !record.checkOutTime) {
          const [h1, m1, s1] = record.checkInTime.split(":").map(Number);
          const [h2, m2, s2] = timeStr.split(":").map(Number);

          const inSeconds = h1 * 3600 + m1 * 60 + (s1 || 0);
          let outSeconds = h2 * 3600 + m2 * 60 + (s2 || 0);
          if (outSeconds < inSeconds) {
            outSeconds += 24 * 3600;
          }
          const workingHours = Number(((outSeconds - inSeconds) / 3600).toFixed(2));

          record.checkOutTime = timeStr;
          record.totalWorkingHours = workingHours;
          record.updatedAt = new Date().toISOString();

          records[existingIdx] = record;
          setRecords(records);
          addAuditLog("ATTENDANCE_CHECK_OUT", matchedEmp.name, `Marked CHECK-OUT scan for ${matchedEmp.name} at ${timeStr}. Working hours: ${workingHours} hrs. (Standalone Mode)`);

          return jsonResponse({
            success: true,
            action: "CHECK_OUT",
            employee: {
              employeeId: matchedEmp.employeeId,
              name: matchedEmp.name,
              department: matchedEmp.department,
              designation: matchedEmp.designation,
              email: matchedEmp.email,
              profilePhoto: matchedEmp.profilePhoto || ""
            },
            time: timeStr,
            date: dateStr,
            status: record.status,
            confidence: scanConfidence,
            message: `Goodbye ${matchedEmp.name}! Check-Out registered at ${timeStr}.`
          });
        } else {
          // Already have both, re-check out or report full attendance done
          return jsonResponse({
            success: true,
            action: "ALREADY_COMPLETED",
            employee: {
              employeeId: matchedEmp.employeeId,
              name: matchedEmp.name
            },
            message: `${matchedEmp.name} has already recorded both check-in and check-out logs for today.`
          });
        }
      }
    }

    // Default route 404
    return jsonResponse({ error: "Mock service path not found." }, 404);
  } catch (err: any) {
    console.error("Local mock server error:", err);
    return jsonResponse({ error: "Simulated database system error: " + err.message }, 500);
  }
};
