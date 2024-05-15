// register commands by typing "node src/register-commands.js" in console

const { REST, Routes } = require("discord.js");
require('dotenv').config();

const commands = [
    {
        name: "test",
        description: "test",
    },
    {
        name: "join",
        description: "Tells bot to join your current voice channel.",
    },
    {
        name: "dc",
        description: "Disconnects bot from voice."
    },
    {
        name: "mafia",
        description: "Starts a game of mafia."
    }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => { 
    try {
        console.log("Registering commands")

        let clientId = process.env.CLIENT_ID;
        let guildId = process.env.GUILD_ID;
        await rest.put( 
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        
        console.log("Commands registered successfully")
    } catch (error) {
        console.log(`${error}\n`);
        console.log("Segmentation fault");
    }
})(); 