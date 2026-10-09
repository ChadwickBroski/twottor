import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { classifyText } from "./post.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  getFirestore,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const escapes = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escapes[character];
  });
}

export async function refreshFeed(currentUser = auth.currentUser) {
  const feedContainer = document.getElementById("feed");

  const allPostsSnapshot = await getDocs(
    query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
    ),
  );

  const allPosts = allPostsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  let posts = allPosts;
  const authorProfiles = new Map();

  if (currentUser) {
    const currentUserPosts = allPosts.filter((post) => post.uid === currentUser.uid);
    const userProfileSnapshot = await getDoc(doc(db, "users", currentUser.uid));
    const userProfile = userProfileSnapshot.exists() ? userProfileSnapshot.data() : {};
    const userInterest = userProfile.interest;
    authorProfiles.set(currentUser.uid, userProfile);

    console.log("Posts by current user:", currentUserPosts);

    if (currentUserPosts.length > 10 && userInterest) {
      const matchingPostsSnapshot = await getDocs(
        query(
          collection(db, "posts"),
          where("topic", "==", userInterest),
          orderBy("createdAt", "desc"),
        ),
      );
      posts = matchingPostsSnapshot.docs.map((postDoc) => ({
        id: postDoc.id,
        ...postDoc.data(),
      }));
    }

    if (currentUserPosts.length >= 10 && currentUserPosts.length % 10 === 0) {
      const userInterest = await classifyText(
        "These are all the posts by the current user (ordered from latest to oldest): " +
          currentUserPosts.map((post) => post.text).join(" "),
      );
      await updateDoc(doc(db, "users", currentUser.uid), {
        interest: userInterest,
      });
    }
  }

  const authorUids = [
    ...new Set(
      posts
        .filter((post) => post.uid && (!post.username || !post.handle) && !authorProfiles.has(post.uid))
        .map((post) => post.uid),
    ),
  ];
  const authorSnapshots = await Promise.allSettled(
    authorUids.map((uid) => getDoc(doc(db, "users", uid))),
  );
  authorSnapshots.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.exists()) {
      authorProfiles.set(authorUids[index], result.value.data());
    }
  });

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
    let authorProfile = authorProfiles.get(post.uid) ?? {};
    let authorName = escapeHtml(post.username || authorProfile.username || post.userEmail || "Unknown user");
    let authorHandle = escapeHtml(post.handle || authorProfile.handle || post.userEmail || "user");
    let postElement = document.createElement("article");
    postElement.classList.add("post");
    postElement.innerHTML = `
      <header class="post-header">
        <strong>${authorName} · </strong>
        <span>@${authorHandle} · ${createdAtText}</span>
      </header>
      <p class="post-content">${escapeHtml(post.text)}</p>
      <footer class="post-actions">
        <button><i class="fa-regular fa-thumbs-down"></i> Dislike</button>
        <button><i class="fa-regular fa-thumbs-up"></i> Like</button>
      </footer>
    `;
    feedContainer.appendChild(postElement);
  });
}

onAuthStateChanged(auth, (currentUser) => {
  refreshFeed(currentUser).catch((error) => {
    console.error("Unable to load posts:", error);
  });
});
