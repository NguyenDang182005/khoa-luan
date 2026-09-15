import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// "Ngẫu nhiên" all định — cùng 1 input cho cùng 1 kết quả, seed chạy lại ra đúng dữ liệu cũ
function det(...nums: number[]): number {
  let h = 2166136261;
  for (const n of nums) {
    h ^= n + 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100000;
}

/** Các ngày trong tuần (Mon–Fri) của 1 tháng */
function weekdays(year: number, month: number, upToDay = 31): number[] {
  const days: number[] = [];
  const last = Math.min(upToDay, new Date(year, month, 0).getDate());
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow >= 1 && dow <= 5) days.push(d);
  }
  return days;
}

async function main() {
  console.log('🌱 Seeding database...');

  // =====================
  // 1. SALARY CONFIG
  // =====================
  await prisma.salaryConfig.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      bhxhRate: 0.08,
      bhytRate: 0.015,
      bhtnRate: 0.01,
      pitFreeAmount: 11000000,
      overtimeRate: 1.5,
      otWeekendRate: 2.0,
      otHolidayRate: 3.0,
      standardWorkHours: 8,
    },
  });

  // =====================
  // 2. DEPARTMENTS
  // =====================
  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: { name: 'Nhân sự', code: 'HR', description: 'Phòng Quản lý Nhân sự' },
  });
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { name: 'Công nghệ thông tin', code: 'IT', description: 'Phòng CNTT' },
  });
  const salesDept = await prisma.department.upsert({
    where: { code: 'SALES' },
    update: {},
    create: { name: 'Kinh doanh', code: 'SALES', description: 'Phòng Kinh doanh' },
  });
  const csDept = await prisma.department.upsert({
    where: { code: 'CS' },
    update: {},
    create: { name: 'Chăm sóc khách hàng', code: 'CS', description: 'Phòng CSKH — tiếp quản escalation từ AI' },
  });
  const designDept = await prisma.department.upsert({
    where: { code: 'DESIGN' },
    update: {},
    create: { name: 'Thiết kế', code: 'DESIGN', description: 'Phòng UI/UX & Thương hiệu' },
  });

  // =====================
  // 3. POSITIONS
  // =====================
  const hrManagerPos = await prisma.position.upsert({
    where: { code: 'HR-MGR' },
    update: {},
    create: { title: 'Trưởng phòng Nhân sự', code: 'HR-MGR', level: 4, departmentId: hrDept.id, minSalary: 25000000, maxSalary: 50000000 },
  });
  const hrStaffPos = await prisma.position.upsert({
    where: { code: 'HR-STAFF' },
    update: {},
    create: { title: 'Chuyên viên Nhân sự', code: 'HR-STAFF', level: 2, departmentId: hrDept.id, minSalary: 10000000, maxSalary: 20000000 },
  });
  const devPos = await prisma.position.upsert({
    where: { code: 'IT-DEV' },
    update: {},
    create: { title: 'Lập trình viên', code: 'IT-DEV', level: 2, departmentId: itDept.id, minSalary: 15000000, maxSalary: 35000000 },
  });
  const seniorDevPos = await prisma.position.upsert({
    where: { code: 'IT-SR-DEV' },
    update: {},
    create: { title: 'Lập trình viên Cao cấp', code: 'IT-SR-DEV', level: 3, departmentId: itDept.id, minSalary: 25000000, maxSalary: 55000000 },
  });
  const testPos = await prisma.position.upsert({
    where: { code: 'IT-TEST' },
    update: {},
    create: { title: 'Kiểm thử phần mềm', code: 'IT-TEST', level: 2, departmentId: itDept.id, minSalary: 12000000, maxSalary: 25000000 },
  });
  const pmPos = await prisma.position.upsert({
    where: { code: 'IT-PM' },
    update: {},
    create: { title: 'Quản lý dự án', code: 'IT-PM', level: 4, departmentId: itDept.id, minSalary: 30000000, maxSalary: 60000000 },
  });
  const salesPos = await prisma.position.upsert({
    where: { code: 'SALES-EXE' },
    update: {},
    create: { title: 'Nhân viên Kinh doanh', code: 'SALES-EXE', level: 2, departmentId: salesDept.id, minSalary: 8000000, maxSalary: 20000000 },
  });
  const csLeadPos = await prisma.position.upsert({
    where: { code: 'CS-LEAD' },
    update: {},
    create: { title: 'Trưởng nhóm CSKH', code: 'CS-LEAD', level: 3, departmentId: csDept.id, minSalary: 18000000, maxSalary: 32000000 },
  });
  const csStaffPos = await prisma.position.upsert({
    where: { code: 'CS-STAFF' },
    update: {},
    create: { title: 'Nhân viên CSKH', code: 'CS-STAFF', level: 1, departmentId: csDept.id, minSalary: 7000000, maxSalary: 15000000 },
  });
  const uiuxPos = await prisma.position.upsert({
    where: { code: 'DS-UIUX' },
    update: {},
    create: { title: 'Thiết kế UI/UX', code: 'DS-UIUX', level: 2, departmentId: designDept.id, minSalary: 12000000, maxSalary: 28000000 },
  });

  // =====================
  // 4. USERS (tài khoản đăng nhập — upsert trước employee để map userId ổn định)
  // =====================
  const pwdAdmin = await bcrypt.hash('Admin@123', 10);
  const pwdEmp = await bcrypt.hash('Employee@123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hr-system.com' },
    update: { isActive: true, role: 'ADMIN' },
    create: { email: 'admin@hr-system.com', passwordHash: pwdAdmin, role: 'ADMIN' },
  });
  const devUser = await prisma.user.upsert({
    where: { email: 'tranthib@hr-system.com' },
    update: { isActive: true },
    create: { email: 'tranthib@hr-system.com', passwordHash: pwdEmp, role: 'EMPLOYEE' },
  });
  // Tài khoản portal chuẩn (được docs ghi trong hướng dẫn đăng nhập)
  const employee1User = await prisma.user.upsert({
    where: { email: 'employee1@company.com' },
    update: { isActive: true },
    create: { email: 'employee1@company.com', passwordHash: pwdEmp, role: 'EMPLOYEE' },
  });
  const employee2User = await prisma.user.upsert({
    where: { email: 'employee2@company.com' },
    update: { isActive: true },
    create: { email: 'employee2@company.com', passwordHash: pwdEmp, role: 'EMPLOYEE' },
  });
  const hrAdminUser = await prisma.user.upsert({
    where: { email: 'hr-admin@company.com' },
    update: { isActive: true, role: 'ADMIN' },
    create: { email: 'hr-admin@company.com', passwordHash: pwdAdmin, role: 'ADMIN' },
  });
  // 2 email cá nhân cũ — khóa để tránh đăng nhập nhầm
  await prisma.user.upsert({
    where: { email: 'nguyenvana@hr-system.com' },
    update: { isActive: false },
    create: { email: 'nguyenvana@hr-system.com', passwordHash: pwdEmp, role: 'EMPLOYEE', isActive: false },
  });
  await prisma.user.upsert({
    where: { email: 'phamvanc@hr-system.com' },
    update: { isActive: false },
    create: { email: 'phamvanc@hr-system.com', passwordHash: pwdEmp, role: 'EMPLOYEE', isActive: false },
  });

  // =====================
  // 5. EMPLOYEES (30 người — upsert theo employeeCode, KHÔNG deleteMany
  //    để hợp đồng/chấm công/lương của lần seed trước không bị cascade mất)
  // =====================
  interface EmpSeed {
    code: string;
    userId: string | null;
    fullName: string;
    email: string;
    phone: string;
    gender: 'MALE' | 'FEMALE';
    dob: string;
    address: string;
    nationalId: string;
    join: string;
    status: 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'TERMINATED';
    deptId: string;
    posId: string;
    contract: { num: string; type: 'FULL_TIME' | 'PART_TIME' | 'PROBATION'; salary: number; allowances: number };
  }

  const adminEmpSeed: EmpSeed = {
    code: 'EMP001', userId: adminUser.id, fullName: 'Trần Thị Admin', email: 'admin@hr-system.com',
    phone: '0901111111', gender: 'FEMALE', dob: '1985-03-15', address: '17 Nguyễn Huệ, Q.1, TP.HCM',
    nationalId: '123456789', join: '2020-01-01', status: 'ACTIVE', deptId: hrDept.id, posId: hrManagerPos.id,
    contract: { num: 'CTR-001', type: 'FULL_TIME', salary: 35000000, allowances: 5000000 },
  };

  const empSeeds: EmpSeed[] = [
    adminEmpSeed,
    { code: 'EMP002', userId: null, fullName: 'Lê Văn HR', email: 'hr@hr-system.com', phone: '0902222222', gender: 'MALE', dob: '1990-07-20', address: '45 Lê Lợi, Q.1, TP.HCM', nationalId: '234567890', join: '2022-03-01', status: 'ACTIVE', deptId: hrDept.id, posId: hrStaffPos.id, contract: { num: 'CTR-002', type: 'FULL_TIME', salary: 15000000, allowances: 2000000 } },
    { code: 'EMP003', userId: employee2User.id, fullName: 'Nguyễn Văn An', email: 'employee2@company.com', phone: '0903333333', gender: 'MALE', dob: '1992-05-10', address: '112 Nguyễn Trãi, Q.5, TP.HCM', nationalId: '345678901', join: '2021-06-01', status: 'ACTIVE', deptId: itDept.id, posId: seniorDevPos.id, contract: { num: 'CTR-003', type: 'FULL_TIME', salary: 30000000, allowances: 3000000 } },
    { code: 'EMP004', userId: devUser.id, fullName: 'Trần Thị Bình', email: 'tranthib@hr-system.com', phone: '0904444444', gender: 'FEMALE', dob: '1995-11-25', address: '78 Trường Chinh, Tân Bình, TP.HCM', nationalId: '456789012', join: '2023-09-01', status: 'ACTIVE', deptId: itDept.id, posId: devPos.id, contract: { num: 'CTR-004', type: 'FULL_TIME', salary: 18000000, allowances: 1500000 } },
    { code: 'EMP005', userId: employee1User.id, fullName: 'Phạm Văn Chinh', email: 'employee1@company.com', phone: '0905555555', gender: 'MALE', dob: '1993-02-28', address: '230 Bạch Đằng, Bình Thạnh, TP.HCM', nationalId: '567890123', join: '2024-01-15', status: 'ACTIVE', deptId: salesDept.id, posId: salesPos.id, contract: { num: 'CTR-005', type: 'PROBATION', salary: 10000000, allowances: 1000000 } },
    { code: 'EMP006', userId: hrAdminUser.id, fullName: 'Nguyễn Thị HR Admin', email: 'hr-admin@company.com', phone: '0906666666', gender: 'FEMALE', dob: '1988-09-12', address: '9 Phạm Văn Đồng, Thủ Đức, TP.HCM', nationalId: '678901234', join: '2023-01-02', status: 'ACTIVE', deptId: hrDept.id, posId: hrStaffPos.id, contract: { num: 'CTR-006', type: 'FULL_TIME', salary: 20000000, allowances: 2500000 } },
    // --- Phòng CSKH (EMP007–EMP014) ---
    { code: 'EMP007', userId: null, fullName: 'Võ Thị Hoa', email: 'emp007@company.com', phone: '0907777001', gender: 'FEMALE', dob: '1991-04-08', address: '24 Điện Biên Phủ, Q.3, TP.HCM', nationalId: '079191001234', join: '2022-06-13', status: 'ACTIVE', deptId: csDept.id, posId: csLeadPos.id, contract: { num: 'CTR-007', type: 'FULL_TIME', salary: 22000000, allowances: 3000000 } },
    { code: 'EMP008', userId: null, fullName: 'Hoàng Minh Tuấn', email: 'emp008@company.com', phone: '0907777002', gender: 'MALE', dob: '1996-08-19', address: '301 Hoàng Văn Thụ, Phú Nhuận, TP.HCM', nationalId: '079196002345', join: '2023-02-06', status: 'ACTIVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-008', type: 'FULL_TIME', salary: 9500000, allowances: 1200000 } },
    { code: 'EMP009', userId: null, fullName: 'Nguyễn Khánh Linh', email: 'emp009@company.com', phone: '0907777003', gender: 'FEMALE', dob: '1997-12-03', address: '15 Trường Chinh, Tân Phú, TP.HCM', nationalId: '079197003456', join: '2023-02-06', status: 'ACTIVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-009', type: 'FULL_TIME', salary: 9000000, allowances: 1200000 } },
    { code: 'EMP010', userId: null, fullName: 'Trương Quốc Bảo', email: 'emp010@company.com', phone: '0907777004', gender: 'MALE', dob: '1994-06-27', address: '88 Cộng Hòa, Tân Bình, TP.HCM', nationalId: '079194004567', join: '2023-08-14', status: 'ACTIVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-010', type: 'FULL_TIME', salary: 9200000, allowances: 1200000 } },
    { code: 'EMP011', userId: null, fullName: 'Lâm Thị Mai', email: 'emp011@company.com', phone: '0907777005', gender: 'FEMALE', dob: '1998-03-30', address: '56 Nguyễn Thị Minh Khai, Q.1, TP.HCM', nationalId: '079198005678', join: '2024-03-04', status: 'ACTIVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-011', type: 'FULL_TIME', salary: 8800000, allowances: 1000000 } },
    { code: 'EMP012', userId: null, fullName: 'Đặng Thị Ngọc Ánh', email: 'emp012@company.com', phone: '0907777006', gender: 'FEMALE', dob: '1993-10-11', address: '129 Nguyễn Đình Chiểu, Q.3, TP.HCM', nationalId: '079193006789', join: '2022-11-21', status: 'ON_LEAVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-012', type: 'FULL_TIME', salary: 9500000, allowances: 1200000 } },
    { code: 'EMP013', userId: null, fullName: 'Phan Thanh Lâm', email: 'emp013@company.com', phone: '0907777007', gender: 'MALE', dob: '1999-01-22', address: '42 Quang Trung, Gò Vấp, TP.HCM', nationalId: '079199007890', join: '2024-05-06', status: 'ACTIVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-013', type: 'FULL_TIME', salary: 8500000, allowances: 1000000 } },
    { code: 'EMP014', userId: null, fullName: 'Bùi Thị Thu Trang', email: 'emp014@company.com', phone: '0907777008', gender: 'FEMALE', dob: '1995-09-17', address: '77 Lý Thái Tổ, Q.10, TP.HCM', nationalId: '079195008901', join: '2023-10-02', status: 'ACTIVE', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-014', type: 'FULL_TIME', salary: 9000000, allowances: 1100000 } },
    // --- Phòng Thiết kế (EMP015–EMP019) ---
    { code: 'EMP015', userId: null, fullName: 'Lý Gia Hân', email: 'emp015@company.com', phone: '0908888001', gender: 'FEMALE', dob: '1996-02-14', address: '31 Nguyễn Thị Diệu, Q.3, TP.HCM', nationalId: '079196009012', join: '2023-04-10', status: 'ACTIVE', deptId: designDept.id, posId: uiuxPos.id, contract: { num: 'CTR-015', type: 'FULL_TIME', salary: 20000000, allowances: 2000000 } },
    { code: 'EMP016', userId: null, fullName: 'Châu Văn Long', email: 'emp016@company.com', phone: '0908888002', gender: 'MALE', dob: '1992-07-09', address: '204 Nguyễn Xí, Bình Thạnh, TP.HCM', nationalId: '079192010123', join: '2022-09-19', status: 'ACTIVE', deptId: designDept.id, posId: uiuxPos.id, contract: { num: 'CTR-016', type: 'FULL_TIME', salary: 23000000, allowances: 2500000 } },
    { code: 'EMP017', userId: null, fullName: 'Tạ Thị Kim Ngân', email: 'emp017@company.com', phone: '0908888003', gender: 'FEMALE', dob: '1999-05-05', address: '18 Hoa Sứ, Phú Nhuận, TP.HCM', nationalId: '079199011234', join: '2025-01-06', status: 'ACTIVE', deptId: designDept.id, posId: uiuxPos.id, contract: { num: 'CTR-017', type: 'PART_TIME', salary: 8000000, allowances: 500000 } },
    { code: 'EMP018', userId: null, fullName: 'Đoàn Anh Khoa', email: 'emp018@company.com', phone: '0908888004', gender: 'MALE', dob: '1994-11-28', address: '95 Bình Long, Bình Tân, TP.HCM', nationalId: '079194012345', join: '2023-06-12', status: 'TERMINATED', deptId: designDept.id, posId: uiuxPos.id, contract: { num: 'CTR-018', type: 'FULL_TIME', salary: 19000000, allowances: 1500000 } },
    { code: 'EMP019', userId: null, fullName: 'Hồ Thị Bích Ngọc', email: 'emp019@company.com', phone: '0908888005', gender: 'FEMALE', dob: '1997-08-23', address: '60 Lê Văn Sỹ, Q.3, TP.HCM', nationalId: '079197013456', join: '2024-08-05', status: 'ACTIVE', deptId: designDept.id, posId: uiuxPos.id, contract: { num: 'CTR-019', type: 'FULL_TIME', salary: 17000000, allowances: 1500000 } },
    // --- Phòng IT (EMP020–EMP025) ---
    { code: 'EMP020', userId: null, fullName: 'Ngô Hải Đăng', email: 'emp020@company.com', phone: '0909999001', gender: 'MALE', dob: '1993-03-03', address: '12 Trần Não, Thủ Đức, TP.HCM', nationalId: '079193014567', join: '2022-01-10', status: 'ACTIVE', deptId: itDept.id, posId: pmPos.id, contract: { num: 'CTR-020', type: 'FULL_TIME', salary: 38000000, allowances: 5000000 } },
    { code: 'EMP021', userId: null, fullName: 'Trịnh Công Duy', email: 'emp021@company.com', phone: '0909999002', gender: 'MALE', dob: '1998-09-15', address: '390 Hoàng Diệu, Q.4, TP.HCM', nationalId: '079198015678', join: '2024-01-08', status: 'ACTIVE', deptId: itDept.id, posId: devPos.id, contract: { num: 'CTR-021', type: 'FULL_TIME', salary: 19000000, allowances: 1500000 } },
    { code: 'EMP022', userId: null, fullName: 'Cao Thị Mỹ Duyên', email: 'emp022@company.com', phone: '0909999003', gender: 'FEMALE', dob: '1999-02-21', address: '27 Văn Chung, Q.1, TP.HCM', nationalId: '079199016789', join: '2024-07-01', status: 'ACTIVE', deptId: itDept.id, posId: testPos.id, contract: { num: 'CTR-022', type: 'FULL_TIME', salary: 14000000, allowances: 1000000 } },
    { code: 'EMP023', userId: null, fullName: 'Dương Văn Phiệt', email: 'emp023@company.com', phone: '0909999004', gender: 'MALE', dob: '1991-12-12', address: '154 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM', nationalId: '079191017890', join: '2021-10-18', status: 'ACTIVE', deptId: itDept.id, posId: seniorDevPos.id, contract: { num: 'CTR-023', type: 'FULL_TIME', salary: 32000000, allowances: 3000000 } },
    { code: 'EMP024', userId: null, fullName: 'Mạc Thị Hạnh', email: 'emp024@company.com', phone: '0909999005', gender: 'FEMALE', dob: '1996-06-06', address: '88 Phan Xích Long, Phú Nhuận, TP.HCM', nationalId: '079196018901', join: '2023-11-06', status: 'ACTIVE', deptId: itDept.id, posId: devPos.id, contract: { num: 'CTR-024', type: 'FULL_TIME', salary: 18000000, allowances: 1500000 } },
    { code: 'EMP025', userId: null, fullName: 'Seo Văn Trường', email: 'emp025@company.com', phone: '0909999006', gender: 'MALE', dob: '1997-04-17', address: '35 Sơn Kỳ, Tân Phú, TP.HCM', nationalId: '079197019012', join: '2024-09-02', status: 'ACTIVE', deptId: itDept.id, posId: devPos.id, contract: { num: 'CTR-025', type: 'FULL_TIME', salary: 17000000, allowances: 1500000 } },
    // --- Nhân sự & Kinh doanh (EMP026–EMP030) ---
    { code: 'EMP026', userId: null, fullName: 'Đinh Thị Thanh Hà', email: 'emp026@company.com', phone: '0901111222', gender: 'FEMALE', dob: '1994-01-29', address: '71 Nguyễn Văn Trỗi, Phú Nhuận, TP.HCM', nationalId: '079194020123', join: '2023-03-20', status: 'ACTIVE', deptId: hrDept.id, posId: hrStaffPos.id, contract: { num: 'CTR-026', type: 'FULL_TIME', salary: 14000000, allowances: 1500000 } },
    { code: 'EMP027', userId: null, fullName: 'Vương Quốc Huy', email: 'emp027@company.com', phone: '0901111333', gender: 'MALE', dob: '1998-10-08', address: '9 Hunnicut, Bình Thạnh, TP.HCM', nationalId: '079198021234', join: '2024-06-03', status: 'ACTIVE', deptId: hrDept.id, posId: hrStaffPos.id, contract: { num: 'CTR-027', type: 'FULL_TIME', salary: 12000000, allowances: 1200000 } },
    { code: 'EMP028', userId: null, fullName: 'Lại Thị Kim Chi', email: 'emp028@company.com', phone: '0901111444', gender: 'FEMALE', dob: '1995-05-25', address: '140 Nguyễn Văn Luật, Bình Tân, TP.HCM', nationalId: '079195022345', join: '2023-07-17', status: 'ACTIVE', deptId: salesDept.id, posId: salesPos.id, contract: { num: 'CTR-028', type: 'FULL_TIME', salary: 12000000, allowances: 2000000 } },
    { code: 'EMP029', userId: null, fullName: 'Ông Thanh Tùng', email: 'emp029@company.com', phone: '0901111555', gender: 'MALE', dob: '2000-03-12', address: '22 Hà Tôn Quyền, Q.11, TP.HCM', nationalId: '079200023456', join: '2026-08-17', status: 'PROBATION', deptId: salesDept.id, posId: salesPos.id, contract: { num: 'CTR-029', type: 'PROBATION', salary: 8000000, allowances: 800000 } },
    { code: 'EMP030', userId: null, fullName: 'Ninh Thị Diễm My', email: 'emp030@company.com', phone: '0901111666', gender: 'FEMALE', dob: '2001-07-07', address: '5 Bà Huyện Thanh Quan, Q.3, TP.HCM', nationalId: '079200124567', join: '2026-08-24', status: 'PROBATION', deptId: csDept.id, posId: csStaffPos.id, contract: { num: 'CTR-030', type: 'PROBATION', salary: 7500000, allowances: 700000 } },
  ];

  // Tạo user placeholder cho nhân viên không có tài khoản đăng nhập riêng
  async function ensureUser(seed: EmpSeed) {
    if (seed.userId) return seed.userId;
    const email = seed.email;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: pwdEmp, role: 'EMPLOYEE' },
    });
    return u.id;
  }

  const employees: Record<string, { id: string; seed: EmpSeed }> = {};
  for (const seed of empSeeds) {
    const userId = await ensureUser(seed);
    const emp = await prisma.employee.upsert({
      where: { employeeCode: seed.code },
      update: { userId, status: seed.status },
      create: {
        employeeCode: seed.code,
        userId,
        fullName: seed.fullName,
        email: seed.email,
        phone: seed.phone,
        gender: seed.gender,
        dateOfBirth: new Date(seed.dob),
        address: seed.address,
        nationalId: seed.nationalId,
        joinDate: new Date(seed.join),
        status: seed.status,
        departmentId: seed.deptId,
        positionId: seed.posId,
      },
    });
    employees[seed.code] = { id: emp.id, seed };
  }

  // Chuỗi quản lý: Admin quản HR + các trưởng nhóm; EMP007 quản team CSKH; EMP003 quản IT dev
  const byCode = (c: string) => employees[c]!.id;
  const managerLinks: Array<[string, string[]]> = [
    ['EMP001', ['EMP002', 'EMP006', 'EMP020', 'EMP007']],
    ['EMP003', ['EMP004', 'EMP021', 'EMP022', 'EMP023', 'EMP024', 'EMP025']],
    ['EMP007', ['EMP008', 'EMP009', 'EMP010', 'EMP011', 'EMP012', 'EMP013', 'EMP014', 'EMP030']],
    ['EMP016', ['EMP015', 'EMP017', 'EMP019']],
    ['EMP005', ['EMP028', 'EMP029']],
  ];
  for (const [mgr, subs] of managerLinks) {
    for (const sub of subs) {
      await prisma.employee.update({ where: { id: byCode(sub) }, data: { managerId: byCode(mgr) } });
    }
  }

  // =====================
  // 6. CONTRACTS
  // =====================
  for (const seed of empSeeds) {
    await prisma.contract.upsert({
      where: { contractNumber: seed.contract.num },
      update: {},
      create: {
        employeeId: byCode(seed.code),
        contractNumber: seed.contract.num,
        type: seed.contract.type,
        startDate: new Date(seed.join),
        baseSalary: seed.contract.salary,
        allowances: seed.contract.allowances,
        signedDate: new Date(seed.join),
        isActive: seed.status !== 'TERMINATED',
      },
    });
  }
  // Hợp đồng của nhân viên nghỉ việc — tắt active + endDate
  await prisma.contract.updateMany({
    where: { contractNumber: 'CTR-018' },
    data: { isActive: false, endDate: new Date('2026-07-31') },
  });

  // =====================
  // 7. PAYROLL — tháng 6 (PAID), 7 (PAID), 8 (APPROVED), 9 (DRAFT chờ duyệt)
  // =====================
  const joinMonth = (seed: EmpSeed) => Number(seed.join.slice(5, 7));
  const joinYear = (seed: EmpSeed) => Number(seed.join.slice(0, 4));
  const leaveFactor: Record<string, number> = { ACTIVE: 1, PROBATION: 1, ON_LEAVE: 0.5, TERMINATED: 1 };

  for (const seed of empSeeds) {
    const empId = byCode(seed.code);
    for (const month of [6, 7, 8, 9]) {
      // Nhân viên mới vào sau tháng hiện tại thì bỏ qua; người nghỉ việc tính đến tháng 7
      if (joinYear(seed) === 2026 && month < joinMonth(seed)) continue;
      if (seed.status === 'TERMINATED' && month > 7) continue;
      if (month === 9 && seed.join > '2026-09-01') continue;

      const base = seed.contract.salary;
      const allowances = seed.contract.allowances;
      const workDays = 23;
      const actual = Math.max(15, Math.round(workDays * (0.9 + (det(empId.length, seed.code.length, month) % 11) / 100) * (leaveFactor[seed.status] ?? 1)));
      const otHours = det(empId.length, month) % 5 === 0 ? 4 : det(empId.length, month) % 7 === 0 ? 2 : 0;
      const socialIns = base * (0.08 + 0.015 + 0.01);
      const hourlyRate = base / (workDays * 8);
      const otPay = otHours * hourlyRate * 1.5;
      const gross = base + allowances + otPay;
      const taxableIncome = Math.max(0, base + otPay - socialIns - 11000000);
      const pit = calcPIT(taxableIncome);
      const netSalary = Math.round(gross - socialIns - pit);
      const status = month === 9 ? 'DRAFT' : month === 8 ? 'APPROVED' : 'PAID';

      await prisma.payroll.upsert({
        where: { employeeId_month_year: { employeeId: empId, month, year: 2026 } },
        update: {
          status,
          paidAt: status === 'PAID' ? new Date(`2026-${String(month).padStart(2, '0')}-28T10:00:00`) : null,
          note: status === 'DRAFT' ? 'Chờ HR Admin duyệt kỳ lương tháng 9' : null,
        },
        create: {
          employeeId: empId,
          month,
          year: 2026,
          baseSalary: base,
          allowances,
          bonus: 0,
          deductions: Math.round(socialIns),
          tax: pit,
          netSalary,
          workingDays: workDays,
          actualWorkingDays: month === 9 ? workDays : actual,
          overtimeHours: otHours,
          overtimePay: Math.round(otPay),
          status,
          paidAt: status === 'PAID' ? new Date(`2026-${String(month).padStart(2, '0')}-28T10:00:00`) : null,
          note: status === 'DRAFT' ? 'Chờ HR Admin duyệt kỳ lương tháng 9' : null,
        },
      });
    }
  }

  // =====================
  // 8. ATTENDANCE — tháng 7, 8 (cả tháng) + 9 (từ mùng 1 đến hết ngày 9)
  // =====================
  const attendanceRows: Array<{
    employeeId: string; date: Date; checkIn: Date; checkOut: Date | null;
    status: 'PRESENT' | 'LATE' | 'REMOTE' | 'ABSENT'; workHours: number; overtime: number;
    location: string; dayType: 'NORMAL';
  }> = [];

  for (const seed of empSeeds) {
    const empId = byCode(seed.code);
    if (seed.status === 'TERMINATED') {
      // nghỉ việc: chỉ chấm công tới 31/7
      for (const month of [6, 7]) {
        for (const day of weekdays(2026, month)) {
          pushAttendance(attendanceRows, empId, seed, month, day, 2026);
        }
      }
      continue;
    }
    for (const month of [6, 7, 8]) {
      for (const day of weekdays(2026, month)) {
        pushAttendance(attendanceRows, empId, seed, month, day, 2026);
      }
    }
    if (seed.join > '2026-09-01') {
      // nhân viên mới giữa tháng 9: chấm từ ngày vào
      const fromDay = Number(seed.join.slice(8, 10));
      for (const day of weekdays(2026, 9, 9)) {
        if (day >= fromDay) pushAttendance(attendanceRows, empId, seed, 9, day, 2026);
      }
    } else {
      for (const day of weekdays(2026, 9, 9)) {
        pushAttendance(attendanceRows, empId, seed, 9, day, 2026);
      }
    }
  }

  await prisma.attendance.createMany({ data: attendanceRows, skipDuplicates: true });

  // =====================
  // 9. LEAVE REQUESTS (xoá & tạo lại — dữ liệu demo, đảm bảo đủ đơn PENDING để duyệt)
  // =====================
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveRequest.createMany({
      data: [
        { employeeId: byCode('EMP004'), type: 'ANNUAL', startDate: new Date('2026-08-25'), endDate: new Date('2026-08-26'), totalDays: 2, reason: 'Nghỉ phép năm về quê', status: 'APPROVED', approvedById: byCode('EMP003'), approvedAt: new Date('2026-08-20') },
        { employeeId: byCode('EMP002'), type: 'SICK', startDate: new Date('2026-08-19'), endDate: new Date('2026-08-19'), totalDays: 1, reason: 'Sốt, đi khám bác sĩ', status: 'APPROVED', approvedById: byCode('EMP001'), approvedAt: new Date('2026-08-19') },
        // 3 đơn PENDING cho demo duyệt phép trên Dashboard
        { employeeId: byCode('EMP020'), type: 'ANNUAL', startDate: new Date('2026-09-14'), endDate: new Date('2026-09-15'), totalDays: 2, reason: 'Nghỉ phép năm du lịch gia đình', status: 'PENDING' },
        { employeeId: byCode('EMP008'), type: 'SICK', startDate: new Date('2026-09-10'), endDate: new Date('2026-09-10'), totalDays: 1, reason: 'Đau bụng đi khám, có giấy báo của phòng khám', status: 'PENDING' },
        { employeeId: byCode('EMP015'), type: 'EMERGENCY', startDate: new Date('2026-09-11'), endDate: new Date('2026-09-11'), totalDays: 1, reason: 'Việc gia đình khẩn cần xử lý trong ngày', status: 'PENDING' },
        { employeeId: byCode('EMP012'), type: 'MATERNITY', startDate: new Date('2026-09-01'), endDate: new Date('2026-11-30'), totalDays: 62, reason: 'Thai sản theo quy định luật lao động', status: 'APPROVED', approvedById: byCode('EMP007'), approvedAt: new Date('2026-08-25') },
        { employeeId: byCode('EMP022'), type: 'UNPAID', startDate: new Date('2026-09-21'), endDate: new Date('2026-09-30'), totalDays: 8, reason: 'Nghỉ không lương về hồ sơ cá nhân', status: 'REJECTED', approvedById: byCode('EMP020'), approvedAt: new Date('2026-09-02'), rejectionReason: 'Giai đoạn nước rút dự án, xin dời sang tháng 10' },
  ],
  });

  // =====================
  // 10. ONBOARDING
  // =====================
  const tasks = [
    { title: 'Ký hợp đồng lao động', category: 'paperwork', dueAfterDays: 1, order: 1 },
    { title: 'Nhận máy tính & thiết bị', category: 'equipment', dueAfterDays: 1, order: 2 },
    { title: 'Tham gia buổi hướng dẫn nội quy', category: 'training', dueAfterDays: 3, order: 3 },
    { title: 'Gặp gỡ đồng nghiệp trong phòng', category: 'introduction', dueAfterDays: 3, order: 4 },
    { title: 'Hoàn thành khóa học an toàn thông tin', category: 'training', dueAfterDays: 7, order: 5 },
    { title: 'Thiết lập tài khoản hệ thống (email, Slack)', category: 'equipment', dueAfterDays: 2, order: 6 },
  ];
  const createdTasks = [];
  for (const t of tasks) {
    const task = await prisma.onboardingTask.upsert({
      where: { id: `onboarding-task-${t.order}` },
      update: {},
      create: { id: `onboarding-task-${t.order}`, ...t },
    });
    createdTasks.push(task);
  }
  // Tiến độ onboarding: EMP005 (cũ), EMP029/EMP030 (mới tháng 8/2026)
  for (const code of ['EMP005', 'EMP029', 'EMP030']) {
    for (const task of createdTasks) {
      const done = code === 'EMP005' ? task.order <= 3 : task.order <= 2;
      await prisma.onboardingProgress.upsert({
        where: { employeeId_taskId: { employeeId: byCode(code), taskId: task.id } },
        update: {},
        create: {
          employeeId: byCode(code),
          taskId: task.id,
          status: done ? 'COMPLETED' : 'PENDING',
          completedAt: done ? new Date(code === 'EMP005' ? '2026-01-16' : '2026-08-25') : null,
        },
      });
    }
  }

  // =====================
  // 11. TRAINING QUESTIONS (xoá & tạo lại — attempt chỉ giữ questionId nên xoá an toàn)
  // =====================
  await prisma.trainingQuestion.deleteMany({});
  {
    await prisma.trainingQuestion.createMany({
      data: [
        // Quiz — CUSTOMER_COMPLAINT
        { scenario: 'CUSTOMER_COMPLAINT', type: 'quiz', order: 1, question: 'Bước đầu tiên trong quy trình L.E.A.R khi xử lý khiếu nại khách hàng là gì?', optionA: 'Giải thích lý do', optionB: 'Lắng nghe và thể hiện sự đồng cảm', optionC: 'Đề xuất giải pháp ngay', optionD: 'Chuyển cho cấp trên', correctAnswer: 'B', explanation: 'L = Listen (Lắng nghe) — bước đầu tiên và quan trọng nhất' },
        { scenario: 'CUSTOMER_COMPLAINT', type: 'quiz', order: 2, question: 'Khi khách hàng dọa "sẽ kiện ra tòa", nhân viên nên làm gì?', optionA: 'Tranh luận để bào chữa', optionB: 'Cúp máy để tránh leo thang', optionC: 'Bình tĩnh ghi nhận, xin lỗi và leo thang lên quản lý', optionD: 'Hứa hẹn bồi thường ngay', correctAnswer: 'C', explanation: 'Escalation đúng quy trình bảo vệ cả khách hàng lẫn nhân viên' },
        { scenario: 'CUSTOMER_COMPLAINT', type: 'quiz', order: 3, question: 'Thời gian phản hồi tối đa cho khiếu nại ưu tiên cao là bao lâu?', optionA: '24 giờ', optionB: '4 giờ', optionC: '1 giờ', optionD: '48 giờ', correctAnswer: 'C', explanation: 'Khiếu nại VIP/ưu tiên cao cần phản hồi trong 1 giờ' },
        { scenario: 'CUSTOMER_COMPLAINT', type: 'quiz', order: 4, question: 'PII Masking trong hệ thống có nghĩa là gì?', optionA: 'Xóa thông tin khách hàng', optionB: 'Che giấu thông tin nhạy cảm trước khi gửi lên AI', optionC: 'Mã hóa toàn bộ database', optionD: 'Yêu cầu xác minh danh tính', correctAnswer: 'B', explanation: 'PII Masking che CCCD, SĐT, Email trước khi AI xử lý' },
        { scenario: 'CUSTOMER_COMPLAINT', type: 'quiz', order: 5, question: 'Sau khi giải quyết xong khiếu nại, bước cuối cùng là gì?', optionA: 'Đóng ticket ngay', optionB: 'Ghi nhận vào hệ thống và follow-up khách hàng', optionC: 'Gửi email xin lỗi form chuẩn', optionD: 'Chờ khách hàng liên hệ lại', correctAnswer: 'B', explanation: 'Follow-up và ghi nhận đảm bảo chất lượng dịch vụ liên tục' },
        // Scenario — CUSTOMER_COMPLAINT
        { scenario: 'CUSTOMER_COMPLAINT', type: 'scenario', order: 6, question: 'Khách hàng Nguyễn Văn A đặt hàng 500 áo in logo công ty cho sự kiện ra mắt sản phẩm ngày mai, nhưng hôm nay nhận được chỉ 200 áo bị in sai màu. Anh/chị là nhân viên CSKH. Anh/chị sẽ xử lý tình huống này như thế nào? (Trả lời đầy đủ theo quy trình L.E.A.R)' },
        { scenario: 'CUSTOMER_COMPLAINT', type: 'scenario', order: 7, question: 'Sau khi xử lý ca trên, cấp trên yêu cầu anh/chị viết báo cáo tóm tắt sự vụ và đề xuất cải tiến quy trình để tránh tái diễn. Anh/chị sẽ viết gì?' },
        // Quiz — COLLEAGUE_CONFLICT
        { scenario: 'COLLEAGUE_CONFLICT', type: 'quiz', order: 1, question: 'Khi đồng nghiệp trong nhóm phản đối gay gắt ý tưởng của bạn trước mặt cả phòng, bạn nên?', optionA: 'Phản đối lại ngay để bảo vệ thể diện', optionB: 'Ghi nhận quan điểm, đề xuất thảo luận riêng sau cuộc họp', optionC: 'Im lặng đến hết cuộc họp', optionD: 'Báo cáo trưởng phòng ngay tại chỗ', correctAnswer: 'B', explanation: 'Gỡ căng thẳng và chuyển tranh luận sang môi trường riêng hiệu quả hơn' },
        { scenario: 'COLLEAGUE_CONFLICT', type: 'quiz', order: 2, question: 'Nguyên tắc "phê bình việc, không phê bình người" có ý nghĩa gì?', optionA: 'Chỉ nhắm vào kết quả công việc, không công kích cá nhân', optionB: 'Không bao giờ được nhắc đến tên người khác', optionC: 'Phê bình qua email cho có bằng chứng', optionD: 'Chỉ quản lý được phép phê bình', correctAnswer: 'A', explanation: 'Tách vấn đề khỏi cá nhân giúp mâu thuẫn không lan rộng' },
        { scenario: 'COLLEAGUE_CONFLICT', type: 'scenario', order: 3, question: 'Đồng nghiệp cùng phòng liên tục giao việc muộn khiến deadline nhóm bị trễ 2 lần liền. Trưởng nhóm yêu cầu bạn trao đổi trực tiếp với người đó. Bạn sẽ mở đầu cuộc trao đổi như thế nào?' },
      ],
    });
  }
  const allQuestions = await prisma.trainingQuestion.findMany();
  const quizBy = (scenario: string, order: number) => allQuestions.find((q) => q.scenario === scenario && q.order === order && q.type === 'quiz');
  const scenBy = (scenario: string, order: number) => allQuestions.find((q) => q.scenario === scenario && q.order === order && q.type === 'scenario');

  // =====================
  // 12. TRAINING SESSIONS + ATTEMPTS (xoá & tạo lại — dữ liệu demo phân tích đào tạo)
  // =====================
  await prisma.trainingAttempt.deleteMany({});
  await prisma.trainingSession.deleteMany({});

  const trainingSeeds = [
    { code: 'EMP005', scenario: 'CUSTOMER_COMPLAINT' as const, quizScore: 80, ai: { professional: 82, empathy: 78, problemSolving: 80, clarity: 85 }, feedback: 'Xử lý tốt quy trình L.E.A.R, cần mạnh dạn đề xuất phương án bồi thường cụ thể hơn.' },
    { code: 'EMP008', scenario: 'CUSTOMER_COMPLAINT' as const, quizScore: 100, ai: { professional: 92, empathy: 90, problemSolving: 88, clarity: 90 }, feedback: 'Xuất sắc — giữ được tông giọng bình tĩnh, escalation đúng thời điểm.' },
    { code: 'EMP009', scenario: 'CUSTOMER_COMPLAINT' as const, quizScore: 60, ai: { professional: 65, empathy: 70, problemSolving: 55, clarity: 62 }, feedback: 'Nên lắng nghe khách nói hết trước khi đề xuất giải pháp; câu chữ còn cứng.' },
    { code: 'EMP011', scenario: 'COLLEAGUE_CONFLICT' as const, quizScore: 100, ai: { professional: 88, empathy: 85, problemSolving: 82, clarity: 86 }, feedback: 'Trao đổi khéo léo, tập trung vào sự vụ thay vì cá nhân.' },
    { code: 'EMP013', scenario: 'COLLEAGUE_CONFLICT' as const, quizScore: 50, ai: { professional: 60, empathy: 55, problemSolving: 50, clarity: 58 }, feedback: 'Câu trả lời còn ngắn, thiếu đề xuất bước tiếp theo cụ thể.' },
    { code: 'EMP014', scenario: 'CUSTOMER_COMPLAINT' as const, quizScore: 80, ai: { professional: 84, empathy: 88, problemSolving: 78, clarity: 80 }, feedback: 'Đồng cảm tốt; cần ghi nhận thông tin đơn hàng chính xác hơn trước khi hứa hẹn.' },
    { code: 'EMP004', scenario: 'MANAGER_FEEDBACK' as const, quizScore: 100, ai: { professional: 86, empathy: 80, problemSolving: 84, clarity: 88 }, feedback: 'Tiếp nhận phản hồi tích cực, cam kết hành động rõ ràng.' },
  ];
  for (const t of trainingSeeds) {
    const session = await prisma.trainingSession.create({
      data: {
        employeeId: byCode(t.code),
        scenario: t.scenario,
        status: 'GRADED',
        quizScore: t.quizScore,
        aiScore: t.ai,
        totalScore: Math.round(t.quizScore * 0.4 + ((t.ai.professional + t.ai.empathy + t.ai.problemSolving + t.ai.clarity) / 4) * 0.6),
        aiFeedback: t.feedback,
        completedAt: new Date('2026-08-28T14:30:00'),
      },
    });
    const attempts: Prisma.TrainingAttemptCreateManyInput[] = [];
    const quizQs = allQuestions.filter((q) => q.scenario === t.scenario && q.type === 'quiz');
    for (const q of quizQs) {
      const correct = det(session.id.length, q.order, t.code.length) % 4 !== 0; // ~75% đúng
      attempts.push({
        sessionId: session.id,
        questionId: q.id,
        answer: q.correctAnswer ?? 'A',
        isCorrect: correct,
        aiEvaluation: Prisma.JsonNull,
      });
    }
    const scenarioQ = scenBy(t.scenario, 3) ?? scenBy(t.scenario, 6) ?? scenBy(t.scenario, 7);
    if (scenarioQ) {
      attempts.push({
        sessionId: session.id,
        questionId: scenarioQ.id,
        answer: 'Em chào anh/chị, trước tiên em xin lỗi vì sự cố này ạ. Em xin ghi nhận đầy đủ thông tin đơn hàng, kiểm tra ngay với bộ phận sản xuất và đề xuất phương án xử lý sớm nhất: ưu tiên in bù 300 áo còn thiếu trong đêm, đồng thời hỗ trợ chi phí vận chuyển khẩn. Anh/chị cho em xin số điện thoại để cập nhật tiến độ mỗi 2 giờ ạ.',
        isCorrect: null,
        aiEvaluation: { ...t.ai, feedback: t.feedback },
      });
    }
    await prisma.trainingAttempt.createMany({ data: attempts });
  }

  // =====================
  // 13. AI CHAT (session + message) — xoá & tạo lại dữ liệu demo
  //     Bao gồm: HR_QA, TRAINING, CSKH (đang chạy) và 2 phiên CSKH ESCALATED
  //     để khung Tiếp Quản CSKH + thống kê Router intent có dữ liệu ngay.
  // =====================
  await prisma.aiChatMessage.deleteMany({});
  await prisma.aiChatSession.deleteMany({});

  const GEMINI = 'gemini-2.5-flash';
  let msgCursor = new Date('2026-09-07T09:00:00');
  const nextMsgTime = () => {
    msgCursor = new Date(msgCursor.getTime() + 1000 * 60 * 7); // +7 phút mỗi lượt
    return msgCursor;
  };

  async function seedChat(opts: {
    type: 'HR_QA' | 'CSKH' | 'TRAINING';
    channel: 'web' | 'mobile' | 'zalo';
    employeeCode?: string;
    externalId?: string;
    isActive?: boolean;
    turns: Array<{ role: 'user' | 'assistant'; content: string; intent?: string; latency?: number; escalated?: boolean; escalateReason?: string; summary?: string; sender?: string }>;
  }) {
    const session = await prisma.aiChatSession.create({
      data: {
        type: opts.type,
        channel: opts.channel,
        employeeId: opts.employeeCode ? byCode(opts.employeeCode) : null,
        externalId: opts.externalId ?? null,
        isActive: opts.isActive ?? true,
      },
    });
    for (const turn of opts.turns) {
      await prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: turn.role,
          content: turn.content,
          metadata: {
            ...(turn.intent ? { intent: turn.intent } : {}),
            ...(turn.role === 'assistant' ? { model: GEMINI, latency_ms: turn.latency ?? 180 + (det(session.id.length, turn.content.length) % 500) } : {}),
            ...(turn.escalated ? { escalated: true } : {}),
            ...(turn.escalateReason ? { escalateReason: turn.escalateReason } : {}),
            ...(turn.summary ? { summary: turn.summary } : {}),
            ...(turn.sender ? { sender: turn.sender } : {}),
          },
          createdAt: nextMsgTime(),
        },
      });
    }
    return session;
  }

  // --- HR_QA (nhân viên hỏi nội bộ qua portal) ---
  await seedChat({
    type: 'HR_QA', channel: 'web', employeeCode: 'EMP003',
    turns: [
      { role: 'user', content: 'Lương tháng 8/2026 của tôi là bao nhiêu?' },
      { role: 'assistant', content: 'Lương thực nhận tháng 8/2026 của bạn là 29.885.544 VNĐ (gồm lương cơ bản 30.000.000đ, phụ cấp 3.000.000đ, sau trừ BHXH 10.5% và thuế TNCN).', intent: 'HR_QA', latency: 320 },
      { role: 'user', content: 'Còn bao nhiêu ngày phép năm của tôi?' },
      { role: 'assistant', content: 'Bạn còn 7/12 ngày phép năm 2026 chưa sử dụng.Bạn có thể đăng ký nghỉ qua mục Đơn Xin Nghỉ trên portal.', intent: 'HR_QA', latency: 265 },
    ],
  });
  await seedChat({
    type: 'HR_QA', channel: 'web', employeeCode: 'EMP004',
    turns: [
      { role: 'user', content: 'Quy định về thai sản của công ty như thế nào?' },
      { role: 'assistant', content: 'Theo nội quy công ty và Điều 139 Bộ luật Lao động 2019: lao động nữ được nghỉ thai sản 6 tháng, được hưởng BHXH theo quy định; có thể thỏa thuận làm thêm sau khi hết nghỉ. Công ty bảo lưu đầy đủ vị trí làm việc trong thời gian này.', intent: 'HR_QA', latency: 410 },
      { role: 'user', content: 'Cho hỏi luôn lịch đóng BHXH hàng tháng' },
      { role: 'assistant', content: 'Công ty đóng BHXH trước ngày 15 hàng tháng. Mức đóng nhân viên: BHXH 8%, BHYT 1.5%, BHTN 1% trên lương cơ bản.', intent: 'HR_QA', latency: 290 },
    ],
  });
  await seedChat({
    type: 'HR_QA', channel: 'mobile', employeeCode: 'EMP021',
    turns: [
      { role: 'user', content: 'Công tác phí được hoàn thế nào?' },
      { role: 'assistant', content: 'Công tác phí trong nước được hoàn trong 7 ngày làm việc: bạn nộp hóa đơn gốc + tờ trình qua portal, quản lý duyệt rồi phòng Kế toán chuyển khoản. Mức chuẩn: lưu trú 800.000đ/đêm, ăn 250.000đ/ngày (theo quy chế chi tiêu 2026).', intent: 'HR_QA', latency: 350 },
    ],
  });
  // Tin nhắn intent OTHER (router trả lời trực tiếp, không qua agent nào)
  await seedChat({
    type: 'HR_QA', channel: 'web', employeeCode: 'EMP024',
    turns: [
      { role: 'user', content: 'Hôm nay thời tiết thế nào nhỉ?' },
      { role: 'assistant', content: 'Câu hỏi nằm ngoài phạm vi nhân sự của tôi. Bạn cần hỏi về lương, phép, hợp đồng hay quy chế công ty không?', intent: 'OTHER', latency: 155 },
    ],
  });

  // --- TRAINING (role-play chấm điểm) ---
  await seedChat({
    type: 'TRAINING', channel: 'mobile', employeeCode: 'EMP005',
    turns: [
      { role: 'user', content: 'Bắt đầu kịch bản customer_complaint' },
      { role: 'assistant', content: 'Vâng, chúng ta bắt đầu kịch bản "Khiếu nại khách hàng". Tôi sẽ đóng vai khách hàng Nguyễn Văn A. Chào bạn, tôi đặt 500 áo in logo mà hôm nay nhận có 200 áo sai màu, sự kiện là NGÀY MAI! Các bạn giải quyết thế nào đây?!', intent: 'TRAINING', latency: 480 },
      { role: 'user', content: 'Em chào anh, em thành thật xin lỗi anh về sự cố này ạ. Em xin phép ghi nhận đầy đủ mã đơn hàng và kiểm tra ngay với bộ phận sản xuất trong 30 phút, đồng thời đề xuất phương án in bù khẩn trong đêm nay.' },
      { role: 'assistant', content: 'Được, tôi chờ bạn 30 phút. Nếu tối nay không có 500 áo đúng mẫu thì các bạn bồi thường thế nào? [Chấm điểm: professional 82 | empathy 78 | problemSolving 80 | clarity 85]', intent: 'TRAINING', latency: 520 },
    ],
  });

  // --- CSKH đang chạy bình thường (bot tự trả lời qua kênh Zalo/Slack) ---
  await seedChat({
    type: 'CSKH', channel: 'zalo', externalId: 'U0DEMO01',
    turns: [
      { role: 'user', content: 'Cho em hỏi shop có hỗ trợ đổi trả trong bao lâu không ạ?' },
      { role: 'assistant', content: 'Dạ chào anh/chị, bên em hỗ trợ đổi trả trong vòng 7 ngày kể từ ngày nhận hàng với sản phẩm còn nguyên tem mác ạ. Anh/chị cần em hỗ trợ thêm gì không ạ?', intent: 'CSKH', latency: 240 },
      { role: 'user', content: 'Ok cảm ơn shop nha' },
      { role: 'assistant', content: 'Dạ không có gì ạ, anh/chị cứ nhắn tin bất cứ khi nào cần hỗ trợ. Chúc anh/chị một ngày tốt lành ạ! ❤️', intent: 'CSKH', latency: 190 },
    ],
  });
  await seedChat({
    type: 'CSKH', channel: 'zalo', externalId: 'U0DEMO02',
    turns: [
      { role: 'user', content: 'Đơn #10245 của em giao bao giờ đến được ạ?' },
      { role: 'assistant', content: 'Dạ đơn #10245 của anh/chị đang trong quá trình vận chuyển, dự kiến giao trong hôm nay hoặc sáng mai ạ. Anh/chị có thể theo dõi trạng thái đơn qua link vận đơn bên em gửi kèm tin nhắn xác nhận ạ.', intent: 'CSKH', latency: 310 },
    ],
  });

  // --- CSKH ESCALATED (isActive=false → vào queue tiếp quản ngay khi mở portal) ---
  const esc1 = await seedChat({
    type: 'CSKH', channel: 'zalo', externalId: 'U0SLACK77', isActive: false,
    turns: [
      { role: 'user', content: 'Tôi đặt 5 hộp quà Tết từ đầu tháng rồi mà đến giờ chưa thấy giao, gọi hotline thì tự động ngắt máy!' },
      { role: 'assistant', content: 'Dạ em thành thật xin lỗi anh về trải nghiệm chưa tốt ạ. Em kiểm tra ngay trạng thái 5 hộp quà Tết của anh trong hệ thống…', intent: 'CSKH', latency: 350 },
      { role: 'user', content: 'Kiểm tra gì mà lâu vậy! Đây là quà tặng đối tác, trễ là mất hợp đồng mấy tỷ của công ty tôi. Tôi yêu cầu gặp người có thẩm quyền NGAY!' },
      { role: 'assistant', content: 'Dạ, việc này nằm ngoài phạm vi xử lý của em. Em đã ghi nhận và chuyển ngay cho bộ phận có thẩm quyền liên hệ hỗ trợ anh trong thời gian sớm nhất ạ. [CAN_ESCALATE: Khách yêu cầu bồi thường đơn quà Tết trễ giao, nguy cơ mất hợp đồng đối tác lớn]', intent: 'CSKH', latency: 420, escalated: true, escalateReason: 'Khách yêu cầu bồi thường đơn quà Tết trễ giao, nguy cơ mất hợp đồng đối tác lớn', summary: 'Khách đặt 5 hộp quà Tết từ đầu tháng chưa được giao, hotline tự ngắt. Khách rất tức giận, yêu cầu gặp người có thẩm quyền ngay vì nguy cơ mất hợp đồng đối tác. Ưu tiên xử lý trong giờ hành chính hôm nay: xác nhận tồn kho, phương án giao khẩn và bồi thường.' },
    ],
  });
  await seedChat({
    type: 'CSKH', channel: 'zalo', externalId: 'U0SLACK42', isActive: false,
    turns: [
      { role: 'user', content: 'Tôi nhận được hàng bị rách vỏ hộp và thiếu 1 phụ kiện. SĐT tôi là 0912345678, mã đơn #10198.' },
      { role: 'assistant', content: 'Dạ em xin lỗi anh/chị về tình trạng hàng hóa ạ. Em xin phép ghi nhận: đơn #10198, thiếu 1 phụ kiện, vỏ hộp bị rách. Anh/chị chụp giúp em vài ảnh sản phẩm để em mở yêu cầu đền bù ngay ạ.', intent: 'CSKH', latency: 280 },
      { role: 'user', content: 'Tôi đã gửi ảnh rồi đấy. Tôi cần đổi hàng mới hoàn chỉnh trong tuần này, không là tôi khiếu nại lên phía quản lý thị trường!' },
      { role: 'assistant', content: 'Dạ, yêu cầu đổi hàng hoàn chỉnh và bồi thường vượt mức ủy quyền của em nên em chuyển trường hợp này cho bộ phận CSKH cấp cao xử lý ngay ạ. [CAN_ESCALATE: Khiếu nại hàng lỗi + thiếu phụ kiện, khách đe dọa khiếu nại lên cơ quan quản lý]', intent: 'CSKH', latency: 390, escalated: true, escalateReason: 'Khiếu nại hàng lỗi + thiếu phụ kiện, khách đe dọa khiếu nại lên cơ quan quản lý', summary: 'Đơn #10198 giao thiếu phụ kiện, vỏ hộp rách; khách đã gửi ảnh. Yêu cầu đổi hàng hoàn chỉnh trong tuần, giọng điệu gay gắt, có nguy cơ khiếu nại công khai. SĐT khách đã được PII masking trong luồng AI; nhân viên xem bản gốc qua Slack/Zalo.' },
    ],
  });

  // =====================
  // 14. NOTIFICATIONS (cho HR Admin / Admin)
  // =====================
  await prisma.notification.deleteMany({});
  await prisma.notification.createMany({
    data: [
      { userId: hrAdminUser.id, type: 'PAYROLL', title: 'Kỳ lương tháng 9/2026 chờ duyệt', body: 'Rule Engine đã tính lương xong toàn công ty. Vào Bảng Lương để duyệt tất cả hoặc duyệt từng dòng.', data: { month: 9, year: 2026 } },
      { userId: hrAdminUser.id, type: 'LEAVE', title: '3 đơn xin nghỉ đang chờ duyệt', body: 'EMP020 (phép năm), EMP008 (ốm), EMP015 (khẩn) — xem tại Dashboard.', data: {} },
      { userId: adminUser.id, type: 'SYSTEM', title: '🔴 Escalation: khách giận dữ cần tiếp quản', body: 'Khách U0SLACK77 khiếu nại đơn quà Tết trễ giao — AI đã chuyển cho nhân viên xử lý.', data: { sessionId: esc1.id } },
      { userId: hrAdminUser.id, type: 'SYSTEM', title: '🔴 Escalation: khiếu nại hàng lỗi', body: 'Khách U0SLACK42 báo thiếu phụ kiện đơn #10198 — cần tiếp quản.', data: { sessionId: esc1.id } },
      { userId: employee1User.id, type: 'ONBOARDING', title: 'Onboarding còn 3 việc cần hoàn thành', body: 'Tham gia hướng dẫn nội quy, gặp đồng nghiệp, khóa an toàn thông tin.', data: {} },
    ],
  });

  // =====================
  // SUMMARY
  // =====================
  console.log('\n✅ Seeding completed!\n');
  console.log('👤 Tài khoản đăng nhập:');
  console.log('  🔴 Admin:           admin@hr-system.com      / Admin@123');
  console.log('  🟡 HR Manager:      hr@hr-system.com         / Hr@123456');
  console.log('  🟣 HR Admin Portal: hr-admin@company.com     / Admin@123     (EMP006)');
  console.log('  🟢 employee1:       employee1@company.com    / Employee@123  (EMP005 - Phạm Văn Chinh)');
  console.log('  🟢 employee2:       employee2@company.com    / Employee@123  (EMP003 - Nguyễn Văn An)');
  console.log('  🟢 Developer:       tranthib@hr-system.com   / Employee@123  (EMP004)');
  console.log('  ⚪ Đã khóa (thay bằng employee1/2): nguyenvana@, phamvanc@hr-system.com');
  console.log('\n📊 Dữ liệu:');
  console.log('  • 30 nhân viên / 5 phòng ban / 10 chức vụ / 30 hợp đồng');
  console.log('  • Payroll: tháng 6-7 (PAID), tháng 8 (APPROVED), tháng 9 (DRAFT — chờ duyệt tất cả)');
  console.log('  • Attendance: tháng 6, 7, 8 (giờ hành chính) + 1–9/9');
  console.log('  • 7 đơn nghỉ phép (3 PENDING để demo duyệt)');
  console.log('  • AI Chat: HR_QA, TRAINING, CSKH + 2 phiên CSKH escalated (queue tiếp quản có sẵn dữ liệu)');
  console.log('  • Training: 7 phiên GRADED + attempts (phân tích đào tạo có số liệu)');
  console.log('  • 5 thông báo (payroll, leave, 2 escalation, onboarding)');
}

/** Sinh 1 dòng chấm công all định cho 1 nhân viên trong 1 ngày */
function pushAttendance(
  rows: Array<{
    employeeId: string; date: Date; checkIn: Date | null; checkOut: Date | null;
    status: 'PRESENT' | 'LATE' | 'REMOTE' | 'ABSENT'; workHours: number; overtime: number;
    location: string; dayType: 'NORMAL';
  }>,
  employeeId: string,
  seed: { code: string },
  month: number,
  day: number,
  year: number,
) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00`);
  const r = det(employeeId.length, day, month, year);
  const late = r % 17 === 0;
  const remote = !late && r % 13 === 0;
  const absent = r % 29 === 0;
  const status = absent ? 'ABSENT' : late ? 'LATE' : remote ? 'REMOTE' : 'PRESENT';
  const inTime = late ? '08:47:00' : '08:02:00';
  const outTime = absent ? null : '17:35:00';
  rows.push({
    employeeId,
    date,
    checkIn: absent ? null : new Date(`${year}-${pad(month)}-${pad(day)}T${inTime}`),
    checkOut: outTime ? new Date(`${year}-${pad(month)}-${pad(day)}T${outTime}`) : null,
    status,
    workHours: absent ? 0 : late ? 8 : 8.5,
    overtime: !absent && day % 9 === 0 ? 2 : 0,
    location: remote ? 'REMOTE (HOME)' : 'GPS 10.7951,106.7218 (32m)',
    dayType: 'NORMAL',
  });
}

// Tính thuế TNCN lũy tiến 7 bậc (Biểu thuế VN 2026)
function calcPIT(taxableIncome: number): number {
  const brackets = [
    { limit: 5000000,   rate: 0.05 },
    { limit: 10000000,  rate: 0.10 },
    { limit: 18000000,  rate: 0.15 },
    { limit: 32000000,  rate: 0.20 },
    { limit: 52000000,  rate: 0.25 },
    { limit: 80000000,  rate: 0.30 },
    { limit: Infinity,  rate: 0.35 },
  ];
  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;
  for (const bracket of brackets) {
    const rangeSize = bracket.limit - prevLimit;
    const taxable = Math.min(remaining, rangeSize);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
    if (remaining <= 0) break;
  }
  return Math.round(tax);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
