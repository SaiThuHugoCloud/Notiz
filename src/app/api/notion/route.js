// src/app/api/notion/route.js
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Helper function to format seconds into MM:SS
const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, category, segments, summary } = body; // Destructure summary as well

    console.log("📨 Received text for Notion:", text);
    console.log("🗂️ Received category:", category);
    console.log("📊 Received segments (count):", segments ? segments.length : 0);
    console.log("✨ Received summary:", summary);

    const properties = {
      Title: {
        title: [
          {
            text: {
              // Use the summary as title if available and concise, otherwise use transcript
              content: summary ? summary.slice(0, 50) : text.slice(0, 50),
            },
          },
        ],
      },
      // Store the full transcript in the 'Text' property
      Text: {
        rich_text: [
          {
            text: {
              content: text,
            },
          },
        ],
      },
      // Add a 'Created At' property to track when the note was made
      "Created At": { // You need a property named "Created At" of type "Date" in Notion
        date: {
          start: new Date().toISOString(),
        },
      },
    };

    // Add Category property if provided, otherwise default to "Uncategorized"
    if (category && category.trim() !== "") {
      properties.Category = {
        multi_select: [{ name: category.trim() }],
      };
    } else {
      properties.Category = {
        multi_select: [{ name: "Uncategorized" }],
      };
    }

    // Format and add Segments property if available
    if (segments && segments.length > 0) {
      const formattedSegments = segments.map(s => `${formatTime(s.start)} - ${s.text}`).join('\n');
      properties.SegmentsData = { // You need a property named "SegmentsData" (type Rich Text or Text) in your Notion DB
        rich_text: [
          {
            text: {
              content: formattedSegments, // Store formatted segments
            },
          },
        ],
      };
    }

    // Add Summary property if available
    if (summary && summary.trim() !== "") {
      properties.Summary = { // You need a property named "Summary" (type Rich Text or Text) in your Notion DB
        rich_text: [
          {
            text: {
              content: summary,
            },
          },
        ],
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: properties, // Use the dynamically constructed properties object
    });

    console.log("✅ Notion response:", response);
    return NextResponse.json({ success: true, pageId: response.id });

  } catch (error) {
    console.error("❌ Notion API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
