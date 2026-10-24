import { EventModel } from '../models/Event.model.js';
import { isDbConnected } from './connection.js';
import { formatSafeError } from '../config/env.js';

export const QUARANTINE_OWNER_ID = 'quarantine-unassigned';

/**
 * Ensures legacy events without an owner are quarantined so they
 * are never exposed to any authenticated user.
 */
export async function migrateLegacyEvents(): Promise<{ modifiedCount: number }> {
  if (!isDbConnected()) {
    return { modifiedCount: 0 };
  }

  try {
    const result = await EventModel.updateMany(
      {
        $or: [
          { ownerId: { $exists: false } },
          { ownerId: null },
          { ownerId: '' },
        ],
      },
      {
        $set: {
          ownerId: QUARANTINE_OWNER_ID,
          quarantinedAt: new Date().toISOString(),
        },
      }
    );

    const count = result.modifiedCount ?? 0;
    if (count > 0) {
      console.info(`🔒 Security migration: Quarantined ${count} unowned legacy event(s) to prevent unauthorized access.`);
    }

    return { modifiedCount: count };
  } catch (err) {
    console.error('Failed to run legacy events quarantine migration:', formatSafeError(err));
    return { modifiedCount: 0 };
  }
}
