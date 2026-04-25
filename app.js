const STORAGE_KEY = "versebloom-state-v1";
const SESSION_KEY = "versebloom-session-v1";

const appState = {
  currentView: "feed",
  authMode: "login",
  shareTargetId: null,
  toastTimer: null,
};

const elements = {
  authView: document.querySelector("#authView"),
  dashboardView: document.querySelector("#dashboardView"),
  authMessage: document.querySelector("#authMessage"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  poemForm: document.querySelector("#poemForm"),
  logoutButton: document.querySelector("#logoutButton"),
  feedTab: document.querySelector("#feedTab"),
  profileTab: document.querySelector("#profileTab"),
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

const seedState = {
  users: [
    {
      id: "user-aanya",
      name: "Aanya Sen",
      handle: "aanya",
      password: "verse123",
      bio: "I write about rain, unfinished trains, and the kindness of old cities.",
      joinedAt: "2026-04-10T07:30:00.000Z",
    },
    {
      id: "user-mateo",
      name: "Mateo Cruz",
      handle: "mateo",
      password: "verse123",
      bio: "Short poems, long silences, and notes from streetlight hours.",
      joinedAt: "2026-04-11T09:12:00.000Z",
    },
    {
      id: "user-leela",
      name: "Leela Narang",
      handle: "leela",
      password: "verse123",
      bio: "I chase image-heavy poems with a little ache in them.",
      joinedAt: "2026-04-14T14:40:00.000Z",
    },
  ],
  poems: [
    {
      id: "poem-night-letters",
      authorId: "user-aanya",
      title: "Night Letters",
      theme: "Monsoon",
      content:
        "The rain wrote to the window all evening,\nletter after letter in silver handwriting.\nI kept reading your name\nbetween the drips and the passing lights.",
      createdAt: "2026-04-20T18:30:00.000Z",
      likeUserIds: ["user-mateo", "user-leela"],
      comments: [
        {
          id: "comment-1",
          userId: "user-mateo",
          text: "That image of silver handwriting is beautiful and very alive.",
          createdAt: "2026-04-20T19:00:00.000Z",
        },
        {
          id: "comment-2",
          userId: "user-leela",
          text: "The last two lines stay with me. It feels intimate without trying too hard.",
          createdAt: "2026-04-20T19:20:00.000Z",
        },
      ],
      shares: [
        {
          id: "share-1",
          userId: "user-leela",
          thought:
            "Sharing this because it made the weather feel personal in the best way.",
          createdAt: "2026-04-21T08:10:00.000Z",
        },
      ],
    },
    {
      id: "poem-platform",
      authorId: "user-mateo",
      title: "Platform 6",
      theme: "Transit",
      content:
        "At platform six,\na goodbye stood up before the train did.\nEven the announcements softened,\nas if the station had seen this happen before.",
      createdAt: "2026-04-22T06:45:00.000Z",
      likeUserIds: ["user-aanya"],
      comments: [
        {
          id: "comment-3",
          userId: "user-aanya",
          text: "The first line is such a strong opening. It sets the whole ache.",
          createdAt: "2026-04-22T07:10:00.000Z",
        },
      ],
      shares: [],
    },
    {
      id: "poem-light-bowl",
      authorId: "user-leela",
      title: "Bowl of Light",
      theme: "Home",
      content:
        "Morning sat on the kitchen table\nlike a bowl filled to the edge.\nMy mother moved through it slowly,\ncareful not to spill the day.",
      createdAt: "2026-04-23T09:20:00.000Z",
      likeUserIds: ["user-aanya", "user-mateo"],
      comments: [],
      shares: [
        {
          id: "share-2",
          userId: "user-aanya",
          thought:
            "Keeping this on my profile because it turns a simple room into something sacred.",
          createdAt: "2026-04-23T11:00:00.000Z",
        },
      ],
    },
  ],
};

function cloneSeedState() {
  return JSON.parse(JSON.stringify(seedState));
}

let state = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));
      return cloneSeedState();
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.poems)) {
      throw new Error("State shape is invalid.");
    }
    return parsed;
  } catch (error) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));
    return cloneSeedState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSessionUserId() {
  return localStorage.getItem(SESSION_KEY);
}

function setSessionUserId(userId) {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
    return;
  }
  localStorage.removeItem(SESSION_KEY);
}

function currentUser() {
  return state.users.find((user) => user.id === getSessionUserId()) || null;
}

function poemById(poemId) {
  return state.poems.find((poem) => poem.id === poemId) || null;
}

function userById(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeHandle(handle) {
  return handle.trim().replace(/^@+/, "").toLowerCase().replace(/\s+/g, "");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  const user = currentUser();
  elements.authView.classList.toggle("hidden", Boolean(user));
  elements.dashboardView.classList.toggle("hidden", !user);

  if (user) {
    renderDashboard();
  }
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
  const myPoems = state.poems.filter((poem) => poem.authorId === user.id);
  const likesReceived = myPoems.reduce(
    (total, poem) => total + poem.likeUserIds.length,
    0
  );
  const shareCount = state.poems.reduce(
    (total, poem) =>
      total + poem.shares.filter((share) => share.userId === user.id).length,
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

function formatJoined(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function renderCommunityStats() {
  const commentCount = state.poems.reduce(
    (total, poem) => total + poem.comments.length,
    0
  );
  const shareCount = state.poems.reduce(
    (total, poem) => total + poem.shares.length,
    0
  );
  const likeCount = state.poems.reduce(
    (total, poem) => total + poem.likeUserIds.length,
    0
  );

  const cards = [
    { value: state.users.length, label: "Writers" },
    { value: state.poems.length, label: "Poems" },
    { value: commentCount, label: "Comments" },
    { value: shareCount, label: "Profile shares" },
    { value: likeCount, label: "Total likes" },
    {
      value: new Set(state.poems.map((poem) => poem.authorId)).size,
      label: "Active voices",
    },
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
  const sortedPoems = [...state.poems].sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
  );

  if (!sortedPoems.length) {
    elements.feedList.innerHTML = emptyState(
      "No poems yet",
      "Start the feed by publishing the first poem from your account."
    );
    return;
  }

  elements.feedList.innerHTML = sortedPoems
    .map((poem) => renderPoemCard(poem, user))
    .join("");
}

function renderPoemCard(poem, user) {
  const author = userById(poem.authorId);
  const liked = poem.likeUserIds.includes(user.id);

  return `
    <article class="poem-card" id="poem-${escapeHtml(poem.id)}">
      <header class="poem-meta">
        <div class="poem-author">
          <span class="avatar">${escapeHtml(initials(author?.name || "Poet"))}</span>
          <div>
            <h4>${escapeHtml(poem.title)}</h4>
            <div class="handle-line">
              ${escapeHtml(author?.name || "Unknown poet")} | @${escapeHtml(author?.handle || "unknown")}
            </div>
          </div>
        </div>
        <span class="timestamp">${escapeHtml(formatDate(poem.createdAt))}</span>
      </header>

      ${
        poem.theme
          ? `<p class="poem-theme">${escapeHtml(poem.theme)}</p>`
          : ""
      }

      <p class="poem-body">${escapeHtml(poem.content)}</p>

      <div class="action-row">
        <div class="action-buttons">
          <button
            class="ghost-action ${liked ? "is-active" : ""}"
            type="button"
            data-action="toggle-like"
            data-poem-id="${escapeHtml(poem.id)}"
          >
            ${liked ? "Liked" : "Like"} ${poem.likeUserIds.length}
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
          <span>${poem.shares.length} profile shares</span>
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

  const sorted = [...comments].sort(
    (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
  );

  return `
    <section class="comments-list">
      ${sorted
        .map((comment) => {
          const author = userById(comment.userId);
          return `
            <article class="comment-item">
              <strong>${escapeHtml(author?.name || "Reader")} | @${escapeHtml(author?.handle || "unknown")}</strong>
              <span class="meta-line"> | ${escapeHtml(formatDate(comment.createdAt))}</span>
              <p>${escapeHtml(comment.text)}</p>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderShareEchoes(shares) {
  if (!shares.length) {
    return "";
  }

  const latestShares = [...shares]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 2);

  return `
    <section class="share-echo-list">
      ${latestShares
        .map((share) => {
          const sharer = userById(share.userId);
          return `
            <article class="share-echo">
              <strong>${escapeHtml(sharer?.name || "Reader")}</strong>
              <span class="meta-line"> shared this to their profile</span>
              <p>${escapeHtml(share.thought)}</p>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderProfile(user) {
  const myPoems = [...state.poems]
    .filter((poem) => poem.authorId === user.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  const myShares = state.poems
    .flatMap((poem) =>
      poem.shares
        .filter((share) => share.userId === user.id)
        .map((share) => ({ share, poem }))
    )
    .sort((left, right) => new Date(right.share.createdAt) - new Date(left.share.createdAt));

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
          <span>${poem.likeUserIds.length} likes</span>
          <span>${poem.comments.length} comments</span>
        </div>
      </div>

      ${
        poem.theme
          ? `<p class="poem-theme">${escapeHtml(poem.theme)}</p>`
          : ""
      }
      <p class="poem-body">${escapeHtml(poem.content)}</p>
    </article>
  `;
}

function renderShareCard(share, poem) {
  const poemAuthor = userById(poem.authorId);
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
          by ${escapeHtml(poemAuthor?.name || "Unknown poet")} | @${escapeHtml(poemAuthor?.handle || "unknown")}
        </div>
        <p class="quote-body">${escapeHtml(poem.content)}</p>
      </div>
    </article>
  `;
}

function emptyState(title, copy) {
  return `
    <article class="empty-state">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(copy)}</p>
    </article>
  `;
}

function handleLogin(formData) {
  const handle = normalizeHandle(formData.get("handle") || "");
  const password = String(formData.get("password") || "").trim();
  const user = state.users.find(
    (entry) => entry.handle === handle && entry.password === password
  );

  if (!user) {
    showAuthMessage("That handle or password does not match any saved account.");
    return;
  }

  setSessionUserId(user.id);
  elements.loginForm.reset();
  showAuthMessage("");
  appState.currentView = "feed";
  toggleAppViews();
  showToast(`Welcome back, ${user.name}.`);
}

function handleSignup(formData) {
  const name = String(formData.get("name") || "").trim();
  const handle = normalizeHandle(formData.get("handle") || "");
  const password = String(formData.get("password") || "").trim();
  const bio = String(formData.get("bio") || "").trim();

  if (!name || !handle || password.length < 6) {
    showAuthMessage("Please fill in your name, handle, and a password of 6+ characters.");
    return;
  }

  if (state.users.some((user) => user.handle === handle)) {
    showAuthMessage("That handle is already taken. Try another one.");
    return;
  }

  const user = {
    id: createId("user"),
    name,
    handle,
    password,
    bio: bio || "A fresh voice arriving with new poems.",
    joinedAt: new Date().toISOString(),
  };

  state.users.unshift(user);
  saveState();
  setSessionUserId(user.id);
  elements.signupForm.reset();
  showAuthMessage("");
  appState.currentView = "feed";
  toggleAppViews();
  showToast(`Your profile is ready, ${user.name}.`);
}

function handleNewPoem(formData) {
  const user = currentUser();
  if (!user) {
    return;
  }

  const title = String(formData.get("title") || "").trim();
  const theme = String(formData.get("theme") || "").trim();
  const content = String(formData.get("content") || "").trim();

  if (!title || !content) {
    showToast("A poem needs both a title and some lines.");
    return;
  }

  state.poems.unshift({
    id: createId("poem"),
    authorId: user.id,
    title,
    theme,
    content,
    createdAt: new Date().toISOString(),
    likeUserIds: [],
    comments: [],
    shares: [],
  });

  saveState();
  elements.poemForm.reset();
  renderDashboard();
  showToast("Your poem is now live in the community feed.");
}

function toggleLike(poemId) {
  const user = currentUser();
  const poem = poemById(poemId);
  if (!user || !poem) {
    return;
  }

  const alreadyLiked = poem.likeUserIds.includes(user.id);
  poem.likeUserIds = alreadyLiked
    ? poem.likeUserIds.filter((id) => id !== user.id)
    : [...poem.likeUserIds, user.id];

  saveState();
  renderDashboard();
}

function addComment(poemId, text) {
  const user = currentUser();
  const poem = poemById(poemId);
  const trimmed = text.trim();

  if (!user || !poem || !trimmed) {
    return;
  }

  poem.comments.push({
    id: createId("comment"),
    userId: user.id,
    text: trimmed,
    createdAt: new Date().toISOString(),
  });

  saveState();
  renderDashboard();
  showToast("Your comment has been added.");
}

function openShareModal(poemId) {
  const poem = poemById(poemId);
  const author = userById(poem?.authorId || "");

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
            by ${escapeHtml(author?.name || "Unknown poet")} | @${escapeHtml(author?.handle || "unknown")}
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

function addShare(formData) {
  const user = currentUser();
  const poemId = String(formData.get("poemId") || "");
  const thought = String(formData.get("thought") || "").trim();
  const poem = poemById(poemId);

  if (!user || !poem || thought.length < 4) {
    showToast("Add a little more context before sharing the poem to your profile.");
    return;
  }

  poem.shares.unshift({
    id: createId("share"),
    userId: user.id,
    thought,
    createdAt: new Date().toISOString(),
  });

  saveState();
  closeShareModal();
  renderDashboard();
  appState.currentView = "profile";
  setView("profile");
  renderProfile(user);
  renderFeed(user);
  renderCommunityStats();
  showToast("The poem is now on your profile with your reflection.");
}

function handleDocumentClick(event) {
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
      toggleLike(poemId);
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

function handleDocumentSubmit(event) {
  if (event.target === elements.loginForm) {
    event.preventDefault();
    handleLogin(new FormData(elements.loginForm));
    return;
  }

  if (event.target === elements.signupForm) {
    event.preventDefault();
    handleSignup(new FormData(elements.signupForm));
    return;
  }

  if (event.target === elements.poemForm) {
    event.preventDefault();
    handleNewPoem(new FormData(elements.poemForm));
    return;
  }

  if (event.target === elements.shareForm) {
    event.preventDefault();
    addShare(new FormData(elements.shareForm));
    return;
  }

  if (event.target.matches(".comment-form")) {
    event.preventDefault();
    const poemId = event.target.dataset.poemId;
    const input = event.target.querySelector('input[name="comment"]');
    addComment(poemId, input?.value || "");
    event.target.reset();
  }
}

function handleLogout() {
  setSessionUserId(null);
  closeShareModal();
  appState.currentView = "feed";
  toggleAppViews();
}

function bootstrap() {
  setAuthMode("login");
  toggleAppViews();

  elements.logoutButton.addEventListener("click", handleLogout);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("submit", handleDocumentSubmit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.shareModal.classList.contains("hidden")) {
      closeShareModal();
    }
  });
}

bootstrap();
