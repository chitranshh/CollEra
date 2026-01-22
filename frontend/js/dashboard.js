// ===== Dashboard JavaScript =====

// ===== State Management =====
let currentUser = null;
let users = [];
let connections = [];
let pendingRequests = [];
let sentRequests = [];
let posts = [];
let currentPage = 1;
let postsPage = 1;
let currentFilter = 'all';
let currentSkillFilter = '';

// ===== Initialize Dashboard =====
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Load user data
    await loadCurrentUser();

    // Load initial data
    await Promise.all([
        loadPosts(),
        loadUsers(),
        loadConnections(),
        loadPendingRequests(),
        loadSuggestions()
    ]);

    // Initialize tab navigation
    initTabNavigation();

    // Initialize filters
    initFilters();
});

// ===== API Helper =====
async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return null;
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// ===== Load Current User =====
async function loadCurrentUser() {
    const data = await apiCall('/api/auth/me');

    if (data && data.success) {
        currentUser = data.data.user;
        updateUserUI();
    }
}

function updateUserUI() {
    if (!currentUser) return;

    // Update avatar
    const userAvatar = document.getElementById('userAvatar');
    const initials = `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    userAvatar.textContent = initials;

    // Update name
    const userName = document.getElementById('userName');
    userName.textContent = currentUser.firstName;

    // Update stats
    document.getElementById('connectionCount').textContent = currentUser.connections?.length || 0;

    // Update notification badge
    const pendingCount = currentUser.pendingConnections?.length || 0;
    document.getElementById('notificationBadge').textContent = pendingCount;
    document.getElementById('requestBadge').textContent = pendingCount;
}

// ===== Load Users =====
async function loadUsers() {
    const params = new URLSearchParams({
        page: currentPage,
        limit: 20
    });

    if (currentSkillFilter) {
        params.append('skills', currentSkillFilter);
    }

    const data = await apiCall(`/api/users?${params}`);

    if (data && data.success) {
        users = data.data.users;
        renderUsers();

        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMore');
        if (data.data.pagination.page < data.data.pagination.pages) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
}

function renderUsers() {
    const grid = document.getElementById('usersGrid');

    if (users.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <h3>No students found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = users.map(user => createUserCard(user)).join('');
}

function createUserCard(user) {
    const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    const isConnected = currentUser?.connections?.some(c => c._id === user._id || c === user._id);
    const isPending = currentUser?.sentRequests?.some(r => r._id === user._id || r === user._id);

    let actionButton = '';
    if (isConnected) {
        actionButton = '<button class="btn btn-secondary" disabled>Connected</button>';
    } else if (isPending) {
        actionButton = '<button class="btn btn-secondary" disabled>Pending</button>';
    } else {
        actionButton = `<button class="btn btn-primary" onclick="sendConnectionRequest('${user._id}')">Connect</button>`;
    }

    return `
        <div class="user-card" data-user-id="${user._id}">
            <div class="user-card-header">
                <div class="user-card-avatar">
                    ${initials}
                    ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
                </div>
                <div class="user-card-info">
                    <div class="user-card-name">${user.firstName} ${user.lastName}</div>
                    <div class="user-card-college">${user.collegeName}</div>
                    <div class="user-card-course">${user.course || ''} ${user.year ? `• Year ${user.year}` : ''}</div>
                </div>
            </div>
            ${user.skills && user.skills.length > 0 ? `
                <div class="user-card-skills">
                    ${user.skills.slice(0, 3).map(skill => `<span class="skill-badge">${skill}</span>`).join('')}
                    ${user.skills.length > 3 ? `<span class="skill-badge">+${user.skills.length - 3}</span>` : ''}
                </div>
            ` : ''}
            <div class="user-card-actions">
                ${actionButton}
                <button class="btn btn-secondary" onclick="viewProfile('${user._id}')">View Profile</button>
            </div>
        </div>
    `;
}

// ===== Load Connections =====
async function loadConnections() {
    const data = await apiCall('/api/connections');

    if (data && data.success) {
        connections = data.data.connections;
        renderConnections();
    }
}

function renderConnections() {
    const grid = document.getElementById('connectionsGrid');

    if (connections.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>No connections yet</h3>
                <p>Start discovering students to build your network</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = connections.map(user => createConnectionCard(user)).join('');
}

function createConnectionCard(user) {
    const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

    return `
        <div class="user-card" data-user-id="${user._id}">
            <div class="user-card-header">
                <div class="user-card-avatar">
                    ${initials}
                    ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
                </div>
                <div class="user-card-info">
                    <div class="user-card-name">${user.firstName} ${user.lastName}</div>
                    <div class="user-card-college">${user.collegeName}</div>
                    <div class="user-card-course">${user.course || ''} ${user.year ? `• Year ${user.year}` : ''}</div>
                </div>
            </div>
            ${user.skills && user.skills.length > 0 ? `
                <div class="user-card-skills">
                    ${user.skills.slice(0, 3).map(skill => `<span class="skill-badge">${skill}</span>`).join('')}
                </div>
            ` : ''}
            <div class="user-card-actions">
                <button class="btn btn-primary" onclick="startChat('${user._id}')">Message</button>
                <button class="btn btn-secondary" onclick="viewProfile('${user._id}')">Profile</button>
            </div>
        </div>
    `;
}

// ===== Load Pending Requests =====
async function loadPendingRequests() {
    const [pendingData, sentData] = await Promise.all([
        apiCall('/api/connections/pending'),
        apiCall('/api/connections/sent')
    ]);

    if (pendingData && pendingData.success) {
        pendingRequests = pendingData.data.pendingConnections;
        renderPendingRequests();
    }

    if (sentData && sentData.success) {
        sentRequests = sentData.data.sentRequests;
        renderSentRequests();
    }
}

function renderPendingRequests() {
    const grid = document.getElementById('receivedRequests');

    if (pendingRequests.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                <h3>No pending requests</h3>
                <p>When students want to connect with you, you'll see them here</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = pendingRequests.map(user => createRequestCard(user, 'received')).join('');
}

function renderSentRequests() {
    const grid = document.getElementById('sentRequests');

    if (sentRequests.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No sent requests</p></div>';
        return;
    }

    grid.innerHTML = sentRequests.map(user => createRequestCard(user, 'sent')).join('');
}

function createRequestCard(user, type) {
    const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

    const actions = type === 'received' ? `
        <button class="btn-accept" onclick="acceptRequest('${user._id}')">Accept</button>
        <button class="btn-reject" onclick="rejectRequest('${user._id}')">Reject</button>
    ` : `
        <button class="btn-reject" onclick="cancelRequest('${user._id}')">Cancel</button>
    `;

    return `
        <div class="request-card" data-user-id="${user._id}">
            <div class="user-card-avatar">
                ${initials}
            </div>
            <div class="request-card-info">
                <div class="request-card-name">${user.firstName} ${user.lastName}</div>
                <div class="request-card-college">${user.collegeName}</div>
            </div>
            <div class="request-card-actions">
                ${actions}
            </div>
        </div>
    `;
}

// ===== Load Suggestions =====
async function loadSuggestions() {
    const data = await apiCall('/api/users/suggestions/smart');

    if (data && data.success) {
        const suggestions = [
            ...data.data.sameCollege,
            ...data.data.similarSkills,
            ...data.data.sameCourse
        ].slice(0, 5);

        renderSuggestions(suggestions);
    }
}

function renderSuggestions(suggestions) {
    const list = document.getElementById('suggestionsList');

    if (suggestions.length === 0) {
        list.innerHTML = '<p class="empty-state">No suggestions available</p>';
        return;
    }

    list.innerHTML = suggestions.map(user => {
        const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        return `
            <div class="suggestion-item">
                <div class="suggestion-avatar">${initials}</div>
                <div class="suggestion-info">
                    <div class="suggestion-name">${user.firstName} ${user.lastName}</div>
                    <div class="suggestion-college">${user.collegeName}</div>
                </div>
                <button class="suggestion-btn" onclick="sendConnectionRequest('${user._id}')">Connect</button>
            </div>
        `;
    }).join('');
}

// ===== Connection Actions =====
async function sendConnectionRequest(userId) {
    const data = await apiCall(`/api/connections/request/${userId}`, 'POST');

    if (data && data.success) {
        showToast('Connection request sent!', 'success');
        await loadCurrentUser();
        await loadUsers();
        await loadSuggestions();
    } else {
        showToast(data?.message || 'Failed to send request', 'error');
    }
}

async function acceptRequest(userId) {
    const data = await apiCall(`/api/connections/accept/${userId}`, 'POST');

    if (data && data.success) {
        showToast('Connection accepted!', 'success');
        await loadCurrentUser();
        await loadConnections();
        await loadPendingRequests();
    } else {
        showToast(data?.message || 'Failed to accept request', 'error');
    }
}

async function rejectRequest(userId) {
    const data = await apiCall(`/api/connections/reject/${userId}`, 'POST');

    if (data && data.success) {
        showToast('Request rejected', 'info');
        await loadPendingRequests();
    } else {
        showToast(data?.message || 'Failed to reject request', 'error');
    }
}

async function cancelRequest(userId) {
    const data = await apiCall(`/api/connections/reject/${userId}`, 'POST');

    if (data && data.success) {
        showToast('Request cancelled', 'info');
        await loadPendingRequests();
    }
}

// ===== Tab Navigation =====
function initTabNavigation() {
    const tabLinks = document.querySelectorAll('.sidebar-link');

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Update active state
            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show corresponding tab
            const tabId = link.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

// ===== Filters =====
function initFilters() {
    // Filter tags
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.dataset.filter;
            loadUsers();
        });
    });

    // Skill tags
    document.querySelectorAll('.skill-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            if (tag.classList.contains('active')) {
                tag.classList.remove('active');
                currentSkillFilter = '';
            } else {
                document.querySelectorAll('.skill-tag').forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                currentSkillFilter = tag.dataset.skill;
            }
            loadUsers();
        });
    });
}

// ===== Search =====
let searchTimeout;
function handleSearch(event) {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
        const query = event.target.value;

        const params = new URLSearchParams({
            page: 1,
            limit: 20,
            search: query
        });

        const data = await apiCall(`/api/users?${params}`);

        if (data && data.success) {
            users = data.data.users;
            renderUsers();
        }
    }, 300);
}

// ===== Explore Search =====
let exploreSearchTimeout;
function handleExploreSearch(event) {
    clearTimeout(exploreSearchTimeout);

    exploreSearchTimeout = setTimeout(async () => {
        const query = event.target.value;

        const params = new URLSearchParams({
            page: 1,
            limit: 20,
            search: query
        });

        const data = await apiCall(`/api/users?${params}`);

        if (data && data.success) {
            users = data.data.users;
            renderUsers();
        }
    }, 300);
}

// ===== User Menu =====
function toggleUserMenu() {
    const menu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');

    menu.classList.toggle('active');
    dropdown.classList.toggle('active');
}

// Close menu on outside click
document.addEventListener('click', (e) => {
    const menu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');

    if (!menu.contains(e.target)) {
        menu.classList.remove('active');
        dropdown.classList.remove('active');
    }
});

// ===== Logout =====
async function handleLogout() {
    await apiCall('/api/auth/logout', 'POST');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// ===== View Profile =====
function viewProfile(userId) {
    // In a full implementation, this would navigate to a profile page
    alert('Profile view coming soon!');
}

// ===== Start Chat =====
function startChat(userId) {
    // In a full implementation, this would open a chat window
    alert('Chat feature coming soon!');
}

// ===== Load More =====
async function loadMoreUsers() {
    currentPage++;

    const params = new URLSearchParams({
        page: currentPage,
        limit: 20
    });

    if (currentSkillFilter) {
        params.append('skills', currentSkillFilter);
    }

    const data = await apiCall(`/api/users?${params}`);

    if (data && data.success) {
        users = [...users, ...data.data.users];
        renderUsers();

        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMore');
        if (data.data.pagination.page < data.data.pagination.pages) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;

    // Add styles if not exists
    if (!document.getElementById('toastStyles')) {
        const styles = document.createElement('style');
        styles.id = 'toastStyles';
        styles.textContent = `
            .toast {
                position: fixed;
                bottom: 24px;
                right: 24px;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
                background: #1a1a24;
                border: 1px solid var(--border-color);
                border-radius: 12px;
                color: white;
                font-size: 14px;
                z-index: 9999;
                animation: slideIn 0.3s ease;
            }
            .toast-success { border-color: #22c55e; }
            .toast-error { border-color: #ef4444; }
            .toast button {
                background: none;
                border: none;
                color: var(--text-muted);
                font-size: 18px;
                cursor: pointer;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ===== Show Notifications =====
function showNotifications() {
    // Switch to requests tab
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-tab="requests"]').classList.add('active');

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById('requestsTab').classList.add('active');
}

// ===== Show Settings =====
function showSettings() {
    alert('Settings page coming soon!');
}

// ===== Posts/Feed Functions =====
async function loadPosts() {
    const data = await apiCall(`/api/posts?page=${postsPage}&limit=10`);

    if (data && data.success) {
        posts = data.data.posts;
        renderPosts();

        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMorePosts');
        if (loadMoreBtn) {
            if (data.data.pagination.page < data.data.pagination.pages) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }
}

function renderPosts() {
    const feed = document.getElementById('postsFeed');

    if (!feed) return;

    if (posts.length === 0) {
        feed.innerHTML = `
            <div class="empty-feed">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <h3>No posts yet</h3>
                <p>Be the first to share something with your network!</p>
            </div>
        `;
        return;
    }

    feed.innerHTML = posts.map(post => createPostCard(post)).join('');
}

function createPostCard(post) {
    const author = post.author;
    const initials = `${author.firstName[0]}${author.lastName[0]}`.toUpperCase();
    const isLiked = post.likes.includes(currentUser?._id);
    const timeAgo = getTimeAgo(post.createdAt);

    return `
        <div class="post-card" data-post-id="${post._id}">
            <div class="post-header">
                <div class="post-avatar">${initials}</div>
                <div class="post-author-details">
                    <span class="post-author-name">${author.firstName} ${author.lastName}</span>
                    <span class="post-author-info-line">${author.collegeName}${author.course ? ` • ${author.course}` : ''}</span>
                    <span class="post-time">${timeAgo}</span>
                </div>
            </div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-stats">
                <span class="post-stat">${post.likes.length} ${post.likes.length === 1 ? 'like' : 'likes'}</span>
                <span class="post-stat">${post.comments.length} ${post.comments.length === 1 ? 'comment' : 'comments'}</span>
            </div>
            <div class="post-actions">
                <button class="post-action ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post._id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                    <span>Like</span>
                </button>
                <button class="post-action" onclick="toggleComments('${post._id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Comment</span>
                </button>
            </div>
            <div class="post-comments" id="comments-${post._id}" style="display: none;">
                <div class="comment-input-wrapper">
                    <input type="text" class="comment-input" id="comment-input-${post._id}" placeholder="Write a comment...">
                    <button class="comment-submit" onclick="submitComment('${post._id}')">Post</button>
                </div>
                <div class="comments-list" id="comments-list-${post._id}">
                    ${post.comments.map(comment => createCommentHtml(comment)).join('')}
                </div>
            </div>
        </div>
    `;
}

function createCommentHtml(comment) {
    const user = comment.user;
    const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    const timeAgo = getTimeAgo(comment.createdAt);

    return `
        <div class="comment-item">
            <div class="comment-avatar">${initials}</div>
            <div class="comment-content">
                <span class="comment-author">${user.firstName} ${user.lastName}</span>
                <p class="comment-text">${escapeHtml(comment.content)}</p>
                <span class="comment-time">${timeAgo}</span>
            </div>
        </div>
    `;
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function toggleLike(postId) {
    const data = await apiCall(`/api/posts/${postId}/like`, 'POST');

    if (data && data.success) {
        // Update UI
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);
        const likeBtn = postCard.querySelector('.post-action');
        const statsSpan = postCard.querySelector('.post-stat');

        if (data.data.isLiked) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }

        statsSpan.textContent = `${data.data.likes} ${data.data.likes === 1 ? 'like' : 'likes'}`;
    }
}

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        document.getElementById(`comment-input-${postId}`).focus();
    } else {
        commentsSection.style.display = 'none';
    }
}

async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();

    if (!content) return;

    const data = await apiCall(`/api/posts/${postId}/comment`, 'POST', { content });

    if (data && data.success) {
        const commentsList = document.getElementById(`comments-list-${postId}`);
        commentsList.innerHTML += createCommentHtml(data.data.comment);
        input.value = '';

        // Update comment count
        const postCard = document.querySelector(`[data-post-id="${postId}"]`);
        const statsSpans = postCard.querySelectorAll('.post-stat');
        const commentCount = document.querySelectorAll(`#comments-list-${postId} .comment-item`).length;
        statsSpans[1].textContent = `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`;
    }
}

// ===== Create Post Modal =====
function openCreatePostModal() {
    const overlay = document.getElementById('postModalOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Update modal user info
    if (currentUser) {
        const initials = `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
        document.getElementById('modalUserAvatar').textContent = initials;
        document.getElementById('postUserAvatar').textContent = initials;
        document.getElementById('modalUserName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        document.getElementById('modalUserCollege').textContent = currentUser.collegeName;
    }

    setTimeout(() => {
        document.getElementById('postContent').focus();
    }, 100);
}

function closePostModal() {
    const overlay = document.getElementById('postModalOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('postContent').value = '';
}

async function submitPost() {
    const content = document.getElementById('postContent').value.trim();
    const btn = document.getElementById('submitPostBtn');

    if (!content) {
        showToast('Please write something to post', 'error');
        return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    const data = await apiCall('/api/posts', 'POST', { content });

    btn.classList.remove('loading');
    btn.disabled = false;

    if (data && data.success) {
        closePostModal();
        showToast('Post created successfully!', 'success');
        // Add new post to the top of the feed
        posts.unshift(data.data.post);
        renderPosts();
    } else {
        showToast(data?.message || 'Error creating post', 'error');
    }
}

async function loadMorePosts() {
    postsPage++;
    const data = await apiCall(`/api/posts?page=${postsPage}&limit=10`);

    if (data && data.success) {
        posts = [...posts, ...data.data.posts];
        renderPosts();

        if (data.data.pagination.page >= data.data.pagination.pages) {
            document.getElementById('loadMorePosts').style.display = 'none';
        }
    }
}
