declare module 'fs' {
    export function existsSync(path: string): boolean;
    export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module 'path' {
    export function join(...paths: string[]): string;
}

declare module 'discord.js' {
    export const GatewayIntentBits: Record<string, number>;
    const Discord: any;
    export default Discord;
}

declare const __dirname: string;

declare interface NodeProcess {
    on(event: 'unhandledRejection', listener: (reason: unknown) => void): this;
}

declare const process: NodeProcess;

declare function require(moduleName: string): any;
