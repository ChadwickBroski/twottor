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
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signOut,
  deleteUser,
  unlink,
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
const settings = document.getElementById("mobile-settings-button");
const settingsModal = document.getElementById("modal");
const settingsDialog = settingsModal.querySelector(".modal-content");
const closeSettingsButton = document.getElementById("close-modal");
const themeSettingButton = document.getElementById("theme-setting");
const themeDropdown = document.getElementById("theme-dropdown");
const themeColorTrigger = document.getElementById("theme-color-trigger");
const themeColorLabel = document.getElementById("theme-color-label");
const themeColorMenu = document.getElementById("theme-color-menu");
const themeColorOptions = [...document.querySelectorAll("#theme-color-menu [data-theme]")];
const faviconLink = document.getElementById("favicon");
const logoutButton = document.getElementById("account-logout");
const deleteAccountButton = document.getElementById("account-delete");
const googleLinkButton = document.getElementById("google-link-button");
const googleLinkStatus = document.getElementById("google-link-status");
const googleLinkFeedback = document.getElementById("google-link-feedback");
const googleProvider = new GoogleAuthProvider();
const profileButton = document.getElementById("profileButton");
const accountButton = document.querySelector(".nav-link.user");
const profileMenu = document.getElementById("profile-menu");
const mobileSettingsButton = document.getElementById("mobile-settings-button");
const mobileLogoutButton = document.getElementById("mobile-logout-button");

const version = "1.11.0.0";
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
  const updatelogView = document.getElementById("updatelog-view");
  const isUpdatelog = currentView === "#updatelog";
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
  updatelogView.hidden = !isUpdatelog;
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

const THEMES = {
  classic: { dark: false, primary: "#1DA1F2" },
  matrix: { dark: true, primary: "#00d957" },
  fire: { dark: true, primary: "#ff5a1f" },
  "serika-dark": { dark: true, primary: "#e2b714" },
  aurora: { dark: true, primary: "#8b5cf6" },
  dracula: { dark: true, primary: "#bd93f9" },
  ocean: { dark: true, primary: "#22d3ee" },
};

let faviconSvg;

async function updateFavicon(color) {
  if (!faviconSvg) {
    faviconSvg = await fetch("assets/favicon.svg").then((response) => response.text());
  }
  const themedSvg = faviconSvg.replace(/fill="[^"]+"/, 'fill="' + color + '"');
  faviconLink.href = "data:image/svg+xml," + encodeURIComponent(themedSvg);
}

function syncThemeMode(isDarkMode) {
  document.body.classList.toggle("dark-mode", isDarkMode);
  document.documentElement.classList.toggle("dark-mode", isDarkMode);
  localStorage.setItem("darkMode", isDarkMode ? "enabled" : "disabled");
  toggle.style.backgroundColor = isDarkMode ? "var(--surface-dark)" : "#ffffff";
  toggle.style.borderColor = isDarkMode ? "var(--surface-dark-border)" : "var(--secondary-border)";
  settings.style.borderColor = isDarkMode ? "var(--surface-dark-border)" : "var(--secondary-border)";
  updateThemeSetting();
}

function applyTheme(themeName, announce = false) {
  const migratedTheme = themeName === "x" ? "serika-dark" : themeName;
  const selectedTheme = THEMES[migratedTheme] ? migratedTheme : "classic";
  document.documentElement.dataset.theme = selectedTheme;
  localStorage.setItem("theme", selectedTheme);
  const selectedOption = themeColorOptions.find((option) => option.dataset.theme === selectedTheme);
  themeColorLabel.textContent = selectedOption?.textContent ?? "Classic";
  themeColorOptions.forEach((option) => {
    option.setAttribute("aria-selected", String(option === selectedOption));
  });
  syncThemeMode(THEMES[selectedTheme].dark);
  updateFavicon(THEMES[selectedTheme].primary);
  if (announce) notification(themeColorLabel.textContent + " theme selected");
}

async function logout() {
  await signOut(auth);
  window.location.href = "landing.html";
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
  window.location.href = "landing.html";
}

function openSettings() {
  settingsModal.setAttribute("aria-hidden", "false");
  settingsDialog.focus();
}

function closeSettings() {
  settingsModal.setAttribute("aria-hidden", "true");
  settings.focus();
}

function updateGoogleLinkState(user) {
  const isLinked = user.providerData.some(
    (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
  );
  const hasAlternativeProvider = user.providerData.some(
    (provider) => provider.providerId !== GoogleAuthProvider.PROVIDER_ID,
  );

  googleLinkStatus.textContent = isLinked
    ? hasAlternativeProvider
      ? "Linked"
      : "Linked. Google is the only sign-in method."
    : "Unlinked";
  googleLinkButton.textContent = isLinked ? "Unlink Google" : "Link with Google";
  googleLinkButton.disabled = isLinked && !hasAlternativeProvider;
  googleLinkButton.title = googleLinkButton.disabled
    ? "Google is the only sign-in method for this account."
    : "";
}

function googleLinkError(error) {
  const messages = {
    "auth/popup-closed-by-user": "Google linking was cancelled.",
    "auth/credential-already-in-use": "That Google account is already linked to another Twottor account.",
    "auth/provider-already-linked": "A Google account is already linked.",
    "auth/no-such-provider": "No Google account is linked.",
    "auth/requires-recent-login": "Please log out and back in, then try unlinking Google again.",
    "auth/unauthorized-domain": "This site is not authorized for Firebase Authentication. Add its domain in Firebase Console under Authentication > Settings > Authorized domains.",
    "auth/requests-from-referer-blocked": "Google linking is blocked by the Firebase API key's website restriction. Update the key's allowed HTTP referrers in Google Cloud Console.",
  };

  return messages[error.code] || "Unable to update Google linking. Please try again.";
}

const usernameSpan = document.getElementById("usernameSpan");
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("landing.html");
    return;
  }

  updateGoogleLinkState(user);
  if (usernameSpan) {
    usernameSpan.textContent = user.email ?? "";
  }
});

function toggleDarkMode() {
  syncThemeMode(!document.body.classList.contains("dark-mode"));
}

const savedTheme = localStorage.getItem("theme");
const savedDarkMode = localStorage.getItem("darkMode");
applyTheme(savedTheme || "classic");
if (savedDarkMode === "enabled" || savedDarkMode === "disabled") {
  syncThemeMode(savedDarkMode === "enabled");
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
  const version = document.getElementById("desktop-version");
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
themeColorTrigger.addEventListener("click", () => {
  const isOpen = themeColorMenu.hidden;
  themeColorMenu.hidden = !isOpen;
  themeColorTrigger.setAttribute("aria-expanded", String(isOpen));
});
themeColorOptions.forEach((option) => option.addEventListener("click", () => {
  applyTheme(option.dataset.theme, true);
  themeColorMenu.hidden = true;
  themeColorTrigger.setAttribute("aria-expanded", "false");
}));
document.addEventListener("click", (event) => {
  if (!themeDropdown.contains(event.target)) {
    themeColorMenu.hidden = true;
    themeColorTrigger.setAttribute("aria-expanded", "false");
  }
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
googleLinkButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    googleLinkStatus.textContent = "You must be signed in to manage linked accounts.";
    return;
  }

  googleLinkButton.disabled = true;
  googleLinkButton.setAttribute("aria-busy", "true");
  googleLinkButton.classList.add("is-loading");
  googleLinkFeedback.textContent = "Updating Google link...";
  try {
    const isLinked = user.providerData.some(
      (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
    );
    if (isLinked) {
      const hasAlternativeProvider = user.providerData.some(
        (provider) => provider.providerId !== GoogleAuthProvider.PROVIDER_ID,
      );
      if (!hasAlternativeProvider) {
        googleLinkFeedback.textContent = "Add another sign-in method before unlinking Google.";
        return;
      }

      const result = await unlink(user, GoogleAuthProvider.PROVIDER_ID);
      updateGoogleLinkState(result);
      googleLinkFeedback.textContent = "Google account unlinked.";
    } else {
      const result = await linkWithPopup(user, googleProvider);
      updateGoogleLinkState(result.user);
      googleLinkFeedback.textContent = "Google account linked.";
    }
  } catch (error) {
    updateGoogleLinkState(auth.currentUser || user);
    googleLinkFeedback.textContent = googleLinkError(error);
  } finally {
    googleLinkButton.classList.remove("is-loading");
    googleLinkButton.removeAttribute("aria-busy");
    updateGoogleLinkState(auth.currentUser || user);
  }
});
deleteAccountButton.addEventListener("click", async () => {
  deleteAccountButton.classList.add("loader");
  deleteAccountButton.setAttribute("aria-busy", "true");
  try {
    await deleteAccount(auth.currentUser);
    await signOut(auth);
    window.location.href = "landing.html";
  } finally {
    deleteAccountButton.classList.remove("loader");
    deleteAccountButton.removeAttribute("aria-busy");
  }
});
updateThemeSetting();
