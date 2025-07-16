// src/app/api/summarize/route.js
import { NextResponse } from "next/server";
import OpenAI from 'openai';

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env.local and Vercel
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided for summarization." }, { status: 400 });
    }

    console.log("📝 Received text for summarization (first 100 chars):", text.substring(0, 100));

    // Call OpenAI's chat completions API for summarization
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // You can use "gpt-4" or "gpt-4o" for better quality, but higher cost
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes text concisely. Provide the summary directly, without conversational filler." },
        { role: "user", content: `Please summarize the following text:\n\n${text}` }
      ],
      temperature: 0.7, // Controls creativity (0.0-1.0)
      max_tokens: 150, // Max length of the summary in tokens
    });

    const summary = completion.choices[0].message.content;

    console.log("✅ Summary generated:", summary);
    return NextResponse.json({ success: true, summary });

  } catch (error) {
    console.error("❌ Summarization API Error:", error);
    // Provide a more descriptive error if it's an OpenAI API error
    if (error.response) {
        console.error("OpenAI API Response Status:", error.response.status);
        console.error("OpenAI API Response Data:", error.response.data);
        return NextResponse.json({ success: false, error: `OpenAI API Error: ${error.response.status} - ${error.response.data.error.message}` }, { status: error.response.status });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
