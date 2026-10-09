import { CONFIG } from '../config/config.js';
import { db } from '../config/database.js';

export class DeveloperService {
  /**
   * Check if a Discord user is an authorized bot developer / owner
   */
  static isDeveloper(userId: string): boolean {
    if (CONFIG.OWNER_IDS.includes(userId)) return true;
    try {
      const row = db.prepare('SELECT 1 FROM developers WHERE user_id = ?').get(userId);
      return Boolean(row);
    } catch {
      return false;
    }
  }

  /**
   * Add a developer to the authorization table
   */
  static addDeveloper(userId: string, addedBy = 'Dashboard'): boolean {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO developers (user_id, added_by, added_at)
        VALUES (?, ?, ?)
      `).run(userId, addedBy, Date.now());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove a developer from authorization table
   */
  static removeDeveloper(userId: string): boolean {
    try {
      db.prepare('DELETE FROM developers WHERE user_id = ?').run(userId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all registered developer IDs
   */
  static getDevelopers(): Array<{ userId: string; addedBy: string; isOwner: boolean; addedAt: number }> {
    const list: Array<{ userId: string; addedBy: string; isOwner: boolean; addedAt: number }> = [];

    // Add primary owner IDs
    for (const ownerId of CONFIG.OWNER_IDS) {
      list.push({
        userId: ownerId,
        addedBy: 'Config / Core Owner',
        isOwner: true,
        addedAt: 0,
      });
    }

    try {
      const rows = db.prepare('SELECT * FROM developers').all() as any[];
      for (const r of rows) {
        if (!CONFIG.OWNER_IDS.includes(r.user_id)) {
          list.push({
            userId: r.user_id,
            addedBy: r.added_by,
            isOwner: false,
            addedAt: r.added_at,
          });
        }
      }
    } catch {}

    return list;
  }

  /**
   * Maintenance Mode State Management
   */
  static isMaintenanceMode(): boolean {
    try {
      const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'maintenance_mode'").get() as any;
      return row ? row.value === '1' : false;
    } catch {
      return false;
    }
  }

  static setMaintenanceMode(enabled: boolean): void {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO bot_settings (key, value)
        VALUES ('maintenance_mode', ?)
      `).run(enabled ? '1' : '0');
    } catch {}
  }
}
