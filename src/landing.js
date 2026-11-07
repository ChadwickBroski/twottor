import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  collection,
  getDocs,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCoUU_nUvDyM_m9tcGuYj-qYcmyPFWGTI",
  authDomain: "twottor.firebaseapp.com",
  projectId: "twottor",
  storageBucket: "twottor.firebasestorage.app",
  messagingSenderId: "927372546363",
  appId: "1:927372546363:web:9e28e525b643c507c8a71e",
};

const communityCount = document.querySelector("#community-count");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function formatCommunityCount(count) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(count).toLowerCase();
}

async function loadCommunityCount() {
  try {
    const snapshot = await getDocs(collection(db, "posts"));
    const authorIds = new Set(
      snapshot.docs
        .map((post) => post.data().uid)
        .filter(Boolean),
    );

    communityCount.textContent = authorIds.size
      ? `${formatCommunityCount(authorIds.size)} people are talking`
      : "Be the first to start a conversation";
  } catch (error) {
    console.warn("Unable to load the community count:", error);
  }
}

void loadCommunityCount();

const statElements = {
  members: document.querySelector("#stat-members"),
  posts: document.querySelector("#stat-posts"),
  storage: document.querySelector("#stat-storage"),
};

function formatStat(value) {
  if (typeof value === "string") return value;

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(Number(value) || 0).toLowerCase();
}

async function loadLandingStats() {
  try {
    const response = await fetch("assets/stats.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Stats request failed with ${response.status}`);
    }

    const stats = await response.json();
    statElements.members.textContent = formatStat(stats.members);
    statElements.posts.textContent = formatStat(stats.posts);
    statElements.storage.textContent = formatStat(stats.storage);
  } catch (error) {
    console.warn("Unable to load landing page stats:", error);
    Object.values(statElements).forEach((element) => {
      element.textContent = "-";
    });
  }
}

void loadLandingStats();
