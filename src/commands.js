const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle
} = require("discord.js");

const { mafiaReply, mafiaCommandHandler } = require("./game.js");

const { joinVoiceChannel } = require('@discordjs/voice');
const EMBED_COLOUR = 0xD3CFBA;
let connection = null;


module.exports = {
    interactionHandler : function(interaction, client) {
        if (interaction.isButton()) buttonHandler(interaction);

        switch(interaction.commandName) {
            case "test":
                testReply(interaction);
                break;
            case "join":
                joinReply(interaction);
                break;
            case "dc":
                dcReply(interaction);
                break;
            case "mafia":
                mafiaReply(interaction, client);
                break;
        }
    },

    messageHandler : function(message, client) {
        if (message.author.bot) return;
        if (message.content.substring(0, 2) != "==") return;

        const args = message.content.slice(2);

        switch(args.split(" ")[0]) {
            case "mafia":
                mafiaCommandHandler(message, client, message.content.split(" ")[1]);
                break;
            default:
                message.reply(messageEmbed("Unknown command."));
                break;
        }
    }
}

function buttonHandler(interaction) {
    switch(interaction.customId) {
        case "click_one":
            testButtonReply(interaction);
            break;
        case "click_two":
            console.log("two");
            removeComponents(interaction.message);
            break;
    }
}

async function testReply(interaction) {
    let button1 = new ButtonBuilder()
    .setLabel("Yes")
    .setCustomId("click_one")
    .setStyle(ButtonStyle.Primary);

    let button2 = new ButtonBuilder()
    .setLabel("Yes")
    .setCustomId("click_two")
    .setStyle(ButtonStyle.Primary);

    await interaction.reply({ 
        embeds: [{
            color: EMBED_COLOUR,
            description: "Are you stupid?"
        }], 
        components: [new ActionRowBuilder().addComponents(button1, button2)], 
        ephemeral: false 
    })
    .catch(console.error);

}

async function joinReply(interaction) {
    let senderId = interaction.user.id;

    // searches for the sender; if sender is found in a voice channel, join the channel; else tells sender
    // to join a voice channel and do nothing else
    await interaction.guild.channels.fetch()
    .then(channels => {
        for (const channel of channels) {
            if (channel[1].type == 2) { // if the channel is a voice channel
                for (const user of channel[1].members) {
                    if (user[1].user.id == senderId) {
                        connection = joinVoiceChannel({
                            channelId: channel[0],
                            guildId: interaction.guildId,
                            adapterCreator: interaction.guild.voiceAdapterCreator,
                        });
                        interaction.reply(messageEmbed("Joined successfully."));
                        return;
                    }
                }
            }
        }

        interaction.reply(messageEmbed("You are not in a voice channel."));
    })
    .catch(console.error);
}

async function dcReply(interaction) {
    if (connection) {
        connection.destroy();
        connection = null;
        await interaction.reply(messageEmbed("Disconnected."));
    } else {
        await interaction.reply(messageEmbed("Bot is not connected to voice."));
    }
}

async function testButtonReply(interaction) {
    removeComponents(interaction.message);
    await interaction.reply(messageEmbed("yes you are stupid"));
}

function removeComponents(message) {
    message.edit({ components: [] });
}

// returns a one-liner embed message object
function messageEmbed(message) {
    return {
        embeds: [{
            color: EMBED_COLOUR,
            description: message
        }]
    }
}