// src/app/api/notion/route.js
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client"; // Correct import for Notion client

// Initialize the Notion client with your API key
const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(req) {
  try {
    // This route expects JSON, so use req.json()
    const body = await req.json();
    const { text } = body;

    console.log("📨 Received text for Notion:", text);

    // Create a new page in Notion
    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: text.slice(0, 50), // Use first 50 chars for title
              },
            },
          ],
        },
        Text: {
          rich_text: [
            {
              text: {
                content: text,
              },
            },
          ],
        },
        Category: {
          multi_select: [{ name: "Uncategorized" }], // Default category
        },
      },
    });

    console.log("✅ Notion response:", response);
    return NextResponse.json({ success: true, pageId: response.id });

  } catch (error) {
    console.error("❌ Notion API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// No 'config' export needed here, as it's handling JSON by default
