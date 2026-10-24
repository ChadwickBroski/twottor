export const TOPICS = [
  "Entertainment", "Sports", "Politics", "Technology", "Health", "Science",
  "Business", "Travel", "Food", "Education", "Animals", "Environment", "Fashion",
  "Art", "History", "Music", "Movies", "Books", "Gaming", "Lifestyle",
  "Programming", "Web Development", "Software Engineering", "Artificial Intelligence",
  "Data Science", "Cybersecurity", "Mobile Development", "Databases", "Open Source",
  "Startups", "Finance", "Economics", "Investing", "Cryptocurrency", "News",
  "Fitness", "Psychology", "Nature", "Pets", "Photography", "Design", "Space",
];

let classifierWorker;
let nextRequestId = 0;
const pendingRequests = new Map();

function getClassifierWorker() {
  if (classifierWorker) return classifierWorker;
  classifierWorker = new Worker(new URL("./classifier-worker.js", import.meta.url), { type: "module" });
  classifierWorker.addEventListener("message", ({ data }) => {
    const request = pendingRequests.get(data.id);
    if (!request) return;
    pendingRequests.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data.topicScores);
  });
  classifierWorker.addEventListener("error", (error) => {
    pendingRequests.forEach(({ reject }) => reject(error.error ?? new Error(error.message)));
    pendingRequests.clear();
    classifierWorker = undefined;
  });
  return classifierWorker;
}

export async function classifyTopics(text) {
  const id = nextRequestId += 1;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    getClassifierWorker().postMessage({ id, text, topics: TOPICS });
  });
}

