import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "attendance_db.json");

// Define types
export interface Admin {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  joiningDate: string;
  status: "Active" | "Inactive";
  faceData?: string; // Base64 jpeg face biometric photo
  profilePhoto?: string; // Optional personal profile photo
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:MM:SS
  checkOutTime?: string; // HH:MM:SS
  totalWorkingHours?: number;
  status: "Present" | "Late" | "Half Day" | "Absent";
  scanConfidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string; // email or name of admin
  details: string;
  timestamp: string;
}

export interface Settings {
  officeStartTime: string; // e.g. "09:00"
  officeHalfDayTime: string; // e.g. "12:00"
  officeEndTime: string; // e.g. "17:00"
  antiSpoofingLevel: "Low" | "Medium" | "High";
}

export interface DatabaseSchema {
  admins: Admin[];
  employees: Employee[];
  attendance_records: AttendanceRecord[];
  audit_logs: AuditLog[];
  settings: Settings;
}

// Helper to hash password
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

class Database {
  private cache: DatabaseSchema | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DB_PATH)) {
      const defaultData: DatabaseSchema = {
        admins: [
          {
            id: crypto.randomUUID(),
            email: "admin@company.com",
            passwordHash: hashPassword("adminpassword"),
            name: "Super Admin",
            role: "administrator"
          }
        ],
        employees: [
          {
            id: crypto.randomUUID(),
            employeeId: "EMP-001",
            name: "Alexander Wright",
            department: "Engineering",
            designation: "Frontend Engineer",
            email: "alex.wright@company.com",
            phone: "+1 (555) 123-4567",
            joiningDate: "2024-01-15",
            status: "Active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: crypto.randomUUID(),
            employeeId: "EMP-002",
            name: "Sarah Chen",
            department: "Design",
            designation: "UX Researcher",
            email: "sarah.chen@company.com",
            phone: "+1 (555) 987-6543",
            joiningDate: "2024-03-01",
            status: "Active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        attendance_records: [],
        audit_logs: [
          {
            id: crypto.randomUUID(),
            action: "DATABASE_INITIALIZE",
            performedBy: "SYSTEM",
            details: "Database initialized with default schema, admin, and office settings.",
            timestamp: new Date().toISOString()
          }
        ],
        settings: {
          officeStartTime: "09:00",
          officeHalfDayTime: "12:00",
          officeEndTime: "17:00",
          antiSpoofingLevel: "Medium"
        }
      };
      this.write(defaultData);
    }
  }

  public read(): DatabaseSchema {
    try {
      if (this.cache) return this.cache;
      const content = fs.readFileSync(DB_PATH, "utf-8");
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch (error) {
      console.error("Failed to read database schema, returning fallback defaults:", error);
      this.init();
      return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    }
  }

  public write(data: DatabaseSchema): void {
    try {
      this.cache = data;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to write to database JSON:", error);
    }
  }

  public logAction(action: string, performedBy: string, details: string): void {
    const db = this.read();
    db.audit_logs.push({
      id: crypto.randomUUID(),
      action,
      performedBy,
      details,
      timestamp: new Date().toISOString()
    });
    this.write(db);
  }
}

export const dbInstance = new Database();
export default dbInstance;
