import { readdirSync } from "fs";
import { basename, join } from "path";
import { Connection } from "./connections";
import { APIApplicationCommandOptionChoice } from "discord.js";

export class Sound {
    public constructor(public path: string) { }

    public play(connection: Connection) {
        const full_path = join(__dirname, "..", "sounds", this.path);
        connection.play(full_path);
    }
}

export class Soundboard {
    private sounds: { [key: string]: Sound } = {};

    public constructor(path: string) {
        const exclude = [".gitkeep"];
        readdirSync(path).forEach(file => {
            if (!exclude.includes(basename(file)))
                this.add(basename(file, ".mp3"), file);
        });
    }

    public add(name: string, path: string): void {
        this.sounds[name] = new Sound(path);
    }

    public get(name: string): Sound | undefined {
        return this.sounds[name];
    }

    public names(): string[] {
        return Object.keys(this.sounds);
    }

    public choices(): APIApplicationCommandOptionChoice<string>[] {
        return this.names().map(name => ({ name, value: name }));
    }
}

export const soundboard = new Soundboard(join(__dirname, "..", "sounds"));