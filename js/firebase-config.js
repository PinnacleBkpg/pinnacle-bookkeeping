/**
 * Pinnacle Bookkeeping — Firebase Configuration
 * -----------------------------------------------
 * Replace these values with your actual Firebase project credentials.
 * Find them at: Firebase Console → Project Settings → Your Apps → Web App
 */

const firebaseConfig = {
  apiKey: "AIzaSyD4w3tkPzEJZx6dizAR0LJ1Wf2_xS_bkZw",
  authDomain: "pinnacle-portal.firebaseapp.com",
  projectId: "pinnacle-portal",
  storageBucket: "pinnacle-portal.firebasestorage.app",
  messagingSenderId: "1028108107769",
  appId: "1:1028108107769:web:d7989d853be2001ddb0728",
  measurementId: "G-EWWQEPKB6C"
};

/**
 * Cloud Functions base URL
 * After deploying functions: https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net
 */
const FUNCTIONS_BASE_URL = "https://us-central1-pinnacle-portal.cloudfunctions.net";

/**
 * Google Drive — Parent folder ID
 * This is the ID of your "Pinnacle Clients" folder in Google Drive.
 * Find it in the URL: https://drive.google.com/drive/folders/THIS_PART
 */
const DRIVE_PARENT_FOLDER_ID = "17EzG6hRK5vumA23cFnkTIyyoQIHC48lO";
