import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCoUU_nUvDyM_m9tcGuYj-qYcmyPFWGTI",
  authDomain: "twottor.firebaseapp.com",
  projectId: "twottor",
  storageBucket: "twottor.firebasestorage.app",
  messagingSenderId: "927372546363",
  appId: "1:927372546363:web:9e28e525b643c507c8a71e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const loginForm = document.querySelector("#login-form");
const googleButton = document.querySelector(".google-login");
const loginMessage = document.querySelector("#login-message");
const submitButton = loginForm.querySelector(".login-submit");

function showMessage(message, isError = false) {
  loginMessage.textContent = message;
  loginMessage.classList.toggle("login-error", isError);
}

function getAuthErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "User is not found. Please check your email or sign up.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  };

  return messages[error.code] || "Unable to log in. Please try again.";
}

async function saveUserProfile(user) {
  await setDoc(
    doc(db, "users", user.uid),
    { uid: user.uid, email: user.email, lastLoginAt: serverTimestamp() },
    { merge: true },
  );
}

async function requireVerifiedEmail(user) {
  await user.reload();

  if (!user.emailVerified) {
    await signOut(auth);
    throw new Error("email-not-verified");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  submitButton.disabled = true;
  submitButton.textContent = "Logging in...";
  showMessage("");

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await requireVerifiedEmail(result.user);
    await saveUserProfile(result.user);
    window.location.href = "index.html";
  } catch (error) {
    showMessage(
      error.message === "email-not-verified"
        ? "Verify your email before logging in."
        : getAuthErrorMessage(error),
      true,
    );
    submitButton.disabled = false;
    submitButton.textContent = "Log in";
  }
});

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  googleButton.querySelector("span").textContent = "Connecting...";
  showMessage("");

  try {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
    window.location.href = "index.html";
  } catch (error) {
    showMessage(getAuthErrorMessage(error), true);
    googleButton.disabled = false;
    googleButton.querySelector("span").textContent = "Continue with Google";
  }
});
