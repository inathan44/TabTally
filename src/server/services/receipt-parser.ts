import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { env } from "~/env";
import { receiptDataSchema, type ReceiptData } from "~/server/contracts/receipt";

export interface ReceiptParserService {
  parseReceipt(imageBase64: string, mimeType: string): Promise<ReceiptData>;
}

class DevReceiptParserService implements ReceiptParserService {
  async parseReceipt(_imageBase64: string, _mimeType: string): Promise<ReceiptData> {
    console.log("[DevReceiptParser] Returning mock receipt data");
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      items: [
        { name: "Margherita Pizza", price: 16.99, quantity: 1 },
        { name: "Caesar Salad", price: 12.5, quantity: 1 },
        { name: "Garlic Bread", price: 7.99, quantity: 1 },
        { name: "Sparkling Water", price: 3.5, quantity: 2 },
        { name: "Tiramisu", price: 9.99, quantity: 1 },
      ],
      subtotal: 54.47,
      tax: 4.79,
      tip: 10.89,
      total: 70.15,
      merchantName: "Luigi's Italian Kitchen",
      date: new Date().toISOString().split("T")[0]!,
      category: "FOOD",
    };
  }
}

class GeminiReceiptParserService implements ReceiptParserService {
  private readonly modelId = "gemini-2.5-flash-lite";

  async parseReceipt(imageBase64: string, mimeType: string): Promise<ReceiptData> {
    console.log(
      `[ReceiptParser] Calling Gemini (${this.modelId}) with ${Math.round(imageBase64.length / 1024)}KB image`,
    );

    const { object, usage } = await generateObject({
      model: google(this.modelId),
      schema: receiptDataSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: Buffer.from(imageBase64, "base64"),
              mediaType: mimeType,
            },
            {
              type: "text",
              text: [
                "Extract all data from this receipt into structured items.",
                "",
                "CRITICAL pricing rule:",
                "- The price shown on the receipt next to an item is ALWAYS the line total (quantity × unit price), never the unit price alone.",
                "- If an item says '2X CAESAR SALAD $24.00', the unit price is $12.00 and quantity is 2 (because $24.00 is the line total for 2 items).",
                "- Set `price` to the PER-UNIT price and `quantity` to the number of units.",
                "- Verify: price × quantity must equal the dollar amount printed on the receipt for that line.",
                "",
                "Other rules for items:",
                "- Expand abbreviated names into readable product names (e.g. 'BC NF VAN GRK YGRT' → 'Vanilla Greek Yogurt')",
                "- Merge tare weights into the item they belong to (subtract from the item's price, do not list tare as a separate item)",
                "- Bag refunds, discounts, and coupons should be listed as separate items with negative prices",
                "- For weighted items, use the total price paid (not per-lb price) and set quantity to 1",
                "",
                "Totals:",
                "- Extract subtotal, tax, tip (0 if none), and total exactly as printed on the receipt.",
                "- Verify: the sum of all (price × quantity) should equal the subtotal.",
                "- Extract merchant name and date (YYYY-MM-DD format, null if not visible).",
                "",
                "Classify the receipt into one of these categories based on the merchant and items:",
                "FOOD, HOUSING, TRANSPORTATION, ENTERTAINMENT, UTILITIES, SHOPPING, HEALTH, EDUCATION, TRAVEL, OTHER",
                "Set category to null if uncertain.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    console.log(
      `[ReceiptParser] Model: ${this.modelId} | Tokens — in: ${usage.inputTokens}, out: ${usage.outputTokens}, total: ${usage.totalTokens}`,
    );

    return object;
  }
}

function createReceiptParserService(): ReceiptParserService {
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new GeminiReceiptParserService();
  }
  if (env.NODE_ENV === "production") {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required in production");
  }
  return new DevReceiptParserService();
}

export const receiptParserService = createReceiptParserService();
