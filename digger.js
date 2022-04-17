/*
* Never spend hours mining from ground to bedrock again!
*
* Learn how to create a simple bot that is capable of digging the block
* below his feet and then going back up by creating a dirt column to the top.
*
* As always, you can send the bot commands using chat messages, and monitor
* his inventory at any time.
*
* Remember that in survival mode he might not have enough dirt to get back up,
* so be sure to teach him a few more tricks before leaving him alone at night.
*/
const mineflayer = require('mineflayer')
const vec3 = require('vec3')
const dotenv = require("dotenv")

dotenv.config()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const vec3Direction = {
    'down': vec3(0, -180, 0),
    'up': vec3(0, 180, 0),
    'south': vec3(0, 0, 180),
    'north': vec3(0, 0, -180),
    'east': vec3(180, 0, 0),
    'west': vec3(-180, 0, 0)
}

const blockOffset = {
    'up': [0, 1, 0],
    'down': [0, -1, 0],
    'south': [0, 0, 1],
    'north': [0, 0, -1],
    'east': [1, 0, 0],
    'west': [-1, 0, 0]
}

const bot = mineflayer.createBot({
    host: process.env.HOST,
    port: process.env.PORT,
    username: process.env.USERNAME,
    password: process.env.PASSWORD
})

// Add debug value to the bot
bot.debugging = false

// Add debug function to the bot class
bot.debug = function (message) {
    console.log(this.debugging);
    if (this.debugging) {
        this.chat(message)
    }
}

bot.on('chat', async (username, message) => {
    if (username === bot.username) return
    
    switch (message) {
        case 'loaded':
            await bot.waitForChunksToLoad()
            bot.chat('Ready!')
            break
        case 'list':
            sayItems()
            break
        case (message.match(/^dig\s?([0-9])?\s?(up|down|south|north|east|west)?/) || {}).input:
            dig(message);
            break;
        case 'build':
            build()
            break
        case 'equip dirt':
            equipDirt()
            break
        case 'equip pickaxe':
            equipPickaxe()
            break
    }
})

function sayItems (items = bot.inventory.items()) {
    const output = items.map(itemToString).join(', ')
    if (output) {
        bot.chat(output)
    } else {
        bot.chat('empty')
    }
}

async function dig (message) {
    bot.chat(message);
    console.log(message);
    /**
     * Find count and direction
     */
    const [arr] = message.matchAll(/^dig\s?([0-9])?\s?(up|down|south|north|east|west)?/g)
    var [, count, direction] = arr
    
    if (!count) {
        count = 1
    }

    if (!direction) {
        direction = 'down'
    }

    bot.chat("Diggin " + count + " " + direction);

    /**
     * Vec3 Structure:
     * 
     * x - south
     * y - up
     * z - west
     */
    
    if (bot.targetDigBlock) {
        bot.chat(`already digging ${bot.targetDigBlock.name}`)
    } else {
        for (let i = 0; i < count; i++) {
            /**
             * If it's diggin up/down, gets only one block
             * If it's diggin north/south/east/west, gets two blocks (height of player)
             */
            var targets = getDigTargets(direction);
            
            /**
             * Digs for each target block
             */
            for (let target of targets) {

                /**
                 * Maximum 10 tries to avoid infinite loop
                 */
                let maxCounter = 10;

                /**
                 * If it's air, the player might be falling, so we wait for a few seconds
                 */
                while (target.name === "air" && maxCounter > 0) {
                    await delay(200);
                    target = bot.blockAt(bot.entity.position.offset(
                        blockOffset[direction][0], blockOffset[direction][1], blockOffset[direction][2]
                    ));
                    maxCounter--;
                }

                console.log("TARGET: " + target.name);
                
                /**
                 * If the block can be digged, dig it
                 */
                if (target && bot.canDigBlock(target)) {
                    //bot.chat(`starting to dig ${target.name}`)
                    bot.debug(`starting to dig ${target.name}`)
                    try {
                        await bot.dig(target)
                        //bot.chat(`finished digging ${target.name}`)
                        bot.debug(`finished digging ${target.name}`)
                    } catch (err) {
                        console.log(err.stack)
                    }
                } else {
                    bot.chat('cannot dig')
                }
            }

            if (['north', 'south', 'east', 'west'].includes(direction)) {
                /**
                 * If it's a cardinal direction, walk to the new position
                 */
                bot.controlState.forward = true;
                await delay(250);
                bot.controlState.forward = false;
            }

        }
    }
}

/**
 * Gets the targets for the dig command, depending on the direction
 * If the direction is up/down, it gets only one block
 * If the direction is north/south/east/west, it gets two blocks (height of player)
 *
 * @param {string} direction 
 * 
 * @returns array of target blocks
 */
function getDigTargets(direction) {
    
    var targets = []
    
    /**
     * First block
     */
    targets.push(
        bot.blockAt(
            bot.entity.position.offset(
                blockOffset[direction][0], blockOffset[direction][1], blockOffset[direction][2]
            )
        )
    )
    
    /**
     * First block + 1 height
     */
    if (['north', 'south', 'east', 'west'].includes(direction)) {
        targets.push(
            bot.blockAt(
                bot.entity.position.offset(
                    blockOffset[direction][0], blockOffset[direction][1]+1, blockOffset[direction][2]
                )
            )
        )
    }

    return targets
}

function build () {
    const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0))
    const jumpY = Math.floor(bot.entity.position.y) + 1.0
    bot.setControlState('jump', true)
    bot.on('move', placeIfHighEnough)
    
    let tryCount = 0
    
    async function placeIfHighEnough () {
        if (bot.entity.position.y > jumpY) {
            try {
                await bot.placeBlock(referenceBlock, vec3(0, 1, 0))
                bot.setControlState('jump', false)
                bot.removeListener('move', placeIfHighEnough)
                bot.chat('Placing a block was successful')
            } catch (err) {
                tryCount++
                if (tryCount > 10) {
                    bot.chat(err.message)
                    bot.setControlState('jump', false)
                    bot.removeListener('move', placeIfHighEnough)
                }
            }
        }
    }
}

async function equipDirt () {
    const mcData = require('minecraft-data')(bot.version)
    let itemsByName
    if (bot.supportFeature('itemsAreNotBlocks')) {
        itemsByName = 'itemsByName'
    } else if (bot.supportFeature('itemsAreAlsoBlocks')) {
        itemsByName = 'blocksByName'
    }
    try {
        await bot.equip(mcData[itemsByName].dirt.id, 'hand')
        bot.chat('equipped dirt')
    } catch (err) {
        bot.chat(`unable to equip dirt: ${err.message}`)
    }
}

async function equipPickaxe () {
    const mcData = require('minecraft-data')(bot.version)
    let itemsByName
    if (bot.supportFeature('itemsAreNotBlocks')) {
        itemsByName = 'itemsByName'
    } else if (bot.supportFeature('itemsAreAlsoBlocks')) {
        itemsByName = 'blocksByName'
    }

    let bestPickaxe = null
    let bestPickaxeName = ""
    if (checkItemInInventory(mcData[itemsByName].diamond_pickaxe.id)) {
        bestPickaxe = mcData[itemsByName].diamond_pickaxe.id
        bestPickaxeName = "diamond pickaxe"
    } else if (checkItemInInventory(mcData[itemsByName].golden_pickaxe.id)) {
        bestPickaxe = mcData[itemsByName].golden_pickaxe.id
        bestPickaxeName = "golden pickaxe"
    } else if (checkItemInInventory(mcData[itemsByName].iron_pickaxe.id)) {
        bestPickaxe = mcData[itemsByName].iron_pickaxe.id
        bestPickaxeName = "iron pickaxe"
    } else if (checkItemInInventory(mcData[itemsByName].stone_pickaxe.id)) {
        bestPickaxe = mcData[itemsByName].stone_pickaxe.id
        bestPickaxeName = "stone pickaxe"
    } else if (checkItemInInventory(mcData[itemsByName].wooden_pickaxe.id)) {
        bestPickaxe = mcData[itemsByName].wooden_pickaxe.id
        bestPickaxeName = "wooden pickaxe"
    }
    
    try {
        await bot.equip(bestPickaxe, 'hand')
        bot.chat('equipped ' + bestPickaxeName)
    } catch (err) {
        bot.chat(`unable to equip pickaxe: ${err.message}`)
    }
}

function checkItemInInventory(item) {
    let inventoryWindow = bot.inventory;

    let hasItem = inventoryWindow.findInventoryItem(item);

    if (hasItem) {
        return true;
    }
    
    return false;
}

function itemToString (item) {
    if (item) {
        return `${item.name} x ${item.count}`
    } else {
        return '(nothing)'
    }
}