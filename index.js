const mineflayer = require('mineflayer')

const options = {
    host: 'localhost', // Change this to the ip you want.
    port: 25565, // Change this to the port you want.
    username: 'zqkt_bot',
    password: ''
}

const bot = mineflayer.createBot(options)

const welcome = () => {
    bot.chat('hi!')
  }
  
bot.once('spawn', welcome)

async function craft (bot) {
    const mcData = require('minecraft-data')(bot.version)
    const plankRecipe = bot.recipesFor(mcData.itemsByName.oak_planks.id ?? mcData.itemsByName.planks.id)[0]
    await bot.craft(plankRecipe, 1, null)
    const stickRecipe = bot.recipesFor(mcData.itemsByName.sticks.id)[0]
    await bot.craft(stickRecipe, 1, null)
    bot.chat('Crafting Sticks finished')
}
