import { SlashCommandBuilder, ChatInputCommandInteraction, VoiceChannel, Routes, REST, ApplicationCommand, APIApplicationCommand, Client } from "discord.js";
import * as HTTP from "https";
import * as fs from "fs";
import { join } from "path";
import { soundboard } from "./sounds";
import { connections } from "./connections";

export type SlashCommand = {
    id?: string,
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
    execute(intr: ChatInputCommandInteraction): Promise<void>
};

export class Commands {
    private commands = [ping, play, sounds, register(this.client)];
    public constructor(private client: Client, private rest: REST) { }

    public async register() {
        const data = await this.rest.put(
            Routes.applicationGuildCommands(process.env["CLIENT_ID"]!, process.env["GUILD_ID"]!),
            { body: this.commands.map(cmd => cmd.data.toJSON()) }
        ) as APIApplicationCommand[];

        data.forEach((cmd, index) => {
            this.commands[index].id = cmd.id;
        });

        console.log(`Registered ${data.length} commands!`);
    }

    public get(name: string): SlashCommand | undefined {
        return this.commands.find(cmd => cmd.data.name === name);
    }
}

export const ping: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("ping")
		.setDescription("Responds with pong"),    
    async execute(intr) { 
        await intr.reply("Pong!");
    }
};

function download(url: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path);
        HTTP.get(url, response => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            }).on("error", reject);
        }).on("error", reject);
    });
}

export const register = (client: Client): SlashCommand => ({
    data: new SlashCommandBuilder()
        .setName("register")
        .setDescription("register")
        .addStringOption(option => option
            .setName("name")
            .setDescription("name")
            .setRequired(true))
        .addAttachmentOption(option => option
            .setName("file")
            .setDescription("file")
            .setRequired(true)),
    async execute(this: SlashCommand, intr) {
        const attachment = intr.options.getAttachment("file");
        const name = intr.options.getString("name", true);
        if (attachment) {
            const path = join(__dirname, "..", "sounds", name + ".mp3"); 
            await download(attachment.url, path);
            soundboard.add(name, name + ".mp3");

            await client.rest.patch(
                Routes.applicationGuildCommand(client.application?.id!, process.env["GUILD_ID"]!, play.id!),
                { body: new SlashCommandBuilder()
                    .setName("play")
                    .setDescription("Plays a sound")
                    .addStringOption(option => option
                        .setName("name")
                        .setDescription("The name of the sound")
                        .setRequired(true)
                        .setChoices(...soundboard.choices()))
                    .toJSON()
                }
            );

            await intr.reply(`Added ${name} to the soundboard`);
        }
    }
});

export const play: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays a sound")
        .addStringOption(option => option
            .setName("name")
            .setDescription("The name of the sound")
            .setRequired(true)
            .setChoices(...soundboard.choices())),
    async execute(intr) {
        const user_id = intr.user.id;
        const member = await intr.guild?.members.fetch(user_id);
        if (member) {
            const voice_channel = member.voice.channel;
            if (voice_channel && voice_channel instanceof VoiceChannel) {
                const connection = connections.create_connection(voice_channel);
                const sound_name = intr.options.getString("name", true);
                const sound = soundboard.get(sound_name);
                if (sound) {
                    sound.play(connection);
                    await intr.reply({ content: `Playing ${sound_name}`, ephemeral: true });
                } else {
                    throw new Error("Could not find a sound with the given name");
                }
            } else {
                throw new Error("The member is not connected to a voice channel");
            }
        } else {
            throw new Error("Cannot fetch member information");
        }
    }
};

export const sounds: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("sounds")
        .setDescription("Display all the registered sounds"),
    async execute(intr) {
        await intr.reply(soundboard.names().join(", "));
    }
}