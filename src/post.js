/*import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

const exampleSentence = "I like dogs.";
const topics = ["Animals", "Food", "Drinks", "Sports", "Technology", "Nature", "Travel", "Music"];

const classifier = await pipeline(
  "zero-shot-classification",
  "Xenova/nli-deberta-v3-xsmall",
  { dtype: "q8" },
);

const classification = await classifier(exampleSentence, topics);
console.log("Topic:", classification.labels[0]);
console.log("Confidence:", classification.scores[0]);8*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
const db = getFirestore(app);
const analytics = getAnalytics(app);

const postButton = document.getElementById("post-button");
const postContainer = document.querySelector(".post-container");

postButton.addEventListener("click", async (event) => {
  event.preventDefault();

  if(postContainer.value.trim() === "") {
    console.log("Post container is empty. Please write something before posting.");
  } else {
    console.log(postContainer.value);
    await addDoc(collection(db, "posts"), {
      text: postContainer.value.trim(),
      createdAt: serverTimestamp(),
    });
     
    postContainer.value = ""; // Clear the textarea after posting
  }

})
