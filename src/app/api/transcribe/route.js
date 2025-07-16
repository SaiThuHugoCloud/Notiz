// src/app/api/transcribe/route.js
import { NextResponse } from "next/server";
import OpenAI from 'openai';

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  console.log("--- Starting transcription request ---");
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    // Get language from formData, default to 'en' if not provided
    const language = formData.get("language") || "en";

    if (!audioFile) {
      console.error("Error: No audio file provided in the request.");
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    console.log(`Received audio file: Name=${audioFile.name}, Type=${audioFile.type}, Size=${audioFile.size} bytes, Language=${language}`);

    // Check if the API key is actually loaded
    if (!process.env.OPENAI_API_KEY) {
      console.error("Error: OPENAI_API_KEY is not set in environment variables.");
      return NextResponse.json({ error: "Server configuration error: OpenAI API key missing." }, { status: 500 });
    } else {
      console.log("OpenAI API Key is loaded.");
    }

    // Perform the transcription using OpenAI Whisper
    let transcriptionResult;
    try {
      transcriptionResult = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: language, // <-- Use the dynamic language here
        response_format: "verbose_json", // Request verbose_json for segments
      });
      console.log("OpenAI API call successful.");
    } catch (openaiError) {
      console.error("❌ Error calling OpenAI Whisper API:", openaiError.message);
      if (openaiError.response) {
        console.error("OpenAI Response Status:", openaiError.response.status);
        console.error("OpenAI Response Data:", openaiError.response.data);
      }
      return NextResponse.json({ error: `OpenAI transcription failed: ${openaiError.message}` }, { status: 500 });
    }

    const transcribedText = transcriptionResult.text;
    const segments = transcriptionResult.segments; // Extract segments

    if (!transcribedText) {
        console.warn("No transcription results found from OpenAI Whisper. The 'text' property was empty.");
        return NextResponse.json({ text: "No speech detected or transcription failed." });
    }

    console.log("✅ OpenAI Whisper Transcription successful:", transcribedText);
    // Return both text and segments
    return NextResponse.json({ text: transcribedText, segments: segments });

  } catch (error) {
    console.error("❌ General Transcription API Error:", error);
    return NextResponse.json({ error: `Transcription failed: ${error.message}. Check server logs for details.` }, { status: 500 });
  } finally {
    console.log("--- Transcription request finished ---");
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
