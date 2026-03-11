/**
 * Pinnacle Bookkeeping — Firebase Configuration
 * -----------------------------------------------
 * Replace these values with your actual Firebase project credentials.
 * Find them at: Firebase Console → Project Settings → Your Apps → Web App
 */

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * Cloud Functions base URL
 * After deploying functions: https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net
 */
const FUNCTIONS_BASE_URL = "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net";

/**
 * Google Drive — Parent folder ID
 * This is the ID of your "Pinnacle Clients" folder in Google Drive.
 * Find it in the URL: https://drive.google.com/drive/folders/THIS_PART
 */
const DRIVE_PARENT_FOLDER_ID = "YOUR_DRIVE_FOLDER_ID_HERE";
