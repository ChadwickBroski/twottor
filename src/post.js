import { classifyTopics } from "./classifier.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  updateDoc,
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
    const topicScores = await classifyTopics(text);
    const topic = Object.entries(topicScores).sort(([, firstScore], [, secondScore]) => secondScore - firstScore)[0]?.[0] ?? "Entertainment";
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};

    await addDoc(collection(db, "posts"), {
      text: text,
      topic: topic,
      topicScores,
      uid: user.uid,
      userEmail: user.email,
      username: profile.username ?? user.displayName ?? user.email,
      handle: profile.handle ?? user.email?.split("@")[0] ?? "user",
      createdAt: serverTimestamp(),
    });
    try {
      await updateDoc(doc(db, "users", user.uid), {
        interestActionCount: increment(3),
      });
    } catch (error) {
      console.warn("Post published, but the interest refresh counter could not be updated:", error);
    }

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
