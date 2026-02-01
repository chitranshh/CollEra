// ===== CollEra Onboarding JavaScript =====

// Check if user is authenticated
(function () {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
        window.location.replace('/');
        return;
    }

    // Check if profile is already completed
    try {
        const userData = JSON.parse(user);
        if (userData.profileCompleted) {
            window.location.replace('/dashboard');
        }
    } catch (e) {
        console.error('Error parsing user data:', e);
    }
})();

// API Configuration
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

// State
let currentStep = 1;
const totalSteps = 4;
let skills = [];
let interests = [];
let profilePhotoBase64 = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTagInputs();
    initBioCounter();
    setMaxDate();
    loadExistingData();
});

// Load existing user data
function loadExistingData() {
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData) {
            // Pre-fill fields if data exists
            if (userData.bio) document.getElementById('bio').value = userData.bio;
            if (userData.branch) document.getElementById('branch').value = userData.branch;
            if (userData.year) document.getElementById('year').value = userData.year;
            if (userData.course) document.getElementById('course').value = userData.course;
            if (userData.gender) document.getElementById('gender').value = userData.gender;
            if (userData.pronouns) document.getElementById('pronouns').value = userData.pronouns;
            if (userData.dob) {
                const date = new Date(userData.dob);
                document.getElementById('dob').value = date.toISOString().split('T')[0];
            }
            if (userData.skills && userData.skills.length > 0) {
                userData.skills.forEach(skill => addTag('skills', skill));
            }
            if (userData.interests && userData.interests.length > 0) {
                userData.interests.forEach(interest => addTag('interests', interest));
            }
            if (userData.linkedIn) document.getElementById('linkedin').value = userData.linkedIn;
            if (userData.github) document.getElementById('github').value = userData.github;
            if (userData.instagram) document.getElementById('instagram').value = userData.instagram;
            if (userData.leetcode) document.getElementById('leetcode').value = userData.leetcode;
            if (userData.hackerrank) document.getElementById('hackerrank').value = userData.hackerrank;
            if (userData.codechef) document.getElementById('codechef').value = userData.codechef;
            if (userData.portfolio) document.getElementById('portfolio').value = userData.portfolio;
            if (userData.profilePicture) {
                profilePhotoBase64 = userData.profilePicture;
                showPhotoPreview(userData.profilePicture);
            }

            updateBioCounter();
        }
    } catch (e) {
        console.error('Error loading existing data:', e);
    }
}

// Set max date for DOB (must be at least 13 years old)
function setMaxDate() {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 13);
    document.getElementById('dob').max = today.toISOString().split('T')[0];
}

// Initialize tag inputs
function initTagInputs() {
    const skillsInput = document.getElementById('skillsInput');
    const interestsInput = document.getElementById('interestsInput');

    skillsInput.addEventListener('keydown', (e) => handleTagKeydown(e, 'skills'));
    interestsInput.addEventListener('keydown', (e) => handleTagKeydown(e, 'interests'));
}

// Handle tag input keydown
function handleTagKeydown(e, type) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const input = e.target;
        const value = input.value.trim().replace(',', '');

        if (value) {
            addTag(type, value);
            input.value = '';
        }
    }
}

// Add a tag
function addTag(type, value) {
    const arr = type === 'skills' ? skills : interests;
    const wrapper = document.getElementById(`${type}Wrapper`);
    const input = document.getElementById(`${type}Input`);

    // Check for duplicates
    if (arr.map(t => t.toLowerCase()).includes(value.toLowerCase())) {
        return;
    }

    // Add to array
    arr.push(value);

    // Create tag element
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `
        ${value}
        <span class="tag-remove" onclick="removeTag('${type}', '${value}', this)">&times;</span>
    `;

    // Insert before input
    wrapper.insertBefore(tag, input);

    // Mark suggested tag as added
    const suggestedTags = document.querySelectorAll(`.suggested-tag`);
    suggestedTags.forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === value.toLowerCase()) {
            btn.classList.add('added');
        }
    });
}

// Remove a tag
function removeTag(type, value, element) {
    const arr = type === 'skills' ? skills : interests;
    const index = arr.indexOf(value);

    if (index > -1) {
        arr.splice(index, 1);
    }

    // Remove element
    element.parentElement.remove();

    // Unmark suggested tag
    const suggestedTags = document.querySelectorAll(`.suggested-tag`);
    suggestedTags.forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === value.toLowerCase()) {
            btn.classList.remove('added');
        }
    });
}

// Initialize bio counter
function initBioCounter() {
    const bio = document.getElementById('bio');
    bio.addEventListener('input', updateBioCounter);
}

function updateBioCounter() {
    const bio = document.getElementById('bio');
    const count = document.getElementById('bioCount');
    count.textContent = bio.value.length;
}

// Photo upload handling
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size should be less than 5MB', 'error');
        return;
    }

    // Read and resize image
    const reader = new FileReader();
    reader.onload = (e) => {
        resizeImage(e.target.result, 400, 400, (resizedBase64) => {
            profilePhotoBase64 = resizedBase64;
            showPhotoPreview(resizedBase64);
        });
    };
    reader.readAsDataURL(file);
}

// Resize image
function resizeImage(base64, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
}

// Show photo preview
function showPhotoPreview(base64) {
    const placeholder = document.getElementById('photoPlaceholder');
    const image = document.getElementById('photoImage');

    placeholder.style.display = 'none';
    image.src = base64;
    image.style.display = 'block';
}

// Navigation
function nextStep(current) {
    if (current >= totalSteps) return;

    // Validate current step
    if (!validateStep(current)) return;

    // Hide current step
    document.getElementById(`step${current}`).classList.remove('active');

    // Show next step
    currentStep = current + 1;
    document.getElementById(`step${currentStep}`).classList.add('active');

    // Update progress
    updateProgress();
}

function prevStep(current) {
    if (current <= 1) return;

    // Hide current step
    document.getElementById(`step${current}`).classList.remove('active');

    // Show previous step
    currentStep = current - 1;
    document.getElementById(`step${currentStep}`).classList.add('active');

    // Update progress
    updateProgress();
}

function updateProgress() {
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    const percentage = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${percentage}%`;

    // Update step indicators
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');

        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
        }
    });
}

// Validation
function validateStep(step) {
    switch (step) {
        case 1:
            // Gender is required
            const gender = document.getElementById('gender').value;
            if (!gender) {
                showToast('Please select your gender', 'error');
                return false;
            }
            return true;
        case 2:
            // Step 2 is optional, just continue
            return true;
        case 3:
            // Step 3 - encourage at least one skill or interest
            if (skills.length === 0 && interests.length === 0) {
                // Still allow continuing, just show a hint
                showToast('Adding skills and interests helps you connect better!', 'info');
            }
            return true;
        case 4:
            // Step 4 is optional
            return true;
        default:
            return true;
    }
}

// Skip onboarding
function skipOnboarding() {
    if (confirm('Are you sure you want to skip profile setup? You can always complete it later from your profile settings.')) {
        window.location.replace('/dashboard');
    }
}

// Complete onboarding
async function completeOnboarding() {
    // Gather all data
    const profileData = {
        profilePicture: profilePhotoBase64,
        dob: document.getElementById('dob').value || null,
        gender: document.getElementById('gender').value || '',
        pronouns: document.getElementById('pronouns').value || '',
        bio: document.getElementById('bio').value.trim() || '',
        branch: document.getElementById('branch').value.trim() || '',
        year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
        course: document.getElementById('course').value.trim() || '',
        skills: skills,
        interests: interests,
        linkedIn: document.getElementById('linkedin').value.trim() || '',
        github: document.getElementById('github').value.trim() || '',
        instagram: document.getElementById('instagram').value.trim() || '',
        leetcode: document.getElementById('leetcode').value.trim() || '',
        hackerrank: document.getElementById('hackerrank').value.trim() || '',
        codechef: document.getElementById('codechef').value.trim() || '',
        portfolio: document.getElementById('portfolio').value.trim() || '',
        profileCompleted: true
    };

    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });

        const data = await response.json();

        if (data.success) {
            // Update local storage with new user data
            const userData = JSON.parse(localStorage.getItem('user'));
            Object.assign(userData, profileData);
            localStorage.setItem('user', JSON.stringify(userData));

            showToast('Profile completed successfully!', 'success');

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.replace('/dashboard');
            }, 1500);
        } else {
            showToast(data.message || 'Failed to save profile', 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Something went wrong. Please try again.', 'error');
    }
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
