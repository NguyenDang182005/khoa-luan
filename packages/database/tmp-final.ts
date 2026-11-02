import { PrismaClient } from '@prisma/client';
import { PayrollService } from '../../apps/api/src/payroll/payroll.service';

async function main() {
  const prisma = new PrismaClient();
  const payroll = new PayrollService(prisma as any, {} as any);
  const emp12 = await prisma.employee.findFirstOrThrow({ where: { employeeCode: 'EMP012' } });
  const emp3 = await prisma.employee.findFirstOrThrow({ where: { employeeCode: 'EMP003' } });

  const mat = await payroll.calculatePayroll(emp12.id, 9, 2026);
  console.log('maternity 9/2026', {
    base: mat.baseSalary,
    deductions: mat.deductions,
    bhxh: mat.bhxh,
    benefit: mat.bhxhBenefit,
    net: mat.netSalary,
    maternityDays: mat._breakdown.maternityDays,
    insuranceApplicable: mat._breakdown.insuranceApplicable,
  });

  const normal = await payroll.calculatePayroll(emp3.id, 9, 2026);
  console.log('normal 9/2026', {
    workingDays: normal.workingDays,
    actual: normal.actualWorkingDays,
    deductions: normal.deductions,
    bhxh: normal.bhxh,
    tax: normal.tax,
    net: normal.netSalary,
    insuranceApplicable: normal._breakdown.insuranceApplicable,
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
