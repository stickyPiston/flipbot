import { AudioPlayer, VoiceConnection, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } from "@discordjs/voice";
import { VoiceChannel, VoiceState } from "discord.js";

export class Connection {
    private player: AudioPlayer;
    public constructor(
        public connection: VoiceConnection,
        public channel: VoiceChannel
    ) {
        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);
    }

    public play(path: string) {
        try {
            const resource = createAudioResource(path, { inlineVolume: true });
            this.player.play(resource);
        } catch (error) {
            throw new Error(`Cannot play the given file ${error}`);
        }
    }
};

export class Connections {
    private map: { [key: string]: Connection } = {};

    public create_connection(channel: VoiceChannel): Connection {
        if (channel.id in this.map) {
            return this.map[channel.id];
        } else {
            const voice_connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guildId,
                adapterCreator: channel.guild.voiceAdapterCreator
            });

            voice_connection.on(VoiceConnectionStatus.Disconnected, async (_old_state, _new_state) => {
                try {
                    await Promise.race([
                        entersState(voice_connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(voice_connection, VoiceConnectionStatus.Connecting, 5000)
                    ]);
                } catch (error) {
                    this.destroy_connection(channel.id);
                }
            });

            const connection = new Connection(voice_connection, channel);

            return this.map[channel.id] = connection;
        }
    }

    public destroy_connection(channel_id: string): void | never {
        if (channel_id in this.map) {
            this.map[channel_id].connection.destroy();
            delete this.map[channel_id];
        } else {
            throw new Error("Cannot destroy unbound connection");
        }
    }

    public async on_update({ channelId, guild }: VoiceState) {
        if (channelId === null) {
            return;
        } else if (channelId in this.map) {
            const connection = this.map[channelId];

            if (connection.channel.members.size === 1)
                this.destroy_connection(channelId);
        } else {
            const channel = await guild.channels.fetch(channelId);
            if (channel === null) {
                throw new Error("Cannot fetch the requested channel");
            } else if (!(channel instanceof VoiceChannel)) {
                throw new Error("Cannot update a non-voice channel");
            } else {
                this.create_connection(channel);
            }
        }
    }
}

export const connections = new Connections();