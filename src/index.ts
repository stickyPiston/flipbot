import { Client, GatewayIntentBits, Events, Interaction, REST, Routes } from "discord.js";
require("dotenv").config();

import { Commands } from "./commands";
import { connections } from "./connections";

((async () => {
    const rest = new REST().setToken(process.env["BOT_TOKEN"]!);

    try {
        const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

        const commands = new Commands(client, rest);
        commands.register();

        client.on(Events.InteractionCreate, async (interaction: Interaction) => {
            if (!interaction.isChatInputCommand()) return;

            try {
                const command = commands.get(interaction.commandName);
                if (command) {
                    await command.execute(interaction);
                } else {
                    throw new Error("Called unknown command");
                }
            } catch (error) {
                const message = `Encountered an error: ${error}`;
                if (interaction.replied) {
                    await interaction.editReply(message);
                } else {
                    await interaction.reply({ content: message, ephemeral: true });
                }
            }
        });

        client.on(Events.VoiceStateUpdate, async (old_state, new_state) => {
            for (const state of [old_state, new_state]) {
                if (state.member?.id !== process.env["CLIENT_ID"])
                    connections.on_update(state);
            }
        });

        client.login(process.env["BOT_TOKEN"]);
    } catch (e) {
        console.error(e);
    }
})());
