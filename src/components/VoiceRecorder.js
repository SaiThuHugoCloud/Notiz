"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Clipboard as LucideClipboard, FileText as LucideFileText, Send as LucideSend, RotateCcw as LucideRotateCcw } from "lucide-react"; // Import Lucide icons
// Removed Firebase imports as per user's request to prioritize multi-language.
// If user wants to re-add auth, we will add them back in a later step.

export default function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState([]); // For timestamps
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [category, setCategory] = useState("Uncategorized");
  const [selectedLanguage, setSelectedLanguage] = useState("en"); // New state for language selection

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null); // Ref for the audio element
  let audioChunks = [];

  const [uiMessage, setUiMessage] = useState("Tap the mic to start your note!");

  // Cleanup for media recorder and audio URL
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Resets the UI and state for a new recording session
  const resetState = () => {
    setRecording(false);
    setAudioUrl(null);
    setTranscript("");
    setSegments([]); // Clear segments
    setIsTranscribing(false);
    setSummary("");
    setCategory("Uncategorized");
    audioChunks = [];
    setUiMessage("Ready for your next brilliant idea!");
  };

  // Handles starting the voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecording(false);
        setIsTranscribing(true);
        setUiMessage("Transcribing your voice... Almost there!");

        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        formData.append("language", selectedLanguage); // <-- Pass selected language to API

        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.text) {
            console.log("✅ Transcribed Text:", data.text);
            setTranscript(data.text);
            setSegments(data.segments || []); // Store segments
            setUiMessage("Transcription complete! Review and save.");
            showCustomAlert("📝 Transcription Complete", data.text, "Your voice has been converted to text. Click on text segments to jump in audio!");
          } else {
            console.error("❌ API Error:", data.error || "Unknown error");
            setUiMessage("Transcription failed. Please try again.");
            showCustomAlert("❌ Transcription Failed", data.error || "Unknown error", "There was an issue converting your voice to text. Please ensure your OpenAI API key is valid.");
            setTranscript("");
            setSegments([]);
          }
        } catch (err) {
          console.error("❌ Network Error during transcription:", err);
          setUiMessage("Network error. Check your connection.");
          showCustomAlert("❌ Network Error", "Network error during transcription.", "Please check your internet connection and try again.");
          setTranscript("");
          setSegments([]);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setAudioUrl(null);
      setTranscript("");
      setSegments([]);
      setSummary("");
      setUiMessage("Recording... Tap again to stop.");
    } catch (err) {
      console.error("🎙️ Microphone access denied:", err);
      setUiMessage("Microphone access denied. Please allow access.");
      showCustomAlert("⚠️ Microphone Access Denied", "Please allow microphone access to record.", "You need to grant microphone permissions in your browser settings to use the voice recorder.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setUiMessage("Processing recording...");
  };

  const sendToNotion = async () => {
    // Authentication check is removed for now.
    if (!transcript) {
      showCustomAlert("No Transcript", "There is no transcribed text to send to Notion.");
      return;
    }
    setUiMessage("Sending note to Notion...");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, category: category, segments: segments, summary: summary }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUiMessage("Note sent successfully! Start a new note.");
        showCustomAlert("✅ Success!", "Note successfully sent to Notion!", "Your note has been successfully added to your Notion database.");
        resetState();
      } else {
        console.error("❌ Failed to send to Notion:", data.error || "Unknown error");
        setUiMessage("Failed to send note to Notion.");
        showCustomAlert("❌ Failed", "Failed to send to Notion: " + (data.error || "Unknown error"), "Please check your Notion integration and API keys.");
      }
    } catch (err) {
      console.error("❌ Error sending to Notion:", err);
      setUiMessage("Error sending note to Notion.");
      showCustomAlert("❌ Error", "Error sending to Notion.", "A network error occurred while sending your note to Notion.");
    }
  };

  const copyTranscriptToClipboard = () => {
    if (transcript) {
      const textarea = document.createElement('textarea');
      textarea.value = transcript;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showCustomAlert("📋 Copied!", "Transcription copied to clipboard.", "You can now paste it anywhere you like.");
      } catch (err) {
        console.error('Failed to copy text: ', err);
        showCustomAlert("❌ Copy Failed", "Could not copy text to clipboard.", "Your browser might not support direct clipboard access or there was an error.");
      }
      document.body.removeChild(textarea);
    }
  };

  const summarizeText = async () => {
    if (!transcript) {
      showCustomAlert("No Text", "There is no transcribed text to summarize.");
      return;
    }
    setIsSummarizing(true);
    setUiMessage("Generating summary...");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
        showCustomAlert("✨ Summary Generated", data.summary, "Here's a concise summary of your note.");
        setUiMessage("Summary ready! Review or send to Notion.");
      } else {
        showCustomAlert("❌ Summarization Failed", data.error || "Unknown error", "Could not generate a summary. Check server logs for details.");
        setUiMessage("Summarization failed.");
      }
    } catch (err) {
      console.error("❌ Error summarizing:", err);
      showCustomAlert("❌ Network Error", "Error generating summary.", "Check your connection or OpenAI API key.");
      setUiMessage("Summarization network error.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Function to seek audio playback to a specific time
  const seekAudio = (timeInSeconds) => {
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = timeInSeconds;
      audioRef.current.play(); // Auto-play after seeking
    }
  };

  // Custom Alert Function (replaces window.alert)
  const showCustomAlert = (title, message, subMessage = "") => {
    const existingAlert = document.getElementById('custom-alert-overlay');
    if (existingAlert && document.body.contains(existingAlert)) {
      document.body.removeChild(existingAlert);
    }

    const alertBox = document.createElement('div');
    alertBox.id = 'custom-alert-overlay';
    alertBox.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in';
    alertBox.innerHTML = `
      <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-95 opacity-0 duration-200 ease-out" id="custom-alert-content">
        <h3 class="text-2xl font-bold text-gray-800 mb-4">${title}</h3>
        <p class="text-gray-700 mb-6 text-base whitespace-pre-wrap break-words max-h-40 overflow-y-auto custom-scrollbar">${message}</p>
        ${subMessage ? `<p class="text-sm text-gray-500 mb-6">${subMessage}</p>` : ''}
        <button id="closeAlert" class="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-colors duration-200">
          Got It!
        </button>
      </div>
    `;
    document.body.appendChild(alertBox);

    setTimeout(() => {
      document.getElementById('custom-alert-content').classList.remove('scale-95', 'opacity-0');
      document.getElementById('custom-alert-content').classList.add('scale-100', 'opacity-100');
    }, 10);

    document.getElementById('closeAlert').onclick = () => {
      const content = document.getElementById('custom-alert-content');
      content.classList.remove('scale-100', 'opacity-100');
      content.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        if (document.body.contains(alertBox)) {
            document.body.removeChild(alertBox);
        }
      }, 200);
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-indigo-200 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background blobs for visual interest */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>

      <div className="relative bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md text-center border border-gray-100 flex flex-col items-center z-10 animate-fade-in-up">
        {/* App Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center justify-center">
          NotizVoice <span className="ml-2 text-4xl">🗣️</span>
        </h1>

        {/* Language Selector */}
        <div className="w-full mb-6">
          <label htmlFor="language-select" className="sr-only">Select Language</label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="th">Thai</option> {/* <-- Add this line for Thai */}
            <option value="MM">Burmese</option>
            {/* Add more languages supported by Whisper API */}
          </select>
        </div>

        {/* Main UI Message - Guides the user */}
        <p className="text-lg text-gray-600 mb-6 h-6 flex items-center justify-center transition-opacity duration-300 ease-in-out">
          {uiMessage}
        </p>

        {/* Mic Button */}
        <div className="mb-6 flex flex-col items-center">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`rounded-full transition-all duration-300 focus:outline-none
              ${recording ? "bg-red-600 hover:bg-red-700 animate-pulse-subtle" : "bg-blue-600 hover:bg-blue-700"}
              text-white flex items-center justify-center shadow-xl
              w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 mx-auto`}
            disabled={isTranscribing || isSummarizing}
          >
            {recording ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>
        </div>

        {/* Loading Indicator */}
        {isTranscribing && (
          <div className="text-blue-700 mb-4 flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full mb-2"></div>
            <p className="text-sm font-medium">Transcribing...</p>
          </div>
        )}
        {isSummarizing && (
          <div className="text-yellow-700 mb-4 flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full mb-2"></div>
            <p className="text-sm font-medium">Summarizing...</p>
          </div>
        )}

        {/* Audio Playback */}
        {audioUrl && !transcript && !isTranscribing && (
          <div className="w-full mb-4 animate-fade-in">
            <audio controls src={audioUrl} className="w-full rounded-lg shadow-sm" ref={audioRef} />
          </div>
        )}

        {/* Transcribed Text & Actions */}
        {transcript && (
          <div className="text-left mt-4 w-full animate-fade-in">
            <p className="text-sm text-gray-600 mb-2 font-semibold">Your Note:</p>
            <div className="bg-gray-100 rounded-lg p-4 mb-4 text-sm text-gray-800 max-h-48 overflow-y-auto custom-scrollbar border border-gray-200">
              {segments.length > 0 ? (
                segments.map((segment, index) => (
                  <span
                    key={index}
                    className="cursor-pointer hover:bg-blue-200 rounded-sm px-1 py-0.5 transition-colors duration-100"
                    onClick={() => seekAudio(segment.start)}
                    title={`Jump to ${segment.start.toFixed(2)}s`}
                  >
                    {segment.text}{" "}
                  </span>
                ))
              ) : (
                <p>{transcript}</p> // Fallback if no segments are provided
              )}
            </div>

            {/* Category Input */}
            <div className="mb-4">
              <label htmlFor="category" className="block text-xs font-medium text-gray-500 mb-1">Category (e.g., Meeting, Idea):</label>
              <input
                type="text"
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Uncategorized"
                className="w-full p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={sendToNotion}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base py-3 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md"
              >
                <LucideSend className="w-5 h-5 mr-2" /> Send to Notion
              </button>
              <button
                onClick={summarizeText}
                disabled={isSummarizing}
                className={`bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-base py-3 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md ${isSummarizing ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <LucideFileText className="w-5 h-5 mr-2" /> {isSummarizing ? 'Summarizing...' : 'Summarize Note'}
              </button>
              <button
                onClick={copyTranscriptToClipboard}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold text-base py-3 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md"
              >
                <LucideClipboard className="w-5 h-5 mr-2" /> Copy to Clipboard
              </button>
              <button
                onClick={resetState}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold text-base py-3 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md"
              >
                <LucideRotateCcw className="w-5 h-5 mr-2" /> Start New Note
              </button>
            </div>

            {/* Display Summary if available */}
            {summary && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-left text-yellow-900 text-sm whitespace-pre-wrap break-words max-h-40 overflow-y-auto custom-scrollbar animate-fade-in">
                <p className="font-bold mb-2 flex items-center">✨ Summary:</p>
                {summary}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Alert Function (replaces window.alert) is dynamically rendered */}

      {/* Custom Scrollbar Style and Animations */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        /* Subtle pulse animation for recording button */
        @keyframes pulse-subtle {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } /* red-500 */
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 1.5s infinite;
        }

        /* Slow ping animation for the inner circle */
        @keyframes ping-slow {
          0% {
            transform: scale(0.5);
            opacity: 0.7;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        /* Fade in animation for alerts and new sections */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }

        /* Fade in from bottom animation for the main card */
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }

        /* Background blob animation */
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite cubic-bezier(0.6, -0.28, 0.735, 0.045);
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
