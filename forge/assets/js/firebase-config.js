/* ============================================================
   THE FORGE — Firebase configuration
   ------------------------------------------------------------
   1. Create a Firebase project at https://console.firebase.google.com
   2. Add a Web App to it and copy the config object it gives you
      over the placeholder values below.
   3. Enable Email/Password sign-in under Authentication.
   4. Create a Firestore database (production mode) and deploy
      firestore.rules.
   Full walkthrough: see forge/README.md
   ------------------------------------------------------------
   NOTE ON "ENVIRONMENT VARIABLES": this is a zero-build static
   site, so there is no bundler to inject env vars. Firebase web
   config values are public identifiers, not secrets — real
   protection comes from firestore.rules. If you later move to a
   bundler (Vite etc.), swap these for import.meta.env values.
   ============================================================ */

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

/* ============================================================
   ADMIN ACCESS
   >>> ADD YOUR REAL EMAIL HERE <<<
   Any account that signs in with one of these emails sees the
   /admin dashboard. You MUST also add the same email(s) to the
   isAdmin() list in firestore.rules — the array below only hides
   the UI; the rules are what actually protect the data.
   The rules also require the admin email to be VERIFIED — click
   the verification link the app sends after you register.
   TODO: replace this email allow-list with Firebase custom
   claims for proper role security (see README, "Hardening").
   ============================================================ */
export const ADMIN_EMAILS = [
  "your-email@example.com",
];
