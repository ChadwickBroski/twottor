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
	serverTimestamp,
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
				<h1>${escapeProfileText(currentUser.username)} <span class="profile-handle">· @${escapeProfileText(currentUser.handle)}</span>
				${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-user-tie profile-badge" style="font-size:18px;" aria-label="Owner" title="Owner"></i>' : ""}
        ${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-code profile-badge" style="font-size:18px;" aria-label="Developer" title="Developer"></i>' : ""}
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
							<strong>${escapeProfileText(currentUser.username)}</strong>
							<span>@${escapeProfileText(currentUser.handle)} · ${formatPostAge(post.createdAt)}</span>
						</header>
						<p class="post-content">${escapeProfileText(post.text)}</p>
						<footer class="post-actions">
							<button class="profile-reply-button" type="button" aria-expanded="false"><i class="fa-solid fa-reply"></i> Reply</button>
							<button type="button"><i class="fa-regular fa-thumbs-up"></i> ${Number.isSafeInteger(post.likeCount) ? post.likeCount : 0}</button>
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
