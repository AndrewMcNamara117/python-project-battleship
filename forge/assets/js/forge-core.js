/* ============================================================
   THE FORGE — shared core
   Firebase init, auth state wiring, shared helpers.
   The page chrome (header/footer/toast) is injected by
   forge-ui.js, which has no dependencies — this module only
   wires live auth state onto it once Firebase is up.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* re-export Firestore/Auth primitives so pages import one module */
export {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, ADMIN_EMAILS,
};

export const isAdminUser = (user) =>
  !!user && ADMIN_EMAILS.map((e) => e.toLowerCase())
    .includes((user.email || "").toLowerCase());

/** Waits for forge-ui.js to have injected the chrome (it runs before
    DOMContentLoaded), then wires auth state onto the nav.
    @returns {Promise<object|null>} resolves with the initial auth user. */
export async function initForgePage() {
  if (document.readyState === "loading") {
    await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
  }
  const authBtn = document.querySelector("[data-auth-btn]");
  const adminLink = document.querySelector("[data-admin-link]");

  return new Promise((resolve) => {
    let first = true;
    onAuthStateChanged(auth, (user) => {
      if (authBtn) {
        authBtn.hidden = false;
        if (user) {
          authBtn.textContent = "Log Out";
          authBtn.onclick = async () => { await signOut(auth); location.href = "index.html"; };
        } else {
          authBtn.textContent = "Log In";
          authBtn.onclick = () => { location.href = "login.html"; };
        }
      }
      if (adminLink) adminLink.hidden = !isAdminUser(user);
      if (first) { first = false; resolve(user); }
    });
  });
}

/* ---------- small helpers ---------- */

let toastTimer;
export function toast(msg, isError = false) {
  const el = document.querySelector(".toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Branded submit-state wrapper: disables the button, shows "Forging…". */
export async function withLoading(btn, fn, label = "Forging…") {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

export function fmtWhen(d) {
  if (!d) return "";
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleString("en-IE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** YYYY-MM-DD in local time — used as the Forge Log dateKey. */
export function todayKey(d = new Date()) {
  return [d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")].join("-");
}

/** Loads the member profile for a signed-in user (doc id == uid), or null. */
export async function getMemberProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "members", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

/** Redirects to /login if nobody is signed in. */
export function requireAuth(user, next) {
  if (!user) {
    location.href = "login.html?next=" + encodeURIComponent(next);
    return false;
  }
  return true;
}
