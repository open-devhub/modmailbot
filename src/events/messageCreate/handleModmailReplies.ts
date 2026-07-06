import {
  AttachmentBuilder,
  type Client,
  type Message,
  type MessageCreateOptions,
  type TextChannel,
} from "discord.js";
import config from "../../../config.json" with { type: "json" };

const { prefixes } = config;

export default async (client: Client, message: Message) => {
  if (message.author.bot) return;
  if (message.webhookId) return;
  if (prefixes.some((p) => message.content.startsWith(p))) return;

  try {
    if (!message.channel.isThread()) return;
    if (message.channel.parentId !== config.modmailChannelId) return;

    const parentMessage = await message.channel.fetchStarterMessage();
    if (!parentMessage) return;

    const embed = parentMessage.embeds[0];
    if (!embed?.footer?.text) return;

    const userId = embed.footer.text;
    if (!userId) return;

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;
    if (!client.user) return;

    const parent = await client.channels.fetch(config.modmailChannelId);
    if (!parent || !parent.isTextBased()) return;

    const textParent = parent as TextChannel;
    const webhooks = await textParent.fetchWebhooks();

    const webhook =
      webhooks.find(
        (w) => w.owner?.id === client.user?.id && w.name === "modmail",
      ) || (await textParent.createWebhook({ name: "modmail" }));

    const attachments = [...message.attachments.values()];

    const dmPayload: MessageCreateOptions = {};
    if (message.content?.trim()) dmPayload.content = message.content;
    if (attachments.length)
      dmPayload.files = attachments.map((a) => new AttachmentBuilder(a.url));

    await user.send(dmPayload);

    await message.react("✅");
  } catch (err) {
    console.error("Modmail reply error:", err);
    await message.react("❌").catch(() => null);
  }
};
