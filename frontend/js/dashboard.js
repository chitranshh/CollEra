// Attach review modal functions to window for modal button compatibility
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;
// Attach modal and college functions to window for inline onclick compatibility
window.openCollegeDetails = openCollegeDetails;
window.closeCollegeDetails = typeof closeCollegeDetails !== 'undefined' ? closeCollegeDetails : () => { };
window.openReviewModal = typeof openReviewModal !== 'undefined' ? openReviewModal : () => { };
window.handleCollegeSearch = handleCollegeSearch;
window.filterColleges = filterColleges;
// Attach modal and college functions to window for inline onclick compatibility
window.openCollegeDetails = openCollegeDetails;
window.closeCollegeDetails = closeCollegeDetails;
window.openReviewModal = openReviewModal;
window.handleCollegeSearch = handleCollegeSearch;
window.filterColleges = filterColleges;
// ===== Dashboard JavaScript =====

// ===== API Configuration =====
const API_BASE_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : window.location.hostname.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\./)
            ? 'http://localhost:3000'
            : window.location.origin.includes('collera')
                ? '' // production: same origin
                : 'http://localhost:3000'; // fallback for dev

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

// Chat state
let socket = null;
let conversations = [];
let currentConversation = null;
let currentChatPartner = null;
let typingTimeout = null;

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

    // Initialize Socket.io connection
    initSocketConnection();

    // Load initial data
    await Promise.all([
        loadPosts(),
        loadUsers(),
        loadConnections(),
        loadPendingRequests(),
        loadSuggestions(),
        loadConversations(),
        loadUnreadCount()
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
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
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

    // Update main avatar
    const userAvatar = document.getElementById('userAvatar');
    const postUserAvatar = document.getElementById('postUserAvatar');
    const initials = `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    if (currentUser.profilePicture) {
        userAvatar.innerHTML = `<img src="${currentUser.profilePicture}" alt="Profile" class="avatar-img">`;
        if (postUserAvatar) postUserAvatar.innerHTML = `<img src="${currentUser.profilePicture}" alt="Profile" class="avatar-img">`;
    } else {
        userAvatar.textContent = initials;
        if (postUserAvatar) postUserAvatar.textContent = initials;
    }

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

    // Apply filter based on currentFilter
    if (currentFilter === 'same-college' && currentUser?.collegeName) {
        params.append('college', currentUser.collegeName);
    }

    const data = await apiCall(`/api/users?${params}`);

    if (data && data.success) {
        let filteredUsers = data.data.users;

        // For nearby colleges filter, we'll show users from different colleges in same city/region
        if (currentFilter === 'nearby' && currentUser?.collegeName) {
            // Extract city/location from college name or show all except same college
            filteredUsers = data.data.users.filter(u => u.collegeName !== currentUser.collegeName);
        }

        users = filteredUsers;
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

// Filter users by category
function filterUsers(filter) {
    // Update active state
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.classList.remove('active');
        if (tag.dataset.filter === filter) {
            tag.classList.add('active');
        }
    });

    currentFilter = filter;
    currentPage = 1;
    loadUsers();
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
    let messageButton = '';
    if (isConnected) {
        actionButton = '<button class="btn btn-secondary" disabled>Connected</button>';
        messageButton = `<button class="btn btn-secondary message-btn" onclick="event.stopPropagation(); startChatWith('${user._id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        </button>`;
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
                ${messageButton}
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

        // Emit socket event for real-time notification
        if (socket) {
            socket.emit('connection_request', { targetUserId: userId });
        }

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

        // Emit socket event for real-time notification
        if (socket) {
            socket.emit('connection_accepted', { requesterId: userId });
        }

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

            // Load colleges when switching to colleges tab
            if (tabId === 'colleges') {
                renderColleges();
            }
        });
    });
}

// ===== Filters =====
function initFilters() {
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
function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');

    menu.classList.toggle('active');
    dropdown.classList.toggle('active');
}

// Close menu on outside click
document.addEventListener('click', (e) => {
    const menu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');

    if (menu && dropdown && !menu.contains(e.target)) {
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

// ===== Profile Menu Functions =====
function showMyAccount() {
    // Close the dropdown
    try {
        document.getElementById('userDropdown').classList.remove('active');
        document.querySelector('.user-menu').classList.remove('active');
    } catch (e) { }

    // Use currentUser for up-to-date info
    const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    showModal('My Account', `
        <form id="myAccountForm" class="account-info">
            <div class="account-avatar">${user.profilePicture ? `<img src="${user.profilePicture}" alt="Profile" class="avatar-img">` : ((user.firstName ? user.firstName.charAt(0) : '') + (user.lastName ? user.lastName.charAt(0) : '') || 'U')}</div>
            <div class="account-details">
                <label>First Name</label>
                <input type="text" id="accountFirstName" value="${user.firstName || ''}" placeholder="First name" required>
                <label>Last Name</label>
                <input type="text" id="accountLastName" value="${user.lastName || ''}" placeholder="Last name" required>
                <label>Email</label>
                <input type="email" value="${user.email || ''}" disabled>
                <label>College</label>
                <input type="text" id="accountCollege" value="${user.collegeName || ''}" placeholder="Your college">
                <label>Date of Birth</label>
                <input type="date" id="accountDob" value="${user.dob ? new Date(user.dob).toISOString().split('T')[0] : ''}">
                <label>Year</label>
                <input type="number" id="accountYear" value="${user.year || ''}" min="1" max="10">
                <p class="account-joined">Joined: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                <button type="submit" class="btn btn-primary btn-sm" style="margin-top:12px;">Save Changes</button>
            </div>
        </form>
    `);
    setTimeout(() => {
        const form = document.getElementById('myAccountForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const firstName = document.getElementById('accountFirstName').value;
                const lastName = document.getElementById('accountLastName').value;
                const collegeName = document.getElementById('accountCollege').value;
                const dob = document.getElementById('accountDob').value;
                const year = document.getElementById('accountYear').value;
                const updateData = { firstName, lastName, collegeName, dob, year: year ? parseInt(year) : undefined };
                const data = await apiCall('/api/users/profile', 'PUT', updateData);
                if (data && data.success) {
                    showToast('Account updated!', 'success');
                    await loadCurrentUser();
                    closeModal();
                } else {
                    showToast('Failed to update account', 'error');
                }
            });
        }
    }, 100);
}

function showEditProfile() {
    // Close the dropdown
    try {
        document.getElementById('userDropdown').classList.remove('active');
        document.querySelector('.user-menu').classList.remove('active');
    } catch (e) { }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const dobValue = user.dob ? new Date(user.dob).toISOString().split('T')[0] : '';

    showModal('Edit Profile', `
        <form id="editProfileForm" class="edit-profile-form">
            <div class="profile-picture-section">
                <div class="profile-picture-preview" id="profilePicturePreview">
                    ${user.profilePicture ? `<img src="${user.profilePicture}" alt="Profile">` : `<span>${user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>`}
                </div>
                <div class="profile-picture-upload">
                    <label for="profilePictureInput" class="btn btn-secondary btn-sm">Change Photo</label>
                    <input type="file" id="profilePictureInput" accept="image/*" style="display: none;" onchange="handleProfilePictureChange(event)">
                    <p class="upload-hint">JPG, PNG or GIF. Max 2MB</p>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="editName" value="${user.name || ''}" placeholder="Your full name">
                </div>
                <div class="form-group">
                    <label>Pronouns</label>
                    <select id="editPronouns">
                        <option value="" ${!user.pronouns ? 'selected' : ''}>Select pronouns</option>
                        <option value="he/him" ${user.pronouns === 'he/him' ? 'selected' : ''}>He/Him</option>
                        <option value="she/her" ${user.pronouns === 'she/her' ? 'selected' : ''}>She/Her</option>
                        <option value="they/them" ${user.pronouns === 'they/them' ? 'selected' : ''}>They/Them</option>
                        <option value="other" ${user.pronouns === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="editDob" value="${dobValue}">
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <select id="editYear">
                        <option value="" ${!user.year ? 'selected' : ''}>Select year</option>
                        <option value="1" ${user.year === 1 ? 'selected' : ''}>1st Year</option>
                        <option value="2" ${user.year === 2 ? 'selected' : ''}>2nd Year</option>
                        <option value="3" ${user.year === 3 ? 'selected' : ''}>3rd Year</option>
                        <option value="4" ${user.year === 4 ? 'selected' : ''}>4th Year</option>
                        <option value="5" ${user.year === 5 ? 'selected' : ''}>5th Year</option>
                        <option value="6" ${user.year === 6 ? 'selected' : ''}>6th Year</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label>Branch / Department</label>
                <input type="text" id="editBranch" value="${user.branch || ''}" placeholder="e.g., Computer Science, Mechanical Engineering">
            </div>
            
            <div class="form-group">
                <label>Bio</label>
                <textarea id="editBio" placeholder="Tell us about yourself" rows="3">${user.bio || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Skills (comma-separated)</label>
                <input type="text" id="editSkills" value="${user.skills ? user.skills.join(', ') : ''}" placeholder="e.g., JavaScript, Python, Design">
            </div>
            
            <div class="form-group">
                <label>Areas of Interest (comma-separated)</label>
                <input type="text" id="editInterests" value="${user.interests ? user.interests.join(', ') : ''}" placeholder="e.g., AI, Web Development, Data Science">
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>LinkedIn URL</label>
                    <input type="url" id="editLinkedin" value="${user.linkedin || ''}" placeholder="https://linkedin.com/in/...">
                </div>
                <div class="form-group">
                    <label>GitHub URL</label>
                    <input type="url" id="editGithub" value="${user.github || ''}" placeholder="https://github.com/...">
                </div>
            </div>
            
            <button type="submit" class="btn btn-primary btn-full">Save Changes</button>
        </form>
    `);

    // Add form submit handler
    setTimeout(() => {
        const form = document.getElementById('editProfileForm');
        if (form) {
            form.addEventListener('submit', handleEditProfile);
        }
    }, 100);
}

let profilePictureBase64 = null;

function handleProfilePictureChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image size should be less than 2MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        profilePictureBase64 = e.target.result;
        const preview = document.getElementById('profilePicturePreview');
        preview.innerHTML = `<img src="${profilePictureBase64}" alt="Profile">`;
    };
    reader.readAsDataURL(file);
}

async function handleEditProfile(e) {
    e.preventDefault();

    const name = document.getElementById('editName').value;
    const bio = document.getElementById('editBio').value;
    const skills = document.getElementById('editSkills').value.split(',').map(s => s.trim()).filter(s => s);
    const interests = document.getElementById('editInterests').value.split(',').map(s => s.trim()).filter(s => s);
    const linkedin = document.getElementById('editLinkedin').value;
    const github = document.getElementById('editGithub').value;
    const pronouns = document.getElementById('editPronouns').value;
    const dob = document.getElementById('editDob').value;
    const year = document.getElementById('editYear').value ? parseInt(document.getElementById('editYear').value) : null;
    const branch = document.getElementById('editBranch').value;
    const profilePicture = profilePictureBase64 || undefined;

    const updateData = { name, bio, skills, interests, linkedin, github, pronouns, dob, year, branch };
    if (profilePicture) {
        updateData.profilePicture = profilePicture;
    }

    const data = await apiCall('/api/users/profile', 'PUT', updateData);

    if (data && data.success) {
        // Update local storage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        Object.assign(user, { name, bio, skills, interests, linkedin, github, pronouns, dob, year, branch });
        if (profilePicture) {
            user.profilePicture = profilePicture;
        }
        localStorage.setItem('user', JSON.stringify(user));

        // Update UI
        document.getElementById('userName').textContent = name;
        document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
        document.getElementById('postUserAvatar').textContent = name.charAt(0).toUpperCase();

        // Reset profile picture state
        profilePictureBase64 = null;

        closeModal();
        showToast('Profile updated successfully!', 'success');
    } else {
        showToast(data?.message || 'Failed to update profile', 'error');
    }
}

function showHelpCenter() {
    // Close the dropdown
    document.getElementById('userDropdown').classList.remove('active');
    document.querySelector('.user-menu').classList.remove('active');

    showModal('Help Center', `
        <div class="help-center">
            <div class="help-section">
                <h4>📧 Contact Support</h4>
                <p>Email us at <a href="mailto:support@collera.in">support@collera.in</a></p>
            </div>
            <div class="help-section">
                <h4>❓ FAQs</h4>
                <div class="faq-item">
                    <strong>How do I connect with other students?</strong>
                    <p>Go to the Explore tab to find students and send connection requests.</p>
                </div>
                <div class="faq-item">
                    <strong>How do I create a post?</strong>
                    <p>Click on "What's on your mind?" in the Home Feed to create a new post.</p>
                </div>
                <div class="faq-item">
                    <strong>How do I edit my profile?</strong>
                    <p>Click on your profile menu and select "Edit Profile".</p>
                </div>
            </div>
            <div class="help-section">
                <h4>📚 About CollEra</h4>
                <p>CollEra is a platform that connects college students across India for collaboration, networking, and knowledge sharing.</p>
            </div>
        </div>
    `);
}

function showDeleteAccount() {
    // Close the dropdown
    document.getElementById('userDropdown').classList.remove('active');
    document.querySelector('.user-menu').classList.remove('active');

    showModal('Delete Account', `
        <div class="delete-account-warning">
            <div class="warning-icon">⚠️</div>
            <h3>Are you sure you want to delete your account?</h3>
            <p>This action <strong>cannot be undone</strong>. All your data, posts, connections, and messages will be <strong>permanently deleted</strong>.</p>
            <div class="confirm-delete-input">
                <label>Type <strong>DELETE</strong> to confirm:</label>
                <input type="text" id="deleteConfirmInput" placeholder="Type DELETE here" autocomplete="off">
            </div>
            <div class="delete-account-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-danger" id="deleteAccountBtn" onclick="confirmDeleteAccount()" disabled>Delete My Account</button>
            </div>
        </div>
    `);

    // Enable delete button only when user types DELETE
    const input = document.getElementById('deleteConfirmInput');
    const deleteBtn = document.getElementById('deleteAccountBtn');

    input.addEventListener('input', () => {
        if (input.value.toUpperCase() === 'DELETE') {
            deleteBtn.disabled = false;
            deleteBtn.classList.add('enabled');
        } else {
            deleteBtn.disabled = true;
            deleteBtn.classList.remove('enabled');
        }
    });
}

async function confirmDeleteAccount() {
    const input = document.getElementById('deleteConfirmInput');
    if (input.value.toUpperCase() !== 'DELETE') {
        showToast('Please type DELETE to confirm', 'error');
        return;
    }

    const deleteBtn = document.getElementById('deleteAccountBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner"></span> Deleting...';

    const data = await apiCall('/api/users/account', 'DELETE');

    if (data && data.success) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        closeModal();
        showToast('Account deleted successfully', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } else {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = 'Delete My Account';
        showToast(data?.message || 'Failed to delete account', 'error');
    }
}

// ===== Modal Helper Functions =====
function showModal(title, content) {
    // Remove existing modal if any
    closeModal();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'genericModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function closeModal() {
    const modal = document.getElementById('genericModal');
    if (modal) modal.remove();
}

// ===== Posts/Feed Functions =====
const MIN_CONNECTIONS_FOR_FEED = 3; // Minimum connections before showing full feed

async function loadPosts() {
    const data = await apiCall(`/api/posts?page=${postsPage}&limit=10`);

    if (data && data.success) {
        posts = data.data.posts;
        renderFeed();

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

function renderFeed() {
    const feed = document.getElementById('postsFeed');
    if (!feed) return;

    const connectionCount = currentUser?.connections?.length || 0;

    // If user has few connections, show connection suggestions on home feed
    if (connectionCount < MIN_CONNECTIONS_FOR_FEED) {
        renderConnectionSuggestionsFeed(feed);
    } else {
        // User has enough connections - show normal post feed
        renderPosts();
    }
}

// Render connection suggestions on home feed for new users
function renderConnectionSuggestionsFeed(feed) {
    const connectionCount = currentUser?.connections?.length || 0;


    feed.innerHTML = `
        <div class="feed-welcome-card">
            <div class="welcome-header">
                <div class="welcome-icon">👋</div>
                <div class="welcome-text">
                    <h2>Welcome to CollEra!</h2>
                    <p>Connect with ${MIN_CONNECTIONS_FOR_FEED - connectionCount} more student${(MIN_CONNECTIONS_FOR_FEED - connectionCount) !== 1 ? 's' : ''} to unlock your personalized feed</p>
                </div>
            </div>
            <div class="connection-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(connectionCount / MIN_CONNECTIONS_FOR_FEED) * 100}%"></div>
                </div>
                <span class="progress-text">${connectionCount}/${MIN_CONNECTIONS_FOR_FEED} connections</span>
            </div>
        </div>

        <div class="feed-suggestions-section">
            <div class="section-header">
                <h3>People you may know</h3>
                <a href="#" onclick="switchToTab('explore'); return false;">See all</a>
            </div>
            <div class="feed-suggestions-grid" id="feedSuggestionsGrid">
                <div class="loading-spinner small loading-rotate-group">
                    <div class="spinner"></div>
                    <span class="loading-text">Loading...</span>
                </div>
            </div>
        </div>

        <div class="feed-suggestions-section">
            <div class="section-header">
                <h3>Students from your college</h3>
            </div>
            <div class="feed-suggestions-grid" id="sameCollegeSuggestionsGrid">
                <div class="loading-spinner small loading-rotate-group">
                    <div class="spinner"></div>
                    <span class="loading-text">Loading...</span>
                </div>
            </div>
        </div>
    `;

    // Load suggestions for the feed
    loadFeedSuggestions();
}

// Load suggestions specifically for the home feed
async function loadFeedSuggestions() {
    // Load general suggestions
    const data = await apiCall('/api/users?limit=6');
    if (data && data.success) {
        const suggestionsGrid = document.getElementById('feedSuggestionsGrid');
        if (suggestionsGrid) {
            const filteredUsers = data.data.users.filter(u =>
                u._id !== currentUser?._id &&
                !currentUser?.connections?.some(c => c._id === u._id || c === u._id) &&
                !currentUser?.sentRequests?.some(r => r._id === u._id || r === u._id)
            );

            if (filteredUsers.length === 0) {
                suggestionsGrid.innerHTML = '<p class="no-suggestions">No suggestions available</p>';
            } else {
                suggestionsGrid.innerHTML = filteredUsers.slice(0, 6).map(user => createFeedSuggestionCard(user)).join('');
            }
        }
    }

    // Load same college suggestions
    const sameCollegeData = await apiCall(`/api/users?college=${encodeURIComponent(currentUser?.collegeName || '')}&limit=6`);
    if (sameCollegeData && sameCollegeData.success) {
        const sameCollegeGrid = document.getElementById('sameCollegeSuggestionsGrid');
        if (sameCollegeGrid) {
            const filteredUsers = sameCollegeData.data.users.filter(u =>
                u._id !== currentUser?._id &&
                !currentUser?.connections?.some(c => c._id === u._id || c === u._id) &&
                !currentUser?.sentRequests?.some(r => r._id === u._id || r === u._id)
            );

            if (filteredUsers.length === 0) {
                sameCollegeGrid.innerHTML = '<p class="no-suggestions">No students from your college found</p>';
            } else {
                sameCollegeGrid.innerHTML = filteredUsers.slice(0, 6).map(user => createFeedSuggestionCard(user)).join('');
            }
        }
    }
}

// Create a suggestion card for the feed
function createFeedSuggestionCard(user) {
    const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    const isPending = currentUser?.sentRequests?.some(r => r._id === user._id || r === user._id);
    const mutualConnections = countMutualConnections(user);

    return `
        <div class="feed-suggestion-card" data-user-id="${user._id}">
            <div class="suggestion-card-avatar">
                ${initials}
                ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
            </div>
            <div class="suggestion-card-info">
                <h4 class="suggestion-card-name">${user.firstName} ${user.lastName}</h4>
                <p class="suggestion-card-college">${user.collegeName}</p>
                ${user.course ? `<p class="suggestion-card-course">${user.course}${user.year ? ` • Year ${user.year}` : ''}</p>` : ''}
                ${mutualConnections > 0 ? `<p class="mutual-connections">${mutualConnections} mutual connection${mutualConnections > 1 ? 's' : ''}</p>` : ''}
            </div>
            <div class="suggestion-card-actions">
                ${isPending ?
            '<button class="btn btn-secondary btn-sm" disabled>Pending</button>' :
            `<button class="btn btn-primary btn-sm" onclick="sendConnectionRequest('${user._id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <line x1="20" y1="8" x2="20" y2="14"/>
                            <line x1="23" y1="11" x2="17" y2="11"/>
                        </svg>
                        Connect
                    </button>`
        }
                <button class="btn btn-ghost btn-sm" onclick="viewProfile('${user._id}')">View</button>
            </div>
        </div>
    `;
}

// Count mutual connections
function countMutualConnections(user) {
    if (!currentUser?.connections || !user.connections) return 0;
    const userConnections = user.connections.map(c => c._id || c);
    const myConnections = currentUser.connections.map(c => c._id || c);
    return userConnections.filter(c => myConnections.includes(c)).length;
}

// Switch to a specific tab
function switchToTab(tabName) {
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}Tab`)?.classList.add('active');
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
// ===== Colleges Tab - NIRF Rankings Data =====
const nirfColleges = [
    // Top Overall Rankings
    { rank: 1, name: "Indian Institute of Technology Madras", location: "Chennai, Tamil Nadu", type: "engineering", category: "overall", score: 90.04, established: 1959 },
    { rank: 2, name: "Indian Institute of Technology Delhi", location: "New Delhi", type: "engineering", category: "overall", score: 88.17, established: 1961 },
    { rank: 3, name: "Indian Institute of Technology Bombay", location: "Mumbai, Maharashtra", type: "engineering", category: "overall", score: 85.35, established: 1958 },
    { rank: 4, name: "Indian Institute of Science", location: "Bengaluru, Karnataka", type: "university", category: "overall", score: 83.57, established: 1909 },
    { rank: 5, name: "Indian Institute of Technology Kanpur", location: "Kanpur, Uttar Pradesh", type: "engineering", category: "overall", score: 82.56, established: 1959 },
    { rank: 6, name: "Indian Institute of Technology Kharagpur", location: "Kharagpur, West Bengal", type: "engineering", category: "overall", score: 78.89, established: 1951 },
    { rank: 7, name: "Indian Institute of Technology Roorkee", location: "Roorkee, Uttarakhand", type: "engineering", category: "overall", score: 76.70, established: 1847 },
    { rank: 8, name: "Indian Institute of Technology Guwahati", location: "Guwahati, Assam", type: "engineering", category: "overall", score: 71.77, established: 1994 },
    { rank: 9, name: "All India Institute of Medical Sciences", location: "New Delhi", type: "medical", category: "overall", score: 70.89, established: 1956 },
    { rank: 10, name: "Jawaharlal Nehru University", location: "New Delhi", type: "university", category: "overall", score: 69.47, established: 1969 },

    // Engineering Colleges
    { rank: 11, name: "National Institute of Technology Tiruchirappalli", location: "Tiruchirappalli, Tamil Nadu", type: "engineering", category: "engineering", score: 68.54, established: 1964 },
    { rank: 12, name: "Indian Institute of Technology Hyderabad", location: "Hyderabad, Telangana", type: "engineering", category: "engineering", score: 67.89, established: 2008 },
    { rank: 13, name: "National Institute of Technology Karnataka", location: "Surathkal, Karnataka", type: "engineering", category: "engineering", score: 66.23, established: 1960 },
    { rank: 14, name: "Indian Institute of Technology Indore", location: "Indore, Madhya Pradesh", type: "engineering", category: "engineering", score: 65.78, established: 2009 },
    { rank: 15, name: "Indian Institute of Technology BHU", location: "Varanasi, Uttar Pradesh", type: "engineering", category: "engineering", score: 65.12, established: 1919 },
    { rank: 16, name: "Vellore Institute of Technology", location: "Vellore, Tamil Nadu", type: "engineering", category: "engineering", score: 64.56, established: 1984 },
    { rank: 17, name: "National Institute of Technology Warangal", location: "Warangal, Telangana", type: "engineering", category: "engineering", score: 63.89, established: 1959 },
    { rank: 18, name: "Indian Institute of Technology Patna", location: "Patna, Bihar", type: "engineering", category: "engineering", score: 63.45, established: 2008 },
    { rank: 19, name: "Indian Institute of Technology Bhubaneswar", location: "Bhubaneswar, Odisha", type: "engineering", category: "engineering", score: 62.78, established: 2008 },
    { rank: 20, name: "Jadavpur University", location: "Kolkata, West Bengal", type: "engineering", category: "engineering", score: 62.34, established: 1955 },
    { rank: 21, name: "BITS Pilani", location: "Pilani, Rajasthan", type: "engineering", category: "engineering", score: 61.89, established: 1964 },
    { rank: 22, name: "National Institute of Technology Rourkela", location: "Rourkela, Odisha", type: "engineering", category: "engineering", score: 61.23, established: 1961 },
    { rank: 23, name: "Delhi Technological University", location: "New Delhi", type: "engineering", category: "engineering", score: 60.78, established: 1941 },
    { rank: 24, name: "Indian Institute of Technology Dhanbad", location: "Dhanbad, Jharkhand", type: "engineering", category: "engineering", score: 60.12, established: 1926 },
    { rank: 25, name: "Amrita Vishwa Vidyapeetham", location: "Coimbatore, Tamil Nadu", type: "engineering", category: "engineering", score: 59.67, established: 1994 },
    { rank: 26, name: "National Institute of Technology Calicut", location: "Kozhikode, Kerala", type: "engineering", category: "engineering", score: 59.23, established: 1961 },
    { rank: 27, name: "Thapar Institute of Engineering", location: "Patiala, Punjab", type: "engineering", category: "engineering", score: 58.89, established: 1956 },
    { rank: 28, name: "College of Engineering Pune", location: "Pune, Maharashtra", type: "engineering", category: "engineering", score: 58.45, established: 1854 },
    { rank: 29, name: "SRM Institute of Science and Technology", location: "Chennai, Tamil Nadu", type: "engineering", category: "engineering", score: 57.89, established: 1985 },
    { rank: 30, name: "PSG College of Technology", location: "Coimbatore, Tamil Nadu", type: "engineering", category: "engineering", score: 57.34, established: 1951 },

    // Management Colleges
    { rank: 1, name: "Indian Institute of Management Ahmedabad", location: "Ahmedabad, Gujarat", type: "management", category: "management", score: 89.25, established: 1961 },
    { rank: 2, name: "Indian Institute of Management Bangalore", location: "Bengaluru, Karnataka", type: "management", category: "management", score: 87.82, established: 1973 },
    { rank: 3, name: "Indian Institute of Management Calcutta", location: "Kolkata, West Bengal", type: "management", category: "management", score: 85.45, established: 1961 },
    { rank: 4, name: "Indian Institute of Management Kozhikode", location: "Kozhikode, Kerala", type: "management", category: "management", score: 79.23, established: 1996 },
    { rank: 5, name: "Indian Institute of Management Lucknow", location: "Lucknow, Uttar Pradesh", type: "management", category: "management", score: 78.67, established: 1984 },
    { rank: 6, name: "Indian Institute of Management Indore", location: "Indore, Madhya Pradesh", type: "management", category: "management", score: 76.89, established: 1996 },
    { rank: 7, name: "XLRI - Xavier School of Management", location: "Jamshedpur, Jharkhand", type: "management", category: "management", score: 74.56, established: 1949 },
    { rank: 8, name: "Indian Institute of Management Tiruchirappalli", location: "Tiruchirappalli, Tamil Nadu", type: "management", category: "management", score: 72.34, established: 2011 },
    { rank: 9, name: "Management Development Institute", location: "Gurugram, Haryana", type: "management", category: "management", score: 71.89, established: 1973 },
    { rank: 10, name: "Faculty of Management Studies, Delhi", location: "New Delhi", type: "management", category: "management", score: 70.45, established: 1954 },
    { rank: 11, name: "Indian Institute of Management Raipur", location: "Raipur, Chhattisgarh", type: "management", category: "management", score: 69.23, established: 2010 },
    { rank: 12, name: "SP Jain Institute of Management", location: "Mumbai, Maharashtra", type: "management", category: "management", score: 68.78, established: 1981 },
    { rank: 13, name: "Indian Institute of Management Ranchi", location: "Ranchi, Jharkhand", type: "management", category: "management", score: 67.89, established: 2010 },
    { rank: 14, name: "National Institute of Industrial Engineering", location: "Mumbai, Maharashtra", type: "management", category: "management", score: 66.45, established: 1963 },
    { rank: 15, name: "Indian Institute of Management Kashipur", location: "Kashipur, Uttarakhand", type: "management", category: "management", score: 65.67, established: 2011 },

    // Medical Colleges
    { rank: 1, name: "All India Institute of Medical Sciences", location: "New Delhi", type: "medical", category: "medical", score: 91.23, established: 1956 },
    { rank: 2, name: "Post Graduate Institute of Medical Education", location: "Chandigarh", type: "medical", category: "medical", score: 85.67, established: 1962 },
    { rank: 3, name: "Christian Medical College", location: "Vellore, Tamil Nadu", type: "medical", category: "medical", score: 82.34, established: 1900 },
    { rank: 4, name: "National Institute of Mental Health", location: "Bengaluru, Karnataka", type: "medical", category: "medical", score: 78.89, established: 1954 },
    { rank: 5, name: "Sanjay Gandhi Postgraduate Institute", location: "Lucknow, Uttar Pradesh", type: "medical", category: "medical", score: 76.45, established: 1983 },
    { rank: 6, name: "AIIMS Jodhpur", location: "Jodhpur, Rajasthan", type: "medical", category: "medical", score: 74.23, established: 2012 },
    { rank: 7, name: "Jawaharlal Institute of Postgraduate Medical Education", location: "Puducherry", type: "medical", category: "medical", score: 73.67, established: 1823 },
    { rank: 8, name: "King George's Medical University", location: "Lucknow, Uttar Pradesh", type: "medical", category: "medical", score: 72.34, established: 1911 },
    { rank: 9, name: "Kasturba Medical College", location: "Manipal, Karnataka", type: "medical", category: "medical", score: 71.89, established: 1953 },
    { rank: 10, name: "Armed Forces Medical College", location: "Pune, Maharashtra", type: "medical", category: "medical", score: 70.45, established: 1948 },
    { rank: 11, name: "AIIMS Bhubaneswar", location: "Bhubaneswar, Odisha", type: "medical", category: "medical", score: 69.23, established: 2012 },
    { rank: 12, name: "AIIMS Rishikesh", location: "Rishikesh, Uttarakhand", type: "medical", category: "medical", score: 68.78, established: 2012 },
    { rank: 13, name: "Maulana Azad Medical College", location: "New Delhi", type: "medical", category: "medical", score: 67.45, established: 1958 },
    { rank: 14, name: "Seth GS Medical College", location: "Mumbai, Maharashtra", type: "medical", category: "medical", score: 66.89, established: 1926 },
    { rank: 15, name: "Grant Medical College", location: "Mumbai, Maharashtra", type: "medical", category: "medical", score: 65.34, established: 1845 },

    // Universities
    { rank: 1, name: "Indian Institute of Science", location: "Bengaluru, Karnataka", type: "university", category: "university", score: 88.47, established: 1909 },
    { rank: 2, name: "Jawaharlal Nehru University", location: "New Delhi", type: "university", category: "university", score: 82.56, established: 1969 },
    { rank: 3, name: "Banaras Hindu University", location: "Varanasi, Uttar Pradesh", type: "university", category: "university", score: 78.34, established: 1916 },
    { rank: 4, name: "University of Delhi", location: "New Delhi", type: "university", category: "university", score: 75.89, established: 1922 },
    { rank: 5, name: "Jadavpur University", location: "Kolkata, West Bengal", type: "university", category: "university", score: 73.45, established: 1955 },
    { rank: 6, name: "Anna University", location: "Chennai, Tamil Nadu", type: "university", category: "university", score: 71.23, established: 1978 },
    { rank: 7, name: "University of Hyderabad", location: "Hyderabad, Telangana", type: "university", category: "university", score: 69.78, established: 1974 },
    { rank: 8, name: "Calcutta University", location: "Kolkata, West Bengal", type: "university", category: "university", score: 68.45, established: 1857 },
    { rank: 9, name: "Manipal Academy of Higher Education", location: "Manipal, Karnataka", type: "university", category: "university", score: 67.23, established: 1953 },
    { rank: 10, name: "Amrita Vishwa Vidyapeetham", location: "Coimbatore, Tamil Nadu", type: "university", category: "university", score: 66.78, established: 2003 },
    { rank: 11, name: "Savitribai Phule Pune University", location: "Pune, Maharashtra", type: "university", category: "university", score: 65.45, established: 1949 },
    { rank: 12, name: "Aligarh Muslim University", location: "Aligarh, Uttar Pradesh", type: "university", category: "university", score: 64.89, established: 1920 },
    { rank: 13, name: "Jamia Millia Islamia", location: "New Delhi", type: "university", category: "university", score: 64.23, established: 1920 },
    { rank: 14, name: "University of Mumbai", location: "Mumbai, Maharashtra", type: "university", category: "university", score: 63.56, established: 1857 },
    { rank: 15, name: "Bharathiar University", location: "Coimbatore, Tamil Nadu", type: "university", category: "university", score: 62.78, established: 1982 },
    { rank: 16, name: "Osmania University", location: "Hyderabad, Telangana", type: "university", category: "university", score: 61.45, established: 1918 },
    { rank: 17, name: "Panjab University", location: "Chandigarh", type: "university", category: "university", score: 60.89, established: 1882 },
    { rank: 18, name: "Visva-Bharati University", location: "Santiniketan, West Bengal", type: "university", category: "university", score: 59.67, established: 1921 },
    { rank: 19, name: "Madras University", location: "Chennai, Tamil Nadu", type: "university", category: "university", score: 58.45, established: 1857 },
    { rank: 20, name: "KIIT University", location: "Bhubaneswar, Odisha", type: "university", category: "university", score: 57.23, established: 1997 }
];

let collegeFilter = 'all';
let collegeSearchTerm = '';

// Generate comprehensive colleges list combining NIRF data with the full college list
function getAllColleges() {
    // Keep existing NIRF colleges with their detailed data
    const nirfCollegesMap = new Map(nirfColleges.map(c => [c.name.toLowerCase(), c]));

    // Add remaining colleges from the comprehensive list
    const allColleges = typeof sortedCollegeList !== 'undefined' ? sortedCollegeList : [];
    let rankCounter = nirfColleges.length + 1;

    const additionalColleges = allColleges
        .filter(name => !nirfCollegesMap.has(name.toLowerCase()))
        .map(name => ({
            rank: rankCounter++,
            name: name,
            location: 'India',
            type: guessCollegeType(name),
            category: guessCollegeCategory(name),
            score: null,
            established: null
        }));

    return [...nirfColleges, ...additionalColleges];
}

function guessCollegeType(name) {
    const lower = name.toLowerCase();
    if (lower.includes('iim') || lower.includes('management') || lower.includes('business')) return 'management';
    if (lower.includes('medical') || lower.includes('aiims') || lower.includes('health')) return 'medical';
    if (lower.includes('university') || lower.includes('vishwavidyalaya')) return 'university';
    return 'engineering';
}

function guessCollegeCategory(name) {
    const lower = name.toLowerCase();
    if (lower.includes('iim') || lower.includes('management') || lower.includes('business')) return 'management';
    if (lower.includes('medical') || lower.includes('aiims') || lower.includes('health')) return 'medical';
    if (lower.includes('university') || lower.includes('vishwavidyalaya')) return 'university';
    return 'engineering';
}

const allCollegesData = getAllColleges();

function renderColleges() {
    const grid = document.getElementById('collegesGrid');
    if (!grid) return;

    let filteredColleges = allCollegesData;

    // Apply category filter
    if (collegeFilter !== 'all') {
        filteredColleges = filteredColleges.filter(c =>
            c.category === collegeFilter || c.type === collegeFilter
        );
    }

    // Apply search filter
    if (collegeSearchTerm) {
        const search = collegeSearchTerm.toLowerCase();
        filteredColleges = filteredColleges.filter(c =>
            c.name.toLowerCase().includes(search) ||
            (c.location && c.location.toLowerCase().includes(search)) ||
            c.type.toLowerCase().includes(search)
        );
    }

    // Limit to 50 colleges for performance
    filteredColleges = filteredColleges.slice(0, 50);

    if (filteredColleges.length === 0) {
        grid.innerHTML = `
            <div class="college-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <h3>No colleges found</h3>
                <p>Try adjusting your search or filter criteria</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredColleges.map(college => createCollegeCard(college)).join('');
}

function createCollegeCard(college) {
    const typeIcons = {
        engineering: '🏛️',
        management: '📊',
        medical: '🏥',
        university: '🎓'
    };

    // Check if this is the user's college
    const userCollege = currentUser?.collegeName?.toLowerCase() || '';
    const isUserCollege = userCollege && (
        userCollege.includes(college.name.toLowerCase()) ||
        college.name.toLowerCase().includes(userCollege)
    );
    const yourCollegeBadge = isUserCollege ? '<span class="your-college-badge">✓ Your College</span>' : '';

    const locationDisplay = (college.location || 'India').replace(/'/g, "\\'");

    return `
        <div class="college-card" onclick="openCollegeDetails('${encodeURIComponent(college.name)}', '${college.type}', '${locationDisplay}')">
            <div class="college-icon">${typeIcons[college.type] || '🏫'}</div>
            <h3 class="college-name">${college.name}${yourCollegeBadge}</h3>
            <div class="college-location">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
                ${college.location || 'India'}
            </div>
            <span class="college-type ${college.type}">${college.type.charAt(0).toUpperCase() + college.type.slice(1)}</span>
            <button class="view-reviews-btn" onclick="event.stopPropagation(); openCollegeDetails('${encodeURIComponent(college.name)}', '${college.type}', '${locationDisplay}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                View Reviews
            </button>
        </div>
    `;
}

function filterColleges(filter) {
    collegeFilter = filter;

    // Update active button
    document.querySelectorAll('[data-college-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.collegeFilter === filter);
    });

    renderColleges();
}

function handleCollegeSearch(event) {
    collegeSearchTerm = event.target.value;
    renderColleges();
}

// Initialize colleges when switching to the tab
document.addEventListener('DOMContentLoaded', () => {
    // Initial render if on colleges tab
    const collegesTab = document.getElementById('collegesTab');
    if (collegesTab && collegesTab.classList.contains('active')) {
        renderColleges();
    }

    // Initialize star rating interactions
    initStarRatings();
});

// Render colleges when tab is clicked
const originalInitTabNavigation = typeof initTabNavigation !== 'undefined' ? initTabNavigation : null;

// ===== College Review System =====
let currentViewingCollege = null;
let reviewRatings = {
    overall: 0,
    academics: 0,
    faculty: 0,
    infrastructure: 0,
    placements: 0,
    campusLife: 0
};

function initStarRatings() {
    // Overall rating
    const overallRating = document.getElementById('overallRating');
    if (overallRating) {
        overallRating.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => {
                const value = parseInt(star.dataset.value);
                reviewRatings.overall = value;
                updateStarDisplay(overallRating, value);
            });
            star.addEventListener('mouseenter', () => {
                highlightStars(overallRating, parseInt(star.dataset.value));
            });
            star.addEventListener('mouseleave', () => {
                updateStarDisplay(overallRating, reviewRatings.overall);
            });
        });
    }

    // Specific ratings
    document.querySelectorAll('.specific-ratings .star-rating').forEach(ratingDiv => {
        const category = ratingDiv.dataset.category;
        ratingDiv.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => {
                const value = parseInt(star.dataset.value);
                reviewRatings[category] = value;
                updateStarDisplay(ratingDiv, value);
            });
            star.addEventListener('mouseenter', () => {
                highlightStars(ratingDiv, parseInt(star.dataset.value));
            });
            star.addEventListener('mouseleave', () => {
                updateStarDisplay(ratingDiv, reviewRatings[category]);
            });
        });
    });
}

function updateStarDisplay(container, value) {
    container.querySelectorAll('.star').forEach(star => {
        star.classList.toggle('active', parseInt(star.dataset.value) <= value);
    });
}

function highlightStars(container, value) {
    container.querySelectorAll('.star').forEach(star => {
        star.classList.toggle('active', parseInt(star.dataset.value) <= value);
    });
}

function resetReviewForm() {
    reviewRatings = { overall: 0, academics: 0, faculty: 0, infrastructure: 0, placements: 0, campusLife: 0 };
    document.querySelectorAll('.star-rating .star').forEach(star => star.classList.remove('active'));
    const titleInput = document.getElementById('reviewTitle');
    const contentInput = document.getElementById('reviewContent');
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
}

async function openCollegeDetails(encodedName, type, location) {
    const name = decodeURIComponent(encodedName);
    currentViewingCollege = { name, type, location, membersPage: 1, postsPage: 1 };

    const typeIcons = { engineering: '🏛️', management: '📊', medical: '🏥', university: '🎓' };

    // Update modal header
    document.getElementById('collegeDetailsName').textContent = name;

    // Check if this is user's college
    const userCollege = currentUser?.collegeName?.toLowerCase() || '';
    const isUserCollege = userCollege && (
        userCollege.includes(name.toLowerCase()) ||
        name.toLowerCase().includes(userCollege)
    );

    // Update college info
    document.getElementById('collegeDetailsHeader').innerHTML = `
        <div class="college-details-icon">${typeIcons[type] || '🏫'}</div>
        <div class="college-details-info">
            <h3>${name}</h3>
            <p>📍 ${location}</p>
        </div>
    `;

    // Show/hide write review button based on user's college
    const writeReviewBtn = document.getElementById('writeReviewBtn');
    if (writeReviewBtn) {
        if (isUserCollege) {
            writeReviewBtn.style.display = 'inline-flex';
            writeReviewBtn.textContent = 'Write Review';
        } else {
            writeReviewBtn.style.display = 'none';
        }
    }

    // Reset tabs to members
    switchCollegeTab('members');

    // Show modal
    document.getElementById('collegeDetailsOverlay').style.display = 'flex';

    // Load all data
    await Promise.all([
        loadCollegeMembers(name),
        loadCollegePosts(name),
        loadCollegeReviews(name)
    ]);

    // Update stats
    updateCollegeStats();
}

// Switch between college tabs
function switchCollegeTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.college-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.collegeTab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.college-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById(`college${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// Update college stats
function updateCollegeStats() {
    const userCount = document.getElementById('collegeUserCount');
    const postCount = document.getElementById('collegePostCount');
    const reviewCount = document.getElementById('collegeReviewCount');

    if (userCount) userCount.textContent = collegeMembersTotal || 0;
    if (postCount) postCount.textContent = collegePostsTotal || 0;
    if (reviewCount) reviewCount.textContent = collegeReviewsTotal || 0;
}

// College Members
let collegeMembersData = [];
let collegeMembersTotal = 0;

// College Posts
let collegePostsData = [];
let collegePostsTotal = 0;

// College Reviews Total
let collegeReviewsTotal = 0;

async function loadCollegePosts(collegeName, page = 1) {
    const postsList = document.getElementById('collegePostsList');
    const loadMoreBtn = document.getElementById('loadMoreCollegePosts');

    if (page === 1) {
        postsList.innerHTML = '<div class="loading-spinner small"><div class="spinner"></div></div>';
        collegePostsData = [];
    }

    const data = await apiCall(`/api/posts/college/${encodeURIComponent(collegeName)}?page=${page}&limit=5`);

    if (data && data.success) {
        const { posts, pagination } = data.data;
        collegePostsTotal = pagination.total;

        if (page === 1) {
            collegePostsData = posts;
        } else {
            collegePostsData = [...collegePostsData, ...posts];
        }

        if (collegePostsData.length > 0) {
            postsList.innerHTML = collegePostsData.map(post => createCollegePostCard(post)).join('');

            // Show/hide load more
            if (pagination.page < pagination.pages) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        } else {
            postsList.innerHTML = `
                <div class="college-posts-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    <p>No posts from this college yet</p>
                </div>
            `;
            loadMoreBtn.style.display = 'none';
        }

        // Update current viewing college page
        if (currentViewingCollege) {
            currentViewingCollege.postsPage = page;
        }

        updateCollegeStats();
    }
}

function loadMoreCollegePosts() {
    if (currentViewingCollege) {
        loadCollegePosts(currentViewingCollege.name, currentViewingCollege.postsPage + 1);
    }
}

function createCollegePostCard(post) {
    const author = post.author;
    const initials = `${author.firstName?.[0] || ''}${author.lastName?.[0] || ''}`.toUpperCase();
    const timeAgo = getTimeAgo(new Date(post.createdAt));
    const isLiked = post.likes?.includes(currentUser?.id);

    return `
        <div class="college-post-card">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">${author.profilePicture ? `<img src="${author.profilePicture}" alt="">` : initials}</div>
                    <div class="author-info">
                        <span class="author-name">${author.firstName} ${author.lastName}</span>
                        <span class="post-meta">${author.course || ''} ${author.year ? `• Year ${author.year}` : ''} • ${timeAgo}</span>
                    </div>
                </div>
            </div>
            <div class="post-content">
                <p>${post.content}</p>
                ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image">` : ''}
            </div>
            <div class="post-actions">
                <button class="post-action-btn ${isLiked ? 'liked' : ''}" onclick="likeCollegePost('${post._id}')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span>${post.likes?.length || 0}</span>
                </button>
                <button class="post-action-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>${post.comments?.length || 0}</span>
                </button>
            </div>
        </div>
    `;
}

async function likeCollegePost(postId) {
    const data = await apiCall(`/api/posts/${postId}/like`, 'POST');
    if (data && data.success && currentViewingCollege) {
        // Reload the posts to reflect the change
        loadCollegePosts(currentViewingCollege.name, 1);
    }
}

async function loadCollegeMembers(collegeName, page = 1) {
    const membersList = document.getElementById('collegeMembersList');
    const membersCount = document.getElementById('collegeMembersCount');
    const loadMoreBtn = document.getElementById('loadMoreMembers');
    const tagsSection = document.getElementById('collegeSkillsTags');

    if (page === 1) {
        membersList.innerHTML = '<div class="loading-spinner small"><div class="spinner"></div></div>';
        collegeMembersData = [];
    }

    const data = await apiCall(`/api/users/college/${encodeURIComponent(collegeName)}?page=${page}&limit=6`);

    if (data && data.success) {
        const { users, total, pagination } = data.data;

        // Update count and store total
        collegeMembersTotal = total;
        membersCount.textContent = `${total} member${total !== 1 ? 's' : ''}`;
        updateCollegeStats();

        if (page === 1) {
            collegeMembersData = users;
        } else {
            collegeMembersData = [...collegeMembersData, ...users];
        }

        if (collegeMembersData.length > 0) {
            membersList.innerHTML = collegeMembersData.map(user => createMemberCard(user)).join('');

            // Show/hide load more
            if (pagination.page < pagination.pages) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }

            // Extract and display popular skills
            const skillsMap = {};
            collegeMembersData.forEach(user => {
                (user.skills || []).forEach(skill => {
                    skillsMap[skill] = (skillsMap[skill] || 0) + 1;
                });
            });

            const sortedSkills = Object.entries(skillsMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8);

            if (sortedSkills.length > 0) {
                tagsSection.innerHTML = sortedSkills.map(([skill, count]) => `
                    <span class="college-skill-tag">
                        ${skill}
                        <span class="count">${count}</span>
                    </span>
                `).join('');
                document.getElementById('collegeTagsSection').style.display = 'block';
            } else {
                document.getElementById('collegeTagsSection').style.display = 'none';
            }
        } else {
            membersList.innerHTML = `
                <div class="members-empty">
                    <p>No students from this college on CollEra yet</p>
                </div>
            `;
            loadMoreBtn.style.display = 'none';
            document.getElementById('collegeTagsSection').style.display = 'none';
        }

        // Update current viewing college page
        if (currentViewingCollege) {
            currentViewingCollege.membersPage = page;
        }
    } else {
        membersList.innerHTML = '<p class="text-muted">Unable to load members</p>';
    }
}

function createMemberCard(user) {
    const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`;
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const courseYear = user.course ? `${user.course}${user.year ? ' • Year ' + user.year : ''}` : '';
    const onlineDot = user.isOnline ? '<span class="member-online-dot"></span>' : '';

    return `
        <div class="member-card" onclick="viewMemberProfile('${user._id}')">
            <div class="member-avatar">${initials || 'U'}</div>
            <div class="member-info">
                <div class="member-name">${fullName || 'User'}</div>
                <div class="member-course">${courseYear || 'Student'}</div>
            </div>
            ${onlineDot}
        </div>
    `;
}

function viewMemberProfile(userId) {
    // For now, show a toast - you can implement profile modal later
    showToast('Profile view coming soon!', 'info');
}

async function loadMoreCollegeMembers() {
    if (currentViewingCollege) {
        const nextPage = (currentViewingCollege.membersPage || 1) + 1;
        await loadCollegeMembers(currentViewingCollege.name, nextPage);
    }
}

function closeCollegeDetails() {
    document.getElementById('collegeDetailsOverlay').style.display = 'none';
    currentViewingCollege = null;
}

async function loadCollegeReviews(collegeName) {
    const reviewsSummary = document.getElementById('reviewsSummary');
    const reviewsList = document.getElementById('reviewsList');

    reviewsSummary.innerHTML = '<div class="loading-spinner small"><div class="spinner"></div></div>';
    reviewsList.innerHTML = '';

    const data = await apiCall(`/api/reviews/${encodeURIComponent(collegeName)}`);

    if (data && data.success) {
        const { reviews, averageRatings } = data.data;

        // Update reviews total and stats
        collegeReviewsTotal = averageRatings?.totalReviews || reviews.length;
        updateCollegeStats();

        if (averageRatings) {
            reviewsSummary.innerHTML = `
                <div class="reviews-summary-rating">
                    <div class="big-rating">${averageRatings.averageRating.toFixed(1)}</div>
                    <div class="rating-stars">${'★'.repeat(Math.round(averageRatings.averageRating))}${'☆'.repeat(5 - Math.round(averageRatings.averageRating))}</div>
                    <div class="total-reviews">${averageRatings.totalReviews} review${averageRatings.totalReviews !== 1 ? 's' : ''}</div>
                </div>
                <div class="reviews-summary-breakdown">
                    ${createRatingBar('Academics', averageRatings.averageAcademics)}
                    ${createRatingBar('Faculty', averageRatings.averageFaculty)}
                    ${createRatingBar('Infrastructure', averageRatings.averageInfrastructure)}
                    ${createRatingBar('Placements', averageRatings.averagePlacements)}
                    ${createRatingBar('Campus Life', averageRatings.averageCampusLife)}
                </div>
            `;
        } else {
            reviewsSummary.innerHTML = `
                <div class="reviews-summary-rating">
                    <div class="big-rating">--</div>
                    <div class="rating-stars">☆☆☆☆☆</div>
                    <div class="total-reviews">No reviews yet</div>
                </div>
            `;
        }

        if (reviews.length > 0) {
            reviewsList.innerHTML = reviews.map(review => createReviewItem(review)).join('');
        } else {
            reviewsList.innerHTML = `
                <div class="reviews-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <h4>No reviews yet</h4>
                    <p>Be the first to share your experience!</p>
                </div>
            `;
        }
    } else {
        reviewsSummary.innerHTML = '<p class="text-muted">Unable to load reviews</p>';
    }
}

function createRatingBar(label, value) {
    const percentage = value ? (value / 5) * 100 : 0;
    const displayValue = value ? value.toFixed(1) : '--';
    return `
        <div class="rating-bar-row">
            <span class="label">${label}</span>
            <div class="rating-bar">
                <div class="rating-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="value">${displayValue}</span>
        </div>
    `;
}

function createReviewItem(review) {
    const author = review.author;
    const initials = author ? `${author.firstName?.charAt(0) || ''}${author.lastName?.charAt(0) || ''}` : 'A';
    const authorName = author ? `${author.firstName} ${author.lastName}` : 'Anonymous';
    const date = new Date(review.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    const hasVoted = review.helpfulVotes?.includes(currentUser?._id);

    return `
        <div class="review-item">
            <div class="review-item-header">
                <div class="review-author-avatar">${initials}</div>
                <div class="review-author-info">
                    <div class="review-author-name">${authorName}</div>
                    <div class="review-date">${date}</div>
                </div>
                <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
            </div>
            <h4 class="review-title">${review.title}</h4>
            <p class="review-content">${review.content}</p>
            <div class="review-actions">
                <button class="review-helpful-btn ${hasVoted ? 'voted' : ''}" onclick="toggleHelpful('${review._id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    Helpful (${review.helpfulVotes?.length || 0})
                </button>
            </div>
        </div>
    `;
}

// Open review modal for user's own college (from sidebar)
function openMyCollegeReview() {
    // Ensure user is loaded
    if (!currentUser) {
        // Try to load user and retry
        loadCurrentUser().then(() => {
            openMyCollegeReview();
        });
        return;
    }
    if (!currentUser.collegeName) {
        showToast('Please complete your profile with college name first', 'error');
        return;
    }

    // Set current viewing college to user's college
    currentViewingCollege = { name: currentUser.collegeName };

    resetReviewForm();
    const collegeNameElem = document.getElementById('reviewCollegeName');
    const modalOverlay = document.getElementById('reviewModalOverlay');
    if (!collegeNameElem || !modalOverlay) {
        showToast('Review modal is not available. Please reload the page.', 'error');
        return;
    }
    collegeNameElem.textContent = currentUser.collegeName;
    modalOverlay.style.display = 'flex';

    // Re-initialize star ratings
    setTimeout(initStarRatings, 100);
}

function openReviewModal() {
    if (!currentViewingCollege) return;

    // Check if user can review this college
    const userCollege = currentUser?.collegeName?.toLowerCase() || '';
    const collegeName = currentViewingCollege.name.toLowerCase();
    const canReview = userCollege && (userCollege.includes(collegeName) || collegeName.includes(userCollege));

    if (!canReview) {
        showToast('You can only review your own college', 'error');
        return;
    }

    resetReviewForm();
    document.getElementById('reviewCollegeName').textContent = currentViewingCollege.name;
    document.getElementById('reviewModalOverlay').style.display = 'flex';

    // Re-initialize star ratings
    setTimeout(initStarRatings, 100);
}

function closeReviewModal() {
    document.getElementById('reviewModalOverlay').style.display = 'none';
    resetReviewForm();
}

async function submitReview() {
    if (!currentViewingCollege) return;

    const title = document.getElementById('reviewTitle').value.trim();
    const content = document.getElementById('reviewContent').value.trim();

    if (reviewRatings.overall === 0) {
        showToast('Please provide an overall rating', 'error');
        return;
    }

    if (!title) {
        showToast('Please provide a review title', 'error');
        return;
    }

    if (!content || content.length < 50) {
        showToast('Please write at least 50 characters in your review', 'error');
        return;
    }

    const btn = document.getElementById('submitReviewBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const data = await apiCall('/api/reviews', 'POST', {
        collegeName: currentViewingCollege.name,
        rating: reviewRatings.overall,
        title,
        content,
        academics: reviewRatings.academics || null,
        faculty: reviewRatings.faculty || null,
        infrastructure: reviewRatings.infrastructure || null,
        placements: reviewRatings.placements || null,
        campusLife: reviewRatings.campusLife || null
    });

    btn.disabled = false;
    btn.textContent = 'Submit Review';

    if (data && data.success) {
        closeReviewModal();
        showToast('Review submitted successfully!', 'success');
        await loadCollegeReviews(currentViewingCollege.name);
    } else {
        showToast(data?.message || 'Failed to submit review', 'error');
    }
}

async function toggleHelpful(reviewId) {
    const data = await apiCall(`/api/reviews/${reviewId}/helpful`, 'POST');

    if (data && data.success) {
        // Reload reviews to update the helpful count
        if (currentViewingCollege) {
            await loadCollegeReviews(currentViewingCollege.name);
        }
    }
}

// ===== Real-time Chat & Messaging =====

// Initialize Socket.io connection
function initSocketConnection() {
    const token = localStorage.getItem('token');
    if (!token) return;

    socket = io(API_BASE_URL || window.location.origin, {
        auth: { token }
    });

    socket.on('connect', () => {
        console.log('🔌 Connected to chat server');
    });

    socket.on('disconnect', () => {
        console.log('🔌 Disconnected from chat server');
    });

    socket.on('new_message', (message) => {
        handleIncomingMessage(message);
    });

    socket.on('message_sent', (message) => {
        // Message confirmed sent
        appendMessageToChat(message, true);
    });

    socket.on('user_typing', (data) => {
        if (currentConversation && currentConversation._id === data.conversationId) {
            showTypingIndicator(data.userName);
        }
    });

    socket.on('user_stopped_typing', (data) => {
        if (currentConversation && currentConversation._id === data.conversationId) {
            hideTypingIndicator();
        }
    });

    socket.on('messages_read', (data) => {
        if (currentConversation && currentConversation._id === data.conversationId) {
            markMessagesAsRead();
        }
    });

    socket.on('user_online', (data) => {
        updateUserOnlineStatus(data.userId, true);
    });

    socket.on('user_offline', (data) => {
        updateUserOnlineStatus(data.userId, false);
    });

    socket.on('new_connection_request', (data) => {
        showToast(`${data.from.firstName} ${data.from.lastName} sent you a connection request!`, 'info');
        loadPendingRequests();
    });

    socket.on('connection_accepted_notification', (data) => {
        showToast(`${data.by.firstName} ${data.by.lastName} accepted your connection request!`, 'success');
        loadConnections();
    });

    socket.on('error', (data) => {
        showToast(data.message, 'error');
    });
}

// Load conversations
async function loadConversations() {
    const data = await apiCall('/api/chat/conversations');

    if (data && data.success) {
        conversations = data.data;
        renderConversations();
    }
}

// Render conversations list
function renderConversations() {
    const container = document.getElementById('conversationsItems');

    if (!conversations || conversations.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p>No conversations yet</p>
                <span>Start chatting with your connections!</span>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conv => {
        const initials = conv.participant ?
            `${conv.participant.firstName[0]}${conv.participant.lastName[0]}`.toUpperCase() : 'U';
        const isOnline = conv.participant?.isOnline;
        const lastMessageTime = conv.lastMessage ? formatMessageTime(conv.lastMessage.createdAt) : '';
        const lastMessagePreview = conv.lastMessage ?
            (conv.lastMessage.sender === currentUser._id ? 'You: ' : '') + truncate(conv.lastMessage.content, 30) :
            'No messages yet';

        // Show profile picture if available, otherwise initials
        const avatarHtml = conv.participant?.profilePicture
            ? `<img src="${conv.participant.profilePicture}" alt="Profile" class="avatar-img">`
            : initials;

        return `
            <div class="conversation-item ${currentConversation?._id === conv._id ? 'active' : ''}" 
                 onclick="openConversation('${conv._id}', '${conv.participant?._id}')">
                <div class="conversation-avatar">
                    ${avatarHtml}
                    <span class="online-dot ${isOnline ? '' : 'offline'}"></span>
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">
                        <span>${conv.participant?.firstName} ${conv.participant?.lastName}</span>
                        <span class="time">${lastMessageTime}</span>
                    </div>
                    <div class="conversation-preview">
                        <span>${lastMessagePreview}</span>
                        ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Open a conversation
async function openConversation(conversationId, participantId) {
    // Find conversation in our list
    let conv = conversations.find(c => c._id === conversationId);

    // If not found, we need to get or create it
    if (!conv && participantId) {
        const data = await apiCall(`/api/chat/conversation/${participantId}`);
        if (data && data.success) {
            conv = {
                _id: data.data.conversationId,
                participant: data.data.participant
            };
            // Reload conversations to include new one
            await loadConversations();
        }
    }

    if (!conv) {
        showToast('Conversation not found', 'error');
        return;
    }

    currentConversation = conv;
    currentChatPartner = conv.participant;

    // If bot conversation, set up bot chat
    if (conversationId === 'mental-health-bot') {
        // Render chat window for bot
        renderChatWindow();
        // No messages to load, but could load from localStorage if desired
        return;
    }

    // Mark conversation as active in list
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.conversation-item[onclick*="${conversationId}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Render chat window
    renderChatWindow();

    // Load messages
    await loadMessages(conversationId);

    // Mark messages as read
    if (socket) {
        socket.emit('mark_read', { conversationId });
    }

    // Update unread count
    loadUnreadCount();
}

// Render chat window
function renderChatWindow() {
    const chatArea = document.getElementById('chatArea');
    const template = document.getElementById('chatWindowTemplate');

    if (!currentChatPartner) return;

    const initials = `${currentChatPartner.firstName[0]}${currentChatPartner.lastName[0]}`.toUpperCase();
    const isOnline = currentChatPartner.isOnline;

    chatArea.innerHTML = `
        <div class="chat-window">
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-avatar">
                        ${currentChatPartner.profilePicture ? `<img src="${currentChatPartner.profilePicture}" alt="Profile" class="avatar-img">` : `<span class="avatar-initials">${initials}</span>`}
                        <span class="online-dot ${isOnline ? '' : 'offline'}"></span>
                    </div>
                    <div class="chat-user-info">
                        <span class="chat-user-name">${currentChatPartner.firstName} ${currentChatPartner.lastName}</span>
                        <span class="chat-user-status ${isOnline ? 'online' : ''}">${isOnline ? 'Online' : formatLastSeen(currentChatPartner.lastSeen)}</span>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button class="icon-btn" onclick="viewProfile('${currentChatPartner._id}')" title="View Profile">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="loading-spinner small">
                    <div class="spinner"></div>
                </div>
            </div>
            <div class="typing-indicator" id="typingIndicator" style="display: none;">
                <span class="typing-text"></span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="messageInput" placeholder="Type a message..." 
                       onkeydown="handleMessageKeydown(event)" 
                       oninput="handleTyping()">
                <button class="send-btn" onclick="sendMessage()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Focus on input
    setTimeout(() => {
        document.getElementById('messageInput')?.focus();
    }, 100);
}

// Load messages for a conversation
async function loadMessages(conversationId) {
    const data = await apiCall(`/api/chat/messages/${conversationId}`);

    if (data && data.success) {
        renderMessages(data.data.messages);
    }
}

// Render messages
function renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="chat-placeholder" style="flex: 1; justify-content: center;">
                <p>No messages yet. Say hello! 👋</p>
            </div>
        `;
        return;
    }

    let html = '';
    let lastDate = null;

    messages.forEach(msg => {
        const msgDate = new Date(msg.createdAt).toDateString();

        // Add date divider if needed
        if (msgDate !== lastDate) {
            html += `
                <div class="message-date-divider">
                    <span>${formatDateDivider(msg.createdAt)}</span>
                </div>
            `;
            lastDate = msgDate;
        }

        const isSent = msg.sender._id === currentUser._id || msg.sender === currentUser._id;
        const time = formatMessageTime(msg.createdAt);

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${msg.content}
                <span class="message-time">${time}</span>
            </div>
        `;
    });

    container.innerHTML = html;

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Append a single message to chat
function appendMessageToChat(message, isSent) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // Remove empty placeholder if present
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const time = formatMessageTime(message.createdAt);
    const messageEl = document.createElement('div');
    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
    messageEl.innerHTML = `
        ${message.content}
        <span class="message-time">${time}</span>
    `;

    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

// Handle incoming message
function handleIncomingMessage(message) {
    // Update conversations list
    loadConversations();
    loadUnreadCount();

    // If this is the current conversation, append the message
    if (currentConversation && message.conversation.toString() === currentConversation._id.toString()) {
        appendMessageToChat(message, false);
        hideTypingIndicator();

        // Mark as read
        if (socket) {
            socket.emit('mark_read', { conversationId: currentConversation._id });
        }
    } else {
        // Show notification for message in other conversation
        const senderName = message.sender ? `${message.sender.firstName}` : 'Someone';
        showToast(`New message from ${senderName}`, 'info');
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input?.value?.trim();

    if (!content || !currentConversation || !currentChatPartner) return;

    // Clear input
    input.value = '';

    // If bot conversation, use bot API
    if (currentConversation._id === 'mental-health-bot') {
        appendMessageToChat({ content, sender: { _id: currentUser._id }, createdAt: new Date() }, true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/bot/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: content })
            });
            const data = await res.json();
            if (data.success) {
                appendMessageToChat({ content: data.response, sender: { _id: 'bot', firstName: data.bot }, createdAt: new Date() }, false);
            } else {
                appendMessageToChat({ content: 'Sorry, I could not respond right now.', sender: { _id: 'bot', firstName: 'Bot' }, createdAt: new Date() }, false);
            }
        } catch {
            appendMessageToChat({ content: 'Network error. Please try again.', sender: { _id: 'bot', firstName: 'Bot' }, createdAt: new Date() }, false);
        }
        return;
    }

    // ...existing code for normal conversations...
    // Send via socket for real-time
    if (socket) {
        socket.emit('send_message', {
            recipientId: currentChatPartner._id,
            content,
            conversationId: currentConversation._id
        });
    } else {
        // Fallback to REST API
        const data = await apiCall(`/api/chat/send/${currentChatPartner._id}`, 'POST', { content });

        if (data && data.success) {
            appendMessageToChat(data.data.message, true);
        } else {
            showToast('Failed to send message', 'error');
        }
    }

    // Stop typing indicator
    if (socket) {
        socket.emit('typing_stop', {
            recipientId: currentChatPartner._id,
            conversationId: currentConversation._id
        });
    }
}

// Handle message input keydown
function handleMessageKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Handle typing indicator
function handleTyping() {
    if (!socket || !currentConversation || !currentChatPartner) return;

    // Send typing start
    socket.emit('typing_start', {
        recipientId: currentChatPartner._id,
        conversationId: currentConversation._id
    });

    // Clear existing timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }

    // Set timeout to stop typing
    typingTimeout = setTimeout(() => {
        socket.emit('typing_stop', {
            recipientId: currentChatPartner._id,
            conversationId: currentConversation._id
        });
    }, 2000);
}

// Show typing indicator
function showTypingIndicator(userName) {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
        indicator.querySelector('.typing-text').textContent = `${userName} is typing`;
    }
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Load unread message count
async function loadUnreadCount() {
    const data = await apiCall('/api/chat/unread');

    if (data && data.success) {
        const badge = document.getElementById('messageBadge');
        if (badge) {
            badge.textContent = data.data.unreadCount;
            badge.style.display = data.data.unreadCount > 0 ? 'flex' : 'none';
        }
    }
}

// Show new message modal
function showNewMessageModal() {
    const overlay = document.getElementById('newMessageModalOverlay');
    overlay.classList.add('active');

    // Populate connections list
    renderConnectionsForChat();
}

// Close new message modal
function closeNewMessageModal() {
    const overlay = document.getElementById('newMessageModalOverlay');
    overlay.classList.remove('active');

    // Clear search
    const input = document.getElementById('connectionSearchInput');
    if (input) input.value = '';
}

// Render connections in the new message modal
function renderConnectionsForChat() {
    const container = document.getElementById('connectionsListModal');

    if (!connections || connections.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>No connections yet</p>
                <span>Connect with other students to start chatting!</span>
            </div>
        `;
        return;
    }

    container.innerHTML = connections.map(conn => {
        const initials = `${conn.firstName[0]}${conn.lastName[0]}`.toUpperCase();
        return `
            <div class="connection-item-modal" onclick="startChatWith('${conn._id}')">
                <div class="connection-avatar">${initials}</div>
                <div class="connection-info">
                    <div class="connection-name">${conn.firstName} ${conn.lastName}</div>
                    <div class="connection-college">${conn.collegeName}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter connections for chat modal
function filterConnectionsForChat(event) {
    const query = event.target.value.toLowerCase();
    const items = document.querySelectorAll('.connection-item-modal');

    items.forEach(item => {
        const name = item.querySelector('.connection-name').textContent.toLowerCase();
        const college = item.querySelector('.connection-college').textContent.toLowerCase();

        if (name.includes(query) || college.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Start chat with a connection
async function startChatWith(userId) {
    closeNewMessageModal();

    // Switch to messages tab
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    document.querySelector('[data-tab="messages"]').classList.add('active');

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById('messagesTab').classList.add('active');

    // Get or create conversation
    const data = await apiCall(`/api/chat/conversation/${userId}`);

    if (data && data.success) {
        await openConversation(data.data.conversationId, userId);
    } else {
        showToast('Failed to start conversation', 'error');
    }
}

// Filter conversations
function filterConversations(event) {
    const query = event.target.value.toLowerCase();
    const items = document.querySelectorAll('.conversation-item');

    items.forEach(item => {
        const name = item.querySelector('.conversation-name span:first-child').textContent.toLowerCase();

        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Update user online status in conversations
function updateUserOnlineStatus(userId, isOnline) {
    // Update in conversations list
    const convItems = document.querySelectorAll('.conversation-item');
    convItems.forEach(item => {
        if (item.onclick && item.onclick.toString().includes(userId)) {
            const dot = item.querySelector('.online-dot');
            if (dot) {
                dot.classList.toggle('offline', !isOnline);
            }
        }
    });

    // Update in current chat header
    if (currentChatPartner && currentChatPartner._id === userId) {
        const headerDot = document.querySelector('.chat-header .online-dot');
        const statusText = document.querySelector('.chat-user-status');
        if (headerDot) {
            headerDot.classList.toggle('offline', !isOnline);
        }
        if (statusText) {
            statusText.textContent = isOnline ? 'Online' : 'Offline';
            statusText.classList.toggle('online', isOnline);
        }
    }

    // Update in user cards
    const userCards = document.querySelectorAll(`[data-user-id="${userId}"] .online-indicator`);
    userCards.forEach(indicator => {
        indicator.style.display = isOnline ? 'block' : 'none';
    });
}

// Mark messages as read visually
function markMessagesAsRead() {
    const messages = document.querySelectorAll('.message.sent');
    messages.forEach(msg => {
        // Could add read receipts visualization here
    });
}

// Helper: Format message time
function formatMessageTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Less than a minute
    if (diff < 60000) {
        return 'Just now';
    }

    // Today - show time
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    // Within a week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    // Older
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper: Format date divider
function formatDateDivider(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return 'Today';
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Helper: Format last seen
function formatLastSeen(dateStr) {
    if (!dateStr) return 'Offline';

    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
        return 'Last seen just now';
    }

    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `Last seen ${mins} min ago`;
    }

    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `Last seen ${hours}h ago`;
    }

    return `Last seen ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// Helper: Truncate text
function truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

// Add message button to user cards
function addMessageButton(userId) {
    return `<button class="btn btn-secondary message-btn" onclick="event.stopPropagation(); startChatWith('${userId}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Message
    </button>`;
}