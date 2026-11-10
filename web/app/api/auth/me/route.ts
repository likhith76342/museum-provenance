import { apiUser, run } from '@/lib/api';

export async function GET() {
  return run(() => apiUser());
}
