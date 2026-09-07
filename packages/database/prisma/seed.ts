import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
    create: { name: 'Kinh doanh', code: 'SALES', description: 'Phòng Kinh doanh & CSKH' },
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
  const salesPos = await prisma.position.upsert({
    where: { code: 'SALES-EXE' },
    update: {},
    create: { title: 'Nhân viên Kinh doanh', code: 'SALES-EXE', level: 2, departmentId: salesDept.id, minSalary: 8000000, maxSalary: 20000000 },
  });

  // =====================
  // 4. USERS & EMPLOYEES
  // =====================

  // --- Admin (HR Manager) ---
  const adminPwd = await bcrypt.hash('Admin@123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hr-system.com' },
    update: {},
    create: { email: 'admin@hr-system.com', passwordHash: adminPwd, role: 'ADMIN' },
  });
  // Xoá employees cũ để seed idempotent (tránh conflict employeeCode)
  await prisma.employee.deleteMany({
    where: { employeeCode: { in: ['EMP001','EMP002','EMP003','EMP004','EMP005'] } },
  });

  const adminEmp = await prisma.employee.create({
    data: {
      employeeCode: 'EMP001',
      userId: adminUser.id,
      fullName: 'Trần Thị Admin',
      email: 'admin@hr-system.com',
      phone: '0901111111',
      gender: 'FEMALE',
      dateOfBirth: new Date('1985-03-15'),
      joinDate: new Date('2020-01-01'),
      status: 'ACTIVE',
      departmentId: hrDept.id,
      positionId: hrManagerPos.id,
      nationalId: '123456789',
    },
  });

  // --- HR Staff ---
  const hrPwd = await bcrypt.hash('Hr@123456', 10);
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@hr-system.com' },
    update: {},
    create: { email: 'hr@hr-system.com', passwordHash: hrPwd, role: 'HR_MANAGER' },
  });
  const hrEmp = await prisma.employee.create({
    data: {
      employeeCode: 'EMP002',
      userId: hrUser.id,
      fullName: 'Lê Văn HR',
      email: 'hr@hr-system.com',
      phone: '0902222222',
      gender: 'MALE',
      dateOfBirth: new Date('1990-07-20'),
      joinDate: new Date('2022-03-01'),
      status: 'ACTIVE',
      departmentId: hrDept.id,
      positionId: hrStaffPos.id,
      managerId: adminEmp.id,
      nationalId: '234567890',
    },
  });

  // --- Senior Dev ---
  const seniorPwd = await bcrypt.hash('Employee@123', 10);
  const seniorUser = await prisma.user.upsert({
    where: { email: 'nguyenvana@hr-system.com' },
    update: {},
    create: { email: 'nguyenvana@hr-system.com', passwordHash: seniorPwd, role: 'EMPLOYEE' },
  });
  const seniorEmp = await prisma.employee.create({
    data: {
      employeeCode: 'EMP003',
      userId: seniorUser.id,
      fullName: 'Nguyễn Văn An',
      email: 'nguyenvana@hr-system.com',
      phone: '0903333333',
      gender: 'MALE',
      dateOfBirth: new Date('1992-05-10'),
      joinDate: new Date('2021-06-01'),
      status: 'ACTIVE',
      departmentId: itDept.id,
      positionId: seniorDevPos.id,
      nationalId: '345678901',
    },
  });

  // --- Dev ---
  const devPwd = await bcrypt.hash('Employee@123', 10);
  const devUser = await prisma.user.upsert({
    where: { email: 'tranthib@hr-system.com' },
    update: {},
    create: { email: 'tranthib@hr-system.com', passwordHash: devPwd, role: 'EMPLOYEE' },
  });
  const devEmp = await prisma.employee.create({
    data: {
      employeeCode: 'EMP004',
      userId: devUser.id,
      fullName: 'Trần Thị Bình',
      email: 'tranthib@hr-system.com',
      phone: '0904444444',
      gender: 'FEMALE',
      dateOfBirth: new Date('1995-11-25'),
      joinDate: new Date('2023-09-01'),
      status: 'ACTIVE',
      departmentId: itDept.id,
      positionId: devPos.id,
      managerId: seniorEmp.id,
      nationalId: '456789012',
    },
  });

  // --- Sales ---
  const salesPwd = await bcrypt.hash('Employee@123', 10);
  const salesUser = await prisma.user.upsert({
    where: { email: 'phamvanc@hr-system.com' },
    update: {},
    create: { email: 'phamvanc@hr-system.com', passwordHash: salesPwd, role: 'EMPLOYEE' },
  });
  const salesEmp = await prisma.employee.create({
    data: {
      employeeCode: 'EMP005',
      userId: salesUser.id,
      fullName: 'Phạm Văn Chinh',
      email: 'phamvanc@hr-system.com',
      phone: '0905555555',
      gender: 'MALE',
      dateOfBirth: new Date('1993-02-28'),
      joinDate: new Date('2024-01-15'),
      status: 'PROBATION',
      departmentId: salesDept.id,
      positionId: salesPos.id,
      nationalId: '567890123',
    },
  });

  const allEmployees = [adminEmp, hrEmp, seniorEmp, devEmp, salesEmp];

  // =====================
  // 5. CONTRACTS
  // =====================
  const contractData = [
    { emp: adminEmp, num: 'CTR-001', type: 'FULL_TIME' as const, salary: 35000000, allowances: 5000000, start: '2020-01-01' },
    { emp: hrEmp,    num: 'CTR-002', type: 'FULL_TIME' as const, salary: 15000000, allowances: 2000000, start: '2022-03-01' },
    { emp: seniorEmp,num: 'CTR-003', type: 'FULL_TIME' as const, salary: 30000000, allowances: 3000000, start: '2021-06-01' },
    { emp: devEmp,   num: 'CTR-004', type: 'FULL_TIME' as const, salary: 18000000, allowances: 1500000, start: '2023-09-01' },
    { emp: salesEmp, num: 'CTR-005', type: 'PROBATION' as const, salary: 10000000, allowances: 1000000, start: '2024-01-15' },
  ];

  for (const c of contractData) {
    await prisma.contract.upsert({
      where: { contractNumber: c.num },
      update: {},
      create: {
        employeeId: c.emp.id,
        contractNumber: c.num,
        type: c.type,
        startDate: new Date(c.start),
        baseSalary: c.salary,
        allowances: c.allowances,
        signedDate: new Date(c.start),
        isActive: true,
      },
    });
  }

  // =====================
  // 6. PAYROLL (tháng 7 & 8 / 2026)
  // =====================
  const payrollData = [
    { emp: adminEmp, base: 35000000, allowances: 5000000, workDays: 23, actualDays: 23, otHours: 0 },
    { emp: hrEmp,    base: 15000000, allowances: 2000000, workDays: 23, actualDays: 22, otHours: 4 },
    { emp: seniorEmp,base: 30000000, allowances: 3000000, workDays: 23, actualDays: 23, otHours: 8 },
    { emp: devEmp,   base: 18000000, allowances: 1500000, workDays: 23, actualDays: 21, otHours: 0 },
    { emp: salesEmp, base: 10000000, allowances: 1000000, workDays: 23, actualDays: 23, otHours: 0 },
  ];

  for (const month of [7, 8]) {
    for (const p of payrollData) {
      // Tính BHXH/BHYT/BHTN
      const socialIns = p.base * (0.08 + 0.015 + 0.01); // 10.5%
      // Tính OT (giờ thường x1.5)
      const hourlyRate = p.base / (p.workDays * 8);
      const otPay = p.otHours * hourlyRate * 1.5;
      // Gross = base + allowances + otPay
      const gross = p.base + p.allowances + otPay;
      // Thu nhập chịu thuế = base + otPay - BHXH - giảm trừ gia cảnh
      const taxableIncome = Math.max(0, p.base + otPay - socialIns - 11000000);
      // Thuế TNCN lũy tiến (đơn giản hóa)
      const pit = calcPIT(taxableIncome);
      const netSalary = gross - socialIns - pit;

      try {
        await prisma.payroll.upsert({
          where: { employeeId_month_year: { employeeId: p.emp.id, month, year: 2026 } },
          update: {},
          create: {
            employeeId: p.emp.id,
            month,
            year: 2026,
            baseSalary: p.base,
            allowances: p.allowances,
            bonus: 0,
            deductions: socialIns,
            tax: pit,
            netSalary: Math.round(netSalary),
            workingDays: p.workDays,
            actualWorkingDays: p.actualDays,
            overtimeHours: p.otHours,
            overtimePay: Math.round(otPay),
            status: month === 7 ? 'PAID' : 'APPROVED',
          },
        });
      } catch (_) { /* upsert handles duplicates */ }
    }
  }

  // =====================
  // 7. ATTENDANCE (tháng 8/2026 — vài ngày mẫu)
  // =====================
  const attendanceDays = [1, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22];
  for (const emp of [seniorEmp, devEmp, salesEmp]) {
    for (const day of attendanceDays) {
      const date = new Date(`2026-08-${String(day).padStart(2, '0')}`);
      try {
        await prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: emp.id, date } },
          update: {},
          create: {
            employeeId: emp.id,
            date,
            checkIn: new Date(`2026-08-${String(day).padStart(2, '0')}T08:00:00`),
            checkOut: new Date(`2026-08-${String(day).padStart(2, '0')}T17:30:00`),
            status: 'PRESENT',
            workHours: 8.5,
            overtime: day === 8 ? 2 : 0,
          },
        });
      } catch (_) { /* skip duplicates */ }
    }
  }

  // =====================
  // 8. LEAVE REQUESTS
  // =====================
  await prisma.leaveRequest.createMany({
    skipDuplicates: true,
    data: [
      {
        employeeId: devEmp.id,
        type: 'ANNUAL',
        startDate: new Date('2026-08-25'),
        endDate: new Date('2026-08-26'),
        totalDays: 2,
        reason: 'Nghỉ phép năm',
        status: 'APPROVED',
        approvedById: adminEmp.id,
        approvedAt: new Date('2026-08-20'),
      },
      {
        employeeId: hrEmp.id,
        type: 'SICK',
        startDate: new Date('2026-08-19'),
        endDate: new Date('2026-08-19'),
        totalDays: 1,
        reason: 'Sốt, đi khám',
        status: 'APPROVED',
        approvedById: adminEmp.id,
        approvedAt: new Date('2026-08-19'),
      },
    ],
  });

  // =====================
  // 9. ONBOARDING TASKS
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

  // Onboarding progress cho nhân viên mới (salesEmp)
  for (const task of createdTasks) {
    await prisma.onboardingProgress.upsert({
      where: { employeeId_taskId: { employeeId: salesEmp.id, taskId: task.id } },
      update: {},
      create: {
        employeeId: salesEmp.id,
        taskId: task.id,
        status: task.order <= 3 ? 'COMPLETED' : 'PENDING',
        completedAt: task.order <= 3 ? new Date('2026-01-16') : null,
      },
    });
  }

  // =====================
  // SUMMARY
  // =====================
  console.log('\n✅ Seeding completed!\n');
  console.log('👤 Tài khoản:');
  console.log('  🔴 Admin:       admin@hr-system.com     / Admin@123');
  console.log('  🟡 HR Manager:  hr@hr-system.com        / Hr@123456');
  console.log('  🟢 Senior Dev:  nguyenvana@hr-system.com / Employee@123  (EMP003)');
  console.log('  🟢 Developer:   tranthib@hr-system.com   / Employee@123  (EMP004)');
  console.log('  🟢 Sales:       phamvanc@hr-system.com   / Employee@123  (EMP005)');
  console.log('\n📊 Data:');
  console.log('  • 5 nhân viên, 3 phòng ban, 5 chức vụ');
  console.log('  • 5 hợp đồng lao động');
  console.log('  • Payroll tháng 7 (PAID) + tháng 8 (APPROVED) cho cả 5 NV');
  console.log('  • Attendance tháng 8 cho EMP003, EMP004, EMP005');
  console.log('  • 2 đơn xin nghỉ phép');
  console.log('  • 6 onboarding tasks + tiến độ cho EMP005');
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
