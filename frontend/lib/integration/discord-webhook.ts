export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  thumbnail?: {
    url: string
  }
  image?: {
    url: string
  }
  footer?: {
    text: string
    icon_url?: string
  }
  timestamp?: string
}

export interface DiscordMessage {
  content?: string
  embeds?: DiscordEmbed[]
  username?: string
  avatar_url?: string
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  message: DiscordMessage,
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Discord API returned ${response.status}: ${errorText}`,
        statusCode: response.status,
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export function sendTestWebhook(webhookUrl: string) {
  return sendDiscordWebhook(webhookUrl, {
    embeds: [
      {
        title: "✅ OC Dashboard Integration Success",
        description: "Your Discord webhook has been configured successfully!",
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        footer: {
          text: "OC Dashboard",
        },
      },
    ],
  })
}

export interface RequiredItem {
  itemId: number
  itemName: string
  requiredBy: Array<{
    memberId: number
    memberName: string
    crimeId: number
    crimeName: string
    position: string
  }>
}

export function sendRequiredItemsWebhook(webhookUrl: string, items: RequiredItem[], type: "loaded" | "required") {
  const title = type === "loaded" ? "📦 Items Loaded in Faction" : "⚠️ Items Required for OC"
  const color = type === "loaded" ? 0x00ff00 : 0xff9900
  const description =
    type === "loaded"
      ? `${items.length} unique item(s) are loaded and ready for use`
      : `${items.length} item(s) are required but not available`

  // Discord limits: 10 embeds per message, 25 fields per embed
  // Strategy: First embed is header, next embeds contain items as fields (up to 25 per embed)
  const embeds: DiscordEmbed[] = [
    {
      title,
      description,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: "OC Dashboard",
      },
    },
  ]

  // Group items into embeds with max 25 fields each
  const maxFieldsPerEmbed = 25
  const maxItemsToShow = 200 // With 25 fields per embed and 9 embeds = 225 max

  const itemsToShow = items.slice(0, maxItemsToShow)

  for (let i = 0; i < itemsToShow.length; i += maxFieldsPerEmbed) {
    const chunk = itemsToShow.slice(i, i + maxFieldsPerEmbed)
    const fields = chunk.map((item) => {
      const membersList = item.requiredBy
        .slice(0, 5) // Limit to 5 members per item to avoid field value being too long
        .map((req) => `[${req.memberName}](https://www.torn.com/profiles.php?XID=${req.memberId}) - ${req.position}`)
        .join("\n")

      const extraMembers = item.requiredBy.length > 5 ? `\n_...and ${item.requiredBy.length - 5} more_` : ""

      return {
        name: `${item.itemName} (ID: ${item.itemId})`,
        value: membersList + extraMembers || "None",
        inline: false,
      }
    })

    embeds.push({
      color,
      fields,
      thumbnail:
        chunk.length === 1
          ? {
              url: `https://www.torn.com/images/items/${chunk[0].itemId}/large.png`,
            }
          : undefined,
    })

    // Stop if we reach 10 embeds (Discord limit)
    if (embeds.length >= 10) break
  }

  if (items.length > maxItemsToShow) {
    const remaining = items.length - maxItemsToShow
    embeds[embeds.length - 1].footer = {
      text: `... and ${remaining} more item(s) not shown`,
    }
  }

  return sendDiscordWebhook(webhookUrl, { embeds })
}

export async function sendLoadedItemsWebhook(
  loadedItems: Array<{ item: any; needed: number; available: number }>,
  crimes: Array<any>,
  memberMap: { [key: number]: string },
  factionId: number,
) {
  const webhookUrl = localStorage.getItem("discordWebhookUrl")
  if (!webhookUrl) {
    return { success: false, error: "Webhook URL not configured" }
  }

  // Convert loaded items to RequiredItem format
  const requiredItems: RequiredItem[] = []

  loadedItems.forEach((itemData) => {
    const itemId = itemData.item.id
    const itemName = itemData.item.name

    const requiredBy: RequiredItem["requiredBy"] = []

    // Find all members who need this item
    crimes
      .filter((crime) => crime.status === "Planning" || crime.status === "Recruiting")
      .forEach((crime) => {
        crime.slots?.forEach((slot: any) => {
          if (slot.item_requirement?.id === itemId && slot.item_requirement.is_available && slot.user) {
            requiredBy.push({
              memberId: slot.user.id,
              memberName: memberMap[slot.user.id] || `ID: ${slot.user.id}`,
              crimeId: crime.id,
              crimeName: crime.name,
              position: slot.position,
            })
          }
        })
      })

    if (requiredBy.length > 0) {
      requiredItems.push({
        itemId,
        itemName,
        requiredBy,
      })
    }
  })

  return sendRequiredItemsWebhook(webhookUrl, requiredItems, "loaded")
}
