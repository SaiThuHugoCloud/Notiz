"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

export default function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  let audioChunks = [];

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const resetState = () => {
    setRecording(false);
    setAudioUrl(null);
    setTranscript("");
    setIsTranscribing(false);
    audioChunks = [];
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

        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.text) {
            setTranscript(data.text);
          } else {
            alert("Transcription failed.");
            setTranscript("");
          }
        } catch (err) {
          alert("Network error. Please try again.");
          setTranscript("");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setAudioUrl(null);
      setTranscript("");
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const sendToNotion = async () => {
    if (!transcript) {
      alert("No transcript to send.");
      return;
    }
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: transcript }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("Sent to Notion!");
        resetState();
      } else {
        alert("Failed to send to Notion.");
      }
    } catch (err) {
      alert("Error sending to Notion.");
    }
  };

  const copyTranscript = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      alert("Copied to clipboard.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">🎤 NotizVoice</h1>

        {/* Mic Button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`rounded-full transition-all duration-300 focus:outline-none
            ${recording ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
            text-white flex items-center justify-center shadow-xl
            w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 mx-auto mb-6`}
        >
          {recording ? (
            <MicOff className="w-10 h-10 sm:w-12 sm:h-12" />
          ) : (
            <Mic className="w-10 h-10 sm:w-12 sm:h-12" />
          )}
        </button>

        {isTranscribing && (
          <div className="text-blue-700 mb-4">
            <div className="animate-spin h-8 w-8 mx-auto border-4 border-blue-400 border-t-transparent rounded-full mb-2"></div>
            <p className="text-sm font-medium">Transcribing...</p>
          </div>
        )}

        {audioUrl && !transcript && (
          <audio controls src={audioUrl} className="w-full mb-4" />
        )}

        {transcript && (
          <div className="text-left mt-4">
            <p className="text-sm text-gray-600 mb-2">Your note:</p>
            <div className="bg-gray-100 rounded-lg p-4 mb-4 text-sm text-gray-800 max-h-48 overflow-y-auto">
              {transcript}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={sendToNotion}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base py-3 rounded-full"
              >
                ✨ Send to Notion
              </button>
              <button
                onClick={copyTranscript}
                className="bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-full"
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={resetState}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm py-2 rounded-full"
              >
                🔁 Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
