const updatelogView = document.getElementById("updatelog-view");
const repository = "ChadwickBroski/twottor";
let updateLogLoaded = false;
let updateLogRequest;

function escapeUpdateText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function loadUpdateLog() {
  if (updateLogLoaded) return;
  if (updateLogRequest) return updateLogRequest;

  updateLogRequest = (async () => {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/commits?per_page=100`,
    );
    const commitsPayload = await response.json();

    if (!response.ok || !Array.isArray(commitsPayload)) {
      const errorMessage = commitsPayload?.message || `GitHub request failed (${response.status})`;
      updatelogView.innerHTML = `
        <h1><i class="fa-solid fa-newspaper"></i> Update log</h1>
        <p class="update-log-error">API rate limit has been exceeded. Each request will be authenticated soon.</p>
      `;
      throw new Error(errorMessage);
    }

    const commitsWithStats = await Promise.all(
      commitsPayload.map(async (commit) => {
        if (!commit.url) return commit;
        try {
          const detailResponse = await fetch(commit.url);
          if (!detailResponse.ok) return commit;
          const details = await detailResponse.json();
          return { ...commit, stats: details.stats };
        } catch {
          return commit;
        }
      }),
    );

    updatelogView.innerHTML = `
      <h1><i class="fa-solid fa-newspaper"></i> Update log</h1>
      <hr>
    `;

    commitsWithStats.forEach((element) => {
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
      const additions = Number(element.stats?.additions) || 0;
      const deletions = Number(element.stats?.deletions) || 0;

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
        <div class="update-entry-stats">
          <span class="update-entry-additions">+${additions} added</span>
          <span class="update-entry-deletions">-${deletions} deleted</span>
        </div>
      `;

      updatelogView.appendChild(commit);
    });

    updateLogLoaded = true;
  })();

  try {
    await updateLogRequest;
  } finally {
    updateLogRequest = undefined;
  }
}

function loadUpdateLogForCurrentView() {
  if (window.location.hash === "#updatelog") {
    void loadUpdateLog().catch((error) => console.error("Unable to load update log:", error));
  }
}

window.addEventListener("hashchange", loadUpdateLogForCurrentView);
loadUpdateLogForCurrentView();
