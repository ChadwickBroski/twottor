import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { classifyTopics, TOPICS } from "./classifier.js";
import {
  addDoc,
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
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
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
const viewedPostIds = new Set();
const likedPostIds = new Set();
const dislikedPostIds = new Set();
const pendingViewCounts = new Map();
const pendingReactionChanges = new Map();
const persistedLikedPostIds = new Set();
const persistedDislikedPostIds = new Set();
let isFlushingPendingChanges = false;
let interestActionsSinceRefresh = 0;
let interestRefreshTimer;
let isRefreshingInterests = false;
let feedRefreshVersion = 0;
const INTEREST_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const INTEREST_ACTION_THRESHOLD = 3;

function clampInterest(value, fallback = 0.25) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(1, Math.max(0, numericValue)) : fallback;
}

function getTimestampMs(value) {
  if (value?.toDate instanceof Function) return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getPostTopicScores(post) {
  const scores = {};
  if (post.topicScores && typeof post.topicScores === "object") {
    TOPICS.forEach((topic) => {
      if (post.topicScores[topic] !== undefined) scores[topic] = clampInterest(post.topicScores[topic], 0);
    });
  }
  if (!Object.keys(scores).length && post.topic) scores[post.topic] = 1;
  return scores;
}

function getProfileInterestScores(userProfile) {
  return Object.fromEntries(TOPICS.map((topic) => [
    topic,
    clampInterest(userProfile.interestScores?.[topic]),
  ]));
}

function getFeedbackText(posts, label) {
  return posts
    .slice(0, 20)
    .map((post) => {
      const topics = Object.entries(getPostTopicScores(post))
        .filter(([, score]) => score >= 0.2)
        .sort(([, firstScore], [, secondScore]) => secondScore - firstScore)
        .slice(0, 5)
        .map(([topic]) => topic)
        .join(", ");
      return `${label} (${topics || "unknown topic"}): ${String(post.text ?? "").slice(0, 280)}`;
    })
    .join("\n");
}

async function refreshUserInterestScores(userId, userProfile, allPosts) {
  const likedIds = new Set(Array.isArray(userProfile.likedPosts) ? userProfile.likedPosts : []);
  const dislikedIds = new Set(Array.isArray(userProfile.dislikedPosts) ? userProfile.dislikedPosts : []);
  const ownPosts = allPosts.filter((post) => post.uid === userId);
  const likedPosts = allPosts.filter((post) => likedIds.has(post.id));
  const dislikedPosts = allPosts.filter((post) => dislikedIds.has(post.id));
  const positivePosts = [...new Map([...ownPosts, ...likedPosts].map((post) => [post.id, post])).values()];
  const positiveText = getFeedbackText(positivePosts, "Preferred topic content");
  const negativeText = getFeedbackText(dislikedPosts, "Disliked topic content");
  const [positiveScores, negativeScores] = await Promise.all([
    positiveText ? classifyTopics(positiveText) : {},
    negativeText ? classifyTopics(negativeText) : {},
  ]);
  const interestScores = Object.fromEntries(TOPICS.map((topic) => {
    const positive = positiveText ? clampInterest(positiveScores[topic], 0) : 0.25;
    const negative = negativeText ? clampInterest(negativeScores[topic], 0) : 0;
    return [topic, Number((positive * (1 - (negative * 0.75))).toFixed(4))];
  }));
  await updateDoc(doc(db, "users", userId), {
    interestScores,
    interestActionCount: 0,
    interestUpdatedAt: serverTimestamp(),
  });
  return interestScores;
}

function refreshInterestsInBackground(userId, userProfile, allPosts) {
  if (isRefreshingInterests) return;
  isRefreshingInterests = true;
  refreshUserInterestScores(userId, userProfile, allPosts)
    .then(() => refreshFeed(auth.currentUser))
    .catch((error) => {
      console.warn("Unable to refresh personalized interests:", error);
    })
    .finally(() => {
      isRefreshingInterests = false;
    });
}

function getPostInterestScore(post, interestScores) {
  const topicScores = getPostTopicScores(post);
  const weightedTopics = Object.entries(topicScores)
    .filter(([, score]) => score >= 0.05)
    .sort(([, firstScore], [, secondScore]) => secondScore - firstScore)
    .slice(0, 5);
  if (!weightedTopics.length) return 0;
  const totalTopicWeight = weightedTopics.reduce((sum, [, score]) => sum + score, 0);
  return weightedTopics.reduce(
    (sum, [topic, score]) => sum + (score * (interestScores[topic] ?? 0.25)),
    0,
  ) / totalTopicWeight;
}

function getAuthorFollowerBoost(authorProfile) {
  const totalFollowers = Math.max(
    0,
    Number(authorProfile?.totalFollowers ?? authorProfile?.followers?.length ?? 0),
  );
  return Math.log1p(totalFollowers) * 0.08;
}

function updateDisplayScore(postElement) {
  const likes = Number(postElement.dataset.likes) || 0;
  const dislikes = Number(postElement.dataset.dislikes) || 0;
  const views = Number(postElement.dataset.views) || 0;
  const replies = Number(postElement.dataset.replies) || 0;
  const createdAt = Number(postElement.dataset.createdAt);
  const ageHours = Math.max(0, (Date.now() - createdAt) / 3600000);
  const trendingScore = ((likes - dislikes) / (likes + dislikes + 5)) * Math.log1p(views);
  const replyBoost = Math.log1p(replies) * 0.35;

  postElement.dataset.displayScore = String((trendingScore + replyBoost) * Math.pow(0.5, ageHours / 168));
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
    const reactionCount = reactionChangesToSave.filter(([, change]) => change.userId === userId).length;
    userDocumentUpdates.set(userId, {
      likedPosts: [...userUpdate.likedPosts],
      dislikedPosts: [...userUpdate.dislikedPosts],
      interestActionCount: increment(reactionCount),
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
    interestActionsSinceRefresh += reactionChangesToSave.filter(([, change]) => change.userId === auth.currentUser?.uid).length;
    if (interestActionsSinceRefresh >= INTEREST_ACTION_THRESHOLD) {
      interestActionsSinceRefresh = 0;
      void refreshFeed(auth.currentUser);
    }
  } catch (error) {
    viewedPostsToSave.forEach(([postId, authorId]) => pendingViewCounts.set(postId, authorId));
    console.error("Error saving pending post views and reactions:\n" + JSON.stringify({
      code: error.code,
      message: error.message,
      currentUserId: auth.currentUser?.uid,
      posts: [...postUpdates].map(([postId, updates]) => ({
        postId,
        fields: Object.keys(updates),
      })),
      users: [...userDocumentUpdates].map(([userId, updates]) => ({
        userId,
        fields: Object.keys(updates),
      })),
    }, null, 2), error);
    if (reactionChangesToSave.length) {
      notification("Your reaction couldn't be saved. Please try again.", "failure");
    }
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

function getProfileUrl(handle) {
  const basePath = location.hostname.endsWith("github.io") ? "/twottor/" : "/";
  return `${basePath}user/${encodeURIComponent(handle || "user")}`;
}

function formatReplyTime(value) {
  let timestamp;
  if (value?.toDate instanceof Function) {
    timestamp = value.toDate();
  } else if (typeof value?.seconds === "number") {
    timestamp = new Date(value.seconds * 1000 + (value.nanoseconds ?? 0) / 1e6);
  } else if (value) {
    timestamp = new Date(value);
  }
  if (!timestamp || Number.isNaN(timestamp.getTime())) return "just now";

  const seconds = Math.max(0, (Date.now() - timestamp.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

async function loadReplies(postId, repliesContainer, showRepliesButton) {
  if (repliesContainer.dataset.loaded === "true") {
    repliesContainer.hidden = repliesContainer.dataset.expanded !== "true";
    showRepliesButton.innerHTML = repliesContainer.hidden
      ? '<i class="fa-solid fa-chevron-down"></i> Show replies'
      : '<i class="fa-solid fa-chevron-up"></i> Hide replies';
    return;
  }
  const repliesSnapshot = await getDocs(
    query(collection(db, "posts", postId, "replies"), orderBy("createdAt", "asc")),
  );
  repliesContainer.innerHTML = repliesSnapshot.docs.map((replyDocument) => {
    const reply = replyDocument.data();
    return `<div class="post-reply">
      <strong>${escapeHtml(reply.username || reply.userEmail || "User")}
          ${reply.handle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" style="font-size: 10px; padding:4px;" aria-label="Owner" title="Owner"></i>' : ""}
          ${reply.handle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" style="font-size: 10px; padding:4px;" aria-label="Developer" title="Developer"></i>' : ""} ·
      </strong>
      <span>@${escapeHtml(reply.handle || "user")} · ${formatReplyTime(reply.createdAt)}</span>
      <p>${escapeHtml(reply.text)}</p>
    </div>`;
  }).join("");
  if (repliesSnapshot.empty) {
    repliesContainer.dataset.loaded = "true";
    repliesContainer.closest(".post").dataset.replies = "0";
    showRepliesButton.hidden = true;
    repliesContainer.hidden = true;
    return;
  }
  const postElement = repliesContainer.closest(".post");
  repliesContainer.dataset.loaded = "true";
  postElement.dataset.replies = String(repliesSnapshot.size);
  updateDisplayScore(postElement);
  showRepliesButton.hidden = false;
  const isExpanded = repliesContainer.dataset.expanded === "true";
  repliesContainer.hidden = !isExpanded;
  showRepliesButton.innerHTML = isExpanded
    ? '<i class="fa-solid fa-chevron-up"></i> Hide replies'
    : `<i class="fa-solid fa-chevron-down"></i> Show replies (${repliesSnapshot.size})`;
}

export async function refreshFeed(currentUser = auth.currentUser) {
  const refreshVersion = ++feedRefreshVersion;
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
  let interestScores = getProfileInterestScores({});
  if (currentUser) {
    const userProfileSnapshot = await getDoc(doc(db, "users", currentUser.uid));
    let userProfile = userProfileSnapshot.exists() ? userProfileSnapshot.data() : {};
    interestScores = getProfileInterestScores(userProfile);
    const lastInterestUpdate = getTimestampMs(userProfile.interestUpdatedAt);
    const interestIsStale = !userProfileSnapshot.exists()
      || !userProfile.interestScores
      || !lastInterestUpdate
      || Date.now() - lastInterestUpdate >= INTEREST_REFRESH_INTERVAL_MS
      || Number(userProfile.interestActionCount) >= INTEREST_ACTION_THRESHOLD;
    if (interestIsStale) {
      refreshInterestsInBackground(currentUser.uid, userProfile, allPosts);
    }
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
  }

  const authorUids = [...new Set(posts.map((post) => post.uid).filter(Boolean))]
    .filter((uid) => !authorProfiles.has(uid));
  const authorSnapshots = await Promise.allSettled(
    authorUids.map((uid) => getDoc(doc(db, "users", uid))),
  );
  authorSnapshots.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.exists()) {
      authorProfiles.set(authorUids[index], result.value.data());
    }
  });

  if (currentUser) {
    const rankedPosts = posts.map((post, index) => ({
      post,
      index,
      relevance: getPostInterestScore(post, interestScores)
        + getAuthorFollowerBoost(authorProfiles.get(post.uid)),
    }));
    rankedPosts.sort((first, second) => {
      if (second.relevance !== first.relevance) return second.relevance - first.relevance;
      const createdAtDifference = getTimestampMs(second.post.createdAt) - getTimestampMs(first.post.createdAt);
      return createdAtDifference || first.index - second.index;
    });
    posts = rankedPosts.map(({ post }) => post);
  }

  if (refreshVersion !== feedRefreshVersion) return;

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
        <a href="${getProfileUrl(authorHandle)}" target="_blank" rel="noopener noreferrer" class="post-header">
          <strong>${authorName}
            ${authorHandle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" aria-label="Owner" title="Owner"></i>' : ""}
            ${authorHandle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" aria-label="Developer" title="Developer"></i>' : ""}
          · </strong>
        </a>
        <span>@${authorHandle} · ${createdAtText}</span>
      </header>
      <p class="post-content">${escapeHtml(post.text)}</p>
      <footer class="post-actions">
        <button class="reply-button" type="button" aria-expanded="false"><i class="fa-solid fa-reply"></i> Reply</button>
        <button class="dislike-button" aria-pressed="${isDisliked}"><i class="fa-${isDisliked ? "solid" : "regular"} fa-thumbs-down"></i> ${displayedDislikeCount}</button>
        <button class="like-button" aria-pressed="${isLiked}"><i class="fa-${isLiked ? "solid" : "regular"} fa-thumbs-up"></i> ${displayedLikeCount}</button>
        <button class="view-count"><i class="fa-regular fa-eye"></i> ${postElement.dataset.views}</button>
      </footer>
      <form class="reply-form" hidden>
        <textarea rows="2" maxlength="280" placeholder="Write a reply..." required></textarea>
        <button type="submit"><i class="fa-solid fa-paper-plane"></i> Send</button>
      </form>
      <button class="post-replies-toggle" type="button" hidden></button>
      <div class="post-replies" hidden></div>
    `;
    const replyButton = postElement.querySelector(".reply-button");
    const replyForm = postElement.querySelector(".reply-form");
    const replyInput = replyForm.querySelector("textarea");
    const showRepliesButton = postElement.querySelector(".post-replies-toggle");
    const repliesContainer = postElement.querySelector(".post-replies");
    showRepliesButton.addEventListener("click", () => {
      const isExpanded = repliesContainer.dataset.expanded === "true";
      repliesContainer.dataset.expanded = String(!isExpanded);
      void loadReplies(post.id, repliesContainer, showRepliesButton);
    });
    showRepliesButton.hidden = false;
    showRepliesButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Show replies';
    replyButton.addEventListener("click", () => {
      if (!currentUser) {
        notification("Please log in before replying.", "failure");
        return;
      }
      const isOpen = !replyForm.hidden;
      replyForm.hidden = isOpen;
      replyButton.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) replyInput.focus();
    });
    replyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) {
        notification("Please log in before replying.", "failure");
        return;
      }
      const text = replyInput.value.trim();
      if (!text) return;
      const submitButton = replyForm.querySelector("button[type=submit]");
      submitButton.disabled = true;
      try {
        const profileSnapshot = await getDoc(doc(db, "users", currentUser.uid));
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        await addDoc(collection(db, "posts", post.id, "replies"), {
          text,
          uid: currentUser.uid,
          userEmail: currentUser.email,
          username: profile.username ?? currentUser.displayName ?? currentUser.email,
          handle: profile.handle ?? currentUser.email?.split("@")[0] ?? "user",
          createdAt: serverTimestamp(),
        });
        repliesContainer.dataset.expanded = "true";
        replyInput.value = "";
        await loadReplies(post.id, repliesContainer, showRepliesButton);
        notification("Reply published.", "success");
      } catch (error) {
        console.error("Unable to create reply:", error);
        notification("Unable to publish your reply.", "failure");
      } finally {
        submitButton.disabled = false;
      }
    });
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
  clearInterval(interestRefreshTimer);
  refreshFeed(currentUser).catch((error) => {
    console.error("Unable to load posts:", error);
    notification("Unable to load posts.", "failure");
  });
  if (currentUser) {
    interestRefreshTimer = setInterval(() => {
      refreshFeed(currentUser).catch((error) => {
        console.error("Unable to refresh personalized feed:", error);
      });
    }, INTEREST_REFRESH_INTERVAL_MS);
  }
});
