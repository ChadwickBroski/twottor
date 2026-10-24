const homeView = document.getElementById("home-view");
const trendingView = document.getElementById("trending-view");
const feed = document.getElementById("feed");

function sortFeedForCurrentView() {
	const isTrending = window.location.hash === "#trending";
	if (!isTrending) return;
	const posts = [...feed.children].filter((post) => post.classList.contains("post"));
	const sortedPosts = [...posts].sort((first, second) => {
		const scoreDifference = (Number(second.dataset.displayScore) || 0)
			- (Number(first.dataset.displayScore) || 0);
		if (scoreDifference !== 0) return scoreDifference;
		return (Number(second.dataset.createdAt) || 0)
			- (Number(first.dataset.createdAt) || 0);
	});

	if (sortedPosts.some((post, index) => post !== posts[index])) {
		sortedPosts.forEach((post) => feed.append(post));
	}
}

function moveFeedToCurrentView() {
	const destination = window.location.hash === "#trending" ? trendingView : homeView;
	destination.append(feed);
	sortFeedForCurrentView();
}

const feedObserver = new MutationObserver(sortFeedForCurrentView);
feedObserver.observe(feed, {
	attributes: true,
	attributeFilter: ["data-display-score"],
	childList: true,
	subtree: true,
});

window.addEventListener("hashchange", moveFeedToCurrentView);
moveFeedToCurrentView();
