// ===== CollEra App JavaScript =====

// ===== IMMEDIATE AUTH CHECK - Redirect logged-in users =====
(function () {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    // If user is logged in and on landing page, redirect to dashboard
    if (token && user && window.location.pathname === '/') {
        window.location.replace('/dashboard');
    }
})();

// ===== Hero Cards Shuffle =====
const heroProfiles = [
    { initials: 'SM', name: 'Shashwat Mishra', college: 'Graphic Era University', gradient: 'gradient-bg' },
    { initials: 'GS', name: 'Gauri Sharma', college: 'JIIT Noida', gradient: 'gradient-bg-2' },
    { initials: 'CS', name: 'Chitransh Saxena', college: 'ABES Engineering College', gradient: 'gradient-bg-3' },
    { initials: 'PB', name: 'Parth Bajpai', college: 'NIT Jalandhar', gradient: 'gradient-bg' },
    { initials: 'K', name: 'Khushi', college: 'Graphic Era University', gradient: 'gradient-bg-2' },
    { initials: 'HC', name: 'Harsh Chauhan', college: 'GL Bajaj', gradient: 'gradient-bg-3' }
];

let currentHeroIndex = 0;

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get random 3 profiles for display
function getRandomProfiles() {
    const shuffled = shuffleArray(heroProfiles);
    return shuffled.slice(0, 3);
}

// Update hero card with animation
function updateHeroCard(cardIndex, profile) {
    const card = document.getElementById(`heroCard${cardIndex}`);
    const avatar = document.getElementById(`heroAvatar${cardIndex}`);
    const name = document.getElementById(`heroName${cardIndex}`);
    const college = document.getElementById(`heroCollege${cardIndex}`);

    if (!card || !avatar || !name || !college) return;

    // Fade out
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px) scale(0.95)';

    setTimeout(() => {
        // Update content
        avatar.textContent = profile.initials;
        avatar.className = `user-avatar ${profile.gradient}`;
        name.textContent = profile.name;
        college.textContent = profile.college;

        // Fade in
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
    }, 300);
}

// Shuffle all hero cards
function shuffleHeroCards() {
    const profiles = getRandomProfiles();
    profiles.forEach((profile, index) => {
        setTimeout(() => {
            updateHeroCard(index + 1, profile);
        }, index * 200); // Stagger the animations
    });
}

// Initialize hero cards on page load
function initHeroCards() {
    const cards = document.querySelectorAll('.hero-card');
    cards.forEach(card => {
        card.style.transition = 'opacity 0.3s ease, transform 0.4s ease';
    });

    // Shuffle on page load
    shuffleHeroCards();

    // Auto-shuffle every 4 seconds
    setInterval(shuffleHeroCards, 4000);
}

// Start shuffling when DOM is ready
document.addEventListener('DOMContentLoaded', initHeroCards);

// ===== Navigation =====
const navbar = document.getElementById('navbar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

// Navbar scroll effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
function toggleMobileMenu() {
    mobileMenuBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
}

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenuBtn.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// ===== Smooth Scrolling =====
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// ===== Modal Functions =====
const modalOverlay = document.getElementById('modalOverlay');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');

function showLogin() {
    closeModals();
    modalOverlay.classList.add('active');
    loginModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function showRegister() {
    closeModals();
    modalOverlay.classList.add('active');
    registerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModals() {
    modalOverlay.classList.remove('active');
    loginModal.classList.remove('active');
    registerModal.classList.remove('active');
    document.body.style.overflow = '';

    // Clear messages
    document.getElementById('loginMessage').className = 'form-message';
    document.getElementById('loginMessage').textContent = '';
    document.getElementById('registerMessage').className = 'form-message';
    document.getElementById('registerMessage').textContent = '';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModals();
    }
});

// ===== Password Toggle =====
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== Form Handlers =====
async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById('loginMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('.loading-text');

    const email = form.email.value;
    const password = form.password.value;

    // Show loading overlay
    loadingText.textContent = 'Signing you in...';
    loadingOverlay.classList.add('active');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        // Hide loading overlay
        loadingOverlay.classList.remove('active');

        if (data.success) {
            messageDiv.className = 'form-message success';
            messageDiv.textContent = 'Login successful! Redirecting...';

            // Store token
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            messageDiv.className = 'form-message error';
            messageDiv.textContent = data.message;

            if (data.needsVerification) {
                messageDiv.innerHTML += '<br><a href="#" onclick="resendVerification(\'' + email + '\')">Resend verification email</a>';
            }
        }
    } catch (error) {
        loadingOverlay.classList.remove('active');
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Network error. Please try again.';
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById('registerMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('.loading-text');

    const formData = {
        firstName: form.firstName.value,
        lastName: form.lastName.value,
        email: form.email.value,
        password: form.password.value,
        collegeName: form.collegeName.value,
        course: form.course.value,
        year: form.year.value ? parseInt(form.year.value) : undefined
    };

    // Validate email format first
    if (!isValidEmailFormat(formData.email)) {
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Please enter a valid email format (e.g., name@college.edu.in)';
        return;
    }

    // Validate college email
    if (!isValidCollegeEmail(formData.email)) {
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Please use a valid college email (.edu.in, .ac.in, or .edu)';
        return;
    }

    // Show loading overlay
    loadingText.textContent = 'Creating your account...';
    loadingOverlay.classList.add('active');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        // Hide loading overlay
        loadingOverlay.classList.remove('active');

        if (data.success) {
            messageDiv.className = 'form-message success';
            messageDiv.textContent = 'Registration successful! Please check your email to verify your account.';
            form.reset();
        } else {
            messageDiv.className = 'form-message error';
            messageDiv.textContent = data.message;
        }
    } catch (error) {
        loadingOverlay.classList.remove('active');
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Network error. Please try again.';
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ===== Email Validation =====
function isValidEmailFormat(email) {
    // Check for common email format issues
    if (!email || typeof email !== 'string') return false;
    if (email.includes('..')) return false; // No consecutive dots
    if (email.includes('.@')) return false; // No dot before @
    if (email.includes('@.')) return false; // No dot after @
    if (email.startsWith('.')) return false; // No leading dot

    // Basic email regex
    const emailRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

function isValidCollegeEmail(email) {
    // First check basic format
    if (!isValidEmailFormat(email)) return false;

    const domain = email.split('@')[1];
    if (!domain) return false;

    const validPatterns = [
        /\.edu\.in$/,
        /\.ac\.in$/,
        /\.edu$/
    ];

    return validPatterns.some(pattern => pattern.test(domain));
}

// ===== Resend Verification =====
async function resendVerification(email) {
    try {
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Failed to resend verification email');
    }
}

// ===== Forgot Password =====
function showForgotPassword() {
    const email = prompt('Enter your email address:');
    if (email) {
        forgotPassword(email);
    }
}

async function forgotPassword(email) {
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Failed to send password reset email');
    }
}

// ===== Counter Animation =====
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.floor(current).toLocaleString();
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target.toLocaleString();
            }
        };

        updateCounter();
    });
}

// ===== Intersection Observer for Animations =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible');

            // Trigger counter animation when stats are visible
            if (entry.target.classList.contains('hero-stats')) {
                animateCounters();
            }
        }
    });
}, observerOptions);

// Observe elements
document.querySelectorAll('.feature-card, .step, .hero-stats').forEach(el => {
    observer.observe(el);
});

// ===== Parallax Effect on Hero =====
document.addEventListener('mousemove', (e) => {
    const heroVisual = document.querySelector('.hero-visual');
    if (!heroVisual) return;

    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;

    heroVisual.style.transform = `translate(${x}px, ${y}px)`;
});

// ===== Check Auth State on Load =====
function checkAuthState() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        // User is logged in - redirect to dashboard immediately
        window.location.href = '/dashboard';
        return;
    }
}

function updateNavForLoggedInUser(user) {
    const navLinks = document.getElementById('navLinks');

    // Replace entire nav with logged-in user navigation
    navLinks.innerHTML = `
        <a href="/dashboard" class="nav-link">Home</a>
        <a href="/dashboard#explore" class="nav-link">Explore</a>
        <a href="/dashboard#colleges" class="nav-link">Colleges</a>
        <a href="/dashboard#requests" class="nav-link">Requests</a>
        <a href="/dashboard" class="btn btn-primary nav-btn">${user.firstName}</a>
    `;
}

// ===== Public Colleges Section =====
const publicColleges = {
    engineering: [
        { name: 'IIT Madras', rank: 1 },
        { name: 'IIT Delhi', rank: 2 },
        { name: 'IIT Bombay', rank: 3 },
        { name: 'IIT Kanpur', rank: 4 },
        { name: 'IIT Kharagpur', rank: 5 },
        { name: 'IIT Roorkee', rank: 6 },
        { name: 'IIT Guwahati', rank: 7 },
        { name: 'IIT Hyderabad', rank: 8 },
        { name: 'NIT Trichy', rank: 9 },
        { name: 'NIT Surathkal', rank: 10 },
        { name: 'NIT Warangal', rank: 11 },
        { name: 'BITS Pilani', rank: 12 }
    ],
    management: [
        { name: 'IIM Ahmedabad', rank: 1 },
        { name: 'IIM Bangalore', rank: 2 },
        { name: 'IIM Calcutta', rank: 3 },
        { name: 'IIM Lucknow', rank: 4 },
        { name: 'IIM Kozhikode', rank: 5 },
        { name: 'IIM Indore', rank: 6 },
        { name: 'XLRI Jamshedpur', rank: 7 },
        { name: 'FMS Delhi', rank: 8 },
        { name: 'MDI Gurgaon', rank: 9 },
        { name: 'SP Jain Mumbai', rank: 10 }
    ],
    medical: [
        { name: 'AIIMS Delhi', rank: 1 },
        { name: 'PGIMER Chandigarh', rank: 2 },
        { name: 'CMC Vellore', rank: 3 },
        { name: 'NIMHANS Bangalore', rank: 4 },
        { name: 'JIPMER Puducherry', rank: 5 },
        { name: 'SGPGI Lucknow', rank: 6 },
        { name: 'BHU Medical', rank: 7 },
        { name: 'King George Medical', rank: 8 }
    ],
    universities: [
        { name: 'IISc Bangalore', rank: 1 },
        { name: 'JNU Delhi', rank: 2 },
        { name: 'BHU Varanasi', rank: 3 },
        { name: 'Delhi University', rank: 4 },
        { name: 'Jamia Millia Islamia', rank: 5 },
        { name: 'University of Hyderabad', rank: 6 },
        { name: 'Amity University', rank: 7 },
        { name: 'Jadavpur University', rank: 8 }
    ]
};

let currentPublicCategory = 'engineering';
let publicSearchQuery = '';

function initPublicColleges() {
    renderPublicColleges();

    // Tab click handlers
    document.querySelectorAll('.public-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.public-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPublicCategory = tab.dataset.category;
            renderPublicColleges();
        });
    });

    // Search handler
    const searchInput = document.getElementById('publicCollegeSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            publicSearchQuery = e.target.value.toLowerCase();
            renderPublicColleges();
        });
    }
}

function renderPublicColleges() {
    const grid = document.getElementById('publicCollegesGrid');
    if (!grid) return;

    let colleges = publicColleges[currentPublicCategory] || [];

    // Filter by search
    if (publicSearchQuery) {
        colleges = colleges.filter(c => c.name.toLowerCase().includes(publicSearchQuery));
    }

    // Show max 8 colleges for public view
    const displayColleges = colleges.slice(0, 8);

    grid.innerHTML = displayColleges.map(college => `
        <div class="public-college-card" onclick="openPublicCollegeReviews('${college.name}', ${college.rank}, '${currentPublicCategory}')">
            <div class="public-college-rank-badge">#${college.rank}</div>
            <div class="public-college-info">
                <h3>${college.name}</h3>
                <div class="public-college-action">
                    <span>Read Reviews</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        </div>
    `).join('');
}

async function openPublicCollegeReviews(collegeName, rank, category) {
    const modal = document.getElementById('publicReviewModal');
    const overlay = document.getElementById('modalOverlay');

    // Update modal header
    document.getElementById('publicCollegeName').textContent = collegeName;
    document.getElementById('publicCollegeRank').textContent = `#${rank} NIRF`;
    document.getElementById('publicCollegeCategory').textContent = category.charAt(0).toUpperCase() + category.slice(1);

    // Show modal
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading
    document.getElementById('publicReviewsList').innerHTML = '<div class="public-reviews-loading">Loading reviews...</div>';
    document.getElementById('publicAvgRatings').innerHTML = '';

    try {
        const response = await fetch(`/api/reviews/public/${encodeURIComponent(collegeName)}`);
        const data = await response.json();

        if (data.success) {
            renderPublicAverageRatings(data.data.averageRatings);
            renderPublicReviews(data.data.reviews);
        } else {
            document.getElementById('publicReviewsList').innerHTML = `
                <div class="public-no-reviews">
                    <span class="no-reviews-icon">📝</span>
                    <p>No reviews yet for this college</p>
                    <small>Be the first to share your experience!</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching reviews:', error);
        document.getElementById('publicReviewsList').innerHTML = `
            <div class="public-no-reviews">
                <span class="no-reviews-icon">😕</span>
                <p>Unable to load reviews</p>
                <small>Please try again later</small>
            </div>
        `;
    }
}

function renderPublicAverageRatings(avgRatings) {
    const container = document.getElementById('publicAvgRatings');
    if (!avgRatings || !avgRatings.overall) {
        container.innerHTML = '';
        return;
    }

    const categories = [
        { key: 'overall', label: 'Overall', icon: '⭐' },
        { key: 'academics', label: 'Academics', icon: '📚' },
        { key: 'faculty', label: 'Faculty', icon: '👨‍🏫' },
        { key: 'infrastructure', label: 'Infrastructure', icon: '🏛️' },
        { key: 'placements', label: 'Placements', icon: '💼' },
        { key: 'campusLife', label: 'Campus Life', icon: '🎉' }
    ];

    container.innerHTML = `
        <h3>Average Ratings</h3>
        <div class="public-ratings-grid">
            ${categories.map(cat => {
        const rating = avgRatings[cat.key] || 0;
        return `
                    <div class="public-rating-item">
                        <span class="rating-icon">${cat.icon}</span>
                        <div class="rating-info">
                            <span class="rating-label">${cat.label}</span>
                            <div class="rating-bar">
                                <div class="rating-fill" style="width: ${(rating / 5) * 100}%"></div>
                            </div>
                            <span class="rating-value">${rating.toFixed(1)}</span>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderPublicReviews(reviews) {
    const container = document.getElementById('publicReviewsList');

    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="public-no-reviews">
                <span class="no-reviews-icon">📝</span>
                <p>No reviews yet for this college</p>
                <small>Sign up to be the first to share your experience!</small>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <h3>Student Reviews (${reviews.length})</h3>
        <div class="public-reviews-wrapper">
            ${reviews.map(review => {
        const authorName = review.author ?
            `${review.author.firstName} ${review.author.lastName}` : 'Anonymous';
        const initials = review.author ?
            `${review.author.firstName[0]}${review.author.lastName[0]}` : '??';
        const date = new Date(review.createdAt).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        return `
                    <div class="public-review-card">
                        <div class="review-header">
                            <div class="reviewer-avatar">${initials}</div>
                            <div class="reviewer-info">
                                <span class="reviewer-name">${authorName}</span>
                                <span class="review-date">${date}</span>
                            </div>
                            <div class="review-rating">
                                <span class="stars">${'⭐'.repeat(Math.round(review.rating))}</span>
                                <span class="rating-num">${review.rating}/5</span>
                            </div>
                        </div>
                        <h4 class="review-title">${review.title}</h4>
                        <p class="review-content">${review.content}</p>
                        <div class="review-footer">
                            <span class="helpful-count">👍 ${review.helpfulVotes?.length || 0} found helpful</span>
                            <button class="helpful-btn-disabled" onclick="promptSignup()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                </svg>
                                Helpful
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function closePublicReviewModal() {
    const modal = document.getElementById('publicReviewModal');
    const overlay = document.getElementById('modalOverlay');

    modal.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function promptSignup() {
    closePublicReviewModal();
    showRegister();
}

// ===== Handle Verification Pages =====
function checkVerificationStatus() {
    const path = window.location.pathname;

    if (path === '/verification-success') {
        document.querySelector('.hero').style.display = 'none';
        document.querySelector('.features').style.display = 'none';
        document.querySelector('.how-it-works').style.display = 'none';
        document.querySelector('.colleges').style.display = 'none';
        document.querySelector('.cta-section').style.display = 'none';
        document.getElementById('verificationSuccess').style.display = 'flex';
    }
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    checkVerificationStatus();
    initPublicColleges();

    // Add animation classes after page load
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// ===== Service Worker Registration (for PWA) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service worker registration failed
        });
    });
}
