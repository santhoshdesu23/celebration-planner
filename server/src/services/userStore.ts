import crypto from 'node:crypto';
import type { User as UserType } from '@celebration-planner/shared';
import { UserModel } from '../models/User.model.js';
import { isDbConnected } from '../db/connection.js';

// In-Memory store fallback
const memoryUsers = new Map<string, UserType>();

export const userStore = {
  async create(data: { name: string; email: string; passwordHash: string }): Promise<UserType> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = data.email.trim().toLowerCase();

    const userRecord: UserType = {
      id,
      name: data.name.trim(),
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    if (isDbConnected()) {
      const created = await UserModel.create(userRecord);
      const obj = (typeof created.toObject === 'function' ? created.toObject() : created) as UserType;
      // toObject transform strips passwordHash for serialization, but userStore returns the record
      return {
        ...obj,
        passwordHash: data.passwordHash,
      };
    }

    const cloned = JSON.parse(JSON.stringify(userRecord));
    memoryUsers.set(id, cloned);
    return cloned;
  },

  async findByEmail(email: string): Promise<UserType | null> {
    const normalizedEmail = email.trim().toLowerCase();

    if (isDbConnected()) {
      const doc = await UserModel.findOne({ email: normalizedEmail }).lean();
      return (doc as UserType) || null;
    }

    for (const u of memoryUsers.values()) {
      if (u.email.toLowerCase() === normalizedEmail) {
        return JSON.parse(JSON.stringify(u));
      }
    }
    return null;
  },

  async findById(id: string): Promise<UserType | null> {
    if (isDbConnected()) {
      const doc = await UserModel.findOne({ id }).lean();
      return (doc as UserType) || null;
    }

    const user = memoryUsers.get(id);
    return user ? JSON.parse(JSON.stringify(user)) : null;
  },

  async clear(): Promise<void> {
    if (isDbConnected()) {
      await UserModel.deleteMany({});
    }
    memoryUsers.clear();
  },
};
