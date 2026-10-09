import dotenv from 'dotenv';
dotenv.config();

let currentBotName = 'Helium';

export function setDynamicBotName(name: string) {
  if (name && name.trim()) {
    currentBotName = name.trim();
  }
}

export const CONFIG = {
  get BOT_NAME(): string {
    return currentBotName;
  },
  set BOT_NAME(name: string) {
    if (name && name.trim()) currentBotName = name.trim();
  },
  AUTHOR: 'req.akira aka ScraperDevBD',
  AUTHOR_USERNAME: 'req.akira',
  AUTHOR_DISCORD: '@req.akira',
  AUTHOR_GITHUB: 'https://github.com/scraperdevbd',
  PREFIX: process.env.DEFAULT_PREFIX || '&',
  VERSION: '1.0.0',
  TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  OWNER_IDS: (process.env.OWNER_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
  DATABASE_PATH: process.env.DATABASE_PATH || './data/helium.db',
  get FOOTER_TEXT(): string {
    return `${currentBotName} • Developed by @req.akira aka ScraperDevBD (github.com/scraperdevbd)`;
  },

  // Admin Dashboard settings
  ADMIN_DASHBOARD_KEY: process.env.ADMIN_DASHBOARD_KEY || '2026',
  DASHBOARD_PORT: parseInt(process.env.DASHBOARD_PORT || '3000'),
  DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:3000',

  // Red theme color palette
  COLORS: {
    PRIMARY: 0xED4245,       // Signature Crimson Red
    DARK_RED: 0x8B0000,      // Deep Blood / Security Red
    ACCENT: 0xFF2A42,        // Bright Neon Red
    CRIMSON: 0xDC143C,       // Pure Crimson Red
    DANGER: 0x990000,        // High Security / Alert Red
    WARNING: 0xE65100,       // Fiery Warning Red-Orange
    SUCCESS: 0xED4245,       // Themed Red Success (or 0x2ECC71 for Discord Green when needed)
    MUTED: 0x2B2D31,         // Sleek Dark Gray Card background
    EMBED_BACKGROUND: 0x1E1F22,
  },

  // Approved strict custom emojis only - ZERO Unicode emojis permitted
  EMOJIS: {
    TICK: '<:tick:1533015334238421103>',
    CROSS: '<:cross:1533015330773925978>',
    STAR: '<:StarDust_Star:1533012379997048862>',
    SHIELD: '<a:shield:1533017410829946953>',
    SETTINGS: '<a:settings:1533018460559245366>',
    WIFI: '<:wifi:1533016428301647923>',
    KEY: '<:key:1533015988285476897>',
    MAIL: '<a:i_mail:1533016044816306298>',
    WIFI_ALT: '<:wifi:1533016387088416870>',
    WARNING: '<a:warning:1533018288957817018>',
  }
} as const;
