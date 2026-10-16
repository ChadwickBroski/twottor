import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	query,
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
if (authenticatedUser) {
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

const createdDate = new Date(
  (currentUser.createdAt.seconds + currentUser.createdAt.nanoseconds / 1e9) * 1000
);

const profileVIew = document.getElementById("profile-view");
profileVIew.innerHTML = `
	<div class="profile-shell">
		<section class="profile-header">
			<div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
			<div class="profile-identity">
				<h1>${escapeProfileText(currentUser.username)}  
				${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-user-tie" aria-label="Owner" style="font-size: 18px;background-color:#1E2933; padding: 8px; cursor:pointer; color: #1A96E4;  border-radius: 999px;" title="Owner"></i>' : ""}
        ${currentUser.handle === "abhay" ? ' <i class="fa-solid fa-code" aria-label="Developer" style="font-size: 18px;background-color:#1E2933; padding: 8px; cursor:pointer; color: #1A96E4;  border-radius: 999px;" title="Developer"></i>' : ""}
				</h1>
				<p class="profile-handle">@${escapeProfileText(currentUser.handle)}</p>
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
					<article class="post">
						<header class="post-header">
							<strong>${escapeProfileText(currentUser.username)}</strong>
							<span>@${escapeProfileText(currentUser.handle)} · ${formatPostAge(post.createdAt)}</span>
						</header>
						<p class="post-content">${escapeProfileText(post.text)}</p>
						<footer class="profile-post-actions">
							<span><i class="fa-regular fa-thumbs-up"></i> ${Number.isSafeInteger(post.likeCount) ? post.likeCount : 0}</span>
							<span><i class="fa-regular fa-eye"></i> ${Number.isSafeInteger(post.viewCount) ? post.viewCount : 0}</span>
						</footer>
					</article>
				`).join("") : '<p class="profile-empty">No posts yet.</p>'}
			</div>
		</section>
	</div>
`;
