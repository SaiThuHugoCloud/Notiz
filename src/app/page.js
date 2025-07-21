// NOTIZ-NEW/src/app/page.js
"use client";

import { useEffect, useState, useRef } from 'react';
import { auth, db } from '/lib/firebase';
import VoiceRecorder from '/src/components/VoiceRecorder';

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // reCAPTCHA state and ref
  const recaptchaRef = useRef(null); // Ref to hold the reCAPTCHA div element
  const [recaptchaApiLoaded, setRecaptchaApiLoaded] = useState(false); // To track if reCAPTCHA API script is loaded
  const [recaptchaWidgetId, setRecaptchaWidgetId] = useState(null); // New state to store the widget ID once rendered

  // State for displaying saved notes from Firestore
  const [savedNotes, setSavedNotes] = useState([]);

  // Effect to load reCAPTCHA script
  useEffect(() => {
    // Prevent loading multiple times if component re-renders
    if (document.getElementById('recaptcha-script')) {
      if (window.grecaptcha && window.grecaptcha.render) {
        setRecaptchaApiLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoadCallback&render=explicit`;
    script.async = true;
    script.defer = true;

    window.onRecaptchaLoadCallback = () => {
      setRecaptchaApiLoaded(true);
      console.log("reCAPTCHA API script loaded.");
    };

    script.onerror = () => {
      console.error("reCAPTCHA script failed to load.");
      setMessage("Error: reCAPTCHA failed to load. Please try again later.");
    };
    document.body.appendChild(script);

    return () => {
      delete window.onRecaptchaLoadCallback;
    };
  }, []);

  // Effect to render reCAPTCHA widget once API is loaded AND div ref is available
  useEffect(() => {
    console.log("reCAPTCHA Site Key from env:", process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

    if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      setMessage("reCAPTCHA Site Key is missing. Please check your .env.local file.");
      console.error("RECAPTCHA_SITE_KEY is undefined or empty.");
      return;
    }

    if (recaptchaApiLoaded && recaptchaRef.current && window.grecaptcha && window.grecaptcha.render) {
      console.log("Attempting to render reCAPTCHA widget...");
      try {
        if (recaptchaWidgetId === null) {
          const widgetId = window.grecaptcha.render(recaptchaRef.current, {
            'sitekey': process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
            'callback': (token) => {
              console.log("reCAPTCHA token obtained:", token);
              setRecaptchaWidgetId(widgetId);
            },
            'expired-callback': () => {
              console.log("reCAPTCHA token expired.");
              setMessage("reCAPTCHA expired. Please re-verify.");
              window.grecaptcha.reset(recaptchaWidgetId);
            },
            'error-callback': () => {
              console.error("reCAPTCHA widget error.");
              setMessage("reCAPTCHA widget error. Please refresh.");
              window.grecaptcha.reset(recaptchaWidgetId);
            }
          });
          console.log("reCAPTCHA widget rendered with ID:", widgetId);
        }
      } catch (e) {
        console.error("Error rendering reCAPTCHA widget:", e);
        setMessage("Error rendering reCAPTCHA. Check sitekey and domains.");
      }
    }
  }, [recaptchaApiLoaded, recaptchaRef.current, recaptchaWidgetId]);


  // Effect to listen for authentication state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setMessage(`Welcome, ${currentUser.email}!`);
      } else {
        setMessage('Please sign in or sign up to use NotizVoice.');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Effect to fetch saved notes from Firestore when the user logs in AND email is verified
  useEffect(() => {
    let unsubscribeNotes;
    if (user && user.emailVerified) {
      const notesCollectionRef = collection(db, `users/${user.uid}/notes`);
      const q = query(notesCollectionRef, orderBy('createdAt', 'desc'));

      unsubscribeNotes = onSnapshot(q, (snapshot) => {
        const userNotes = [];
        snapshot.forEach((doc) => {
          userNotes.push({ id: doc.id, ...doc.data() });
        });
        setSavedNotes(userNotes);
      }, (error) => {
        console.error("Error fetching notes:", error);
        setMessage("Error loading notes. Please try again.");
      });
    } else {
      setSavedNotes([]);
    }

    return () => {
      if (unsubscribeNotes) {
        unsubscribeNotes();
      }
    };
  }, [user]);

  // --- Authentication Handlers ---
  const handleSignUp = async () => {
    setMessage('Signing up...');
    
    if (!recaptchaApiLoaded || !window.grecaptcha || recaptchaWidgetId === null) {
      setMessage("reCAPTCHA is not fully loaded or rendered. Please wait for the checkbox to appear.");
      console.warn("reCAPTCHA not ready for signup:", { recaptchaApiLoaded, grecaptchaExists: !!window.grecaptcha, recaptchaWidgetId });
      return;
    }

    const recaptchaResponse = window.grecaptcha.getResponse(recaptchaWidgetId);
    if (!recaptchaResponse) {
      setMessage("Please complete the reCAPTCHA challenge.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User signed up:", userCredential.user);
      await sendEmailVerification(userCredential.user);
      setMessage("Account created! Please check your email to verify your account to access NotizVoice features.");
      setEmail('');
      setPassword('');
      window.grecaptcha.reset(recaptchaWidgetId);
    } catch (error) {
      setMessage(`Sign Up Error: ${error.message}`);
      console.error("Sign Up Error:", error);
      window.grecaptcha.reset(recaptchaWidgetId);
    }
  };

  const handleSignIn = async () => {
    setMessage('Signing in...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (error) {
      setMessage(`Sign In Error: ${error.message}`);
      console.error("Sign In Error:", error);
    }
  };

  const handleSignOut = async () => {
    setMessage('Signing out...');
    try {
      await signOut(auth);
      setMessage("You have been signed out.");
    } catch (error) {
      setMessage(`Sign Out Error: ${error.message}`);
      console.error("Sign Out Error:", error);
    }
  };

  // --- Firestore Save Handler (triggered by VoiceRecorder) ---
  const handleSaveNoteToFirestore = async ({ title, content, category, summary }) => {
    if (!user || !user.emailVerified) {
      console.warn('Attempted to save note without a logged-in or verified user.');
      setMessage('Cannot save note: Please verify your email to access this feature.');
      return;
    }
    if (!content.trim()) {
      setMessage('Cannot save an empty note to Firestore.');
      return;
    }

    setMessage('Saving note to your personal collection...');
    try {
      await addDoc(collection(db, `users/${user.uid}/notes`), {
        title: title || 'Untitled Note',
        content: content,
        category: category || 'Uncategorized',
        summary: summary || '',
        createdAt: new Date(),
      });
      setMessage('Note saved to your collection!');
    } catch (error) {
      setMessage(`Error saving note to collection: ${error.message}`);
      console.error("Error saving note to Firestore:", error);
    }
  };

  // Handle deleting a saved note from Firestore
  const handleDeleteSavedNote = async (noteId) => {
    if (!user || !user.emailVerified) {
      setMessage('Cannot delete note: Please verify your email to access this feature.');
      return;
    }
    setMessage('Deleting note...');
    try {
      await deleteDoc(doc(db, `users/${user.uid}/notes`, noteId));
      setMessage('Note deleted successfully!');
    } catch (error) {
      setMessage(`Error deleting note: ${error.message}`);
      console.error("Error deleting note:", error);
    }
  };


  // Render loading state while checking authentication status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">Loading NotizVoice...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl border border-gray-200">
        <h1 className="text-3xl font-extrabold mb-8 text-center text-gray-900">NotizVoice</h1>

        {!user ? (
          // Authentication UI for non-logged-in users
          <>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-2">Email:</label>
              <input
                type="email"
                id="email"
                className="shadow-sm appearance-none border border-gray-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">Password:</label>
              <input
                type="password"
                id="password"
                className="shadow-sm appearance-none border border-gray-300 rounded-md w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Password"
              />
            </div>

            {/* reCAPTCHA Widget */}
            <div ref={recaptchaRef} className="g-recaptcha mb-6"></div>
            {!recaptchaApiLoaded && (
              <p className="text-sm text-gray-500 mb-4">Loading reCAPTCHA...</p>
            )}
            {recaptchaApiLoaded && recaptchaWidgetId === null && (
                <p className="text-sm text-gray-500 mb-4">reCAPTCHA loaded. Please wait for the checkbox to appear.</p>
            )}


            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={handleSignIn}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-md"
                aria-label="Sign In"
              >
                Sign In
              </button>
              <button
                onClick={handleSignUp}
                disabled={recaptchaWidgetId === null}
                className={`w-full sm:w-auto bg-green-600 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-md
                  ${recaptchaWidgetId === null ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}
                aria-label="Sign Up"
              >
                Sign Up
              </button>
            </div>
          </>
        ) : (
          // UI for logged-in users: Check if email is verified before showing app features
          <div className="text-center">
            <p className="text-lg font-medium text-gray-800 mb-4">Logged in as: <span className="font-bold text-blue-700">{user.email}</span></p>
            <p className="text-sm text-gray-600 mb-6">User ID: <span className="font-mono bg-gray-100 p-1 rounded text-xs break-all">{user.uid}</span></p>

            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-md mb-8"
              aria-label="Sign Out"
            >
              Sign Out
            </button>

            {!user.emailVerified ? (
              <div className="mt-8 p-6 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800">
                <h2 className="text-xl font-bold mb-3">Email Not Verified</h2>
                <p>Please check your email inbox (and spam folder) for a verification link. You need to verify your email to access all NotizVoice features.</p>
                <button
                  onClick={async () => {
                    setMessage('Resending verification email...');
                    try {
                      await sendEmailVerification(auth.currentUser);
                      setMessage('Verification email re-sent! Please check your inbox.');
                    } catch (error) {
                      setMessage(`Error resending email: ${error.message}`);
                      console.error('Error resending verification email:', error);
                    }
                  }}
                  className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200 ease-in-out"
                >
                  Resend Verification Email
                </button>
              </div>
            ) : (
              // Show full app features if email is verified
              <>
                {/* Voice Recorder Component */}
                {/* Pass the current user to VoiceRecorder for admin checks */}
                <VoiceRecorder onSaveToFirestore={handleSaveNoteToFirestore} currentUser={user} />

                {/* Saved Notes List (from Firestore) */}
                <div className="mt-8 border-t border-gray-200 pt-8">
                  <h2 className="text-2xl font-semibold mb-6 text-gray-800">My Saved Notes</h2>
                  {savedNotes.length === 0 ? (
                    <p className="text-gray-500">No saved notes yet. Transcribe and save your first note using the recorder above!</p>
                  ) : (
                    <div className="space-y-4">
                      {savedNotes.map((note) => (
                        <div key={note.id} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm text-left">
                          <h3 className="text-lg font-semibold text-gray-800 mb-1">{note.title}</h3>
                          <p className="text-gray-700 text-sm mb-2 whitespace-pre-wrap">{note.content}</p>
                          {note.summary && <p className="text-xs text-gray-600 mb-2">Summary: {note.summary}</p>}
                          {note.category && <p className="text-xs text-gray-500 mb-2">Category: {note.category}</p>}
                          <p className="text-xs text-gray-500 mb-2">Created: {new Date(note.createdAt.seconds * 1000).toLocaleString()}</p>
                          <button
                            onClick={() => handleDeleteSavedNote(note.id)}
                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-md focus:outline-none focus:shadow-outline transition duration-200 ease-in-out"
                            aria-label={`Delete note: ${note.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Message display area */}
        {message && (
          <p className="text-center text-sm mt-6 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-700">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
