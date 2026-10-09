import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
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
const handlePattern = /^[a-zA-Z0-9_]{3,20}$/;

async function handleIsTaken(handle, exceptUid = null) {
  const normalizedHandle = handle.trim().toLowerCase();
  const handleSnapshot = await getDoc(doc(db, "handles", normalizedHandle));

  return handleSnapshot.exists() && handleSnapshot.data().uid !== exceptUid;
}

async function claimHandle(handle, user) {
  const normalizedHandle = handle.trim().toLowerCase();
  const handleRef = doc(db, "handles", normalizedHandle);

  await runTransaction(db, async (transaction) => {
    const handleSnapshot = await transaction.get(handleRef);
    if (handleSnapshot.exists() && handleSnapshot.data().uid !== user.uid) {
      const error = new Error("That handle is already in use.");
      error.code = "handle/already-in-use";
      throw error;
    }

    if (!handleSnapshot.exists()) {
      transaction.set(handleRef, {
        uid: user.uid,
        handleLowercase: normalizedHandle,
      });
    }
  });
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("login-error", isError);
}

function authError(error) {
  if (error.code === "handle/already-in-use") {
    return "That handle is already in use. Choose another one.";
  }

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
  const username = document.querySelector("#username").value.trim();
  const handle = document.querySelector("#handle").value.trim();

  if (!handlePattern.test(handle)) {
    showMessage("Use a 3-20 character handle with only letters, numbers, and underscores.", true);
    return;
  }

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.", true);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";
  showMessage("");

  try {
    if (await handleIsTaken(handle)) {
      showMessage("That handle is already in use. Choose another one.", true);
      return;
    }

    const result = await createUserWithEmailAndPassword(auth, email, password);

    try {
      await claimHandle(handle, result.user);
    } catch (error) {
      if (error.code === "handle/already-in-use") {
        await deleteUser(result.user);
      }
      throw error;
    }

    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      email: result.user.email,
      username,
      handle,
      createdAt: serverTimestamp(),
    });
    await sendEmailVerification(result.user);
    await signOut(auth);

    showMessage("Check your email to verify your account before logging in.");
  } catch (error) {
    showMessage(authError(error), true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});

googleButton.addEventListener("click", async () => {
  const username = document.querySelector("#username").value.trim();
  const handle = document.querySelector("#handle").value.trim();
  if (!handlePattern.test(handle)) {
    showMessage("Use a 3-20 character handle with only letters, numbers, and underscores.", true);
    return;
  }
  if (!username || !handle) {
    showMessage("Enter a username and handle before signing up with Google.", true);
    return;
  }

  googleButton.disabled = true;
  googleButton.querySelector("span").textContent = "Connecting...";
  showMessage("");

  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (await handleIsTaken(handle, result.user.uid)) {
      await signOut(auth);
      showMessage("That handle is already in use. Choose another one.", true);
      return;
    }

    await claimHandle(handle, result.user);
    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      email: result.user.email,
      username,
      handle,
      handleLowercase: handle.toLowerCase(),
      createdAt: serverTimestamp(),
    }, { merge: true });
    window.location.href = "index.html";
  } catch (error) {
    if (error.code === "handle/already-in-use") {
      await signOut(auth);
    }
    showMessage(authError(error), true);
  } finally {
    googleButton.disabled = false;
    googleButton.querySelector("span").textContent = "Sign up with Google";
  }
});
