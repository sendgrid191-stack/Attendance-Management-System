export interface Admin {
  id: string;
  email: string;
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
  faceData?: string; // Base64 of facial snapshot template
  profilePhoto?: string; // Optional user profile photo base64
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  designation: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkingHours?: number;
  status: "Present" | "Late" | "Half Day" | "Absent";
  scanConfidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

export interface Settings {
  officeStartTime: string;
  officeHalfDayTime: string;
  officeEndTime: string;
  antiSpoofingLevel: "Low" | "Medium" | "High";
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  presentOnTime: number;
  lateToday: number;
  halfDayToday: number;
  absentToday: number;
  weeklyTrend: Array<{ date: string; day: string; present: number; absent: number }>;
  deptDistribution: Array<{ department: string; total: number; present: number }>;
  recentLogs: Array<{
    id: string;
    employeeId: string;
    name: string;
    department: string;
    checkInTime?: string;
    checkOutTime?: string;
    status: "Present" | "Late" | "Half Day" | "Absent";
    confidence: number;
  }>;
}
