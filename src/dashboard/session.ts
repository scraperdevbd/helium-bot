import crypto from 'crypto';
import { GuildMember, User } from 'discord.js';
import { CONFIG } from '../config/config.js';
import { Logger } from '../core/logger.js';

export interface DashboardSession {
  id: string;
  userId: string;
  userTag: string;
  guildId?: string;
  webToken: string;
  currentPage: 'overview' | 'security' | 'automod' | 'moderation' | 'logs' | 'features' | 'database';
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

export class DashboardSessionManager {
  private static sessions: Map<string, DashboardSession> = new Map();
  private static failedAttempts: Map<string, { count: number; resetAt: number }> = new Map();
  private static validTokens: Map<string, { userId: string; expiresAt: number }> = new Map();

  private static SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Validate activation attempt by checking rate limits, authorization, and activation key
   */
  static validateAccess(
    user: User,
    member: GuildMember | null,
    providedKey?: string
  ): { allowed: boolean; reason?: string; isOwner: boolean } {
    const isOwner = CONFIG.OWNER_IDS.includes(user.id);
    const isAdmin = member ? member.permissions.has('Administrator') : false;

    // 1. Rate limiting check (max 3 failed attempts in 60s)
    const now = Date.now();
    const rateData = this.failedAttempts.get(user.id);
    if (rateData && now < rateData.resetAt && rateData.count >= 3) {
      const waitSec = Math.ceil((rateData.resetAt - now) / 1000);
      Logger.security(`Rate-limit triggered on admin dashboard access for user ${user.id}`);
      return { allowed: false, reason: `Too many failed attempts. Please wait ${waitSec}s before retrying.`, isOwner };
    }

    // 2. Authorization check
    if (!isOwner && !isAdmin) {
      this.recordFailedAttempt(user.id);
      Logger.security(`Unauthorized user ${user.id} (${user.tag}) attempted dashboard access.`);
      return { allowed: false, reason: 'Access denied: You must be a Server Administrator or Bot Owner.', isOwner };
    }

    // 3. Activation key check (never log or reveal the key)
    if (!providedKey || providedKey.trim() !== CONFIG.ADMIN_DASHBOARD_KEY) {
      this.recordFailedAttempt(user.id);
      Logger.security(`Invalid activation key provided by ${user.id} (${user.tag}).`);
      return { allowed: false, reason: 'Invalid dashboard activation key provided.', isOwner };
    }

    // Clear failed attempts on success
    this.failedAttempts.delete(user.id);
    return { allowed: true, isOwner };
  }

  private static recordFailedAttempt(userId: string) {
    const now = Date.now();
    const existing = this.failedAttempts.get(userId);
    if (!existing || now >= existing.resetAt) {
      this.failedAttempts.set(userId, { count: 1, resetAt: now + 60000 });
    } else {
      existing.count += 1;
    }
  }

  /**
   * Create an interactive dashboard session
   */
  static createSession(user: User, guildId?: string): DashboardSession {
    const sessionId = `dash_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const webToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    const session: DashboardSession = {
      id: sessionId,
      userId: user.id,
      userTag: user.tag,
      guildId,
      webToken,
      currentPage: 'overview',
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.SESSION_TIMEOUT_MS,
    };

    this.sessions.set(sessionId, session);
    this.validTokens.set(webToken, { userId: user.id, expiresAt: now + this.SESSION_TIMEOUT_MS });

    return session;
  }

  static getSession(sessionId: string): DashboardSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.validTokens.delete(session.webToken);
      return undefined;
    }

    return session;
  }

  static touchSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      const now = Date.now();
      session.lastActivity = now;
      session.expiresAt = now + this.SESSION_TIMEOUT_MS;
      this.validTokens.set(session.webToken, { userId: session.userId, expiresAt: session.expiresAt });
    }
  }

  static closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.validTokens.delete(session.webToken);
      this.sessions.delete(sessionId);
    }
  }

  static validateWebToken(token: string): boolean {
    const data = this.validTokens.get(token);
    if (!data) return false;
    if (Date.now() > data.expiresAt) {
      this.validTokens.delete(token);
      return false;
    }
    return true;
  }
}
