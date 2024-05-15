module.exports = {
    mafiaReply: function(interaction, client) {
        game_state = 1;
        game_author = interaction.user.username;
        const channel = client.channels.cache.get(interaction.channelId);
        interaction.reply(messageEmbed("Starting a game of Mafia. Do [==mafia join] to join!"))
    },

    mafiaCommandHandler: async function(message, client, command) {
        switch(command) {
            case "join":
                mafiaJoinReply(message);
                break;
            case "start":
                mafiaStartReply(message, client);
                break;
            case "debug":
                // if (!playerInGame(message.author.username)) break;
                const channel = await message.author.createDM();
                await channel.awaitMessages({
                    max: 1,
                    time: 10_000,
                })
                .then((collected) => console.log(collected.first().content))
                .catch(() => console.log("timeout"));

                console.log("main thread ended");
                break;
            default:
                message.reply(messageEmbed("Unknown mafia command. Do [==mafia help] to learn more."))
        }
    }
}

const EMBED_COLOUR = 0xD3CFBA;

// key: user's username (not globalName)
// value: { role: ..., status: (alive/dead), }
let playerMap = new Map();

// an array of players in a mafia game
let playerArr = [];

// 0 = not running; 1 = gathering participants; 2 = game running
let game_state = 0;

// the username of the user who did /mafia to start the game
let game_author = null;

function mafiaJoinReply(message) {
    if (game_state != 1) {
        message.reply(messageEmbed("Cannot join: Mafia game not in participant gathering state."))
        return;
    }

    let playerName = message.author.username;

    if (playerMap.get(playerName) != null) {
        message.reply(messageEmbed("You have already joined!"))
        return;
    }

    playerMap.set(playerName, {
        user: message.author,
        role: "villager",
        status: "alive",
    });
    playerArr.push(playerName);

    message.reply(messageEmbed("Mafia game joined successfully!"))
}

function mafiaStartReply(message, client) {
    if (game_state != 1) {
        message.reply(messageEmbed("Cannot start: Mafia game not in participant gathering state."))
        return;
    }
    if (playerArr.length <= 1) { // should be 2; 1 for testing
        message.reply(messageEmbed("Cannot start: Cannot play with less than or equal to 2 players."))
        return;
    }
    if (message.author.username != game_author) {
        message.reply(messageEmbed("Only the user who did /mafia can start the game."));
        return;
    }
    const channel = client.channels.cache.get(message.channelId);
    channel.send(messageEmbed("Starting game!"));
    game_state = 2;
    game(client);
}

async function game(client) {
    let mafiaUsername = gameInitiation(client);
    let mafiaAlive = true;

    // game continues as long as there are more than 2 players alive and the mafia is alive
    // i.e. game ends when there are =< 2 players or mafia gets eliminated
    while(playerArr.length >= 2 && mafiaAlive) { // should be > 2, >= 2 for testing
        // night: prompt mafia to kill someone & handle player actions
        // other roles may be added in the future
        const victim = await mafiaKillPrompt(mafiaUsername, client);

        handleActions({
            mafiaKill: victim,
        });

        break; // stub
    }
    console.log("game end");
    
}

// assign roles, dm each participant their role
function gameInitiation(client) {
    let numPlayers = playerArr.length;
    let mafiaIdx = random(numPlayers);
    let mafiaUsername = playerArr[mafiaIdx];
    playerMap.get(mafiaUsername).role = "mafia";

    for (username of playerArr) {
        client.users.send(getUserId(username), `Your role is: ${getUserRole(username)}.`);
    }


    return mafiaUsername;
}

// prompts the mafia for a person to kill
// options: someone's username or skip
// if mafia input is not in the player list, prompt again until a valid player username is given
// if timeout, skip mafia's turn
// REQUIRES: mafia is a participating user
// RETURNS: victim's name or "skip"
async function mafiaKillPrompt(mafiaUsername, client) {
    let output = null;
    const mafiaUser = getUser(mafiaUsername);
    const channel = await mafiaUser.createDM();

    client.users.send(getUserId(mafiaUsername), "Who will you kill tonight? Please enter their username or \"skip\" without the quotations to skip. You have 30 seconds.");
    const filter = (m) => {
        return m.author == mafiaUser;
    };

    while (!playerInGame(output) && output != "skip") {
        await channel.awaitMessages({
            filter,
            max: 1,
            time: 30_000,
            errors: ["time"]
        })
        .then(collected => { 
            output = collected.first().content;
            if (!playerInGame(output) && output != "skip") {
                client.users.send(getUserId(mafiaUsername), "Please enter a valid username (not global name!).");
            }
            console.log(`player entered ${output}`);
        })
        .catch(() => { 
            client.users.send(getUserId(mafiaUsername), "Timeout - your turn has been skipped. You didn't kill anyone tonight.");
            console.log("timeout") 
            return null;
        });        
    }

    if (output == "skip") {
        client.users.send(getUserId(mafiaUsername), "You didn't kill anyone tonight.");
        return null;
    } else {
        client.users.send(getUserId(mafiaUsername), `You decided to kill ${output} tonight.`);
        return output;
    }
}

// handles all player actions that took place during nighttime (kills, etc)
function handleActions(actions) {
    
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

function random(max) {
    return Math.floor(Math.random() * max);
}

function playerInGame(username) {
    if (username == null) return false;
    return playerMap.get(username) != null;
}

function getUser(username) {
    if (!playerInGame(username)) return;
    return playerMap.get(username).user;
}

function getUserId(username) {
    if (!playerInGame(username)) return;
    return playerMap.get(username).user.id;
}

function getUserRole(username) {
    if (!playerInGame(username)) return;
    return playerMap.get(username).role;
}

function getUserStatus(username) {
    if (!playerInGame(username)) return;
    return playerMap.get(username).status;
}