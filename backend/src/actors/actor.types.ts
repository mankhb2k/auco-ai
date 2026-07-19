/** Phân lớp quyền demo (không phải auth thật) — xem ARCHITECTURE.md. */
export type AccessLayer = 'it_admin' | 'manager' | 'employee';

export const ACCESS_LAYERS: readonly AccessLayer[] = [
  'it_admin',
  'manager',
  'employee',
];

export function isAccessLayer(value: unknown): value is AccessLayer {
  return (
    typeof value === 'string' &&
    (ACCESS_LAYERS as readonly string[]).includes(value)
  );
}

/** Actor gắn vào request qua header X-Demo-Employee-Id. */
export type DemoActor = {
  id: string;
  displayName: string;
  role: string;
  accessLayer: AccessLayer;
  bankCode: string;
  branchCode: string | null;
};

export const DEMO_EMPLOYEE_HEADER = 'x-demo-employee-id';

/** Fallback khi FE chưa gửi header — nhân viên tín dụng seed. */
export const DEFAULT_DEMO_EMPLOYEE_ID = 'emp-credit-b';
