const API_BASE =
  window.__VERSEBLOOM_API_BASE__ ||
  document.querySelector('meta[name="versebloom-api-base"]')?.content ||
  (window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "");
const TOKEN_KEY = "versebloom-api-token-v1";

const appState = {
  currentView: "feed",
  authMode: "login",
  shareTargetId: null,
  toastTimer: null,
  token: localStorage.getItem(TOKEN_KEY),
  dashboard: null,
};

const elements = {
  authView: document.querySelector("#authView"),
  dashboardView: document.querySelector("#dashboardView"),
  authMessage: document.querySelector("#authMessage"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  poemForm: document.querySelector("#poemForm"),
  logoutButton: document.querySelector("#logoutButton"),
  loggedInUser: document.querySelector("#loggedInUser"),
  profileSummary: document.querySelector("#profileSummary"),
  feedList: document.querySelector("#feedList"),
  communityStats: document.querySelector("#communityStats"),
  dashboardToast: document.querySelector("#dashboardToast"),
  profileHero: document.querySelector("#profileHero"),
  profilePoems: document.querySelector("#profilePoems"),
  profileShares: document.querySelector("#profileShares"),
  feedView: document.querySelector("#feedView"),
  profileView: document.querySelector("#profileView"),
  shareModal: document.querySelector("#shareModal"),
  sharePreview: document.querySelector("#sharePreview"),
  shareForm: document.querySelector("#shareForm"),
  shareThought: document.querySelector("#shareThought"),
  sharePoemId: document.querySelector("#sharePoemId"),
  closeShareModal: document.querySelector("#closeShareModal"),
  authTabs: Array.from(document.querySelectorAll("[data-auth-mode]")),
  viewButtons: Array.from(document.querySelectorAll("[data-view]")),
};

function setToken(token) {
  appState.token = token || "";
  if (appState.token) {
    localStorage.setItem(TOKEN_KEY, appState.token);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

function clearSession() {
  setToken("");
  appState.dashboard = null;
}

function serverUnavailableMessage() {
  if (window.location.protocol === "file:") {
    return "Backend is not reachable. Start start_server.bat and reload, or open http://127.0.0.1:8000.";
  }

  return "The API is not reachable right now. If this is a Vercel deployment, check that the database env vars are configured.";
}

function currentUser() {
  return appState.dashboard?.user || null;
}

function poemById(poemId) {
  return (
    appState.dashboard?.poems.find((poem) => String(poem.id) === String(poemId)) ||
    null
  );
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatJoined(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function emptyState(title, copy) {
  return `
    <article class="empty-state">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(copy)}</p>
    </article>
  `;
}

function showAuthMessage(message) {
  elements.authMessage.textContent = message;
}

function showToast(message) {
  elements.dashboardToast.textContent = message;
  elements.dashboardToast.classList.remove("hidden");

  if (appState.toastTimer) {
    window.clearTimeout(appState.toastTimer);
  }

  appState.toastTimer = window.setTimeout(() => {
    elements.dashboardToast.classList.add("hidden");
  }, 2800);
}

function setAuthMode(mode) {
  appState.authMode = mode;
  elements.authTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  elements.loginForm.classList.toggle("hidden", mode !== "login");
  elements.signupForm.classList.toggle("hidden", mode !== "signup");
  showAuthMessage("");
}

function setView(view) {
  appState.currentView = view;
  elements.feedView.classList.toggle("hidden", view !== "feed");
  elements.profileView.classList.toggle("hidden", view !== "profile");
  elements.viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
}

function toggleAppViews() {
  const loggedIn = Boolean(appState.dashboard?.user);
  elements.authView.classList.toggle("hidden", loggedIn);
  elements.dashboardView.classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    renderDashboard();
  }
}

async function apiRequest(path, options = {}) {
  const { method = "GET", data, auth = true } = options;
  const headers = {
    Accept: "application/json",
  };

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth && appState.token) {
    headers.Authorization = `Bearer ${appState.token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    const offlineError = new Error(serverUnavailableMessage());
    offlineError.status = 0;
    throw offlineError;
  }

  let payload = {};
  const responseText = await response.text();
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      payload = {};
    }
  }

  if (!response.ok) {
    const apiError = new Error(payload.error || "Request failed.");
    apiError.status = response.status;
    throw apiError;
  }

  return payload;
}

async function loadDashboard() {
  const dashboard = await apiRequest("/api/bootstrap");
  appState.dashboard = dashboard;
  toggleAppViews();
  return dashboard;
}

function renderDashboard() {
  const user = currentUser();
  if (!user) {
    return;
  }

  elements.loggedInUser.innerHTML = `
    <span class="avatar">${escapeHtml(initials(user.name))}</span>
    <span>
      <strong>${escapeHtml(user.name)}</strong><br />
      <span class="meta-line">@${escapeHtml(user.handle)}</span>
    </span>
  `;

  renderProfileSummary(user);
  renderCommunityStats();
  renderFeed(user);
  renderProfile(user);
  setView(appState.currentView);
}

function renderProfileSummary(user) {
  const myPoems = appState.dashboard.poems.filter((poem) => poem.author.id === user.id);
  const likesReceived = myPoems.reduce(
    (total, poem) => total + poem.likeCount,
    0
  );
  const shareCount = appState.dashboard.poems.reduce(
    (total, poem) =>
      total + poem.shares.filter((share) => share.user.id === user.id).length,
    0
  );

  elements.profileSummary.innerHTML = `
    <section class="profile-summary">
      <div class="author-pill">
        <span class="avatar">${escapeHtml(initials(user.name))}</span>
        <div>
          <strong>${escapeHtml(user.name)}</strong><br />
          <span class="meta-line">@${escapeHtml(user.handle)}</span>
        </div>
      </div>

      <div>
        <h3>${escapeHtml(user.name)}</h3>
        <p>${escapeHtml(user.bio || "A poet gathering thoughts and sharing lines.")}</p>
      </div>

      <div class="stat-row">
        <div class="stat-chip">
          <strong>${myPoems.length}</strong>
          <span>Poems published</span>
        </div>
        <div class="stat-chip">
          <strong>${likesReceived}</strong>
          <span>Likes received</span>
        </div>
        <div class="stat-chip">
          <strong>${shareCount}</strong>
          <span>Profile shares</span>
        </div>
        <div class="stat-chip">
          <strong>${formatJoined(user.joinedAt)}</strong>
          <span>Member since</span>
        </div>
      </div>
    </section>
  `;
}

function renderCommunityStats() {
  const stats = appState.dashboard.communityStats;
  const cards = [
    { value: stats.writers, label: "Writers" },
    { value: stats.poems, label: "Poems" },
    { value: stats.comments, label: "Comments" },
    { value: stats.profileShares, label: "Profile shares" },
    { value: stats.totalLikes, label: "Total likes" },
    { value: stats.activeVoices, label: "Active voices" },
  ];

  elements.communityStats.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <strong>${card.value}</strong>
          <span>${card.label}</span>
        </article>
      `
    )
    .join("");
}

function renderFeed(user) {
  const poems = appState.dashboard.poems;
  if (!poems.length) {
    elements.feedList.innerHTML = emptyState(
      "No poems yet",
      "Start the feed by publishing the first poem from your account."
    );
    return;
  }

  elements.feedList.innerHTML = poems
    .map((poem) => renderPoemCard(poem, user))
    .join("");
}

function renderPoemCard(poem, user) {
  return `
    <article class="poem-card" id="poem-${escapeHtml(poem.id)}">
      <header class="poem-meta">
        <div class="poem-author">
          <span class="avatar">${escapeHtml(initials(poem.author.name || "Poet"))}</span>
          <div>
            <h4>${escapeHtml(poem.title)}</h4>
            <div class="handle-line">
              ${escapeHtml(poem.author.name || "Unknown poet")} | @${escapeHtml(poem.author.handle || "unknown")}
            </div>
          </div>
        </div>
        <span class="timestamp">${escapeHtml(formatDate(poem.createdAt))}</span>
      </header>

      ${poem.theme ? `<p class="poem-theme">${escapeHtml(poem.theme)}</p>` : ""}
      <p class="poem-body">${escapeHtml(poem.content)}</p>

      <div class="action-row">
        <div class="action-buttons">
          <button
            class="ghost-action ${poem.likedByCurrentUser ? "is-active" : ""}"
            type="button"
            data-action="toggle-like"
            data-poem-id="${escapeHtml(poem.id)}"
          >
            ${poem.likedByCurrentUser ? "Liked" : "Like"} ${poem.likeCount}
          </button>
          <button
            class="ghost-action"
            type="button"
            data-action="open-share"
            data-poem-id="${escapeHtml(poem.id)}"
          >
            Share to profile
          </button>
        </div>

        <div class="metric-line">
          <span>${poem.comments.length} comments</span>
          <span>${poem.shareCount} profile shares</span>
          ${
            poem.author.id === user.id
              ? '<span>Your poem</span>'
              : "<span>Community poem</span>"
          }
        </div>
      </div>

      <form class="comment-form" data-poem-id="${escapeHtml(poem.id)}">
        <input
          name="comment"
          type="text"
          maxlength="180"
          placeholder="Leave a thoughtful comment on this poem..."
          required
        />
        <button class="secondary-button" type="submit">Comment</button>
      </form>

      ${renderComments(poem.comments)}
      ${renderShareEchoes(poem.shares)}
    </article>
  `;
}

function renderComments(comments) {
  if (!comments.length) {
    return emptyState(
      "No comments yet",
      "Be the first person to respond to this poem."
    );
  }

  return `
    <section class="comments-list">
      ${comments
        .map(
          (comment) => `
            <article class="comment-item">
              <strong>${escapeHtml(comment.user.name || "Reader")} | @${escapeHtml(comment.user.handle || "unknown")}</strong>
              <span class="meta-line"> | ${escapeHtml(formatDate(comment.createdAt))}</span>
              <p>${escapeHtml(comment.text)}</p>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderShareEchoes(shares) {
  if (!shares.length) {
    return "";
  }

  return `
    <section class="share-echo-list">
      ${shares
        .slice(0, 2)
        .map(
          (share) => `
            <article class="share-echo">
              <strong>${escapeHtml(share.user.name || "Reader")}</strong>
              <span class="meta-line"> shared this to their profile</span>
              <p>${escapeHtml(share.thought)}</p>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderProfile(user) {
  const myPoems = appState.dashboard.poems.filter((poem) => poem.author.id === user.id);
  const myShares = appState.dashboard.poems
    .flatMap((poem) =>
      poem.shares
        .filter((share) => share.user.id === user.id)
        .map((share) => ({ share, poem }))
    )
    .sort(
      (left, right) =>
        new Date(right.share.createdAt) - new Date(left.share.createdAt)
    );

  const totalCommentsOnMyPoems = myPoems.reduce(
    (total, poem) => total + poem.comments.length,
    0
  );

  elements.profileHero.innerHTML = `
    <p class="section-kicker">Profile</p>
    <h3>${escapeHtml(user.name)}</h3>
    <p>${escapeHtml(user.bio || "A poet with a page full of drafts and shared feelings.")}</p>

    <div class="hero-stats">
      <div class="stat-card">
        <strong>${myPoems.length}</strong>
        <span>Original poems</span>
      </div>
      <div class="stat-card">
        <strong>${myShares.length}</strong>
        <span>Poems shared to your profile</span>
      </div>
      <div class="stat-card">
        <strong>${totalCommentsOnMyPoems}</strong>
        <span>Comments on your poems</span>
      </div>
      <div class="stat-card">
        <strong>@${escapeHtml(user.handle)}</strong>
        <span>Your writer handle</span>
      </div>
    </div>
  `;

  elements.profilePoems.innerHTML = myPoems.length
    ? myPoems.map((poem) => renderProfilePoem(poem)).join("")
    : emptyState(
        "You have not published a poem yet",
        "Write your first poem in the feed and it will appear here."
      );

  elements.profileShares.innerHTML = myShares.length
    ? myShares.map(({ share, poem }) => renderShareCard(share, poem)).join("")
    : emptyState(
        "No profile shares yet",
        "When you share another writer's poem with your own thought, it will show here."
      );
}

function renderProfilePoem(poem) {
  return `
    <article class="share-card">
      <div class="share-card-header">
        <div>
          <h4>${escapeHtml(poem.title)}</h4>
          <div class="meta-line">${escapeHtml(formatDate(poem.createdAt))}</div>
        </div>
        <div class="metric-line">
          <span>${poem.likeCount} likes</span>
          <span>${poem.comments.length} comments</span>
        </div>
      </div>

      ${poem.theme ? `<p class="poem-theme">${escapeHtml(poem.theme)}</p>` : ""}
      <p class="poem-body">${escapeHtml(poem.content)}</p>
    </article>
  `;
}

function renderShareCard(share, poem) {
  return `
    <article class="share-card">
      <div class="share-card-header">
        <div>
          <h4>Shared on ${escapeHtml(formatDate(share.createdAt))}</h4>
          <div class="meta-line">Your reflection on ${escapeHtml(poem.title)}</div>
        </div>
      </div>

      <p class="share-thought">${escapeHtml(share.thought)}</p>

      <div class="share-reference">
        <strong>${escapeHtml(poem.title)}</strong>
        <div class="meta-line">
          by ${escapeHtml(poem.author.name || "Unknown poet")} | @${escapeHtml(poem.author.handle || "unknown")}
        </div>
        <p class="quote-body">${escapeHtml(poem.content)}</p>
      </div>
    </article>
  `;
}

function openShareModal(poemId) {
  const poem = poemById(poemId);
  if (!poem) {
    return;
  }

  appState.shareTargetId = poemId;
  elements.sharePoemId.value = poemId;
  elements.sharePreview.innerHTML = `
    <p class="section-kicker">Share this poem</p>
    <div class="share-preview-card">
      <div class="share-preview-meta">
        <div>
          <h4>${escapeHtml(poem.title)}</h4>
          <div class="meta-line">
            by ${escapeHtml(poem.author.name || "Unknown poet")} | @${escapeHtml(poem.author.handle || "unknown")}
          </div>
        </div>
        <span class="timestamp">${escapeHtml(formatDate(poem.createdAt))}</span>
      </div>
      <p class="quote-body">${escapeHtml(poem.content)}</p>
    </div>
  `;
  elements.shareThought.value = "";
  elements.shareModal.classList.remove("hidden");
  elements.shareThought.focus();
}

function closeShareModal() {
  appState.shareTargetId = null;
  elements.shareForm.reset();
  elements.shareModal.classList.add("hidden");
}

async function handleLogin(formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    showAuthMessage("Please enter your email and password.");
    return;
  }

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      auth: false,
      data: { email, password },
    });
    setToken(payload.token);
    appState.dashboard = payload.dashboard;
    elements.loginForm.reset();
    showAuthMessage("");
    appState.currentView = "feed";
    toggleAppViews();
    showToast(`Welcome back, ${payload.dashboard.user.name}.`);
  } catch (error) {
    showAuthMessage(error.message);
  }
}

async function handleSignup(formData) {
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    handle: String(formData.get("handle") || "").trim(),
    password: String(formData.get("password") || "").trim(),
    bio: String(formData.get("bio") || "").trim(),
  };

  try {
    const response = await apiRequest("/api/auth/register", {
      method: "POST",
      auth: false,
      data: payload,
    });
    setToken(response.token);
    appState.dashboard = response.dashboard;
    elements.signupForm.reset();
    showAuthMessage("");
    appState.currentView = "feed";
    toggleAppViews();
    showToast(`Your profile is ready, ${response.dashboard.user.name}.`);
  } catch (error) {
    showAuthMessage(error.message);
  }
}

async function handleNewPoem(formData) {
  const title = String(formData.get("title") || "").trim();
  const theme = String(formData.get("theme") || "").trim();
  const content = String(formData.get("content") || "").trim();

  try {
    const response = await apiRequest("/api/poems", {
      method: "POST",
      data: { title, theme, content },
    });
    appState.dashboard = response.dashboard;
    elements.poemForm.reset();
    renderDashboard();
    showToast(response.message || "Your poem is now live in the community feed.");
  } catch (error) {
    showToast(error.message);
  }
}

async function toggleLike(poemId) {
  try {
    const response = await apiRequest(`/api/poems/${poemId}/like`, {
      method: "POST",
      data: {},
    });
    appState.dashboard = response.dashboard;
    renderDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function addComment(poemId, text) {
  try {
    const response = await apiRequest(`/api/poems/${poemId}/comments`, {
      method: "POST",
      data: { text },
    });
    appState.dashboard = response.dashboard;
    renderDashboard();
    showToast(response.message || "Your comment has been added.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addShare(formData) {
  const poemId = String(formData.get("poemId") || "");
  const thought = String(formData.get("thought") || "").trim();

  try {
    const response = await apiRequest(`/api/poems/${poemId}/shares`, {
      method: "POST",
      data: { thought },
    });
    appState.dashboard = response.dashboard;
    closeShareModal();
    appState.currentView = "profile";
    renderDashboard();
    showToast(
      response.message || "The poem is now on your profile with your reflection."
    );
  } catch (error) {
    showToast(error.message);
  }
}

async function handleLogout() {
  try {
    if (appState.token) {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        data: {},
      });
    }
  } catch (error) {
    // Clear local state even if the server is already gone.
  }

  clearSession();
  closeShareModal();
  appState.currentView = "feed";
  toggleAppViews();
}

async function handleDocumentClick(event) {
  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    setAuthMode(authModeButton.dataset.authMode);
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setView(viewButton.dataset.view);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const poemId = actionButton.dataset.poemId;
    const action = actionButton.dataset.action;

    if (action === "toggle-like") {
      await toggleLike(poemId);
      return;
    }

    if (action === "open-share") {
      openShareModal(poemId);
      return;
    }
  }

  if (event.target === elements.closeShareModal) {
    closeShareModal();
    return;
  }

  if (event.target === elements.shareModal) {
    closeShareModal();
  }
}

async function handleDocumentSubmit(event) {
  if (event.target === elements.loginForm) {
    event.preventDefault();
    await handleLogin(new FormData(elements.loginForm));
    return;
  }

  if (event.target === elements.signupForm) {
    event.preventDefault();
    await handleSignup(new FormData(elements.signupForm));
    return;
  }

  if (event.target === elements.poemForm) {
    event.preventDefault();
    await handleNewPoem(new FormData(elements.poemForm));
    return;
  }

  if (event.target === elements.shareForm) {
    event.preventDefault();
    await addShare(new FormData(elements.shareForm));
    return;
  }

  if (event.target.matches(".comment-form")) {
    event.preventDefault();
    const poemId = event.target.dataset.poemId;
    const input = event.target.querySelector('input[name="comment"]');
    await addComment(poemId, input?.value || "");
  }
}

async function bootstrap() {
  setAuthMode("login");
  document.addEventListener("click", (event) => {
    void handleDocumentClick(event);
  });
  document.addEventListener("submit", (event) => {
    void handleDocumentSubmit(event);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.shareModal.classList.contains("hidden")) {
      closeShareModal();
    }
  });
  elements.logoutButton.addEventListener("click", () => {
    void handleLogout();
  });

  if (appState.token) {
    try {
      await loadDashboard();
      return;
    } catch (error) {
      clearSession();
      showAuthMessage(error.message);
    }
  }

  toggleAppViews();
}

bootstrap();
