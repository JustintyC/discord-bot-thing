module.exports = {
    mafiaReply: function(interaction, client) {
        if (game_state != 0) {
            interaction.reply(messageEmbed("There is an ongoing game right now!"));
            return;
        }

        // resetting globals
        playerMap = new Map();
        playerArr = [];
        mafia_alive = true;
        alive_players = 0;

        game_state = 1;
        game_author = interaction.user.username;
        const channel = client.channels.cache.get(interaction.channelId);
        interaction.reply(messageEmbed("Starting a game of Mafia. Do [==mafia join] to join!"));

        // adds the caller to the game
        playerMap.set(game_author, {
            user: interaction.user,
            role: "villager",
            status: "alive",
        });
        playerArr.push(game_author);
    },

    mafiaCommandHandler: async function(message, client, args) {
        switch(args[0]) {
            case "join":
                mafiaJoinReply(message);
                break;
            case "start":
                mafiaStartReply(message, client);
                break;
            case "v": // so that the bot doesn't respond to ==mafia v twice
                break;
            case "end":
                mafiaEndReply(message);
                break;
            case "debug":
                // if (!playerInGame(message.author.username)) break;
                message.reply(messageEmbed(`playerArr: ${playerArr}, game_state: ${game_state}, alive_players: ${alive_players}`))
                break;
            default:
                message.reply(messageEmbed("Unknown mafia command. Do [==mafia help] to learn more."))
        }
    }
}

const EMBED_COLOUR = 0xD3CFBA;

// key: user's username (not globalName)
// value: { User: JSON object of user, role: ..., status: (alive/dead), }
let playerMap = new Map();

// an array of players in a mafia game
let playerArr = [];

// 0 = not running; 1 = gathering participants; 2 = game running
let game_state = 0;

// the username of the user who did /mafia to start the game
let game_author = null;
let alive_players = 0;
let mafia_alive = true;

function mafiaEndReply(message) {
    game_state = 0;
    message.reply(messageEmbed("Game ended."));
}

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
    game(client, channel);
}

async function game(client, channel) {
    let mafiaUsername = gameInitiation(client);

    while(!checkIfGameEnd()) {
        // night: prompt mafia to kill someone & handle player actions
        // other roles may be added in the future
        channel.send(messageEmbed("It is nighttime, and everyone goes to sleep. Meanwhile, the mafia takes action..."));
        const victim = await mafiaKillPrompt(mafiaUsername, client);

        // day
        channel.send(messageEmbed("The sun has risen!"));

        const actions = {
            mafiaKill: victim
        }

        handleActions(actions);
        if(checkIfGameEnd()) break;

        if (victim == null) {
            channel.send(messageEmbed(`No one was killed last night. Start discussing!`));
        } else {
            channel.send(messageEmbed(`${victim} was killed last night. Start discussing!`));        
        }
    
        channel.send(messageEmbed("[==mafia v username] to vote to eliminate someone, [==mafia v skip] to abstain. A decision will be made if more than 50% of players voted the same thing."))
    
        

        await voting(client, channel);

    }

    // handle the end of the game
    console.log("game end");
    if (mafia_alive) {
        channel.send(messageEmbed("The mafia has killed everyone in town."));
    } else {
        channel.send(messageEmbed("The mafia has been eliminated. Villagers win!"));
    }

    game_state = 0;
}

// game continues as long as there are more than 2 players alive and the mafia is alive
// i.e. game ends when there are =< 2 players or mafia gets eliminated
// returns true if game meets conditions to end
function checkIfGameEnd() {
    return alive_players < 2 || !mafia_alive; // should be <= 2, < 2 for testing
}

// assign roles, dm each participant their role
function gameInitiation(client) {
    let numPlayers = playerArr.length;
    alive_players = numPlayers;
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
// RETURNS: victim's name or null for skip
async function mafiaKillPrompt(mafiaUsername, client) {
    let output = null;
    const mafiaUser = getUser(mafiaUsername);
    const channel = await mafiaUser.createDM();

    client.users.send(getUserId(mafiaUsername), "Who will you kill tonight? Please enter their username or \"skip\" without the quotations to skip. You have 30 seconds.");
    const filter = (m) => {
        return m.author == mafiaUser;
    };

    // keep prompting the user until a valid username of an alive player or "skip" is provided
    while (!((playerInGame(output) && (getUserStatus(output) == "alive")) || output == "skip")) {
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
            console.log(`mafia entered ${output}`);
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
        if (output == mafiaUsername) {
            client.users.send(getUserId(mafiaUsername), `You stubbed your toe and died.`);
        } else {
            client.users.send(getUserId(mafiaUsername), `You decided to kill ${output} tonight.`);
        }
        return output;
    }
}

// handles all player actions that took place during nighttime (kills, etc)
function handleActions(actions) {
    victim = actions.mafiaKill;

    if (victim != null) killPlayer(victim);

    // if (victim == null) {
    //     channel.send(messageEmbed(`No one was killed last night. Start discussing!`));
    // } else {
    //     killPlayer(victim);
    //     channel.send(messageEmbed(`${victim} was killed last night. Start discussing!`));        
    // }

    // channel.send(messageEmbed("[==mafia v username] to vote to eliminate someone, [==mafia v skip] to abstain. A decision will be made if more than 50% of players voted the same thing."))
}

function killPlayer(username) {
    playerMap.get(username).status = "dead";
    alive_players--;
    if (getUserRole(username) == "mafia") mafia_alive = false;
}

// starts player voting
async function voting(client, channel) {
    let voteCountMap = new Map();
    let voteMap = new Map();

    // message must start with ==mafia v
    // player must not have voted before
    // On vote: 
    //      if voted to skip, add 1 tally point to skip
    //      if voted for anything else (a player),
    //          1. check if the player is in game and alive
    //          2. add 1 tally point to that player
    // once everyone has voted, get the option with the most votes; if the number of votes for that option
    // is more than 50% of voters, that decision is carried out
    const filter = (m) => {
        console.log(m.content);
        if (!m.content.startsWith("==mafia v ")) return false;
        if (voteCountMap.get(m.author.id) != null) {
            m.reply(messageEmbed("You have already voted!"));
            return false;
        }
        if (getUserStatus(m.author.username) != "alive") {
            m.reply(messageEmbed("You are no longer / not in game."));
            return false
        };

        let arg = null;
        try {
            arg = m.content.split(" ")[2];
        } catch (error) {
            console.log("filter error");
            return false;
        }

        if (arg == "skip" || (playerInGame(arg) && getUserStatus(arg) == "alive")) {
            voteCountMap.set(m.author.id, 1);
            if (voteMap.get(arg) == null) voteMap.set(arg, 1);
            else voteMap.set(arg, voteMap.get(arg) + 1);
            channel.send(messageEmbed(`+1 vote for ${arg}`));
            return true;
        } else {
            m.reply(messageEmbed("Player does not exist / is not in game."));
            console.log("voted player doesnt exist/not in game");
            return false;
        }
    }

    await channel.awaitMessages({
        filter,
        max: alive_players,
    })
    .then(() => {
        channel.send(messageEmbed("Voting complete!"));

        // finds the maximum voted option
        let max;
        let tie = false;
        for (let [key, value] of voteMap) {
            if (!max) max = [key, value];
            else {
                if (max[1] < value) { 
                    max = [key, value];
                    tie = false;
                } else if (max[1] == value) {
                    tie = true;
                }
            }
        }
        console.log(max);

        // carries out voted option
        if (max[0] == "skip" || tie) {
            channel.send(messageEmbed("No one was voted out."));
        } else {
            const fiftyPercent = alive_players/2;
            if (max[1] > fiftyPercent) {
                channel.send(messageEmbed(`${max[0]} has been voted out.`));
                killPlayer(max[0]);
            } else {
                channel.send(messageEmbed("There were not enough votes to make a decision. No one was voted out."));
            }
            
        }

    })
    .catch(collected => console.log(`error; ${collected}`))

    return 0;
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
    if (!playerInGame(username)) return null;
    return playerMap.get(username).user;
}

function getUserId(username) {
    if (!playerInGame(username)) return null;
    return playerMap.get(username).user.id;
}

function getUserRole(username) {
    if (!playerInGame(username)) return null;
    return playerMap.get(username).role;
}

function getUserStatus(username) {
    if (!playerInGame(username)) return null;
    return playerMap.get(username).status;
}