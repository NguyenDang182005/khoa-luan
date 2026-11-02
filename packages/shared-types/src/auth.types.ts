// ===== Auth Types =====
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  avatarUrl?: string | null;
  displayName?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface FirebaseLoginRequest {
  idToken: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  firebaseUid?: string;
  /** ID của dòng RefreshToken — JwtStrategy kiểm tra phiên còn sống mỗi request (thu hồi phiên thật) */
  sid?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ===== Enums =====
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

/** Returns true if the role has full admin access */
export function isAdminRole(role: UserRole | string): boolean {
  return role === UserRole.ADMIN;
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
  PROBATION = 'PROBATION',
}

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  UNPAID = 'UNPAID',
  EMERGENCY = 'EMERGENCY',
  OT = 'OT',
  LATE_PERMISSION = 'LATE_PERMISSION',
  BUSINESS_TRIP = 'BUSINESS_TRIP',
  OTHER = 'OTHER',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  REMOTE = 'REMOTE',
  ON_LEAVE = 'ON_LEAVE',
}

export enum ContractType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  PROBATION = 'PROBATION',
  FREELANCE = 'FREELANCE',
  INTERNSHIP = 'INTERNSHIP',
}

export enum PayrollStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}
