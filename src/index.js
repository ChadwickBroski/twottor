import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { notification } from "./notification.js";
import {
  collection,
  getDocs,
  deleteDoc,
  getDoc,
  doc,
  getFirestore,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  deleteUser,
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
const navLinks = [...document.querySelectorAll(".nav-links .nav-link")];
const homeView = document.getElementById("home-view");
const darkMode = localStorage.getItem("darkMode") === "enabled";

const settings = document.getElementById("mobile-settings-button");
const settingsModal = document.getElementById("modal");
const settingsDialog = settingsModal.querySelector(".modal-content");
const closeSettingsButton = document.getElementById("close-modal");
const themeSettingButton = document.getElementById("theme-setting");
const logoutButton = document.getElementById("account-logout");
const deleteAccountButton = document.getElementById("account-delete");
const profileButton = document.getElementById("profileButton");
const accountButton = document.querySelector(".nav-link.user");
const profileMenu = document.getElementById("profile-menu");
const mobileSettingsButton = document.getElementById("mobile-settings-button");
const mobileLogoutButton = document.getElementById("mobile-logout-button");

const version = "1.5.2.0";
const desktopVersion = document.getElementById("desktop-version");
const settingsVersion = document.getElementById("settings-version");

desktopVersion.innerHTML = version;
settingsVersion.innerHTML = version;

function updateNavigation() {
  const currentView = window.location.hash || "#home";
  const isUserProfilePath = /^\/(?:twottor\/)?user\/[^/]+\/?$/.test(window.location.pathname)
    || Boolean(new URLSearchParams(window.location.search).get("user"));
  const isHome = currentView === "#home" && !isUserProfilePath;
  const searchView = document.getElementById("search-view");
  const isSearch = currentView === "#search";
  const trendingView = document.getElementById("trending-view");
  const isTrending = currentView === "#trending";
  const leaderboardView = document.getElementById("leaderboard-view");
  const isLeaderboard = currentView === "#leaderboard";
  const macaqueView = document.getElementById("macaque-view");
  const isMacaque = currentView === "#macaque";
  const profileView = document.getElementById("profile-view");
  const isProfile =
    isUserProfilePath ||
    window.location.hash === "#profile";

  profileView.hidden = !isProfile;

  homeView.hidden = !isHome;
  searchView.hidden = !isSearch;
  trendingView.hidden = !isTrending;
  leaderboardView.hidden = !isLeaderboard
  macaqueView.hidden = !isMacaque;
  profileView.hidden = !isProfile;
  navLinks.forEach((link) => {
    const isActive = link.hash === currentView;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

window.addEventListener("hashchange", updateNavigation);
updateNavigation();

function updateThemeSetting() {
  const isDarkMode = document.body.classList.contains("dark-mode");
  themeSettingButton.setAttribute("aria-pressed", String(isDarkMode));
  themeSettingButton.setAttribute(
    "aria-label",
    isDarkMode ? "Dark mode on. Turn off dark mode" : "Dark mode off. Turn on dark mode",
  );
  themeSettingButton.innerHTML = isDarkMode
    ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>'
    : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
}

async function logout() {
  await signOut(auth);
  window.location.href = "login.html";
}

async function deleteAccount() {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const currentUserPosts = await getDocs(
    query(collection(db, "posts"), where("uid", "==", currentUser.uid)),
  );
  await Promise.all(
    currentUserPosts.docs.map((post) => deleteDoc(post.ref)),
  );
  const userProfile = await getDoc(doc(db, "users", currentUser.uid));
  const handle = userProfile.data()?.handle?.trim();
  const accountDocuments = [deleteDoc(doc(db, "users", currentUser.uid))];
  if (handle) {
    accountDocuments.push(deleteDoc(doc(db, "handles", handle)));
  }
  await Promise.all(accountDocuments);
  await deleteUser(auth.currentUser);
  await logout();
  window.location.href = "login.html";
}

function openSettings() {
  settingsModal.setAttribute("aria-hidden", "false");
  settingsDialog.focus();
}

function closeSettings() {
  settingsModal.setAttribute("aria-hidden", "true");
  settings.focus();
}

const usernameSpan = document.getElementById("usernameSpan");
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  if (usernameSpan) {
    usernameSpan.textContent = user.email ?? "";
  }

});

function toggleDarkMode() {
  const darkModeEnabled = document.body.classList.toggle("dark-mode");
  document.documentElement.classList.toggle("dark-mode", darkModeEnabled);
  localStorage.setItem("darkMode", darkModeEnabled ? "enabled" : "disabled");
  toggle.style.backgroundColor = darkModeEnabled ? "#15202B" : "#ffffff";
  toggle.style.borderColor = darkModeEnabled ? "#38444D" : "#e1e8ed";

  settings.style.borderColor = darkModeEnabled ? "#38444D" : "#e1e8ed";
  updateThemeSetting();
}

if (darkMode) {
  toggleDarkMode();
}

if (window.matchMedia("(max-width: 640px)").matches) {
  const navLinks = document.getElementById("nav-links");
  const homeButton = document.getElementById("homeButton");
  const searchButton = document.getElementById("searchButton");
  const trendingButton = document.getElementById("trendingButton");
  const leaderboardButton = document.getElementById("leaderboardButton");
  const macaqueButton = document.getElementById("macaqueButton");

  homeButton.innerHTML = `<i class="fa-solid fa-house"></i>`;
  searchButton.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;
  trendingButton.innerHTML = `<i class="fa-solid fa-fire"></i>`;
  leaderboardButton.innerHTML = `<i class="fa-solid fa-ranking-star"></i>`;
  macaqueButton.innerHTML = `<i class="fa-brands fa-openai"></i>`
  profileButton.innerHTML = `<i class="fa-solid fa-user"></i>`;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function closeProfileMenu() {
  profileMenu.classList.remove("is-open");
  profileButton.setAttribute("aria-expanded", "false");
  accountButton.setAttribute("aria-expanded", "false");
}

profileButton.setAttribute("aria-haspopup", "menu");
profileButton.setAttribute("aria-expanded", "false");
accountButton.setAttribute("aria-haspopup", "menu");
accountButton.setAttribute("aria-expanded", "false");
profileButton.addEventListener("click", (event) => {
  if (!isMobileLayout()) return;

  event.preventDefault();
  const isOpen = profileMenu.classList.toggle("is-open");
  profileButton.setAttribute("aria-expanded", String(isOpen));
  accountButton.setAttribute("aria-expanded", String(isOpen));
});

accountButton.addEventListener("click", (event) => {
  if (isMobileLayout()) return;

  event.preventDefault();
  const isOpen = profileMenu.classList.toggle("is-open");
  profileButton.setAttribute("aria-expanded", String(isOpen));
  accountButton.setAttribute("aria-expanded", String(isOpen));
});

mobileSettingsButton.addEventListener("click", () => {
  closeProfileMenu();
  openSettings();
});

mobileLogoutButton.addEventListener("click", async () => {
  closeProfileMenu();
  await logout();
});

profileMenu.querySelectorAll(".profile-menu-item").forEach((item) => {
  if (item === mobileSettingsButton || item === mobileLogoutButton) return;
  item.addEventListener("click", closeProfileMenu);
});

document.addEventListener("click", (event) => {
  if (isMobileLayout() && !profileMenu.contains(event.target) && !profileButton.contains(event.target)) {
    closeProfileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeProfileMenu();
});

toggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("collapsed");
  const version = document.getElementById("version");
  version.style.display = collapsed ? "none" : "block";

  document.body.classList.toggle("sidebar-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
});

// Settings and dark mode event listeners
settings.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal.getAttribute("aria-hidden") === "false") {
    closeSettings();
  }
});
themeSettingButton.addEventListener("click", () => {
  toggleDarkMode();
  notification(
    document.body.classList.contains("dark-mode")
      ? "Dark Mode Selected"
      : "Light Mode Selected",
  );
});
logoutButton.addEventListener("click", async () => {
  logoutButton.classList.add("loader");
  logoutButton.setAttribute("aria-busy", "true");
  try {
    await logout();
  } finally {
    logoutButton.classList.remove("loader");
    logoutButton.removeAttribute("aria-busy");
  }
});
deleteAccountButton.addEventListener("click", async () => {
  deleteAccountButton.classList.add("loader");
  deleteAccountButton.setAttribute("aria-busy", "true");
  try {
    await deleteAccount(auth.currentUser);
    await signOut(auth);
    window.location.href = "login.html";
  } finally {
    deleteAccountButton.classList.remove("loader");
    deleteAccountButton.removeAttribute("aria-busy");
  }
});
updateThemeSetting();
