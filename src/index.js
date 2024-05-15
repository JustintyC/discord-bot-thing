const { Client, IntentsBitField } = require("discord.js");
const { interactionHandler, messageHandler } = require("./commands.js")
require('dotenv').config();

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.DirectMessages,
    ],
});

client.on("ready", (c) => {
    console.log(`${c.user.username} is online`);
});

client.on("interactionCreate", (interaction) => {
    interactionHandler(interaction, client);
});

client.on("messageCreate", (message) => {
    messageHandler(message, client);
});



client.login(process.env.DISCORD_TOKEN);