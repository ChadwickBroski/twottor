// Search page baseline: handles the UI only.
// The loaded posts and users are kept here so search filtering can use them.
import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const app = getApps().length ? getApp() : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

let postsList = [];
let usersList = [];

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
const searchTabs = [...document.querySelectorAll(".search-tab")];

// Load every post and user that the current account is allowed to read.
async function loadSearchLists() {
  if (!db || !auth) {
    console.warn("[search] Firebase app is not ready");
    return;
  }

  try {
    await auth.authStateReady();
    const [postsSnapshot, usersSnapshot] = await Promise.all([
      getDocs(collection(db, "posts")),
      getDocs(collection(db, "users")),
    ]);

    postsList = postsSnapshot.docs.map((postDocument) => ({
      id: postDocument.id,
      ...postDocument.data(),
    }));
    usersList = usersSnapshot.docs.map((userDocument) => ({
      uid: userDocument.id,
      ...userDocument.data(),
    }));

    // Expose the lists while developing so they can be inspected in DevTools.
    window.searchData = { posts: postsList, users: usersList };
  } catch (error) {
    console.error("[search] unable to load posts and users", error);
  }
}

void loadSearchLists();

function searchAndSort(keyword) {
  const query = keyword.toLowerCase();

  return postsList
    .filter((post) => post.text?.toLowerCase().includes(query))
    .sort((a, b) => a.text.localeCompare(b.text));
}

function formatSearchTime(value) {
  const timestamp = value?.toDate instanceof Function
    ? value.toDate().getTime()
    : typeof value?.seconds === "number"
      ? value.seconds * 1000
      : new Date(value).getTime();
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function escapeSearchText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function loadSearchReplies(postId, container, toggle) {
  const snapshot = await getDocs(collection(db, "posts", postId, "replies"));
  container.innerHTML = snapshot.docs.map((replyDocument) => {
    const reply = replyDocument.data();
    return `<div class="post-reply"><strong>${escapeSearchText(reply.username || reply.userEmail || "User")}</strong><span>@${escapeSearchText(reply.handle || "user")}</span><p>${escapeSearchText(reply.text)}</p></div>`;
  }).join("");
  toggle.hidden = snapshot.empty;
  toggle.innerHTML = `<i class="fa-solid fa-chevron-${container.hidden ? "down" : "up"}" aria-hidden="true"></i> ${container.hidden ? "Show" : "Hide"} replies (${snapshot.size})`;
}

async function saveSearchReaction(post, searchedPost, reaction) {
  await auth.authStateReady();
  const currentUser = auth.currentUser;
  if (!currentUser) return window.alert("Please log in before reacting.");

  const userReference = doc(db, "users", currentUser.uid);
  const userSnapshot = await getDoc(userReference);
  const user = userSnapshot.exists() ? userSnapshot.data() : {};
  const likedPosts = new Set(user.likedPosts || []);
  const dislikedPosts = new Set(user.dislikedPosts || []);
  const wasLiked = likedPosts.has(post.id);
  const wasDisliked = dislikedPosts.has(post.id);
  const isLiked = reaction === "like" ? !wasLiked : false;
  const isDisliked = reaction === "dislike" ? !wasDisliked : false;

  if (isLiked) likedPosts.add(post.id); else likedPosts.delete(post.id);
  if (isDisliked) dislikedPosts.add(post.id); else dislikedPosts.delete(post.id);
  const batch = writeBatch(db);
  batch.update(userReference, {
    likedPosts: [...likedPosts],
    dislikedPosts: [...dislikedPosts],
  });
  batch.update(doc(db, "posts", post.id), {
    likeCount: increment(Number(isLiked) - Number(wasLiked)),
    dislikeCount: increment(Number(isDisliked) - Number(wasDisliked)),
  });
  await batch.commit();

  post.likeCount = Math.max(0, (Number(post.likeCount) || 0) + Number(isLiked) - Number(wasLiked));
  post.dislikeCount = Math.max(0, (Number(post.dislikeCount) || 0) + Number(isDisliked) - Number(wasDisliked));
  searchedPost.querySelector(".like-button").innerHTML = `<i class="fa-${isLiked ? "solid" : "regular"} fa-thumbs-up"></i> ${post.likeCount}`;
  searchedPost.querySelector(".dislike-button").innerHTML = `<i class="fa-${isDisliked ? "solid" : "regular"} fa-thumbs-down"></i> ${post.dislikeCount}`;
}

// Show or hide the clear button as the user types.
searchInput?.addEventListener("input", () => {
  searchClear.hidden = !searchInput.value;
  const selectedTab = document.querySelector(".search-tab.is-active")?.textContent.trim().toLowerCase();
  const searchResults = document.getElementById("search-results");

  if (selectedTab === "people") {
    if (searchInput.value.trim() === "") {
      searchResults.classList.add("search-results");
      searchResults.innerHTML = `
        <i class="fa-solid fa-compass" aria-hidden="true"></i>
        <strong>Start searching</strong>
        <span>Your results will appear here.</span>
      `;
      return;
    }

    const searchedPeople = usersList.filter((user) =>
      [user.username, user.handle, user.email]
        .some((value) => String(value ?? "").toLowerCase().includes(searchInput.value.trim().toLowerCase())),
    );

    if (searchInput.value.trim() !== "" && searchedPeople.length !== 0) {
      searchResults.replaceChildren();
      searchResults.classList.remove("search-results");
      searchedPeople.forEach((person) => {
        const searchedPerson = document.createElement("article");
        searchedPerson.classList.add("post");
        searchedPerson.innerHTML = `
          <header class="post-header">
            <strong>${escapeSearchText(person.username || "User")} 
            ${person.handle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" aria-label="Owner" title="Owner"></i>' : ""}
            ${person.handle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" aria-label="Developer" title="Developer"></i>' : ""} ·
            </strong>
            <span>@${escapeSearchText(person.handle || "user")}</span>
          </header>
          <div class="leaderboard-stats">
            <span><i class="fa-solid fa-eye"></i> ${person.totalViews} views</span>
            <span><i class="fa-solid fa-thumbs-up"></i> ${person.totalLikes} likes</span>
            <span><i class="fa-solid fa-thumbs-down"></i> ${person.totalDislikes} dislikes</span>
          </div>
        `;
        searchResults.append(searchedPerson);
      });
    } else if (searchedPeople.length === 0) {
      searchResults.innerHTML = ``;
      searchResults.classList.add("search-results");
      searchResults.innerHTML = `
        <i class="fa-solid fa-compass" aria-hidden="true"></i>
        <strong>No search results</strong>
        <span>Your search does not match any users</span>
      `;
    } else {
      searchResults.innerHTML = ``;
      searchResults.classList.add("search-results");
      searchResults.innerHTML = `
        <i class="fa-solid fa-compass" aria-hidden="true"></i>
        <strong>Start searching</strong>
        <span>Your results will appear here.</span>
      `;
    }
    return;
  }

  const searchedPosts = searchAndSort(searchInput.value);
  if (searchInput.value !== "" && searchedPosts.length !== 0) {
    searchResults.replaceChildren();
    searchResults.classList.remove("search-results");
    searchedPosts.forEach((post) => {
      const searchedPost = document.createElement("article");
      searchedPost.classList.add("post");
      const currentUser = auth?.currentUser;
      const currentProfile = usersList.find((user) => user.uid === currentUser?.uid) || {};
      const isLiked = currentProfile.likedPosts?.includes(post.id) === true;
      const isDisliked = currentProfile.dislikedPosts?.includes(post.id) === true;
      searchedPost.innerHTML = `
        <header class="post-header">
          <strong>${escapeSearchText(post.username || post.userEmail || "Unknown user")}
          ${post.handle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" aria-label="Owner" title="Owner"></i>' : ""}
          ${post.handle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" aria-label="Developer" title="Developer"></i>' : ""} ·
          </strong>
        <span>@${escapeSearchText(post.handle || "user")} · ${formatSearchTime(post.createdAt)}</span>
        </header>
        <p class="post-content">${escapeSearchText(post.text)}</p>
        <footer class="post-actions">
          <button class="reply-button" type="button" aria-expanded="false"><i class="fa-solid fa-reply"></i> Reply</button>
          <button class="dislike-button" type="button" aria-pressed="${isDisliked}"><i class="fa-${isDisliked ? "solid" : "regular"} fa-thumbs-down"></i> ${post.dislikeCount || 0}</button>
          <button class="like-button" type="button" aria-pressed="${isLiked}"><i class="fa-${isLiked ? "solid" : "regular"} fa-thumbs-up"></i> ${post.likeCount || 0}</button>
          <button class="view-count" type="button"><i class="fa-regular fa-eye"></i> ${post.viewCount || 0}</button>
        </footer>
        <form class="reply-form" hidden>
          <textarea rows="2" maxlength="280" placeholder="Write a reply..." required></textarea>
          <button type="submit"><i class="fa-solid fa-paper-plane"></i> Send</button>
        </form>
        <button class="post-replies-toggle" type="button" hidden></button>
        <div class="post-replies" hidden></div>
      `;
      const replyButton = searchedPost.querySelector(".reply-button");
      const replyForm = searchedPost.querySelector(".reply-form");
      const repliesToggle = searchedPost.querySelector(".post-replies-toggle");
      const repliesContainer = searchedPost.querySelector(".post-replies");

      replyButton.addEventListener("click", () => {
        replyForm.hidden = !replyForm.hidden;
        replyButton.setAttribute("aria-expanded", String(!replyForm.hidden));
      });
      replyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await auth.authStateReady();
        if (!auth.currentUser) return window.alert("Please log in before replying.");
        const textarea = replyForm.querySelector("textarea");
        const text = textarea.value.trim();
        if (!text) return;
        const profileSnapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        await addDoc(collection(db, "posts", post.id, "replies"), {
          text,
          uid: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          username: profile.username ?? auth.currentUser.displayName ?? auth.currentUser.email,
          handle: profile.handle ?? auth.currentUser.email?.split("@")[0] ?? "user",
          createdAt: serverTimestamp(),
        });
        textarea.value = "";
        await loadSearchReplies(post.id, repliesContainer, repliesToggle);
        repliesContainer.hidden = false;
      });
      repliesToggle.addEventListener("click", async () => {
        repliesContainer.hidden = !repliesContainer.hidden;
        if (!repliesContainer.hidden) await loadSearchReplies(post.id, repliesContainer, repliesToggle);
      });
      void loadSearchReplies(post.id, repliesContainer, repliesToggle).catch((error) => {
        console.error("Unable to load search replies:", error);
      });
      searchedPost.querySelector(".like-button").addEventListener("click", () => {
        saveSearchReaction(post, searchedPost, "like").catch(console.error);
      });
      searchedPost.querySelector(".dislike-button").addEventListener("click", () => {
        saveSearchReaction(post, searchedPost, "dislike").catch(console.error);
      });
      searchResults.append(searchedPost);
    });

  } else if (searchedPosts.length === 0) {
    searchResults.innerHTML = ``;
    searchResults.classList.add("search-results");
    searchResults.innerHTML = `
      <i class="fa-solid fa-compass" aria-hidden="true"></i>
      <strong>No search results</strong>
      <span>Your search does not match any posts</span>
    `;
  } else {
    searchResults.innerHTML = ``;
    searchResults.classList.add("search-results");
    searchResults.innerHTML = `
      <i class="fa-solid fa-compass" aria-hidden="true"></i>
      <strong>Start searching</strong>
      <span>Your results will appear here.</span>
    `;
  }
});

// Clear the current query and return focus to the input.
searchClear?.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.hidden = true;
  searchInput.focus();
});

// Prevent a page reload until result-searching logic is added.
searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchInput.focus();
});

// Keep one search category visually selected at a time.
searchTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    searchTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    searchInput.value = "";
    searchClear.hidden = true;
    searchInput?.dispatchEvent(new Event("input"));
  });
});
