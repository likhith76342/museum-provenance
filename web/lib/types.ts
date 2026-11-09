export type Role = 'admin' | 'curator' | 'researcher';

export type SessionUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: Role;
};

export const EDITORS: Role[] = ['admin', 'curator'];
