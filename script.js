/* ============================================================================
   VALENTINE'S DAY GAME - JAVASCRIPT
   Interactive functionality for the Valentine surprise
   With Firebase tracking for Dashboard feature
   ============================================================================ */

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

let noButtonMoveCount = 0;
let currentTrackingId = null; // Current valentine tracking ID
let dashboardListener = null; // Firebase listener for real-time updates
let currentQRLink = null; // Current QR code link for download
let isTestMode = false; // Flag to track if user is testing their own link

const teaseMessages = [
    "Oops! Try again! 😏",
    "Hehe, that's not the right choice! 💕",
    "Come on, you know you want to say Yes! 😘",
    "The No button is shy! 🙈",
    "Are you sure about that? 💗",
    "My heart says you'll click Yes! 💖",
    "No is not an option, sweetie! 🌹",
    "That button has commitment issues! 😂",
    "Keep trying... or just click Yes! 💝",
    "I believe in you! Click Yes! ✨"
];

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const senderName = urlParams.get('from');
    const trackingId = urlParams.get('id');
    const trackView = urlParams.get('track');
    
    if (trackView) {
        // Dashboard view - show tracking dashboard
        showDashboard(trackView);
    } else if (senderName && trackingId) {
        // Valentine link with tracking - show question and record view
        currentTrackingId = trackingId;
        showQuestionScreen(decodeURIComponent(senderName));
        recordView(trackingId);
    } else if (senderName) {
        // Legacy link without tracking - just show question
        showQuestionScreen(decodeURIComponent(senderName));
    } else {
        // Show intro screen
        initFloatingHearts();
    }
    
    // Setup No button behavior
    setupNoButton();
});

// ============================================================================
// FIREBASE HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique tracking ID
 * @returns {string} Unique ID
 */
function generateTrackingId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Check if Firebase is available
 * @returns {boolean}
 */
function isFirebaseReady() {
    return typeof firebaseEnabled !== 'undefined' && firebaseEnabled && database;
}

/**
 * Create a new Valentine entry in Firebase
 * @param {string} trackingId - Unique tracking ID
 * @param {string} senderName - Name of the sender
 */
async function createValentineEntry(trackingId, senderName) {
    if (!isFirebaseReady()) {
        console.log('Firebase not available, skipping tracking');
        return;
    }
    
    try {
        await database.ref('valentines/' + trackingId).set({
            senderName: senderName,
            createdAt: Date.now(),
            views: 0,
            yesClicked: false,
            yesClickedAt: null
        });
        console.log('Valentine entry created:', trackingId);
    } catch (error) {
        console.error('Error creating valentine entry:', error);
    }
}

/**
 * Record a view for a Valentine
 * @param {string} trackingId - Tracking ID
 */
async function recordView(trackingId) {
    if (!isFirebaseReady() || !trackingId) {
        return;
    }
    
    try {
        const ref = database.ref('valentines/' + trackingId + '/views');
        await ref.transaction(currentViews => {
            return (currentViews || 0) + 1;
        });
        console.log('View recorded for:', trackingId);
    } catch (error) {
        console.error('Error recording view:', error);
    }
}

/**
 * Record Yes click for a Valentine
 * @param {string} trackingId - Tracking ID
 */
async function recordYesClick(trackingId) {
    if (!isFirebaseReady() || !trackingId) {
        return;
    }
    
    try {
        await database.ref('valentines/' + trackingId).update({
            yesClicked: true,
            yesClickedAt: Date.now()
        });
        console.log('Yes click recorded for:', trackingId);
    } catch (error) {
        console.error('Error recording yes click:', error);
    }
}

// ============================================================================
// FLOATING HEARTS BACKGROUND
// ============================================================================

function initFloatingHearts() {
    const container = document.getElementById('floatingHearts');
    const hearts = ['💕', '💖', '💗', '💓', '💝', '💘', '❤️', '🌹', '✨'];
    
    // Create initial hearts
    for (let i = 0; i < 15; i++) {
        createFloatingHeart(container, hearts);
    }
    
    // Continue creating hearts
    setInterval(() => {
        if (document.querySelectorAll('.floating-heart').length < 20) {
            createFloatingHeart(container, hearts);
        }
    }, 2000);
}

function createFloatingHeart(container, hearts) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.left = Math.random() * 100 + '%';
    heart.style.animationDuration = (6 + Math.random() * 4) + 's';
    heart.style.fontSize = (15 + Math.random() * 20) + 'px';
    heart.style.animationDelay = Math.random() * 2 + 's';
    
    container.appendChild(heart);
    
    // Remove heart after animation
    setTimeout(() => {
        heart.remove();
    }, 12000);
}

// ============================================================================
// SCREEN NAVIGATION
// ============================================================================

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    document.getElementById(screenId).classList.add('active');
}

function showNameInput() {
    showScreen('nameScreen');
    setTimeout(() => {
        document.getElementById('nameInput').focus();
    }, 500);
}

function showQuestionScreen(senderName) {
    initFloatingHearts();
    
    // Set the sender's name
    document.getElementById('senderName').textContent = senderName;
    document.getElementById('senderNameSuccess').textContent = senderName;
    
    showScreen('questionScreen');
}

// ============================================================================
// LINK GENERATION
// ============================================================================

function generateLink() {
    const nameInput = document.getElementById('nameInput');
    const name = nameInput.value.trim();
    
    if (!name) {
        // Shake the input to indicate error
        nameInput.style.animation = 'shake 0.5s ease';
        setTimeout(() => {
            nameInput.style.animation = '';
        }, 500);
        nameInput.focus();
        return;
    }
    
    // Generate unique tracking ID
    const trackingId = generateTrackingId();
    currentTrackingId = trackingId;
    
    // Generate the shareable link with tracking ID
    const baseUrl = window.location.origin + window.location.pathname;
    const shareableLink = `${baseUrl}?from=${encodeURIComponent(name)}&id=${trackingId}`;
    const trackingLink = `${baseUrl}?track=${trackingId}`;
    
    // Create Firebase entry for tracking
    createValentineEntry(trackingId, name);
    
    // Show link screen with both links
    showScreen('linkScreen');
    document.getElementById('generatedLink').value = shareableLink;
    document.getElementById('trackingLink').value = trackingLink;
    
    // Store link for QR code (generate when section is opened)
    currentQRLink = shareableLink;
}

function copyLink(inputId = 'generatedLink', textId = 'copyText') {
    const linkInput = document.getElementById(inputId);
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile
    
    navigator.clipboard.writeText(linkInput.value).then(() => {
        const copyText = document.getElementById(textId);
        copyText.textContent = '✅ Copied!';
        setTimeout(() => {
            copyText.textContent = '📋 Copy';
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        document.execCommand('copy');
        const copyText = document.getElementById(textId);
        copyText.textContent = '✅ Copied!';
        setTimeout(() => {
            copyText.textContent = '📋 Copy';
        }, 2000);
    });
}

/**
 * Open tracking dashboard for current valentine
 */
function openTracking() {
    const trackingLink = document.getElementById('trackingLink').value;
    if (trackingLink) {
        window.open(trackingLink, '_blank');
    }
}

function shareWhatsApp() {
    const link = document.getElementById('generatedLink').value;
    const message = `Hey! I have a special surprise for you 💕\n\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

function shareTelegram() {
    const link = document.getElementById('generatedLink').value;
    const message = `Hey! I have a special surprise for you 💕`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`, '_blank');
}

function shareEmail() {
    const link = document.getElementById('generatedLink').value;
    const subject = `Will You Be My Valentine? 💕`;
    const body = `Hey!\n\nI have a special Valentine's Day surprise for you! 💕\n\nClick this link to see it:\n${link}\n\nCan't wait for your answer! 💝`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ============================================================================
// SHARE SITE FUNCTIONALITY (Home Screen)
// ============================================================================

function toggleShareMenu() {
    const menu = document.getElementById('shareMenu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

// Close share menu when clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('shareMenu');
    const btn = document.querySelector('.share-site-btn');
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('active');
    }
});

function shareSiteWhatsApp() {
    const siteUrl = 'https://willyoubemyvalentine.fun';
    const message = `💕 Create a cute Valentine's Day surprise for your special someone!\n\n${siteUrl}\n\nThe "No" button runs away - they can only say Yes! 😄`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    toggleShareMenu();
}

function shareSiteTelegram() {
    const siteUrl = 'https://willyoubemyvalentine.fun';
    const message = `💕 Create a cute Valentine's Day surprise! The "No" button runs away!`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent(message)}`, '_blank');
    toggleShareMenu();
}

function shareSiteTwitter() {
    const siteUrl = 'https://willyoubemyvalentine.fun';
    const message = `💕 Create a cute "Will You Be My Valentine?" surprise for your special someone! The "No" button runs away 😄`;
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent(message)}`, '_blank');
    toggleShareMenu();
}

function copySiteLink() {
    const siteUrl = 'https://willyoubemyvalentine.fun';
    navigator.clipboard.writeText(siteUrl).then(() => {
        // Show feedback
        const btn = document.querySelector('.share-site-btn span:last-child');
        if (btn) {
            const original = btn.textContent;
            btn.textContent = 'Link Copied!';
            setTimeout(() => {
                btn.textContent = original;
            }, 2000);
        }
        toggleShareMenu();
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = siteUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toggleShareMenu();
    });
}

function testYourself() {
    // Get the name from the generated link
    const link = document.getElementById('generatedLink').value;
    const urlParams = new URLSearchParams(link.split('?')[1]);
    const senderName = urlParams.get('from');
    
    if (senderName) {
        // Set test mode flag
        isTestMode = true;
        showBackButtons(true);
        
        // Show the question screen with the name
        showQuestionScreen(decodeURIComponent(senderName));
    }
}

/**
 * Show/hide back buttons on question and success screens
 * @param {boolean} show - Whether to show the buttons
 */
function showBackButtons(show) {
    const questionBackBtn = document.getElementById('questionBackBtn');
    const successBackBtn = document.getElementById('successBackBtn');
    
    if (questionBackBtn) {
        questionBackBtn.style.display = show ? 'inline-flex' : 'none';
    }
    if (successBackBtn) {
        successBackBtn.style.display = show ? 'inline-flex' : 'none';
    }
}

/**
 * Go back to the link screen from test mode
 */
function goBackToLink() {
    isTestMode = false;
    showBackButtons(false);
    showScreen('linkScreen');
    
    // Reset any test state
    noButtonMoveCount = 0;
    const teaseText = document.getElementById('teaseText');
    if (teaseText) teaseText.textContent = '';
}

// ============================================================================
// NO BUTTON BEHAVIOR
// ============================================================================

function setupNoButton() {
    const noBtn = document.getElementById('noBtn');
    const container = document.getElementById('buttonContainer');
    
    if (!noBtn || !container) return;
    
    // Move button on hover (desktop)
    noBtn.addEventListener('mouseenter', moveNoButton);
    
    // Move button on touch start (mobile)
    noBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        moveNoButton();
    }, { passive: false });
    
    // Also handle touchmove to prevent scrolling when near button
    noBtn.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
    
    // Handle click as fallback (for accessibility)
    noBtn.addEventListener('click', function(e) {
        e.preventDefault();
        moveNoButton();
    });
    
    // Prevent focus which could cause issues
    noBtn.addEventListener('focus', function() {
        this.blur();
        moveNoButton();
    });
}

function moveNoButton() {
    const noBtn = document.getElementById('noBtn');
    const container = document.getElementById('buttonContainer');
    const questionScreen = document.getElementById('questionScreen');
    
    noButtonMoveCount++;
    
    // Get button dimensions
    const btnWidth = noBtn.offsetWidth;
    const btnHeight = noBtn.offsetHeight;
    
    // Get viewport dimensions with safe margins
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate safe area (keep button fully visible)
    const margin = 20;
    const maxX = viewportWidth - btnWidth - margin;
    const maxY = viewportHeight - btnHeight - margin;
    
    // Calculate random position within safe bounds
    const randomX = Math.max(margin, Math.random() * maxX);
    const randomY = Math.max(margin, Math.random() * maxY);
    
    // Apply new position with fixed positioning
    noBtn.style.position = 'fixed';
    noBtn.style.left = randomX + 'px';
    noBtn.style.top = randomY + 'px';
    noBtn.style.zIndex = '1000';
    
    // Show tease message
    showTeaseMessage();
    
    // Make button smaller after many attempts
    if (noButtonMoveCount > 5) {
        const scale = Math.max(0.4, 1 - (noButtonMoveCount - 5) * 0.1);
        noBtn.style.transform = `scale(${scale})`;
    }
    
    // Make Yes button grow slightly
    const yesBtn = document.getElementById('yesBtn');
    if (noButtonMoveCount > 3) {
        const yesScale = Math.min(1.4, 1 + noButtonMoveCount * 0.05);
        yesBtn.style.transform = `scale(${yesScale})`;
    }
    
    // Vibrate on mobile if supported (subtle feedback)
    if (navigator.vibrate && noButtonMoveCount <= 3) {
        navigator.vibrate(50);
    }
}

function showTeaseMessage() {
    const teaseText = document.getElementById('teaseText');
    const randomMessage = teaseMessages[Math.floor(Math.random() * teaseMessages.length)];
    
    teaseText.style.opacity = '0';
    setTimeout(() => {
        teaseText.textContent = randomMessage;
        teaseText.style.opacity = '1';
    }, 100);
}

// ============================================================================
// SUCCESS CELEBRATION
// ============================================================================

function sayYes() {
    // Record Yes click in Firebase
    if (currentTrackingId) {
        recordYesClick(currentTrackingId);
    }
    
    showScreen('successScreen');
    
    // Start celebrations
    startFireworks();
    startHeartRain();
    playSuccessAnimations();
}

function startFireworks() {
    const fireworksContainer = document.getElementById('fireworks');
    const colors = ['#ff6b9d', '#e91e63', '#9c27b0', '#ff4081', '#ffd700', '#ff8a80'];
    
    // Create multiple firework bursts
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            createFirework(fireworksContainer, colors);
        }, i * 300);
    }
    
    // Continue fireworks periodically
    const fireworkInterval = setInterval(() => {
        createFirework(fireworksContainer, colors);
    }, 500);
    
    // Stop after 10 seconds
    setTimeout(() => {
        clearInterval(fireworkInterval);
    }, 10000);
}

function createFirework(container, colors) {
    const firework = document.createElement('div');
    firework.className = 'firework';
    firework.style.left = Math.random() * 100 + '%';
    firework.style.top = Math.random() * 60 + '%';
    firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    container.appendChild(firework);
    
    // Create sparkle particles
    for (let i = 0; i < 8; i++) {
        createSparkle(container, firework.style.left, firework.style.top);
    }
    
    // Remove after animation
    setTimeout(() => {
        firework.remove();
    }, 1000);
}

function createSparkle(container, x, y) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-particle';
    sparkle.textContent = ['✨', '⭐', '💫', '🌟'][Math.floor(Math.random() * 4)];
    sparkle.style.left = x;
    sparkle.style.top = y;
    sparkle.style.transform = `translate(${(Math.random() - 0.5) * 200}px, 0)`;
    
    container.appendChild(sparkle);
    
    setTimeout(() => {
        sparkle.remove();
    }, 2000);
}

function startHeartRain() {
    const heartsContainer = document.getElementById('heartsRain');
    const hearts = ['💖', '💕', '💗', '💓', '💝', '❤️', '💘', '🌹'];
    
    // Create heart rain
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            createRainHeart(heartsContainer, hearts);
        }, i * 200);
    }
}

function createRainHeart(container, hearts) {
    const heart = document.createElement('div');
    heart.className = 'rain-heart';
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.left = Math.random() * 100 + '%';
    heart.style.fontSize = (20 + Math.random() * 30) + 'px';
    heart.style.animationDuration = (3 + Math.random() * 2) + 's';
    
    container.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
    }, 5000);
}

function playSuccessAnimations() {
    // Add confetti effect
    createConfetti();
}

function createConfetti() {
    const colors = ['#ff6b9d', '#e91e63', '#9c27b0', '#ff4081', '#ffd700', '#ff8a80', '#4caf50', '#2196f3'];
    const container = document.body;
    
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: ${5 + Math.random() * 10}px;
                height: ${5 + Math.random() * 10}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -20px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                z-index: 10000;
                pointer-events: none;
                animation: confettiFall ${2 + Math.random() * 3}s linear forwards;
            `;
            
            container.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 5000);
        }, i * 50);
    }
}

// Add shake animation for input validation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-10px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-10px); }
        80% { transform: translateX(10px); }
    }
    
    @keyframes confettiFall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============================================================================
// KEYBOARD SUPPORT
// ============================================================================

document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const activeScreen = document.querySelector('.screen.active');
        
        if (activeScreen.id === 'introScreen') {
            showNameInput();
        } else if (activeScreen.id === 'nameScreen') {
            generateLink();
        }
    }
});

// ============================================================================
// INFO SECTIONS & FAQ FUNCTIONALITY
// ============================================================================

/**
 * Scroll to the info sections below the intro
 */
function scrollToInfo() {
    const infoSections = document.getElementById('infoSections');
    if (infoSections) {
        infoSections.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Scroll to a specific section by ID
 * @param {string} sectionId - The ID of the section to scroll to
 */
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Toggle mobile navigation menu
 */
function toggleMobileMenu() {
    const nav = document.getElementById('headerNav');
    const icon = document.getElementById('menuIcon');
    if (nav && icon) {
        nav.classList.toggle('open');
        icon.textContent = nav.classList.contains('open') ? '✕' : '☰';
    }
}

/**
 * Close mobile navigation menu
 */
function closeMobileMenu() {
    const nav = document.getElementById('headerNav');
    const icon = document.getElementById('menuIcon');
    if (nav && icon) {
        nav.classList.remove('open');
        icon.textContent = '☰';
    }
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(e) {
    const header = document.getElementById('siteHeader');
    const nav = document.getElementById('headerNav');
    if (header && nav && !header.contains(e.target) && nav.classList.contains('open')) {
        closeMobileMenu();
    }
});

/**
 * Toggle FAQ item open/closed
 * @param {HTMLElement} element - The FAQ item element
 */
function toggleFaq(element) {
    // Close all other FAQ items
    const allFaqItems = document.querySelectorAll('.faq-item');
    allFaqItems.forEach(item => {
        if (item !== element) {
            item.classList.remove('active');
        }
    });
    
    // Toggle the clicked item
    element.classList.toggle('active');
}

// ============================================================================
// PRIVACY MODAL
// ============================================================================

/**
 * Show the privacy modal
 */
function showPrivacy() {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

/**
 * Hide the privacy modal
 * @param {Event} event - Optional event object
 */
function hidePrivacy(event) {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        // If event is provided and click was on modal background, close it
        if (event && event.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        } else if (!event) {
            // Called directly (from X button)
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
}

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hidePrivacy();
    }
});

// ============================================================================
// DASHBOARD FUNCTIONALITY
// ============================================================================

/**
 * Show the dashboard screen and load Valentine data
 * @param {string} trackingId - Tracking ID to load
 */
function showDashboard(trackingId) {
    initFloatingHearts();
    showScreen('dashboardScreen');
    
    // Show loading state
    document.getElementById('dashboardLoading').style.display = 'block';
    document.getElementById('dashboardStats').style.display = 'none';
    document.getElementById('dashboardError').style.display = 'none';
    
    if (!isFirebaseReady()) {
        showDashboardError('Firebase not available. Tracking features require Firebase setup.');
        return;
    }
    
    // Load Valentine data and set up real-time listener
    loadDashboardData(trackingId);
}

/**
 * Load dashboard data from Firebase with real-time updates
 * @param {string} trackingId - Tracking ID
 */
function loadDashboardData(trackingId) {
    if (!isFirebaseReady()) {
        showDashboardError('Firebase not available');
        return;
    }
    
    // Remove previous listener if exists
    if (dashboardListener) {
        dashboardListener.off();
    }
    
    // Store tracking ID for refresh
    currentTrackingId = trackingId;
    
    // Set up real-time listener
    dashboardListener = database.ref('valentines/' + trackingId);
    
    dashboardListener.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            updateDashboardUI(data);
        } else {
            showDashboardError('Valentine not found');
        }
    }, (error) => {
        console.error('Dashboard error:', error);
        showDashboardError('Error loading data');
    });
}

/**
 * Update dashboard UI with Valentine data
 * @param {Object} data - Valentine data from Firebase
 */
function updateDashboardUI(data) {
    // Hide loading, show stats
    document.getElementById('dashboardLoading').style.display = 'none';
    document.getElementById('dashboardStats').style.display = 'block';
    document.getElementById('dashboardError').style.display = 'none';
    
    // Update sender name
    document.getElementById('statSenderName').textContent = data.senderName || 'Unknown';
    
    // Update created date
    const createdDate = new Date(data.createdAt);
    document.getElementById('statCreatedAt').textContent = formatDateTime(createdDate);
    
    // Update views
    document.getElementById('statViews').textContent = (data.views || 0) + ' time' + (data.views !== 1 ? 's' : '');
    
    // Update response status
    const responseCard = document.getElementById('responseCard');
    const responseIcon = document.getElementById('responseIcon');
    const statResponse = document.getElementById('statResponse');
    const responseTimeCard = document.getElementById('responseTimeCard');
    
    if (data.yesClicked) {
        responseCard.classList.add('yes-response');
        responseIcon.textContent = '💖';
        statResponse.textContent = 'Said YES! 🎉';
        
        // Show response time
        if (data.yesClickedAt) {
            responseTimeCard.style.display = 'flex';
            const yesDate = new Date(data.yesClickedAt);
            document.getElementById('statResponseTime').textContent = formatDateTime(yesDate);
        }
    } else {
        responseCard.classList.remove('yes-response');
        responseIcon.textContent = '⏳';
        statResponse.textContent = 'Waiting...';
        responseTimeCard.style.display = 'none';
    }
}

/**
 * Show dashboard error
 * @param {string} message - Error message
 */
function showDashboardError(message) {
    document.getElementById('dashboardLoading').style.display = 'none';
    document.getElementById('dashboardStats').style.display = 'none';
    document.getElementById('dashboardError').style.display = 'block';
    
    const errorHint = document.querySelector('.error-hint');
    if (errorHint && message) {
        errorHint.textContent = message;
    }
}

/**
 * Format date and time for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date/time string
 */
function formatDateTime(date) {
    const options = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Refresh dashboard data
 */
function refreshDashboard() {
    if (currentTrackingId) {
        // Show loading briefly
        document.getElementById('dashboardLoading').style.display = 'block';
        document.getElementById('dashboardStats').style.display = 'none';
        
        // Data will update automatically via real-time listener
        setTimeout(() => {
            if (document.getElementById('dashboardStats').style.display === 'none') {
                loadDashboardData(currentTrackingId);
            }
        }, 500);
    }
}

/**
 * Navigate to home/intro screen
 */
function goToHome() {
    // Clear tracking listener
    if (dashboardListener) {
        dashboardListener.off();
        dashboardListener = null;
    }
    
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Show intro screen
    showScreen('introScreen');
    initFloatingHearts();
}

// ============================================================================
// COUNTDOWN TIMER
// ============================================================================

/**
 * Initialize and run the Valentine's Day countdown timer
 */
function initCountdownTimer() {
    const countdownTimer = document.getElementById('countdownTimer');
    if (!countdownTimer) return;
    
    // Valentine's Day 2026 - February 14, 2026 at midnight
    const valentinesDay = new Date('2026-02-14T00:00:00');
    
    function updateCountdown() {
        const now = new Date();
        const diff = valentinesDay - now;
        
        // If Valentine's Day has passed
        if (diff <= 0) {
            const label = countdownTimer.querySelector('.countdown-label');
            if (label) {
                label.textContent = "💕 Happy Valentine's Day! 💕";
            }
            countdownTimer.classList.add('finished');
            return;
        }
        
        // Calculate time components
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        // Update display
        const daysEl = document.getElementById('countDays');
        const hoursEl = document.getElementById('countHours');
        const minsEl = document.getElementById('countMins');
        const secsEl = document.getElementById('countSecs');
        
        if (daysEl) daysEl.textContent = days;
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minsEl) minsEl.textContent = mins.toString().padStart(2, '0');
        if (secsEl) secsEl.textContent = secs.toString().padStart(2, '0');
    }
    
    // Update immediately and then every second
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// ============================================================================
// LIVE VALENTINE COUNTER
// ============================================================================

/**
 * Initialize and fetch the live Valentine count from Firebase
 */
function initLiveCounter() {
    const counterEl = document.getElementById('valentineCount');
    if (!counterEl) return;
    
    // Wait for Firebase to be ready
    if (!isFirebaseReady()) {
        // Retry after a short delay, max 5 attempts
        if (!window.liveCounterRetries) window.liveCounterRetries = 0;
        window.liveCounterRetries++;
        
        if (window.liveCounterRetries < 5) {
            setTimeout(initLiveCounter, 500);
        } else {
            // Firebase not available, show estimated count
            counterEl.textContent = '2,000+';
        }
        return;
    }
    
    // Try to get count from Firebase
    // Note: This requires Firebase rules to allow read access
    const valentinesRef = database.ref('valentines');
    
    valentinesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const count = Object.keys(data).length;
            animateCounter(counterEl, count);
        } else {
            counterEl.textContent = '2,000+';
        }
    }, (error) => {
        // Permission denied or other error - show estimated count silently
        // Based on actual data: ~2000 valentines created
        counterEl.textContent = '2,000+';
    });
}

/**
 * Animate counter from current value to target value
 * @param {HTMLElement} element - The element to update
 * @param {number} target - Target count value
 */
function animateCounter(element, target) {
    const current = parseInt(element.textContent.replace(/,/g, '')) || 0;
    const diff = target - current;
    
    // If difference is small, just set it directly
    if (Math.abs(diff) < 5) {
        element.textContent = target.toLocaleString();
        return;
    }
    
    // Animate the count
    const duration = 1000; // 1 second
    const steps = 30;
    const stepValue = diff / steps;
    let step = 0;
    
    const interval = setInterval(() => {
        step++;
        const newValue = Math.round(current + (stepValue * step));
        element.textContent = newValue.toLocaleString();
        
        if (step >= steps) {
            clearInterval(interval);
            element.textContent = target.toLocaleString();
        }
    }, duration / steps);
}

// Initialize countdown and counter when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initCountdownTimer();
    initLiveCounter();
    initTestimonials();
});

// ============================================================================
// QR CODE GENERATION
// ============================================================================

/**
 * Toggle QR code section visibility
 */
function toggleQrSection() {
    const qrSection = document.getElementById('qrSection');
    const qrContent = document.getElementById('qrContent');
    
    if (!qrSection || !qrContent) return;
    
    const isOpen = qrContent.style.display !== 'none';
    
    if (isOpen) {
        qrContent.style.display = 'none';
        qrSection.classList.remove('open');
    } else {
        qrContent.style.display = 'block';
        qrSection.classList.add('open');
        
        // Always regenerate QR when opening (ensures it's visible)
        if (currentQRLink) {
            // Small delay to ensure canvas is visible before drawing
            setTimeout(() => generateQRCode(currentQRLink), 100);
        }
    }
}

/**
 * Generate QR code for the valentine link using QRious library
 * @param {string} link - The valentine link
 */
function generateQRCode(link) {
    const canvas = document.getElementById('qrCanvas');
    
    // Store the link for later
    currentQRLink = link;
    
    // Check if QRious library is loaded
    if (!window.QRious) {
        // Retry after library loads
        setTimeout(() => generateQRCode(link), 300);
        return;
    }
    
    if (!canvas) {
        // Canvas not found, retry
        setTimeout(() => generateQRCode(link), 300);
        return;
    }
    
    // Generate the QR code using QRious
    try {
        new QRious({
            element: canvas,
            value: link,
            size: 180,
            level: 'M',
            foreground: '#e91e63',
            background: '#ffffff',
            padding: 10
        });
    } catch (error) {
        console.error('QR Code generation error:', error);
    }
}

/**
 * Download QR code as PNG image
 */
function downloadQRCode() {
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;
    
    // Create a temporary link to download
    const link = document.createElement('a');
    link.download = 'valentine-qr-code.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ============================================================================
// TESTIMONIALS ROTATION
// ============================================================================

let currentTestimonial = 0;
let testimonialInterval = null;

/**
 * Initialize testimonials auto-rotation
 */
function initTestimonials() {
    const testimonials = document.querySelectorAll('.testimonial-card');
    if (testimonials.length === 0) return;
    
    // Start auto-rotation
    testimonialInterval = setInterval(() => {
        currentTestimonial = (currentTestimonial + 1) % testimonials.length;
        showTestimonial(currentTestimonial);
    }, 4000); // Rotate every 4 seconds
}

/**
 * Show specific testimonial
 * @param {number} index - Index of testimonial to show
 */
function showTestimonial(index) {
    const testimonials = document.querySelectorAll('.testimonial-card');
    const dots = document.querySelectorAll('.testimonial-dots .dot');
    
    if (testimonials.length === 0) return;
    
    // Update current index
    currentTestimonial = index;
    
    // Hide all testimonials
    testimonials.forEach(t => t.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    
    // Show selected testimonial
    if (testimonials[index]) {
        testimonials[index].classList.add('active');
    }
    if (dots[index]) {
        dots[index].classList.add('active');
    }
    
    // Reset the interval when manually clicking
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
        testimonialInterval = setInterval(() => {
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            showTestimonial(currentTestimonial);
        }, 4000);
    }
}

// ============================================================================
// WHAT'S NEXT - POST-YES FOLLOW-UP FUNCTIONALITY
// ============================================================================

/**
 * Collection of romantic quotes for the follow-up section
 */
const romanticQuotes = [
    { text: "You are my today and all of my tomorrows.", author: "Leo Christopher" },
    { text: "In all the world, there is no heart for me like yours.", author: "Maya Angelou" },
    { text: "I love you not only for what you are, but for what I am when I am with you.", author: "Roy Croft" },
    { text: "Whatever our souls are made of, his and mine are the same.", author: "Emily Brontë" },
    { text: "I have waited for this opportunity for more than half a century, to repeat to you once again my vow of eternal fidelity and everlasting love.", author: "Gabriel García Márquez" },
    { text: "You are the finest, loveliest, tenderest person I have ever known.", author: "F. Scott Fitzgerald" },
    { text: "I saw that you were perfect, and so I loved you. Then I saw that you were not perfect and I loved you even more.", author: "Angelita Lim" },
    { text: "The best thing to hold onto in life is each other.", author: "Audrey Hepburn" },
    { text: "If I know what love is, it is because of you.", author: "Hermann Hesse" },
    { text: "I wish I could turn back the clock. I'd find you sooner and love you longer.", author: "Unknown" },
    { text: "To love and be loved is to feel the sun from both sides.", author: "David Viscott" },
    { text: "You are my heart, my life, my one and only thought.", author: "Arthur Conan Doyle" },
    { text: "I fell in love the way you fall asleep: slowly, and then all at once.", author: "John Green" },
    { text: "Every love story is beautiful, but ours is my favorite.", author: "Unknown" },
    { text: "You make me want to be a better person.", author: "Melvin Udall" },
    { text: "My heart is, and always will be, yours.", author: "Jane Austen" },
    { text: "I choose you. And I'll choose you over and over. Without pause, without doubt, in a heartbeat.", author: "Unknown" },
    { text: "You are the last thought in my mind before I drift off to sleep and the first thought when I wake up each morning.", author: "Unknown" },
    { text: "Grow old with me, the best is yet to be.", author: "Robert Browning" },
    { text: "In case you ever foolishly forget: I am never not thinking of you.", author: "Virginia Woolf" }
];

let currentQuoteIndex = 0;

/**
 * Toggle followup card open/close
 * @param {string} cardId - ID of the card to toggle
 */
function toggleFollowupCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    card.classList.toggle('open');
}

/**
 * Get a new random quote
 */
function getNewQuote() {
    // Get a different quote than current
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * romanticQuotes.length);
    } while (newIndex === currentQuoteIndex && romanticQuotes.length > 1);
    
    currentQuoteIndex = newIndex;
    const quote = romanticQuotes[currentQuoteIndex];
    
    // Update both possible quote elements (main page and ecard page)
    const quoteTextEl = document.getElementById('randomQuoteText') || document.getElementById('randomQuoteTextEcard');
    const quoteAuthorEl = document.getElementById('randomQuoteAuthor') || document.getElementById('randomQuoteAuthorEcard');
    
    if (quoteTextEl) {
        quoteTextEl.textContent = `"${quote.text}"`;
    }
    if (quoteAuthorEl) {
        quoteAuthorEl.textContent = `— ${quote.author}`;
    }
}

/**
 * Copy current quote to clipboard
 */
function copyQuote() {
    const quoteTextEl = document.getElementById('randomQuoteText') || document.getElementById('randomQuoteTextEcard');
    const quoteAuthorEl = document.getElementById('randomQuoteAuthor') || document.getElementById('randomQuoteAuthorEcard');
    
    if (!quoteTextEl || !quoteAuthorEl) return;
    
    const fullQuote = `${quoteTextEl.textContent} ${quoteAuthorEl.textContent}`;
    
    navigator.clipboard.writeText(fullQuote).then(() => {
        showCopyToast('Quote copied!');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = fullQuote;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyToast('Quote copied!');
    });
}

/**
 * Select a date idea (visual feedback)
 * @param {HTMLElement} element - The clicked date idea card
 */
function selectDateIdea(element) {
    // Remove selected class from all cards
    document.querySelectorAll('.date-idea-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected class to clicked card
    element.classList.add('selected');
    
    // Get the date idea text
    const title = element.querySelector('.date-idea-title').textContent;
    const desc = element.querySelector('.date-idea-desc').textContent;
    const emoji = element.querySelector('.date-idea-emoji').textContent;
    
    // Copy to clipboard
    const dateText = `${emoji} Valentine's Date Idea: ${title} - ${desc}`;
    navigator.clipboard.writeText(dateText).then(() => {
        showCopyToast(`${emoji} ${title} copied!`);
    }).catch(() => {
        showCopyToast(`${emoji} ${title} selected!`);
    });
}

/**
 * Copy reply template to clipboard
 * @param {HTMLElement} element - The clicked reply template
 */
function copyReply(element) {
    const replyText = element.querySelector('.reply-text').textContent;
    
    // Visual feedback - add copied class
    element.classList.add('copied');
    const copyIcon = element.querySelector('.reply-copy-icon');
    if (copyIcon) {
        copyIcon.textContent = '✓';
    }
    
    // Reset after 2 seconds
    setTimeout(() => {
        element.classList.remove('copied');
        if (copyIcon) {
            copyIcon.textContent = '📋';
        }
    }, 2000);
    
    navigator.clipboard.writeText(replyText).then(() => {
        showCopyToast('Reply copied! Send it to your Valentine!');
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = replyText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyToast('Reply copied!');
    });
}

/**
 * Show a toast notification for copy actions
 * @param {string} message - Message to display
 */
function showCopyToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.copy-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.innerHTML = `<span>✓</span> ${message}`;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after 2.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}

/**
 * Initialize What's Next section with a random quote
 */
function initWhatsNext() {
    // Set a random quote on load
    currentQuoteIndex = Math.floor(Math.random() * romanticQuotes.length);
    const quote = romanticQuotes[currentQuoteIndex];
    
    // Update both possible quote elements
    const quoteTextEl = document.getElementById('randomQuoteText') || document.getElementById('randomQuoteTextEcard');
    const quoteAuthorEl = document.getElementById('randomQuoteAuthor') || document.getElementById('randomQuoteAuthorEcard');
    
    if (quoteTextEl) {
        quoteTextEl.textContent = `"${quote.text}"`;
    }
    if (quoteAuthorEl) {
        quoteAuthorEl.textContent = `— ${quote.author}`;
    }
}
