import {
  EmbedBuilder,
  type ColorResolvable,
  type EmbedFooterData,
  type EmbedField,
  type Interaction,
} from "discord.js";

type RepliableInteraction = Interaction & {
  deferred?: boolean;
  replied?: boolean;
  editReply?: (options: { embeds: EmbedBuilder[] }) => Promise<unknown>;
};

type EmbedBuilderTypes = {
  interaction: RepliableInteraction;
  channel: any;
  title: string;
  description: string;
  color: ColorResolvable;
  fields: EmbedField[];
  footer?: string | EmbedFooterData;
  reply?: boolean;
};

export default ({
  interaction,
  channel = interaction.channel,
  title,
  description,
  color = 0x5865f2,
  fields = [],
  footer,
  reply = false,
}: EmbedBuilderTypes) => {
  const embed = new EmbedBuilder()
    .setTitle(title || "")
    .setDescription(description || "")
    .setColor(color);

  if (fields && fields.length) embed.addFields(fields);

  if (footer) {
    if (typeof footer === "string") embed.setFooter({ text: footer });
    else embed.setFooter(footer);
  }

  const shouldEdit = !!reply || !!interaction.deferred || !!interaction.replied;

  if (shouldEdit && typeof interaction.editReply === "function") {
    return interaction.editReply({ embeds: [embed] });
  }

  return channel.send({ embeds: [embed] });
};
