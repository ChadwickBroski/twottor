import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

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
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

const sidebar = document.querySelector(".sidebar");
const toggle = document.querySelector(".sidebar-toggle");
const lightdarkToggle = document.querySelector(".lightdark-toggle");
const darkMode = localStorage.getItem("darkMode") === "enabled";

const settings = document.querySelector(".settings");

const usernameSpan = document.getElementById("usernameSpan");
onAuthStateChanged(auth, (user) => {
  if (usernameSpan) {
    usernameSpan.textContent = user?.email ?? "Not logged in";
  }
});

function toggleDarkMode() {
  const darkModeEnabled = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", darkModeEnabled ? "enabled" : "disabled");
  const icon = lightdarkToggle.querySelector("i");
  const body = document.getElementById("body");

  body.style.background = darkModeEnabled
    ? "linear-gradient(135deg, #15202B 0%, #38444D 100%)"
    : "linear-gradient(135deg, #f7f9fa 0%, #e8f5fe 100%)";
  lightdarkToggle.setAttribute("aria-pressed", String(darkModeEnabled));
  lightdarkToggle.setAttribute(
    "aria-label",
    darkModeEnabled ? "Disable dark mode" : "Enable dark mode",
  );
  lightdarkToggle.style.borderColor = darkModeEnabled ? "#38444D" : "#e1e8ed";
  toggle.style.backgroundColor = darkModeEnabled ? "#15202B" : "#ffffff";
  toggle.style.borderColor = darkModeEnabled ? "#38444D" : "#e1e8ed";
  icon.className = darkModeEnabled ? "fa-solid fa-sun" : "fa-solid fa-moon";

  settings.style.borderColor = darkModeEnabled ? "#38444D" : "#e1e8ed";

}

if (darkMode) {
  toggleDarkMode();
}

toggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("collapsed");
  const version = document.getElementById("version");
  version.style.display = collapsed ? "none" : "block";

  document.body.classList.toggle("sidebar-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
});

lightdarkToggle.addEventListener("click", toggleDarkMode);
