const updatelogView = document.getElementById("updatelog-view");

const repository = "ChadwickBroski/twottor";

const response = await fetch(
  `https://api.github.com/repos/${repository}/commits?per_page=100`,
);

const commits = await response.json();

function escapeUpdateText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

updatelogView.innerHTML = `
  <h1><i class="fa-solid fa-newspaper"></i> Update log</h1>
  <hr>
`;

commits.forEach((element) => {
  const commit = document.createElement("article");
  commit.className = "post update-entry";
  const commitData = element.commit || {};
  const commitDate = commitData.author?.date ? new Date(commitData.author.date) : null;
  const formattedDate = commitDate && !Number.isNaN(commitDate.getTime())
    ? commitDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Unknown date";
  const messageLines = String(commitData.message || "No commit message").split("\n");
  const title = messageLines.shift() || "No commit message";
  const details = messageLines.join("\n").trim();
  const authorName = commitData.author?.name || element.author?.login || "Unknown author";
  const shortHash = String(element.sha || "").slice(0, 7);
  const avatarUrl = element.author?.avatar_url
    || `https://github.com/identicons/${encodeURIComponent(element.sha || authorName)}.png`;

  commit.innerHTML = `
    <header class="update-entry-header">
      <div>
        <h2>${escapeUpdateText(title)}</h2>
        ${details ? `<p>${escapeUpdateText(details)}</p>` : ""}
      </div>
      <a class="update-entry-hash" href="${escapeUpdateText(element.html_url)}" target="_blank" rel="noopener noreferrer">${escapeUpdateText(shortHash)}</a>
    </header>
    <footer class="update-entry-meta">
      <span><img class="update-entry-avatar" src="${escapeUpdateText(avatarUrl)}" alt=""> ${escapeUpdateText(authorName)}</span>
      <time datetime="${escapeUpdateText(commitData.author?.date)}"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${escapeUpdateText(formattedDate)}</time>
    </footer>
  `;

  updatelogView.appendChild(commit);
});
