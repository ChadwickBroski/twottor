import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

export async function classifyText(postedSentence) {
  const exampleSentence = postedSentence;
  const topics = ["Entertainment", "Sports", "Politics", "Technology", "Health", "Science", "Business", "Travel", "Food", "Education", "Animals", "Environment", "Fashion", "Art", "History", "Music", "Movies", "Books", "Gaming", "Lifestyle"];

  const classifier = await pipeline(
    "zero-shot-classification",
    "Xenova/nli-deberta-v3-xsmall",
    { dtype: "q8" },
  );

  const classification = await classifier(exampleSentence, topics);
  return classification.labels[0];
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { refreshFeed } from "./feed.js";
import { notification } from "./notification.js";

const firebaseConfig = {
    apiKey: "AIzaSyBCoUU_nUvDyM_m9tcGuYj-qYcmyPFWGTI",
    authDomain: "twottor.firebaseapp.com",
    projectId: "twottor",
    storageBucket: "twottor.firebasestorage.app",
    messagingSenderId: "927372546363",
    appId: "1:927372546363:web:9e28e525b643c507c8a71e",
    measurementId: "G-9LS15S9KYW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const user = auth.currentUser;

const postButton = document.getElementById("post-button");
const postContainer = document.querySelector(".post-container");
let isPosting = false;

postButton.addEventListener("click", async (event) => {
  event.preventDefault();
  if (isPosting) return;

  const user = auth.currentUser;

  if (!user) {
    notification("Please log in before posting.", "failure");
    return;
  }
  if (!user.emailVerified) {
    notification("Please verify your email before posting.", "failure");
    return;
  }

  const text = postContainer.value.trim();

  if (!text) {
    notification("Write something before posting.", "failure");
    return;
  }

  isPosting = true;
  postButton.classList.add("loader");
  postButton.setAttribute("aria-busy", "true");
  try {
    const topic = await classifyText(text);
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};

    await addDoc(collection(db, "posts"), {
      text: text,
      topic: topic,
      uid: user.uid,
      userEmail: user.email,
      username: profile.username ?? user.displayName ?? user.email,
      handle: profile.handle ?? user.email?.split("@")[0] ?? "user",
      createdAt: serverTimestamp(),
    });

    postContainer.value = "";
    notification("Post published.", "success");
    try {
      await refreshFeed();
    } catch (error) {
      console.error("Post was published, but the feed could not refresh:", error);
      notification("Post published, but the feed couldn't refresh.", "failure");
    }
  } catch (error) {
    console.error("Error creating post:", error);
    notification("Unable to create the post.", "failure");
  } finally {
    isPosting = false;
    postButton.classList.remove("loader");
    postButton.removeAttribute("aria-busy");
  }
});
