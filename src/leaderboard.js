import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
const db = getFirestore(app);

const cacheKey = "twottor.leaderboard.users.v2";
let cachedUsers;
let usersRequest;

function readCachedUsers() {
  try {
    const savedUsers = localStorage.getItem(cacheKey);
    if (savedUsers !== null) {
      const parsedUsers = JSON.parse(savedUsers);
      if (Array.isArray(parsedUsers)) cachedUsers = parsedUsers;
    }
  } catch (error) {
    console.warn("Unable to read cached leaderboard users:", error);
  }

  return cachedUsers;
}

function fetchUsers() {
  if (!usersRequest) {
    usersRequest = getDocs(collection(db, "users"))
      .then((snapshot) => snapshot.docs.map((userDoc) => ({
        uid: userDoc.id,
        ...userDoc.data(),
      })))
      .then((users) => {
        cachedUsers = users;
        localStorage.setItem(cacheKey, JSON.stringify(users));
        return users;
      })
      .catch((error) => {
        usersRequest = undefined;
        throw error;
      })
      .finally(() => {
        usersRequest = undefined;
      });
  }

  return usersRequest;
}

async function initializeMissingUserTotals(users) {
  const usersMissingTotals = users.filter((user) =>
    ![user.totalLikes, user.totalDislikes, user.totalViews]
      .every((value) => Number.isSafeInteger(value) && value >= 0),
  );
  if (usersMissingTotals.length === 0) return users;

  const postsSnapshot = await getDocs(collection(db, "posts"));
  const totalsByUser = new Map();
  postsSnapshot.docs.forEach((postDocument) => {
    const post = postDocument.data();
    if (!post.uid) return;

    const totals = totalsByUser.get(post.uid) ?? {
      totalLikes: 0,
      totalDislikes: 0,
      totalViews: 0,
    };
    totals.totalLikes += Number.isSafeInteger(post.likeCount) && post.likeCount > 0 ? post.likeCount : 0;
    totals.totalDislikes += Number.isSafeInteger(post.dislikeCount) && post.dislikeCount > 0 ? post.dislikeCount : 0;
    totals.totalViews += Number.isSafeInteger(post.viewCount) && post.viewCount > 0 ? post.viewCount : 0;
    totalsByUser.set(post.uid, totals);
  });

  const updatedUsers = users.map((user) => {
    if (!usersMissingTotals.some((missingUser) => missingUser.uid === user.uid)) return user;
    return {
      ...user,
      ...(totalsByUser.get(user.uid) ?? { totalLikes: 0, totalDislikes: 0, totalViews: 0 }),
    };
  });

  for (let start = 0; start < usersMissingTotals.length; start += 450) {
    const batch = writeBatch(db);
    usersMissingTotals.slice(start, start + 450).forEach((user) => {
      const updatedUser = updatedUsers.find((candidate) => candidate.uid === user.uid);
      batch.update(doc(db, "users", user.uid), {
        totalLikes: updatedUser.totalLikes,
        totalDislikes: updatedUser.totalDislikes,
        totalViews: updatedUser.totalViews,
      });
    });
    await batch.commit();
  }

  cachedUsers = updatedUsers;
  localStorage.setItem(cacheKey, JSON.stringify(updatedUsers));
  return updatedUsers;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function printUsersOnLeaderboardEntry() {
  if (window.location.hash !== "#leaderboard") return;
  const leaderboardView = document.getElementById("leaderboard-view");

  try {
    const usersUnsorted = await initializeMissingUserTotals(await fetchUsers());
    const score = (user) =>
      (user.totalLikes ?? 0) - (user.totalDislikes ?? 0) + Math.log1p(user.totalViews ?? 0);
    const users = [...usersUnsorted].sort((a, b) => score(b) - score(a));

    leaderboardView.querySelectorAll(".post").forEach((element) => element.remove());
    users.forEach((user, index) => {
      const userElement = document.createElement("article");
      userElement.classList.add("post");
      const totalLikes = Number.isSafeInteger(user.totalLikes) ? user.totalLikes : 0;
      const totalDislikes = Number.isSafeInteger(user.totalDislikes) ? user.totalDislikes : 0;
      const totalViews = Number.isSafeInteger(user.totalViews) ? user.totalViews : 0;
      userElement.innerHTML = `
        <header class="post-header">
          <strong>#${index + 1} ${escapeHtml(user.username || "User")}</strong>
          <span>@${escapeHtml(user.handle || "user")}</span>
        </header>
        <article class="post" style="padding: 10px; padding-left: 20px;"><h3><i class="fa-solid fa-eye"></i> ${totalViews} views</h3></article>
        <article class="post" style="padding: 10px; padding-left: 20px;"><h3><i class="fa-solid fa-thumbs-up"></i> ${totalLikes} likes</h3></article>
        <article class="post" style="padding: 10px; padding-left: 20px;"><h3><i class="fa-solid fa-thumbs-down"></i> ${totalDislikes} dislikes</h3></article>
      `;
      leaderboardView.append(userElement);
    });
    console.log(users);
  } catch (error) {
    console.error("Unable to load leaderboard users:", error);
  }
}

window.addEventListener("hashchange", printUsersOnLeaderboardEntry);
void printUsersOnLeaderboardEntry();