const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '..', 'packages', 'database', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      user: { select: { email: true, role: true } },
      contracts: { select: { allowances: true, baseSalary: true } },
      leaveRequests: { where: { status: 'APPROVED' }, select: { type: true, totalDays: true, startDate: true, endDate: true } }
    }
  });

  console.log('Employees in DB:');
  const emp6 = employees.find(e => e.employeeCode === 'EMP006');
  if (emp6) {
    const { computeBalance } = require('../apps/api/dist/leave/leave-entitlement.js');
    const { ensureDefaultLeavePolicy } = require('../apps/api/dist/settings/single-row.utils.js');
    const policyRow = await ensureDefaultLeavePolicy(prisma);
    const policy = {
      annualQuotaDays: policyRow.annualQuotaDays,
      seniorityBonusEveryYears: policyRow.seniorityBonusEveryYears,
      seniorityBonusDays: policyRow.seniorityBonusDays,
      prorateByJoinMonth: policyRow.prorateByJoinMonth,
      maxCarryOverDays: policyRow.maxCarryOverDays,
    };
    const empData = await prisma.employee.findUnique({ where: { id: emp6.id }, select: { joinDate: true } });
    const bal = computeBalance({
      policy,
      joinDate: empData.joinDate,
      year: 2026,
      usedThisYear: 1,
      usedPrevYear: 0,
    });
    console.log('COMPUTED BALANCE FOR EMP006:', bal);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
