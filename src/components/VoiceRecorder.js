"use client";

import { useState, useRef, useEffect } from "react";

export default function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  let audioChunks = [];

  // State to manage the UI message shown to the user
  const [uiMessage, setUiMessage] = useState("Tap the mic to start recording!");

  // Effect to manage message transitions (optional, but adds polish)
  const messageTimeoutRef = useRef(null);
  useEffect(() => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    // Optionally set a timeout for certain messages to fade or change
    // For now, it just ensures cleanup
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [uiMessage]);


  const resetState = () => {
    setRecording(false);
    setAudioUrl(null);
    setTranscript("");
    setIsTranscribing(false);
    audioChunks = [];
    setUiMessage("Ready for your next note!");
  };

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
        setUiMessage("Transcribing your voice...");

        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.text) {
            console.log("✅ Transcribed Text:", data.text);
            setTranscript(data.text);
            setUiMessage("Transcription complete! Review and send.");
            showCustomAlert("📝 Transcription Complete", data.text, "Your voice has been converted to text. You can now send it to Notion.");
          } else {
            console.error("❌ API Error:", data.error || "Unknown error");
            setUiMessage("Transcription failed. Please try again.");
            showCustomAlert("❌ Transcription Failed", data.error || "Unknown error", "There was an issue converting your voice to text.");
            setTranscript("");
          }
        } catch (err) {
          console.error("❌ Network Error during transcription:", err);
          setUiMessage("Network error. Check your connection.");
          showCustomAlert("❌ Network Error", "Network error during transcription.", "Please check your internet connection and try again.");
          setTranscript("");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setAudioUrl(null);
      setTranscript("");
      setUiMessage("Recording in progress... Tap to stop.");
    } catch (err) {
      console.error("🎙️ Microphone access denied:", err);
      setUiMessage("Microphone access denied. Please allow access.");
      showCustomAlert("⚠️ Microphone Access Denied", "Please allow microphone access to record.", "You need to grant microphone permissions in your browser settings.");
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
    if (!transcript) {
      showCustomAlert("No Transcript", "There is no transcribed text to send to Notion.");
      return;
    }
    setUiMessage("Sending note to Notion...");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUiMessage("Note sent to Notion! Start a new note.");
        showCustomAlert("✅ Success", "Note successfully sent to Notion!", "Your note has been successfully added to your Notion database.");
        resetState();
      } else {
        console.error("❌ Failed to send to Notion:", data.error || "Unknown error");
        setUiMessage("Failed to send note to Notion.");
        showCustomAlert("❌ Failed", "Failed to send to Notion: " + (data.error || "Unknown error"), "Please check your Notion integration and try again.");
      }
    } catch (err) {
      console.error("❌ Error sending to Notion:", err);
      setUiMessage("Error sending note to Notion.");
      showCustomAlert("❌ Error", "Error sending to Notion.", "A network error occurred while sending to Notion.");
    }
  };

  // Custom Alert Function (replaces window.alert)
  const showCustomAlert = (title, message, subMessage = "") => {
    const existingAlert = document.getElementById('custom-alert-overlay');
    if (existingAlert) {
      document.body.removeChild(existingAlert);
    }

    const alertBox = document.createElement('div');
    alertBox.id = 'custom-alert-overlay';
    alertBox.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4';
    alertBox.innerHTML = `
      <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-95 opacity-0 duration-200 ease-out" id="custom-alert-content">
        <h3 class="text-2xl font-bold text-gray-800 mb-4">${title}</h3>
        <p class="text-gray-700 mb-6 text-base whitespace-pre-wrap break-words">${message}</p>
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
        document.body.removeChild(alertBox);
      }, 200);
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 font-inter">
      <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-12 max-w-md w-full text-center border border-gray-100 flex flex-col items-center">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-10 flex items-center justify-center">
          NotizVoice <span className="ml-4 text-5xl">🗣️</span>
        </h2>

        {/* Main UI Message */}
        <p className="text-2xl font-semibold text-gray-700 mb-10 h-10 flex items-center justify-center transition-opacity duration-300 ease-in-out">
          {uiMessage}
        </p>

        {/* Recording Button */}
        <div className="mb-10 flex flex-col items-center">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`
              w-56 h-56 rounded-full flex items-center justify-center text-white
              transition-all duration-300 ease-in-out transform
              ${recording
                ? "bg-red-600 hover:bg-red-700 shadow-red-500/60 ring-8 ring-red-300 animate-pulse-light"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/60 ring-8 ring-blue-300"
              }
              focus:outline-none focus:ring-8 focus:ring-opacity-75
              text-9xl relative overflow-hidden
            `}
            aria-label={recording ? "Stop Recording" : "Start Recording"}
            disabled={isTranscribing} // Disable button while transcribing
          >
            {recording ? (
              <span className="relative z-10">🛑</span>
            ) : (
              <span className="relative z-10">🎤</span>
            )}
            {recording && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full bg-white opacity-20 animate-ping-slow rounded-full"></div>
              </div>
            )}
          </button>
        </div>

        {/* Loading Indicator for Transcription */}
        {isTranscribing && (
          <div className="mt-6 p-6 bg-blue-50 rounded-xl border border-blue-200 shadow-inner flex flex-col items-center w-full transition-opacity duration-300 ease-in-out">
            <svg className="animate-spin h-14 w-14 text-blue-600 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xl font-medium text-blue-700">Transcribing audio...</p>
            <p className="text-sm text-blue-500 mt-1">This might take a few moments.</p>
          </div>
        )}

        {/* Audio Playback */}
        {audioUrl && !isTranscribing && (
          <div className="mt-6 p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-inner w-full transition-opacity duration-300 ease-in-out">
            <p className="text-base text-gray-600 mb-3 font-medium">▶️ Playback:</p>
            <audio controls src={audioUrl} className="w-full rounded-lg shadow-sm" />
          </div>
        )}

        {/* Transcribed Text & Action Buttons */}
        {transcript && !isTranscribing && (
          <div className="mt-6 p-6 bg-indigo-50 rounded-xl border border-indigo-200 shadow-md w-full flex flex-col items-center transition-opacity duration-300 ease-in-out">
            <p className="text-base text-indigo-800 font-semibold mb-3">📝 Transcribed Text:</p>
            <div className="bg-white p-4 rounded-lg border border-gray-300 text-left text-gray-800 whitespace-pre-wrap break-words text-base leading-relaxed max-h-60 overflow-y-auto custom-scrollbar w-full">
              {transcript}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-4 w-full justify-center">
              <button
                onClick={sendToNotion}
                className={`flex-1 px-8 py-3 bg-purple-600 text-white rounded-full font-bold text-lg
                  hover:bg-purple-700 transition-all duration-300 ease-in-out shadow-lg
                  focus:outline-none focus:ring-4 focus:ring-purple-300 transform hover:scale-105`}
              >
                ✉️ Send to Notion
              </button>
              <button
                onClick={resetState}
                className={`flex-1 px-8 py-3 bg-gray-300 text-gray-800 rounded-full font-bold text-lg
                  hover:bg-gray-400 transition-all duration-300 ease-in-out shadow-lg
                  focus:outline-none focus:ring-4 focus:ring-gray-300 transform hover:scale-105`}
              >
                ✨ New Note
              </button>
            </div>
          </div>
        )}
      </div>

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

        /* Simple pulse animation for recording button */
        @keyframes pulse-light {
          0% {
            box-shadow: 0 0 0 0 rgba(252, 165, 165, 0.7); /* red-300 */
          }
          70% {
            box-shadow: 0 0 0 15px rgba(252, 165, 165, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(252, 165, 165, 0);
          }
        }
        .animate-pulse-light {
          animation: pulse-light 1.5s infinite;
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
      `}</style>
    </div>
  );
}
