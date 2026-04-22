// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDSyoTVgsZpcxhhBSJVBoj_a1K8TsQPwik",
  authDomain: "lexivia-25eb4.firebaseapp.com",
  projectId: "lexivia-25eb4",
  storageBucket: "lexivia-25eb4.firebasestorage.app",
  messagingSenderId: "604210840962",
  appId: "1:604210840962:web:fd0b386858efd4548efb9b",
  measurementId: "G-WG9N5VGQM4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);