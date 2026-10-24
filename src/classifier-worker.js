import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

let classifierPromise;

async function getClassifier() {
  classifierPromise ??= pipeline(
    "zero-shot-classification",
    "Xenova/nli-deberta-v3-xsmall",
    { dtype: "q8" },
  );
  return classifierPromise;
}

self.addEventListener("message", async ({ data }) => {
  try {
    const classifier = await getClassifier();
    const classification = await classifier(data.text, data.topics, { multi_label: true });
    const topicScores = Object.fromEntries(classification.labels.map((label, index) => [
      label,
      Math.min(1, Math.max(0, Number(classification.scores[index]) || 0)),
    ]));
    self.postMessage({ id: data.id, topicScores });
  } catch (error) {
    self.postMessage({ id: data.id, error: error?.message ?? "Classifier failed" });
  }
});
