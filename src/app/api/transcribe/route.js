// NOTIZ-NEW/src/app/api/transcribe/route.js
import { NextResponse } from "next/server";
import { SpeechClient } from '@google-cloud/speech';

// --- CRITICAL FIX START ---
let googleSpeechClient;

try {
  // Get the JSON string from the Vercel environment variable
  const googleCredentialsJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!googleCredentialsJsonString) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
  }

  // Parse the JSON string into a JavaScript object
  const credentials = JSON.parse(googleCredentialsJsonString);

  // Initialize the SpeechClient EXPLICITLY with the parsed credentials.
  // We set keyFilename to null to ensure it doesn't try to look for a file.
  googleSpeechClient = new SpeechClient({
    projectId: credentials.project_id, // Important to set the project ID
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    keyFilename: null // Explicitly tell the client NOT to look for a file
  });

  console.log("Google Speech Client initialized successfully with provided credentials.");

} catch (e) {
  console.error("❌ Failed to initialize Google Speech Client:", e.message);
  // Re-throw or handle this more gracefully if the app needs to start even without credentials.
  // For transcription to work, this is a fatal error, so logging and letting it fail is fine.
  // If this happens at startup, Vercel might show build/deploy errors.
  googleSpeechClient = null; // Ensure it's null if initialization failed
}
// --- CRITICAL FIX END ---


export async function POST(req) {
  console.log("--- Starting Google Cloud transcription request ---");

  // Check if the client was initialized successfully
  if (!googleSpeechClient) {
    console.error("❌ Google Speech Client not initialized. Cannot process transcription request.");
    return NextResponse.json({ error: "Server configuration error: Google Speech Client not initialized." }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    const selectedLanguage = formData.get("language") || "en";

    if (!audioFile) {
      console.error("Error: No audio file provided in the request.");
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    console.log(`Received audio file: Name=${audioFile.name}, Type=${audioFile.type}, Size=${audioBuffer.length} bytes`);
    console.log(`Frontend selected language code received: ${selectedLanguage}`);

    // --- Google Cloud Language Code Mapping ---
    let languageCodeForGoogle = 'en-US'; // Default
    switch (selectedLanguage) {
      case 'en':
        languageCodeForGoogle = 'en-US';
        break;
      case 'es':
        languageCodeForGoogle = 'es-ES';
        break;
      case 'fr':
        languageCodeForGoogle = 'fr-FR';
        break;
      case 'de':
        languageCodeForGoogle = 'de-DE';
        break;
      case 'ja':
        languageCodeForGoogle = 'ja-JP';
        break;
      case 'zh':
        languageCodeForGoogle = 'zh-CN';
        break;
      case 'th':
        languageCodeForGoogle = 'th-TH';
        break;
      case 'my-MM':
        languageCodeForGoogle = 'my-MM';
        console.log("Backend: Explicitly setting Google language code to 'my-MM' for Burmese.");
        break;
      default:
        languageCodeForGoogle = 'en-US';
        console.warn(`Backend: Unsupported/Unexpected language code '${selectedLanguage}'. Defaulting to 'en-US'.`);
    }

    // IMPORTANT: Google Cloud Speech-to-Text synchronous API has a limit of 60 seconds.
    // For longer audio (which is likely for 1000 users), you MUST use
    // the Long Running Operation API (googleSpeechClient.longRunningRecognize)
    // which requires uploading the audio to Google Cloud Storage first.
    // Your current code uses the synchronous `recognize` method.
    // If your audio is longer than ~60 seconds, this will fail or be truncated.
    // You would need to implement GCS upload and `longRunningRecognize` for robust long audio handling.

    const audioConfig = {
        encoding: 'WEBM_OPUS', // Common for MediaRecorder output as audio/webm
        languageCode: languageCodeForGoogle,
        enableWordTimeOffsets: true, // Needed for segments/timestamps
        speechContexts: [
            {
                phrases: [
                    "မှတ်စု", "အစည်းအဝေး", "အိုင်ဒီယာ", "နိုတစ်",
                    "အသံမှတ်စု", "မြန်မာဘာသာ", "မင်္ဂလာပါ", "ကောင်းပါသလား",
                ],
            },
        ],
    };

    const request = {
      audio: {
        content: audioBuffer.toString('base64'),
      },
      config: audioConfig,
    };

    let googleResponse;
    try {
      [googleResponse] = await googleSpeechClient.recognize(request);
      console.log("Google Cloud Speech-to-Text API call successful.");
    } catch (googleError) {
      console.error("❌ Error calling Google Cloud Speech-to-Text API:", googleError.details || googleError.message);
      return NextResponse.json({ error: `Google transcription failed: ${googleError.details || googleError.message}. Check server logs and Google Cloud billing.` }, { status: 500 });
    }

    const transcribedText = googleResponse.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    const segments = [];
    googleResponse.results.forEach(result => {
        if (result.alternatives[0].words) {
            result.alternatives[0].words.forEach(wordInfo => {
                const startSeconds = parseFloat(wordInfo.startTime.seconds || 0) + (wordInfo.startTime.nanos || 0) / 1e9;
                const endSeconds = parseFloat(wordInfo.endTime.seconds || 0) + (wordInfo.endTime.nanos || 0) / 1e9;
                segments.push({
                    text: wordInfo.word,
                    start: startSeconds,
                    end: endSeconds,
                });
            });
        }
    });

    if (!transcribedText) {
        console.warn("No transcription results found from Google Cloud Speech-to-Text. This might mean silence or poor audio quality.");
        return NextResponse.json({ text: "No speech detected or transcription failed. Please try speaking clearly." });
    }

    console.log("✅ Google Cloud Speech-to-Text Transcription successful. Full Text Length:", transcribedText.length);
    console.log("✅ Transcribed Text:", transcribedText);
    return NextResponse.json({ text: transcribedText, segments: segments });

  } catch (error) {
    console.error("❌ General Transcription API Error (Google):", error);
    return NextResponse.json({ error: `Transcription failed: ${error.message}. Please ensure your Google Cloud API key is valid, billing is enabled, and there are no network issues.` }, { status: 500 });
  } finally {
    console.log("--- Google Cloud transcription request finished ---");
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};