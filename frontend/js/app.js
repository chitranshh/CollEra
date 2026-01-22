// ===== CollEra App JavaScript =====

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
function isValidCollegeEmail(email) {
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
        // User is logged in - update nav
        updateNavForLoggedInUser(JSON.parse(user));
    }
}

function updateNavForLoggedInUser(user) {
    const navLinks = document.getElementById('navLinks');
    const loginLink = navLinks.querySelector('a[onclick="showLogin()"]');
    const registerLink = navLinks.querySelector('a[onclick="showRegister()"]');

    if (loginLink) {
        loginLink.textContent = 'Dashboard';
        loginLink.href = '/dashboard';
        loginLink.removeAttribute('onclick');
    }

    if (registerLink) {
        registerLink.textContent = user.firstName;
        registerLink.href = '/profile';
        registerLink.removeAttribute('onclick');
    }
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
