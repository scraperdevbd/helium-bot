export class Logger {
  private static formatTime(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  static info(message: string, context: string = 'Helium') {
    console.log(`\x1b[38;2;237;66;69m[${this.formatTime()}]\x1b[0m \x1b[36m[${context}]\x1b[0m ${message}`);
  }

  static success(message: string, context: string = 'Helium') {
    console.log(`\x1b[38;2;237;66;69m[${this.formatTime()}]\x1b[0m \x1b[32m[${context}]\x1b[0m ${message}`);
  }

  static warn(message: string, context: string = 'Helium') {
    console.warn(`\x1b[38;2;237;66;69m[${this.formatTime()}]\x1b[0m \x1b[33m[${context}]\x1b[0m ${message}`);
  }

  static error(message: string, error?: any, context: string = 'Helium') {
    console.error(`\x1b[38;2;237;66;69m[${this.formatTime()}]\x1b[0m \x1b[31m[${context}]\x1b[0m ${message}`);
    if (error) {
      console.error(error);
    }
  }

  static security(message: string, context: string = 'Security') {
    console.log(`\x1b[38;2;139;0;0m[${this.formatTime()}]\x1b[0m \x1b[35m[${context}]\x1b[0m ${message}`);
  }
}
