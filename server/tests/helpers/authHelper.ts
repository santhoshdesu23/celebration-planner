import { generateToken } from '../../src/utils/auth.js';
import { userStore } from '../../src/services/userStore.js';
import { hashPassword } from '../../src/utils/auth.js';

export function createTestToken(user = { id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com', name: 'Test User' }): string {
  return generateToken(user);
}

export function getTestAuthHeader(user = { id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com', name: 'Test User' }) {
  return { Authorization: `Bearer ${createTestToken(user)}` };
}

export async function createTestUserInStore(data = { name: 'Test User', email: 'tester@example.com', password: 'Password123!' }) {
  const passwordHash = await hashPassword(data.password);
  return userStore.create({
    name: data.name,
    email: data.email,
    passwordHash,
  });
}
