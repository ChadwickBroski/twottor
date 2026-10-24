import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
	addDoc,
	collection,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	query,
	orderBy,
	increment,
	serverTimestamp,
	writeBatch,
	where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

await auth.authStateReady();
const authenticatedUser = auth.currentUser;
let currentUser = {};
let recentPosts = [];
const likedPostIds = new Set();
const dislikedPostIds = new Set();
let reactionProfileData = {};

const pathParts = window.location.pathname.split("/").filter(Boolean);
const userPathIndex = pathParts.indexOf("user");
const profileHandle = new URLSearchParams(window.location.search).get("user")
	|| (userPathIndex !== -1
	? decodeURIComponent(pathParts[userPathIndex + 1] || "")
	: "");

if (profileHandle) {
	const userSnapshot = await getDocs(
		query(collection(db, "users"), where("handle", "==", profileHandle)),
	);
	if (!userSnapshot.empty) {
		const userDocument = userSnapshot.docs[0];
		currentUser = { uid: userDocument.id, ...userDocument.data() };
		const postsSnapshot = await getDocs(
			query(collection(db, "posts"), where("uid", "==", currentUser.uid)),
		);
		recentPosts = postsSnapshot.docs
			.map((postDocument) => ({ id: postDocument.id, ...postDocument.data() }))
			.sort((firstPost, secondPost) => getPostTimestamp(secondPost.createdAt) - getPostTimestamp(firstPost.createdAt))
			.slice(0, 5);
	}
} else if (authenticatedUser) {
	const userDocument = await getDoc(doc(db, "users", authenticatedUser.uid));
	currentUser = userDocument.exists() ? userDocument.data() : {};
	const postsSnapshot = await getDocs(
		query(collection(db, "posts"), where("uid", "==", authenticatedUser.uid)),
	);
	recentPosts = postsSnapshot.docs
		.map((postDocument) => ({ id: postDocument.id, ...postDocument.data() }))
		.sort((firstPost, secondPost) => getPostTimestamp(secondPost.createdAt) - getPostTimestamp(firstPost.createdAt))
		.slice(0, 5);
}

if (authenticatedUser) {
	const reactionProfileSnapshot = await getDoc(doc(db, "users", authenticatedUser.uid));
	reactionProfileData = reactionProfileSnapshot.exists() ? reactionProfileSnapshot.data() : {};
	(reactionProfileData.likedPosts ?? []).forEach((postId) => likedPostIds.add(postId));
	(reactionProfileData.dislikedPosts ?? []).forEach((postId) => dislikedPostIds.add(postId));
}

if (profileHandle && !currentUser.uid) {
	document.getElementById("profile-view").innerHTML = "<h2>User not found</h2>";
	throw new Error("Profile user was not found");
}

function getPostTimestamp(value) {
	if (value?.toDate instanceof Function) return value.toDate().getTime();
	if (typeof value?.seconds === "number") return value.seconds * 1000;
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function escapeProfileText(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	})[character]);
}

function formatPostAge(value) {
	const seconds = Math.max(0, (Date.now() - getPostTimestamp(value)) / 1000);
	if (seconds < 60) return `${Math.floor(seconds)} seconds ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
	return `${Math.floor(seconds / 86400)} days ago`;
}

const profileVIew = document.getElementById("profile-view");

const createdDate = currentUser.createdAt?.toDate instanceof Function
	? currentUser.createdAt.toDate()
	: new Date(currentUser.createdAt || Date.now());

profileVIew.innerHTML = `
	<div class="profile-shell">
		<section class="profile-header">
			<div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
			<div class="profile-identity">
				<h1>${escapeProfileText(currentUser.username)} 
				${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" style="font-size:18px;" aria-label="Owner" title="Owner"></i>' : ""}
        ${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" style="font-size:18px;" aria-label="Developer" title="Developer"></i>' : ""} · 
				<span class="profile-handle">@${escapeProfileText(currentUser.handle)}</span>
				</h1>
				<p class="profile-joined"><i class="fa-solid fa-calendar"></i>  Joined ${createdDate.toLocaleDateString()}</p>
			</div>
		</section>
		<section class="profile-stats" aria-label="Profile statistics">
			<div class="profile-stat"><i class="fa-solid fa-eye"></i><strong>${currentUser.totalViews ?? 0}</strong><span>Views</span></div>
			<div class="profile-stat"><i class="fa-solid fa-thumbs-up"></i><strong>${currentUser.totalLikes ?? 0}</strong><span>Likes</span></div>
			<div class="profile-stat"><i class="fa-solid fa-thumbs-down"></i><strong>${currentUser.totalDislikes ?? 0}</strong><span>Dislikes</span></div>
		</section>
		<section class="profile-recent">
			<h2>Recent posts</h2>
			<div class="profile-posts">
				${recentPosts.length ? recentPosts.map((post) => `
					<article class="post" data-post-id="${escapeProfileText(post.id)}">
						<header class="post-header">
							<strong>${escapeProfileText(currentUser.username)}
							${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" aria-label="Owner" title="Owner"></i>' : ""}
       				${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" aria-label="Developer" title="Developer"></i>' : ""} · 
							</strong>
							<span>@${escapeProfileText(currentUser.handle)} · ${formatPostAge(post.createdAt)}</span>
						</header>
						<p class="post-content">${escapeProfileText(post.text)}</p>
						<footer class="post-actions">
							<button class="profile-reply-button" type="button" aria-expanded="false"><i class="fa-solid fa-reply"></i> Reply</button>
							<button class="profile-dislike-button" type="button" aria-pressed="${dislikedPostIds.has(post.id)}" ${authenticatedUser ? "" : "disabled"}><i class="fa-${dislikedPostIds.has(post.id) ? "solid" : "regular"} fa-thumbs-down"></i> ${Number.isSafeInteger(post.dislikeCount) ? post.dislikeCount : 0}</button>
							<button class="profile-like-button" type="button" aria-pressed="${likedPostIds.has(post.id)}" ${authenticatedUser ? "" : "disabled"}><i class="fa-${likedPostIds.has(post.id) ? "solid" : "regular"} fa-thumbs-up"></i> ${Number.isSafeInteger(post.likeCount) ? post.likeCount : 0}</button>
							<button type="button"><i class="fa-regular fa-eye"></i> ${Number.isSafeInteger(post.viewCount) ? post.viewCount : 0}</button>
						</footer>
						<form class="reply-form" hidden>
							<textarea rows="2" maxlength="280" placeholder="Write a reply..." required></textarea>
							<button type="submit"><i class="fa-solid fa-paper-plane"></i> Send</button>
						</form>
		<button class="post-replies-toggle" type="button" hidden></button>
		<div class="post-replies" hidden></div>
					</article>
				`).join("") : '<p class="profile-empty">No posts yet.</p>'}
			</div>
		</section>
	</div>
`;

function renderProfileReaction(postElement, isLiked, isDisliked, likeCount, dislikeCount) {
	const likeButton = postElement.querySelector(".profile-like-button");
	const dislikeButton = postElement.querySelector(".profile-dislike-button");
	likeButton.setAttribute("aria-pressed", String(isLiked));
	likeButton.innerHTML = `<i class="fa-${isLiked ? "solid" : "regular"} fa-thumbs-up"></i> ${likeCount}`;
	dislikeButton.setAttribute("aria-pressed", String(isDisliked));
	dislikeButton.innerHTML = `<i class="fa-${isDisliked ? "solid" : "regular"} fa-thumbs-down"></i> ${dislikeCount}`;
}

async function saveProfileReaction(post, isLiked, isDisliked) {
	const batch = writeBatch(db);
	const userReference = doc(db, "users", authenticatedUser.uid);
	const previousLiked = Array.isArray(reactionProfileData.likedPosts) && reactionProfileData.likedPosts.includes(post.id);
	const previousDisliked = Array.isArray(reactionProfileData.dislikedPosts) && reactionProfileData.dislikedPosts.includes(post.id);
	const likeDelta = Number(isLiked) - Number(previousLiked);
	const dislikeDelta = Number(isDisliked) - Number(previousDisliked);
	const userUpdates = {
		likedPosts: [...likedPostIds],
		dislikedPosts: [...dislikedPostIds],
	};
	if (post.uid === authenticatedUser.uid) {
		if (likeDelta) userUpdates.totalLikes = increment(likeDelta);
		if (dislikeDelta) userUpdates.totalDislikes = increment(dislikeDelta);
		batch.update(userReference, userUpdates);
	} else {
		batch.update(userReference, userUpdates);
		const authorUpdates = {};
		if (likeDelta) authorUpdates.totalLikes = increment(likeDelta);
		if (dislikeDelta) authorUpdates.totalDislikes = increment(dislikeDelta);
		if (Object.keys(authorUpdates).length) batch.update(doc(db, "users", post.uid), authorUpdates);
	}
	const postUpdates = {};
	if (likeDelta) postUpdates.likeCount = increment(likeDelta);
	if (dislikeDelta) postUpdates.dislikeCount = increment(dislikeDelta);
	if (Object.keys(postUpdates).length) batch.update(doc(db, "posts", post.id), postUpdates);
	await batch.commit();
	reactionProfileData.likedPosts = [...likedPostIds];
	reactionProfileData.dislikedPosts = [...dislikedPostIds];
}

profileVIew.querySelectorAll(".profile-like-button, .profile-dislike-button").forEach((reactionButton) => {
	reactionButton.addEventListener("click", async () => {
		if (!authenticatedUser) return;
		const postElement = reactionButton.closest(".post");
		const post = recentPosts.find((candidate) => candidate.id === postElement.dataset.postId);
		if (!post) return;
		const previousLiked = likedPostIds.has(post.id);
		const previousDisliked = dislikedPostIds.has(post.id);
		const isLikeAction = reactionButton.classList.contains("profile-like-button");
		const isLiked = isLikeAction ? !previousLiked : false;
		const isDisliked = isLikeAction ? false : !previousDisliked;
		const likeCount = Math.max(0, (Number(post.likeCount) || 0) + Number(isLiked) - Number(previousLiked));
		const dislikeCount = Math.max(0, (Number(post.dislikeCount) || 0) + Number(isDisliked) - Number(previousDisliked));
		if (isLiked) likedPostIds.add(post.id); else likedPostIds.delete(post.id);
		if (isDisliked) dislikedPostIds.add(post.id); else dislikedPostIds.delete(post.id);
		postElement.querySelector(".profile-like-button").disabled = true;
		postElement.querySelector(".profile-dislike-button").disabled = true;
		renderProfileReaction(postElement, isLiked, isDisliked, likeCount, dislikeCount);
		try {
			await saveProfileReaction(post, isLiked, isDisliked);
			post.likeCount = likeCount;
			post.dislikeCount = dislikeCount;
		} catch (error) {
			if (previousLiked) likedPostIds.add(post.id); else likedPostIds.delete(post.id);
			if (previousDisliked) dislikedPostIds.add(post.id); else dislikedPostIds.delete(post.id);
			renderProfileReaction(postElement, previousLiked, previousDisliked, Number(post.likeCount) || 0, Number(post.dislikeCount) || 0);
			console.error("Unable to save profile reaction:", error);
		} finally {
			postElement.querySelector(".profile-like-button").disabled = false;
			postElement.querySelector(".profile-dislike-button").disabled = false;
		}
	});
});

profileVIew.querySelectorAll(".profile-reply-button").forEach((replyButton) => {
	const replyForm = replyButton.closest(".post").querySelector(".reply-form");
	const replyInput = replyForm.querySelector("textarea");
	replyButton.addEventListener("click", () => {
		const isOpen = !replyForm.hidden;
		replyForm.hidden = isOpen;
		replyButton.setAttribute("aria-expanded", String(!isOpen));
		if (!isOpen) replyInput.focus();
	});
	replyForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!authenticatedUser) return;
		const text = replyInput.value.trim();
		if (!text) return;
		const submitButton = replyForm.querySelector("button[type=submit]");
		submitButton.disabled = true;
		try {
			const profileSnapshot = await getDoc(doc(db, "users", authenticatedUser.uid));
			const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
			const postId = replyButton.closest(".post").dataset.postId;
			await addDoc(collection(db, "posts", postId, "replies"), {
				uid: authenticatedUser.uid,
				userEmail: authenticatedUser.email,
				username: profile.username ?? authenticatedUser.displayName ?? authenticatedUser.email,
				handle: profile.handle ?? authenticatedUser.email?.split("@")[0] ?? "user",
				text,
				createdAt: serverTimestamp(),
			});
			replyInput.value = "";
			replyForm.hidden = true;
		} finally {
			submitButton.disabled = false;
		}
	});
});

await Promise.all([...profileVIew.querySelectorAll(".post")].map(async (postElement) => {
	const repliesContainer = postElement.querySelector(".post-replies");
	const repliesToggle = postElement.querySelector(".post-replies-toggle");
	const repliesSnapshot = await getDocs(
		query(collection(db, "posts", postElement.dataset.postId, "replies"), orderBy("createdAt", "asc")),
	);
	if (repliesSnapshot.empty) return;

	repliesContainer.innerHTML = repliesSnapshot.docs.map((replyDocument) => {
		const reply = replyDocument.data();
		return `<div class="post-reply">
			<strong>${escapeProfileText(reply.username || reply.userEmail || "User")}</strong>
			<span>· @${escapeProfileText(reply.handle || "user")} · ${formatPostAge(reply.createdAt)}</span>
			<p>${escapeProfileText(reply.text)}</p>
		</div>`;
	}).join("");
	repliesToggle.hidden = false;
	repliesToggle.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Show replies (${repliesSnapshot.size})`;
	repliesToggle.addEventListener("click", () => {
		repliesContainer.hidden = !repliesContainer.hidden;
		repliesToggle.innerHTML = repliesContainer.hidden
			? `<i class="fa-solid fa-chevron-down"></i> Show replies (${repliesSnapshot.size})`
			: `<i class="fa-solid fa-chevron-up"></i> Hide replies`;
	});
}));
