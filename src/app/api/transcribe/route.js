// NOTIZ-NEW/src/app/api/transcribe/route.js
import { NextResponse } from "next/server";
import { SpeechClient } from '@google-cloud/speech';

// Initialize Google Cloud Speech Client
// Credentials will be picked up from GOOGLE_APPLICATION_CREDENTIALS env var automatically
// as long as it contains the JSON *content* (not a file path).
const googleSpeechClient = new SpeechClient();

export async function POST(req) {
  console.log("--- Starting Google Cloud transcription request ---");
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
    // These should match the 'value' attributes in your VoiceRecorder.js select options.
    let languageCodeForGoogle = 'en-US'; // Default
    switch (selectedLanguage) {
      case 'en':
        languageCodeForGoogle = 'en-US';
        break;
      case 'es':
        languageCodeForGoogle = 'es-ES'; // Spanish (Spain) - You might prefer 'es-LA' or other regional codes
        break;
      case 'fr':
        languageCodeForGoogle = 'fr-FR'; // French (France)
        break;
      case 'de':
        languageCodeForGoogle = 'de-DE'; // German (Germany)
        break;
      case 'ja':
        languageCodeForGoogle = 'ja-JP'; // Japanese (Japan)
        break;
      case 'zh':
        languageCodeForGoogle = 'zh-CN'; // Chinese (Mandarin, Simplified) - change to 'zh-TW' for Traditional, 'yue-HK' for Cantonese
        break;
      case 'th':
        languageCodeForGoogle = 'th-TH'; // Thai (Thailand)
        break;
      case 'my-MM': // This is the explicit code for Burmese (Myanmar)
        languageCodeForGoogle = 'my-MM';
        console.log("Backend: Explicitly setting Google language code to 'my-MM' for Burmese.");
        break;
      default:
        // Fallback for unexpected language codes or if "auto" was sent by mistake
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
        // CRITICAL: REMOVED sampleRateHertz to let Google auto-detect.
        // This resolves many "No speech detected" issues for browser-recorded audio.
        languageCode: languageCodeForGoogle,
        enableWordTimeOffsets: true, // Needed for segments/timestamps
        // Add speech contexts here to improve accuracy for specific Burmese terms.
        // Replace these example phrases with actual, frequently spoken phrases from your users.
        speechContexts: [
            {
                phrases: [
                    "မှတ်စု", // Note
                    "အစည်းအဝေး", // Meeting
                    "အိုင်ဒီယာ", // Idea (direct transliteration of 'idea')
                    "နိုတစ်", // Notiz (transliteration of your app name)
                    "အသံမှတ်စု", // Voice note
                    "မြန်မာဘာသာ", // Burmese language
                    "မင်္ဂလာပါ", // Hello (Burmese)
                    "ကောင်းပါသလား", // How are you? (Burmese)
                    // ADD MORE SPECIFIC BURMESE PHRASES HERE FOR ACCURACY IMPROVEMENT
                    // e.g., Common names, product names, industry terms.
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
        // Consider returning a more specific message to the user here.
        return NextResponse.json({ text: "No speech detected or transcription failed. Please try speaking clearly." });
    }

    console.log("✅ Google Cloud Speech-to-Text Transcription successful. Full Text Length:", transcribedText.length);
    console.log("✅ Transcribed Text:", transcribedText); // Log the full text on backend for debugging
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