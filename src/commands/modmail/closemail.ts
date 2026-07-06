import { PermissionFlagsBits, EmbedBuilder, Client, Message } from "discord.js";
import config from "../../../config.json" with { type: "json" };
import { modmailCache } from "../../events/messageCreate/modmailSessions.js";

export default {
  name: "closemail",
  description: "Close the current modmail thread.",
  permissionRequired: PermissionFlagsBits.ManageThreads,
  aliases: ["close", "endmail"],

  async callback(client: Client, message: Message) {
    try {
      if (
        !message.channel.isThread() ||
        message.channel.parentId !== config.modmailChannelId
      ) {
        return message.reply(
          "This command can only be used inside a modmail thread.",
        );
      }

      const thread = message.channel;

      const parentMessage = await thread.fetchStarterMessage();
      if (!parentMessage) return;

      const embed = parentMessage.embeds[0];
      if (!embed?.footer?.text) return;

      const userId = embed.footer.text;
      if (!userId) return;

      modmailCache.delete(userId);

      const user = await client.users.fetch(userId).catch(() => null);

      if (user) {
        await user
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle("Modmail Closed")
                .setDescription(
                  "Your modmail has been closed. You can open a new one anytime.",
                )
                .setColor(0xff4d4d),
            ],
          })
          .catch(() => null);
      }

      await thread.send({
        embeds: [
          new EmbedBuilder()
            .setDescription("🔒 Modmail closed")
            .setColor(0xff4d4d),
        ],
      });

      await thread.setLocked(true);
      await thread.setArchived(true);
    } catch (err) {
      console.error("Closemail error:", err);

      const fallbackChannel = message.channel;
      if (
        fallbackChannel &&
        "send" in fallbackChannel &&
        typeof fallbackChannel.send === "function"
      ) {
        await fallbackChannel
          .send("Failed to close modmail thread.")
          .catch(() => null);
      }
    }
  },
};
