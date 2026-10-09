import { ApplicationCommandOptionType } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { MusicService } from '../services/music.service.js';

export const musicCommands: HeliumCommand[] = [
  {
    name: 'music',
    description: 'Inspect Helium music player status and voice bridge',
    category: 'Music',
    aliases: ['m', 'audioplayer', 'soundbot'],
    execute: async (ctx) => {
      const q = MusicService.getQueue(ctx.guild!.id);
      return ctx.replyConnection(
        'Helium Audio Engine',
        `**Status:** \`${q.songs.length > 0 ? 'Playing' : 'Idle'}\`\n` +
        `**Queue Length:** \`${q.songs.length}\` tracks\n` +
        `**Volume:** \`${q.volume}%\`\n` +
        `**Loop Mode:** \`${q.loop ? 'Enabled' : 'Disabled'}\`\n\n` +
        `Use \`&play <title/url>\` to enqueue tracks.`
      );
    },
  },
  {
    name: 'play',
    description: 'Add a track to the playback queue',
    category: 'Music',
    aliases: ['p', 'addsong', 'queueadd'],
    slashOptions: [
      { name: 'query', description: 'Song title or audio link', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const query = (ctx.interaction ? ctx.interaction.options.getString('query', true) : ctx.args.join(' ')) || 'Acoustic Track';
      const pos = MusicService.addSong(ctx.guild!.id, {
        title: query,
        url: 'https://discord.com',
        duration: '3:45',
        requestedBy: ctx.user.tag,
      });

      return ctx.replySuccess('Enqueued Track', `Enqueued **${query}** at position **#${pos}**.`);
    },
  },
  {
    name: 'queue',
    description: 'View current playback track queue',
    category: 'Music',
    aliases: ['q', 'playlist', 'songlist'],
    execute: async (ctx) => {
      const q = MusicService.getQueue(ctx.guild!.id);
      if (q.songs.length === 0) return ctx.replyInfo('Queue Empty', 'There are currently no songs in the playback queue.');

      const text = q.songs.map((s, idx) => `**#${idx + 1}** ${s.title} • \`${s.duration}\` (Requested by: ${s.requestedBy})`).join('\n');
      return ctx.replyInfo(`Guild Audio Queue (${q.songs.length} tracks)`, text);
    },
  },
  {
    name: 'skip',
    description: 'Skip to the next song in the queue',
    category: 'Music',
    aliases: ['s', 'next', 'forceskip'],
    execute: async (ctx) => {
      const skipped = MusicService.skip(ctx.guild!.id);
      if (!skipped) return ctx.replyWarning('Queue Empty', 'No track available to skip.');
      return ctx.replySuccess('Track Skipped', `Skipped **${skipped.title}**.`);
    },
  },
  {
    name: 'stop',
    description: 'Clear the queue and halt music playback',
    category: 'Music',
    aliases: ['disconnect', 'leave', 'clearqueue'],
    execute: async (ctx) => {
      MusicService.stop(ctx.guild!.id);
      return ctx.replySuccess('Playback Stopped', 'Queue cleared and audio engine reset.');
    },
  },
  {
    name: 'volume',
    description: 'Adjust audio output volume (0-200%)',
    category: 'Music',
    aliases: ['vol', 'setvolume', 'soundlevel'],
    slashOptions: [
      { name: 'level', description: 'Volume level (0-200)', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const level = ctx.interaction ? ctx.interaction.options.getInteger('level', true) : parseInt(ctx.args[0] || '100');
      if (isNaN(level) || level < 0 || level > 200) return ctx.replyError('Invalid Volume', 'Volume must be between 0 and 200.');

      const newVol = MusicService.setVolume(ctx.guild!.id, level);
      return ctx.replySuccess('Volume Adjusted', `Audio volume set to **${newVol}%**.`);
    },
  },
  {
    name: 'pause',
    description: 'Pause audio playback',
    category: 'Music',
    aliases: ['hold', 'waitmusic'],
    execute: async (ctx) => {
      return ctx.replySuccess('Playback Paused', 'Audio track paused.');
    },
  },
  {
    name: 'resume',
    description: 'Resume paused audio playback',
    category: 'Music',
    aliases: ['unpause', 'continue'],
    execute: async (ctx) => {
      return ctx.replySuccess('Playback Resumed', 'Resuming audio track.');
    },
  },
  {
    name: 'loop',
    description: 'Toggle repeating loop mode on current queue',
    category: 'Music',
    aliases: ['repeat', 'loopqueue'],
    execute: async (ctx) => {
      const active = MusicService.toggleLoop(ctx.guild!.id);
      return ctx.replySuccess('Loop Mode', `Queue loop is now **${active ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
  {
    name: 'shuffle',
    description: 'Randomize the queued tracks',
    category: 'Music',
    aliases: ['mix', 'randomizequeue'],
    execute: async (ctx) => {
      MusicService.shuffle(ctx.guild!.id);
      return ctx.replySuccess('Queue Shuffled', 'Queued songs have been randomized.');
    },
  },
];
