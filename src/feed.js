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
  orderBy,
  increment,
  writeBatch,
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
const viewedPostIds = new Set();
const likedPostIds = new Set();
const dislikedPostIds = new Set();
const pendingViewCounts = new Map();
const pendingReactionChanges = new Map();
const persistedLikedPostIds = new Set();
const persistedDislikedPostIds = new Set();
let isFlushingPendingChanges = false;

function updateDisplayScore(postElement) {
  const likes = Number(postElement.dataset.likes) || 0;
  const dislikes = Number(postElement.dataset.dislikes) || 0;
  const views = Number(postElement.dataset.views) || 0;
  const createdAt = Number(postElement.dataset.createdAt);
  const ageHours = Math.max(0, (Date.now() - createdAt) / 3600000);
  const trendingScore = ((likes - dislikes) / (likes + dislikes + 5)) * Math.log1p(views);

  postElement.dataset.displayScore = String(trendingScore * Math.pow(0.5, ageHours / 168));
}

async function flushPendingChanges() {
  if (isFlushingPendingChanges || (pendingViewCounts.size === 0 && pendingReactionChanges.size === 0)) return;

  isFlushingPendingChanges = true;
  const viewedPostsToSave = [...pendingViewCounts.entries()];
  const reactionChangesToSave = [...pendingReactionChanges.entries()];
  pendingViewCounts.clear();
  let didCommit = false;

  const batch = writeBatch(db);
  const postUpdates = new Map();
  const userUpdates = new Map();
  const userStatDeltas = new Map();
  const addUserStatDelta = (userId, field, delta) => {
    if (!userId || delta === 0) return;
    const userStats = userStatDeltas.get(userId) ?? {
      totalLikes: 0,
      totalDislikes: 0,
      totalViews: 0,
    };
    userStats[field] += delta;
    userStatDeltas.set(userId, userStats);
  };

  viewedPostsToSave.forEach(([postId, authorId]) => {
    postUpdates.set(postId, { ...(postUpdates.get(postId) ?? {}), viewCount: increment(1) });
    addUserStatDelta(authorId, "totalViews", 1);
  });
  reactionChangesToSave.forEach(([postId, change]) => {
    const wasLiked = persistedLikedPostIds.has(postId);
    const wasDisliked = persistedDislikedPostIds.has(postId);
    const userUpdate = userUpdates.get(change.userId) ?? {
      likedPosts: new Set(persistedLikedPostIds),
      dislikedPosts: new Set(persistedDislikedPostIds),
    };
    if (change.isLiked !== wasLiked) {
      if (change.isLiked) userUpdate.likedPosts.add(postId);
      else userUpdate.likedPosts.delete(postId);
    }
    if (change.isDisliked !== wasDisliked) {
      if (change.isDisliked) userUpdate.dislikedPosts.add(postId);
      else userUpdate.dislikedPosts.delete(postId);
    }
    userUpdates.set(change.userId, userUpdate);

    const updates = postUpdates.get(postId) ?? {};
    if (change.isLiked !== wasLiked) {
      updates.likeCount = increment(change.isLiked ? 1 : -1);
      addUserStatDelta(change.authorId, "totalLikes", change.isLiked ? 1 : -1);
    }
    if (change.isDisliked !== wasDisliked) {
      updates.dislikeCount = increment(change.isDisliked ? 1 : -1);
      addUserStatDelta(change.authorId, "totalDislikes", change.isDisliked ? 1 : -1);
    }
    postUpdates.set(postId, updates);
  });

  const userDocumentUpdates = new Map();
  userUpdates.forEach((userUpdate, userId) => {
    userDocumentUpdates.set(userId, {
      likedPosts: [...userUpdate.likedPosts],
      dislikedPosts: [...userUpdate.dislikedPosts],
    });
  });

  const userStatBaselines = new Map();
  await Promise.all([...userStatDeltas.keys()].map(async (userId) => {
    const userSnapshot = await getDoc(doc(db, "users", userId));
    const userData = userSnapshot.exists() ? userSnapshot.data() : {};
    const hasTotals = [userData.totalLikes, userData.totalDislikes, userData.totalViews]
      .every((value) => Number.isSafeInteger(value) && value >= 0);
    if (hasTotals) return;

    const userPostsSnapshot = await getDocs(
      query(collection(db, "posts"), where("uid", "==", userId)),
    );
    const totals = userPostsSnapshot.docs.reduce((sum, postDocument) => {
      const post = postDocument.data();
      sum.totalLikes += Number.isSafeInteger(post.likeCount) && post.likeCount > 0 ? post.likeCount : 0;
      sum.totalDislikes += Number.isSafeInteger(post.dislikeCount) && post.dislikeCount > 0 ? post.dislikeCount : 0;
      sum.totalViews += Number.isSafeInteger(post.viewCount) && post.viewCount > 0 ? post.viewCount : 0;
      return sum;
    }, { totalLikes: 0, totalDislikes: 0, totalViews: 0 });
    userStatBaselines.set(userId, totals);
  }));

  userStatDeltas.forEach((stats, userId) => {
    const updates = userDocumentUpdates.get(userId) ?? {};
    const baseline = userStatBaselines.get(userId);
    Object.entries(stats).forEach(([field, delta]) => {
      if (baseline) updates[field] = baseline[field] + delta;
      else if (delta !== 0) updates[field] = increment(delta);
    });
    userDocumentUpdates.set(userId, updates);
  });
  userDocumentUpdates.forEach((updates, userId) => {
    batch.update(doc(db, "users", userId), updates);
  });
  postUpdates.forEach((updates, postId) => {
    if (Object.keys(updates).length) {
      batch.update(doc(db, "posts", postId), updates);
    }
  });

  const likeButtons = [...document.querySelectorAll("#feed .like-button")];
  const dislikeButtons = [...document.querySelectorAll("#feed .dislike-button")];
  if (reactionChangesToSave.length) {
    likeButtons.forEach((button) => {
      button.disabled = true;
    });
    dislikeButtons.forEach((button) => {
      button.disabled = true;
    });
  }

  try {
    await batch.commit();
    didCommit = true;
    try {
      const cacheKey = "twottor.leaderboard.users.v2";
      const cachedUsers = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      if (Array.isArray(cachedUsers)) {
        const updatedUsers = cachedUsers.map((user) => {
          const deltas = userStatDeltas.get(user.uid);
          if (!deltas) return user;

          const baseline = userStatBaselines.get(user.uid);
          return {
            ...user,
            totalLikes: baseline
              ? baseline.totalLikes + deltas.totalLikes
              : Math.max(0, (Number.isSafeInteger(user.totalLikes) ? user.totalLikes : 0) + deltas.totalLikes),
            totalDislikes: baseline
              ? baseline.totalDislikes + deltas.totalDislikes
              : Math.max(0, (Number.isSafeInteger(user.totalDislikes) ? user.totalDislikes : 0) + deltas.totalDislikes),
            totalViews: baseline
              ? baseline.totalViews + deltas.totalViews
              : Math.max(0, (Number.isSafeInteger(user.totalViews) ? user.totalViews : 0) + deltas.totalViews),
          };
        });
        localStorage.setItem(cacheKey, JSON.stringify(updatedUsers));
      }
    } catch (error) {
      console.warn("Unable to update cached leaderboard totals:", error);
    }

    reactionChangesToSave.forEach(([postId, change]) => {
      if (change.isLiked) {
        persistedLikedPostIds.add(postId);
      } else {
        persistedLikedPostIds.delete(postId);
      }
      if (change.isDisliked) {
        persistedDislikedPostIds.add(postId);
      } else {
        persistedDislikedPostIds.delete(postId);
      }
      const pendingChange = pendingReactionChanges.get(postId);
      if (pendingChange?.isLiked === change.isLiked && pendingChange?.isDisliked === change.isDisliked) {
        pendingReactionChanges.delete(postId);
      }
    });
  } catch (error) {
    viewedPostsToSave.forEach(([postId, authorId]) => pendingViewCounts.set(postId, authorId));
    console.error("Error saving pending post views and reactions:", error);
  } finally {
    isFlushingPendingChanges = false;
    if (reactionChangesToSave.length) {
      likeButtons.forEach((button) => {
        button.disabled = !auth.currentUser;
      });
      dislikeButtons.forEach((button) => {
        button.disabled = !auth.currentUser;
      });
    }
    if (didCommit && (pendingViewCounts.size || pendingReactionChanges.size)) {
      void flushPendingChanges();
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    void flushPendingChanges();
  }
});

window.addEventListener("pagehide", () => {
  void flushPendingChanges();
});

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
    persistedLikedPostIds.clear();
    persistedDislikedPostIds.clear();
    likedPostIds.clear();
    dislikedPostIds.clear();
    if (Array.isArray(userProfile.likedPosts)) {
      userProfile.likedPosts.forEach((postId) => persistedLikedPostIds.add(postId));
    }
    if (Array.isArray(userProfile.dislikedPosts)) {
      userProfile.dislikedPosts.forEach((postId) => persistedDislikedPostIds.add(postId));
    }
    persistedLikedPostIds.forEach((postId) => likedPostIds.add(postId));
    persistedDislikedPostIds.forEach((postId) => dislikedPostIds.add(postId));
    pendingReactionChanges.forEach((change, postId) => {
      if (change.userId !== currentUser.uid) return;
      if (change.isLiked) {
        likedPostIds.add(postId);
      } else {
        likedPostIds.delete(postId);
      }
      if (change.isDisliked) {
        dislikedPostIds.add(postId);
      } else {
        dislikedPostIds.delete(postId);
      }
    });
  } else {
    likedPostIds.clear();
    dislikedPostIds.clear();
    persistedLikedPostIds.clear();
    persistedDislikedPostIds.clear();

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
    const observer = new IntersectionObserver(([entry], observer) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        if (currentUser && !viewedPostIds.has(post.id)) {
          viewedPostIds.add(post.id);
          pendingViewCounts.set(post.id, post.uid);
          postElement.dataset.views = String((Number(postElement.dataset.views) || 0) + 1);
          postElement.querySelector(".view-count").innerHTML = `<i class="fa-regular fa-eye"></i> ${postElement.dataset.views}`;
          updateDisplayScore(postElement);
          void flushPendingChanges();
        }
      }
    }, { threshold: 0.5 });

    observer.observe(postElement);
    postElement.classList.add("post");
    postElement.dataset.postId = post.id;
    const likeCount = Number.isInteger(post.likeCount) ? Math.max(0, post.likeCount) : 0;
    const isLiked = likedPostIds.has(post.id);
    const dislikeCount = Number.isInteger(post.dislikeCount) ? Math.max(0, post.dislikeCount) : 0;
    const isDisliked = dislikedPostIds.has(post.id);
    let displayedLikeCount = Math.max(0, likeCount + Number(isLiked) - Number(persistedLikedPostIds.has(post.id)));
    let displayedDislikeCount = Math.max(0, dislikeCount + Number(isDisliked) - Number(persistedDislikedPostIds.has(post.id)));
    postElement.dataset.likes = String(displayedLikeCount);
    postElement.dataset.dislikes = String(displayedDislikeCount);
    postElement.dataset.views = String(Number.isInteger(post.viewCount) ? Math.max(0, post.viewCount) : 0);
    postElement.dataset.createdAt = String(Number.isFinite(timestampValue) ? timestampValue : Date.now());
    updateDisplayScore(postElement);
    postElement.innerHTML = `
      <header class="post-header">
        <strong>${authorName} · </strong>
        <span>@${authorHandle} · ${createdAtText}</span>
      </header>
      <p class="post-content">${escapeHtml(post.text)}</p>
      <footer class="post-actions">
        <button class="dislike-button" aria-pressed="${isDisliked}"><i class="fa-${isDisliked ? "solid" : "regular"} fa-thumbs-down"></i> ${displayedDislikeCount}</button>
        <button class="like-button" aria-pressed="${isLiked}"><i class="fa-${isLiked ? "solid" : "regular"} fa-thumbs-up"></i> ${displayedLikeCount}</button>
        <button class="view-count"><i class="fa-regular fa-eye"></i> ${postElement.dataset.views}</button>
      </footer>
    `;
    const likeButton = postElement.querySelector(".like-button");
    const dislikeButton = postElement.querySelector(".dislike-button");
    likeButton.disabled = !currentUser;
    dislikeButton.disabled = !currentUser;

    const updateReaction = (reaction) => {
      const isLiked = likedPostIds.has(post.id);
      const isDisliked = dislikedPostIds.has(post.id);
      const nextIsLiked = reaction === "like" ? !isLiked : isDisliked ? isLiked : false;
      const nextIsDisliked = reaction === "dislike" ? !isDisliked : isLiked ? isDisliked : false;

      if (nextIsLiked) {
        likedPostIds.add(post.id);
        dislikedPostIds.delete(post.id);
      } else {
        likedPostIds.delete(post.id);
      }
      if (nextIsDisliked) {
        dislikedPostIds.add(post.id);
        likedPostIds.delete(post.id);
      } else {
        dislikedPostIds.delete(post.id);
      }

      const finalIsLiked = likedPostIds.has(post.id);
      const finalIsDisliked = dislikedPostIds.has(post.id);
      displayedLikeCount = Math.max(0, displayedLikeCount + Number(finalIsLiked) - Number(isLiked));
      displayedDislikeCount = Math.max(0, displayedDislikeCount + Number(finalIsDisliked) - Number(isDisliked));
      postElement.dataset.likes = String(displayedLikeCount);
      postElement.dataset.dislikes = String(displayedDislikeCount);
      updateDisplayScore(postElement);
      if (
        finalIsLiked === persistedLikedPostIds.has(post.id)
        && finalIsDisliked === persistedDislikedPostIds.has(post.id)
      ) {
        pendingReactionChanges.delete(post.id);
      } else {
        pendingReactionChanges.set(post.id, {
          userId: currentUser.uid,
          authorId: post.uid,
          isLiked: finalIsLiked,
          isDisliked: finalIsDisliked,
        });
      }
      void flushPendingChanges();

      likeButton.setAttribute("aria-pressed", String(finalIsLiked));
      likeButton.innerHTML = `<i class="fa-${finalIsLiked ? "solid" : "regular"} fa-thumbs-up"></i> ${displayedLikeCount}`;
      dislikeButton.setAttribute("aria-pressed", String(finalIsDisliked));
      dislikeButton.innerHTML = `<i class="fa-${finalIsDisliked ? "solid" : "regular"} fa-thumbs-down"></i> ${displayedDislikeCount}`;
    };

    likeButton.addEventListener("click", () => updateReaction("like"));
    dislikeButton.addEventListener("click", () => updateReaction("dislike"));
    feedContainer.appendChild(postElement);
  });
}

onAuthStateChanged(auth, (currentUser) => {
  refreshFeed(currentUser).catch((error) => {
    console.error("Unable to load posts:", error);
  });
});
