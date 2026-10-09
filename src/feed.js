import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

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

export async function refreshFeed() {
  const feedContainer = document.getElementById("feed");

  const postsSnapshot = await getDocs(
    query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
    ),
  );

  const posts = postsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  feedContainer.innerHTML = "";

  posts.forEach((post) => {
    const createdAt = post.createdAt;
    let timestamp;
    if (createdAt?.toDate instanceof Function) {
      timestamp = createdAt.toDate();
    } else if (typeof createdAt?.seconds === "number") {
      timestamp = new Date(createdAt.seconds * 1000 + (createdAt.nanoseconds ?? 0) / 1e6);
    } else if (createdAt) {
      timestamp = new Date(createdAt);
    }
    const timestampValue = timestamp?.getTime();
    const timeAgo = Number.isFinite(timestampValue)
      ? Math.max(0, (Date.now() - timestampValue) / 1000)
      : null;
    let createdAtText;
    if (timeAgo === null) {
      createdAtText = "just now";
    } else if (timeAgo < 60) {
      createdAtText = `${Math.floor(timeAgo)} seconds ago`;
    } else if (timeAgo < 3600) {
      createdAtText = `${Math.floor(timeAgo / 60)} minutes ago`;
    } else if (timeAgo < 86400) {
      createdAtText = `${Math.floor(timeAgo / 3600)} hours ago`;
    } else {
      createdAtText = `${Math.floor(timeAgo / 86400)} days ago`;
    }
    const postElement = document.createElement("article");
    postElement.classList.add("post");
    postElement.innerHTML = `
      <header class="post-header">
        <strong>${post.userEmail}</strong>
        <span>@${post.userEmail} · ${createdAtText}</span>
      </header>
      <p class="post-content">${post.text}</p>
    `;
    feedContainer.appendChild(postElement);
  });
}

refreshFeed().catch((error) => {
  console.error("Unable to load posts:", error);
});
