import asyncio
import os
import discord
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN", "")
CHANNEL_ID = 1493329389516099616
GIF_URL = "https://cdn.discordapp.com/attachments/1458538502051594438/1492666832317054986/caption.2ec320da.gif?ex=69de2411&is=69dcd291&hm=a091d64ad83411bf47239680222f0865b8709b5db328adcfa378c1dd9259e83e&"

async def main():
    intents = discord.Intents.default()
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        channel = client.get_channel(CHANNEL_ID)
        if channel is None:
            channel = await client.fetch_channel(CHANNEL_ID)
        message = await channel.fetch_message(1493333494368305376)
        await message.reply(GIF_URL)
        print("GIF enviado como reply com sucesso!")
        await client.close()

    await client.start(TOKEN)

if __name__ == "__main__":
    asyncio.run(main())
