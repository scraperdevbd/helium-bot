import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config/config.js';

export class HeliumEmbed extends EmbedBuilder {
  constructor() {
    super();
    this.setColor(CONFIG.COLORS.PRIMARY);
    this.setFooter({
      text: CONFIG.FOOTER_TEXT,
    });
    this.setTimestamp();
  }

  static success(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.TICK} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  static error(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.DARK_RED)
      .setTitle(`${CONFIG.EMOJIS.CROSS} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  static warning(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.WARNING)
      .setTitle(`${CONFIG.EMOJIS.WARNING} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  static security(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.DANGER)
      .setTitle(`${CONFIG.EMOJIS.SHIELD} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  static info(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.STAR} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  static settings(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.SETTINGS} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  static connection(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.WIFI} ${title}`)
      .setDescription(description)
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }
}
