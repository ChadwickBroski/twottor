import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
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
const form = document.querySelector("#signup-form");
const googleButton = document.querySelector(".google-login");
const message = document.querySelector("#signup-message");
const submitButton = form.querySelector(".login-submit");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("login-error", isError);
}

function authError(error) {
  const errors = {
    "auth/email-already-in-use": "An account already exists with this email.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-up was cancelled.",
  };

  return errors[error.code] || "Unable to create the account. Please try again.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const confirmPassword = document.querySelector("#confirm-password").value;

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.", true);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";
  showMessage("");

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    await sendEmailVerification(result.user);
    await signOut(auth);

    showMessage("Check your email to verify your account before logging in.");
  } catch (error) {
    showMessage(authError(error), true);
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  googleButton.querySelector("span").textContent = "Connecting...";
  showMessage("");

  try {
    const result = await signInWithPopup(auth, googleProvider);
    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      email: result.user.email,
      createdAt: serverTimestamp(),
    }, { merge: true });
    window.location.href = "index.html";
  } catch (error) {
    showMessage(authError(error), true);
    googleButton.disabled = false;
    googleButton.querySelector("span").textContent = "Sign up with Google";
  }
});
