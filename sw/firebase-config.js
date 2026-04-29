// firebase-config.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD6TBV8AmQwxAIoQJB5yuxrKcqAEVOWYKQ",
  authDomain: "avisos-jardines.firebaseapp.com",
  projectId: "avisos-jardines",
  storageBucket: "avisos-jardines.firebasestorage.app",
  messagingSenderId: "1010324110751",
  appId: "1:1010324110751:web:c7ab30ffadfb5966fd51aa"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { app, messaging };