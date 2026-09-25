/**
 * Quy tắc mật khẩu theo SecurityPolicy — tách thành util thuần (không import NestJS/Prisma/Firebase)
 * để dùng chung được từ auth.service, employees.service và unit test mà không kéo dependency nặng.
 */

export interface PasswordPolicyRules {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
}

/** Kiểm tra mật khẩu mới theo SecurityPolicy — trả danh sách lỗi (rỗng = hợp lệ) */
export function validatePasswordPolicy(
  pw: string,
  policy: PasswordPolicyRules,
): string[] {
  const errors: string[] = [];
  if (pw.length < policy.passwordMinLength)
    errors.push(`ít nhất ${policy.passwordMinLength} ký tự`);
  if (policy.requireUppercase && !/[A-Z]/.test(pw)) errors.push("một chữ HOA");
  if (policy.requireLowercase && !/[a-z]/.test(pw)) errors.push("một chữ thường");
  if (policy.requireDigit && !/[0-9]/.test(pw)) errors.push("một chữ số");
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(pw)) errors.push("một ký tự đặc biệt");
  return errors;
}
