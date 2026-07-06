import {
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  type Client,
  type Message,
  type TextChannel,
  type ThreadChannel,
  type WebhookMessageCreateOptions,
} from "discord.js";
import crypto from "crypto";
import config from "../../../config.json" with { type: "json" };
import ucid from "unique-custom-id";

export const modmailCache = new Map<string, string>();

export default async (client: Client, message: Message) => {
  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.DM) return;

  try {
    const parent = await client.channels
      .fetch(config.modmailChannelId)
      .catch(() => null);

    if (!parent || !parent.isTextBased()) return;

    const textParent = parent as TextChannel;

    const threadId = modmailCache.get(message.author.id) || null;
    let thread: ThreadChannel | null = null;

    if (threadId) {
      const fetchedThread = await client.channels
        .fetch(threadId)
        .catch(() => null);
      if (fetchedThread?.isThread()) thread = fetchedThread;
      if (!thread || thread.archived || thread.locked) {
        modmailCache.delete(message.author.id);
        thread = null;
      }
    }

    const preview = new EmbedBuilder()
      .setTitle("Modmail Preview")
      .setColor(0x5865f2)
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    if (message.content) preview.setDescription(message.content);

    if (message.attachments.size > 0) {
      const file = message.attachments.first();
      if (file) {
        if (file.contentType?.startsWith("image/")) preview.setImage(file.url);
        else preview.addFields({ name: "Attachment", value: file.url });
      }
    }

    if (!thread) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("modmail_confirm")
          .setLabel("Continue")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("modmail_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger),
      );

      const prompt = await message.reply({
        embeds: [preview],
        components: [row],
      });

      const collector = prompt.createMessageComponentCollector({
        time: 30000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== message.author.id) return;

        await i.deferUpdate();

        if (i.customId === "modmail_cancel") {
          return prompt.edit({
            content: "Cancelled",
            embeds: [],
            components: [],
          });
        }

        const id = ucid.format("short") as string;

        const threadEmbed = new EmbedBuilder()
          .setTitle("New Modmail")
          .setColor(0x5865f2)
          .setThumbnail(message.author.displayAvatarURL())
          .addFields(
            { name: "User", value: `<@${message.author.id}>`, inline: true },
            { name: "User Tag", value: message.author.tag, inline: true },
            { name: "Modmail ID", value: id, inline: true },
            {
              name: "Timestamp",
              value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
              inline: true,
            },
          )
          .setFooter({ text: message.author.id })
          .setTimestamp();

        const threadMsg = await textParent.send({
          content: `<@&${config.moderatorRole}> #${id}`,
          embeds: [threadEmbed],
        });

        const thread = await threadMsg.startThread({
          name: `${message.author.tag} (${id})`,
          autoArchiveDuration: 1440,
        });

        modmailCache.set(message.author.id, thread.id);

        await sendToThread(client, textParent, thread, message);

        await prompt.edit({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Modmail thread created")
              .addFields(
                {
                  name: "Modmail ID",
                  value: id,
                  inline: true,
                },
                {
                  name: "Timestamp",
                  value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                  inline: true,
                },
              )
              .setThumbnail(message.author.displayAvatarURL())
              .setColor(0x5865f2),
          ],
          components: [],
        });
      });

      collector.on("end", async (collected) => {
        if (!collected.size) {
          await prompt.edit({
            content: "Timed out",
            embeds: [],
            components: [],
          });
        }
      });

      return;
    }

    await sendToThread(client, textParent, thread as ThreadChannel, message);
  } catch (err) {
    console.error(err);
  }
};

async function sendToThread(
  client: Client,
  parent: TextChannel,
  thread: ThreadChannel,
  message: Message,
) {
  const webhooks = await parent.fetchWebhooks();

  const webhook =
    webhooks.find(
      (w) => w.owner?.id === client.user?.id && w.name === "modmail",
    ) || (await parent.createWebhook({ name: "modmail" }));

  const payload: WebhookMessageCreateOptions & { threadId: string } = {
    username: message.author.username,
    avatarURL: message.author.displayAvatarURL(),
    threadId: thread.id,
  };

  if (message.content) {
    payload.content = message.content;
  }

  const attachments = [...message.attachments.values()];
  if (attachments.length) {
    payload.files = attachments.map((a) => new AttachmentBuilder(a.url));
  }

  await webhook.send(payload);

  await message.react("✅");
}
