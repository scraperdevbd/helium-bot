import { db } from '../config/database.js';

export class EconomyService {
  private static ensureUser(userId: string) {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      db.prepare('INSERT INTO users (id, wallet, bank, created_at) VALUES (?, 1000, 0, ?)').run(userId, Date.now());
    }
  }

  static getBalance(userId: string): { wallet: number; bank: number; total: number; capacity: number } {
    this.ensureUser(userId);
    const row = db.prepare('SELECT wallet, bank, bank_capacity FROM users WHERE id = ?').get(userId) as any;
    return {
      wallet: row.wallet,
      bank: row.bank,
      total: row.wallet + row.bank,
      capacity: row.bank_capacity,
    };
  }

  static claimDaily(userId: string): { success: boolean; amount?: number; nextClaimInMs?: number } {
    this.ensureUser(userId);
    const row = db.prepare('SELECT wallet, last_daily FROM users WHERE id = ?').get(userId) as any;
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - row.last_daily < cooldown) {
      return { success: false, nextClaimInMs: cooldown - (now - row.last_daily) };
    }

    const reward = 500;
    db.prepare('UPDATE users SET wallet = wallet + ?, last_daily = ? WHERE id = ?').run(reward, now, userId);
    return { success: true, amount: reward };
  }

  static claimWeekly(userId: string): { success: boolean; amount?: number; nextClaimInMs?: number } {
    this.ensureUser(userId);
    const row = db.prepare('SELECT wallet, last_weekly FROM users WHERE id = ?').get(userId) as any;
    const now = Date.now();
    const cooldown = 7 * 24 * 60 * 60 * 1000;

    if (now - row.last_weekly < cooldown) {
      return { success: false, nextClaimInMs: cooldown - (now - row.last_weekly) };
    }

    const reward = 3000;
    db.prepare('UPDATE users SET wallet = wallet + ?, last_weekly = ? WHERE id = ?').run(reward, now, userId);
    return { success: true, amount: reward };
  }

  static deposit(userId: string, amount: number): { success: boolean; message: string } {
    this.ensureUser(userId);
    const row = db.prepare('SELECT wallet, bank, bank_capacity FROM users WHERE id = ?').get(userId) as any;
    if (amount <= 0 || row.wallet < amount) return { success: false, message: 'Insufficient wallet balance.' };
    if (row.bank + amount > row.bank_capacity) return { success: false, message: 'Bank capacity exceeded.' };

    db.prepare('UPDATE users SET wallet = wallet - ?, bank = bank + ? WHERE id = ?').run(amount, amount, userId);
    return { success: true, message: `Deposited $${amount.toLocaleString()} into bank.` };
  }

  static withdraw(userId: string, amount: number): { success: boolean; message: string } {
    this.ensureUser(userId);
    const row = db.prepare('SELECT wallet, bank FROM users WHERE id = ?').get(userId) as any;
    if (amount <= 0 || row.bank < amount) return { success: false, message: 'Insufficient bank balance.' };

    db.prepare('UPDATE users SET wallet = wallet + ?, bank = bank - ? WHERE id = ?').run(amount, amount, userId);
    return { success: true, message: `Withdrew $${amount.toLocaleString()} from bank.` };
  }

  static transfer(fromId: string, toId: string, amount: number): { success: boolean; message: string } {
    this.ensureUser(fromId);
    this.ensureUser(toId);

    const sender = db.prepare('SELECT wallet FROM users WHERE id = ?').get(fromId) as any;
    if (amount <= 0 || sender.wallet < amount) return { success: false, message: 'Insufficient wallet balance.' };

    db.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ?').run(amount, fromId);
    db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(amount, toId);

    return { success: true, message: `Transferred $${amount.toLocaleString()} to <@${toId}>.` };
  }

  static getShopItems() {
    return db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all() as any[];
  }

  static buyItem(userId: string, itemName: string): { success: boolean; message: string } {
    this.ensureUser(userId);
    const item = db.prepare('SELECT * FROM shop_items WHERE LOWER(name) = LOWER(?)').get(itemName) as any;
    if (!item) return { success: false, message: 'Item not found in store.' };

    const user = db.prepare('SELECT wallet, inventory FROM users WHERE id = ?').get(userId) as any;
    if (user.wallet < item.price) return { success: false, message: 'Insufficient wallet balance.' };

    const inventory: string[] = JSON.parse(user.inventory || '[]');
    inventory.push(item.name);

    db.prepare('UPDATE users SET wallet = wallet - ?, inventory = ? WHERE id = ?').run(
      item.price,
      JSON.stringify(inventory),
      userId
    );

    return { success: true, message: `Successfully purchased **${item.name}** for $${item.price.toLocaleString()}!` };
  }

  static getInventory(userId: string): string[] {
    this.ensureUser(userId);
    const user = db.prepare('SELECT inventory FROM users WHERE id = ?').get(userId) as any;
    return JSON.parse(user.inventory || '[]');
  }

  static addMoney(userId: string, amount: number) {
    this.ensureUser(userId);
    db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(amount, userId);
  }
}
