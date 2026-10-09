import { Collection } from 'discord.js';

export class CooldownManager {
  private static cooldowns: Collection<string, Collection<string, number>> = new Collection();

  /**
   * Check if a command is on cooldown for a user. Returns remaining seconds, or 0 if allowed.
   */
  static check(commandName: string, userId: string, cooldownSeconds: number = 3): number {
    if (cooldownSeconds <= 0) return 0;

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;
    const cooldownAmount = cooldownSeconds * 1000;

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownAmount;
      if (now < expirationTime) {
        return Math.ceil((expirationTime - now) / 1000);
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    return 0;
  }
}
