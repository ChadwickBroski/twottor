import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { classifyTopics, TOPICS } from "./classifier.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCoUU_nUvDyM_m9tcGuYj-qYcmyPFWGTI",
  authDomain: "twottor.firebaseapp.com",
  projectId: "twottor",
  storageBucket: "twottor.firebasestorage.app",
  messagingSenderId: "927372546363",
  appId: "1:927372546363:web:9e28e525b643c507c8a71e",
  measurementId: "G-9LS15S9KYW",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const accessStatus = document.getElementById("access-status");
const status = document.getElementById("status");
const recalculateButton = document.getElementById("recalculate-button");
const MAX_BATCH_WRITES = 400;

let authorizedUser;

function setStatus(message) {
  status.textContent = message;
}

function clampScore(value, fallback = 0.25) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : fallback;
}

function topTopic(topicScores) {
  return Object.entries(topicScores)
    .sort(([, firstScore], [, secondScore]) => secondScore - firstScore)[0]?.[0] ?? TOPICS[0];
}

function getTopicLabels(post) {
  return Object.entries(post.topicScores ?? {})
    .filter(([, score]) => Number(score) >= 0.2)
    .sort(([, firstScore], [, secondScore]) => secondScore - firstScore)
    .slice(0, 5)
    .map(([topic]) => topic)
    .join(", ") || post.topic || "unknown topic";
}

function feedbackText(label, posts) {
  return posts.slice(0, 20)
    .map((post) => `${label} (${getTopicLabels(post)}): ${String(post.text ?? "").slice(0, 280)}`)
    .join("\n");
}

async function commitUpdates(updates) {
  for (let start = 0; start < updates.length; start += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    updates.slice(start, start + MAX_BATCH_WRITES).forEach(({ reference, data }) => {
      batch.update(reference, data);
    });
    await batch.commit();
  }
}

async function requireAdmin() {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("You must be logged in to use this page.");
  const userSnapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
  const profile = userSnapshot.exists() ? userSnapshot.data() : {};
  if (profile.handle !== "abhay") {
    throw new Error("Access denied. This tool is currently limited to @abhay.");
  }
  authorizedUser = auth.currentUser;
  accessStatus.textContent = `Authorized as @${profile.handle}.`;
  recalculateButton.disabled = false;
}

async function recalculateRecommendationData() {
  recalculateButton.disabled = true;
  setStatus("Loading posts and users…");

  const [postsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, "posts")),
    getDocs(collection(db, "users")),
  ]);
  const posts = postsSnapshot.docs.map((postDocument) => ({
    id: postDocument.id,
    reference: postDocument.ref,
    ...postDocument.data(),
  }));
  const users = usersSnapshot.docs.map((userDocument) => ({
    uid: userDocument.id,
    reference: userDocument.ref,
    ...userDocument.data(),
  }));

  const postUpdates = [];
  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index];
    const topicScores = await classifyTopics(String(post.text ?? ""));
    post.topicScores = topicScores;
    post.topic = topTopic(topicScores);
    postUpdates.push({
      reference: post.reference,
      data: { topic: post.topic, topicScores: post.topicScores },
    });
    setStatus(`Classified posts: ${index + 1}/${posts.length}`);
  }
  await commitUpdates(postUpdates);

  const userUpdates = [];
  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const likedIds = new Set(Array.isArray(user.likedPosts) ? user.likedPosts : []);
    const dislikedIds = new Set(Array.isArray(user.dislikedPosts) ? user.dislikedPosts : []);
    const ownPosts = posts.filter((post) => post.uid === user.uid);
    const likedPosts = posts.filter((post) => likedIds.has(post.id));
    const dislikedPosts = posts.filter((post) => dislikedIds.has(post.id));
    const positivePosts = [...new Map([...ownPosts, ...likedPosts].map((post) => [post.id, post])).values()];
    const positiveText = feedbackText("Preferred content", positivePosts);
    const negativeText = feedbackText("Disliked content", dislikedPosts);
    const positiveScores = positiveText ? await classifyTopics(positiveText) : {};
    const negativeScores = negativeText ? await classifyTopics(negativeText) : {};
    const interestScores = Object.fromEntries(TOPICS.map((topic) => {
      const positive = positiveText ? clampScore(positiveScores[topic], 0) : 0.25;
      const negative = negativeText ? clampScore(negativeScores[topic], 0) : 0;
      return [topic, Number((positive * (1 - (negative * 0.75))).toFixed(4))];
    }));
    userUpdates.push({
      reference: user.reference,
      data: {
        interestScores,
        interestActionCount: 0,
        interestUpdatedAt: serverTimestamp(),
      },
    });
    setStatus(`Recalculated users: ${index + 1}/${users.length}`);
  }
  await commitUpdates(userUpdates);
  setStatus(`Complete. Recalculated ${posts.length} posts and ${users.length} users.`);
  recalculateButton.disabled = false;
}

recalculateButton.addEventListener("click", () => {
  recalculateRecommendationData().catch((error) => {
    console.error("Recommendation data recalculation failed:", error);
    setStatus(`Failed: ${error.message}`);
    recalculateButton.disabled = false;
  });
});

requireAdmin().catch((error) => {
  accessStatus.textContent = error.message;
  recalculateButton.disabled = true;
});
