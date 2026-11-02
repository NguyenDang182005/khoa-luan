/**
 * Bắt buộc secret phải có trong env — không dùng giá trị mặc định hardcode.
 * (Trước đây fallback 'hr-system-secret-key' khiến deploy thiếu env vẫn chạy được
 *  với secret ai cũng biết.) Thiếu env → throw lúc boot, fail sớm & rõ.
 */
export function requireSecret(
  config: { get: <T = string>(key: string) => T | undefined },
  key: string,
): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(
      `Thiếu biến môi trường ${key}. Không có giá trị mặc định an toàn — hãy set ${key} trong .env`,
    );
  }
  return value;
}