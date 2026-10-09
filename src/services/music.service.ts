export interface Song {
  title: string;
  url: string;
  duration: string;
  requestedBy: string;
}

export interface GuildQueue {
  guildId: string;
  songs: Song[];
  volume: number;
  playing: boolean;
  loop: boolean;
}

export class MusicService {
  private static queues = new Map<string, GuildQueue>();

  static getQueue(guildId: string): GuildQueue {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        guildId,
        songs: [],
        volume: 100,
        playing: false,
        loop: false,
      });
    }
    return this.queues.get(guildId)!;
  }

  static addSong(guildId: string, song: Song): number {
    const queue = this.getQueue(guildId);
    queue.songs.push(song);
    return queue.songs.length;
  }

  static skip(guildId: string): Song | null {
    const queue = this.getQueue(guildId);
    if (queue.songs.length === 0) return null;
    return queue.songs.shift() || null;
  }

  static stop(guildId: string) {
    const queue = this.getQueue(guildId);
    queue.songs = [];
    queue.playing = false;
  }

  static setVolume(guildId: string, volume: number): number {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(200, volume));
    return queue.volume;
  }

  static toggleLoop(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    queue.loop = !queue.loop;
    return queue.loop;
  }

  static shuffle(guildId: string) {
    const queue = this.getQueue(guildId);
    if (queue.songs.length > 1) {
      queue.songs.sort(() => Math.random() - 0.5);
    }
  }
}
