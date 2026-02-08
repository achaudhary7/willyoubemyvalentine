/**
 * Valentine Ad Manager
 *
 * Reusable Google AdSense integration for WillYouBeMyValentine.fun
 *
 * ============================================================================
 * KEY FEATURES
 * ============================================================================
 * - Lazy loading with Intersection Observer (only load ads when visible)
 * - Automatic AdSense initialization
 * - Sticky bottom ad for mobile with dismiss
 * - Responsive ad sizing
 * - Fallback placeholder when AdSense not loaded
 * - CLS prevention with min-height containers
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 * 1. Include this script: <script src="/ad-manager.js"></script>
 * 2. Add ad containers in HTML:
 *    <div class="ad-container ad-container--leaderboard" 
 *         data-ad-slot="YOUR_SLOT_ID"
 *         data-ad-format="auto"
 *         data-ad-lazy="true">
 *        <span class="ad-label">Advertisement</span>
 *    </div>
 * 3. Call ValentineAds.init() or let DOMContentLoaded handle it
 *
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 * Set your AdSense Publisher ID below:
 */

// ============================================================================
// AD CONFIGURATION
// ============================================================================

const AD_CONFIG = {
    // Google AdSense Publisher ID - Replace with your actual ID
    publisherId: 'ca-pub-7457883797698050',

    // Enable/disable ads globally (useful for testing)
    enabled: true,

    // Lazy loading threshold (how far before viewport to start loading)
    lazyThreshold: '200px',

    // Sticky bottom ad delay (ms after page load)
    stickyDelay: 5000,

    // Sticky bottom ad - auto-hide after (ms), 0 = never
    stickyAutoHide: 0,

    // Minimum screen width for sidebar ads (px)
    sidebarMinWidth: 1025,

    // Maximum ads per page (Google recommends balance)
    maxAdsPerPage: 8,

    // Debug mode - logs ad events to console
    debug: false
};

// ============================================================================
// AD MANAGER CLASS
// ============================================================================

const ValentineAds = {

    // Track initialized ads
    _initializedAds: new Set(),
    _observer: null,
    _adCount: 0,
    _adSenseLoaded: false,

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the ad system
     * Call this on DOMContentLoaded or when ready
     */
    init: function() {
        if (!AD_CONFIG.enabled) {
            if (AD_CONFIG.debug) console.log('[AdManager] Ads disabled');
            return;
        }

        // Load AdSense script if not already loaded
        this._loadAdSenseScript();

        // Set up Intersection Observer for lazy loading
        this._setupLazyLoading();

        // Initialize all ad containers on the page
        this._initializeAdContainers();

        // Setup sticky bottom ad for mobile
        this._setupStickyAd();

        if (AD_CONFIG.debug) console.log('[AdManager] Initialized');
    },

    // ========================================================================
    // ADSENSE SCRIPT LOADING
    // ========================================================================

    /**
     * Load the Google AdSense script tag
     */
    _loadAdSenseScript: function() {
        // Check if already loaded
        if (document.querySelector('script[src*="adsbygoogle"]')) {
            this._adSenseLoaded = true;
            return;
        }

        var script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + AD_CONFIG.publisherId;

        script.onload = function() {
            ValentineAds._adSenseLoaded = true;
            if (AD_CONFIG.debug) console.log('[AdManager] AdSense script loaded');
            // Push any queued ads
            ValentineAds._pushQueuedAds();
        };

        script.onerror = function() {
            if (AD_CONFIG.debug) console.log('[AdManager] AdSense script failed to load (likely ad blocker)');
        };

        document.head.appendChild(script);
    },

    // ========================================================================
    // LAZY LOADING WITH INTERSECTION OBSERVER
    // ========================================================================

    /**
     * Set up Intersection Observer for lazy-loading ads
     */
    _setupLazyLoading: function() {
        if (!('IntersectionObserver' in window)) {
            // Fallback: load all ads immediately
            this._loadAllAdsImmediately();
            return;
        }

        this._observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var container = entry.target;
                    ValentineAds._activateAd(container);
                    ValentineAds._observer.unobserve(container);
                }
            });
        }, {
            rootMargin: AD_CONFIG.lazyThreshold
        });
    },

    // ========================================================================
    // AD CONTAINER INITIALIZATION
    // ========================================================================

    /**
     * Find and initialize all ad containers on the page
     */
    _initializeAdContainers: function() {
        var containers = document.querySelectorAll('.ad-container[data-ad-slot]');

        containers.forEach(function(container) {
            var id = container.id || ('ad-' + Math.random().toString(36).substr(2, 8));
            container.id = id;

            // Skip if already initialized
            if (ValentineAds._initializedAds.has(id)) return;

            // Skip if max ads reached
            if (ValentineAds._adCount >= AD_CONFIG.maxAdsPerPage) {
                container.style.display = 'none';
                return;
            }

            // Check if lazy loading is enabled for this ad
            if (container.dataset.adLazy === 'true' && ValentineAds._observer) {
                ValentineAds._observer.observe(container);
            } else {
                ValentineAds._activateAd(container);
            }

            ValentineAds._initializedAds.add(id);
            ValentineAds._adCount++;
        });
    },

    // ========================================================================
    // AD ACTIVATION
    // ========================================================================

    /**
     * Detect if current viewport is mobile
     * @returns {boolean} true if mobile (<=768px)
     */
    _isMobile: function() {
        return window.innerWidth <= 768;
    },

    /**
     * Detect if current viewport is small mobile
     * @returns {boolean} true if small mobile (<=500px)
     */
    _isSmallMobile: function() {
        return window.innerWidth <= 500;
    },

    /**
     * Get optimal ad format based on viewport and container type
     * @param {HTMLElement} container - The ad container element
     * @param {string} requestedFormat - The requested ad format
     * @returns {string} optimal format for current viewport
     */
    _getOptimalFormat: function(container, requestedFormat) {
        // If explicit format requested (not auto/horizontal), respect it
        if (requestedFormat && requestedFormat !== 'auto' && requestedFormat !== 'horizontal') {
            return requestedFormat;
        }

        // On mobile, use 'auto' to let Google pick the best mobile format
        // Google's auto format handles 320x100, 320x50, 300x250 selection
        if (this._isMobile()) {
            // For in-article containers on mobile, rectangle performs best
            if (container.classList.contains('ad-container--in-article') || 
                container.classList.contains('ad-container--mobile-incontent')) {
                return 'rectangle';
            }
            // For all other mobile ads, let Google optimize
            return 'auto';
        }

        // On desktop, horizontal works best for leaderboard-style placements
        if (requestedFormat === 'horizontal') {
            return 'horizontal';
        }

        return 'auto';
    },

    /**
     * Activate a single ad container - insert AdSense code
     * @param {HTMLElement} container - The ad container element
     */
    _activateAd: function(container) {
        if (!container || container.classList.contains('ad-loaded')) return;

        var slotId = container.dataset.adSlot;
        var requestedFormat = container.dataset.adFormat || 'auto';
        var responsive = container.dataset.adResponsive !== 'false';

        // Get optimal format based on viewport
        var format = this._getOptimalFormat(container, requestedFormat);

        // Add visibility class for animation
        container.classList.add('ad-visible');

        // Create the AdSense ins element
        var ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', AD_CONFIG.publisherId);

        if (slotId && slotId !== 'auto') {
            ins.setAttribute('data-ad-slot', slotId);
        }

        ins.setAttribute('data-ad-format', format);

        // Always enable full-width-responsive on mobile for better fill rates
        if (responsive || this._isMobile()) {
            ins.setAttribute('data-full-width-responsive', 'true');
        }

        // Insert the ad element
        container.appendChild(ins);
        container.classList.add('ad-loaded');

        // Push to AdSense
        this._pushAd();

        if (AD_CONFIG.debug) console.log('[AdManager] Ad activated:', container.id, 'format:', format, 'mobile:', this._isMobile());
    },

    /**
     * Push ad to Google AdSense
     */
    _pushAd: function() {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            if (AD_CONFIG.debug) console.error('[AdManager] AdSense push error:', e);
        }
    },

    /**
     * Push any ads that were queued before AdSense loaded
     */
    _pushQueuedAds: function() {
        var loadedAds = document.querySelectorAll('.ad-container.ad-loaded');
        loadedAds.forEach(function() {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                // Silently ignore
            }
        });
    },

    /**
     * Fallback: Load all ads immediately (no Intersection Observer)
     */
    _loadAllAdsImmediately: function() {
        var containers = document.querySelectorAll('.ad-container[data-ad-slot]');
        containers.forEach(function(container) {
            ValentineAds._activateAd(container);
        });
    },

    // ========================================================================
    // STICKY BOTTOM AD (MOBILE)
    // ========================================================================

    /**
     * Setup the sticky bottom ad for mobile devices
     */
    _setupStickyAd: function() {
        var stickyAd = document.querySelector('.ad-container--sticky');
        if (!stickyAd) return;

        // Only show on mobile
        if (window.innerWidth > 768) return;

        // Show after delay
        setTimeout(function() {
            stickyAd.style.display = 'flex';
            ValentineAds._activateAd(stickyAd);

            // Add body padding to prevent content being hidden behind sticky ad
            document.body.style.paddingBottom = '60px';
        }, AD_CONFIG.stickyDelay);

        // Auto-hide if configured
        if (AD_CONFIG.stickyAutoHide > 0) {
            setTimeout(function() {
                ValentineAds.closeStickyAd();
            }, AD_CONFIG.stickyDelay + AD_CONFIG.stickyAutoHide);
        }
    },

    /**
     * Close the sticky bottom ad
     */
    closeStickyAd: function() {
        var stickyAd = document.querySelector('.ad-container--sticky');
        if (stickyAd) {
            stickyAd.style.display = 'none';
            document.body.style.paddingBottom = '';
        }
    },

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Dynamically insert an ad between elements
     * @param {string} afterSelector - CSS selector for the element to insert after
     * @param {string} adType - Ad type class (e.g., 'leaderboard', 'rectangle')
     * @param {string} slotId - AdSense slot ID
     */
    insertAdAfter: function(afterSelector, adType, slotId) {
        var targetEl = document.querySelector(afterSelector);
        if (!targetEl) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'ad-section-break';
        wrapper.innerHTML = 
            '<div class="ad-container ad-container--' + adType + '" ' +
            'data-ad-slot="' + (slotId || 'auto') + '" ' +
            'data-ad-format="auto" ' +
            'data-ad-lazy="true">' +
            '<span class="ad-label">Advertisement</span>' +
            '</div>';

        targetEl.parentNode.insertBefore(wrapper, targetEl.nextSibling);

        // Initialize the newly added container
        if (this._observer) {
            this._observer.observe(wrapper.querySelector('.ad-container'));
        }
    },

    /**
     * Refresh all ads on the page (useful for SPA navigation)
     */
    refreshAll: function() {
        this._initializedAds.clear();
        this._adCount = 0;

        // Remove existing ad content
        document.querySelectorAll('.ad-container').forEach(function(container) {
            container.classList.remove('ad-loaded', 'ad-visible');
            var ins = container.querySelector('.adsbygoogle');
            if (ins) ins.remove();
        });

        // Reinitialize
        this._initializeAdContainers();
    },

    /**
     * Disable all ads (e.g., for premium users)
     */
    disable: function() {
        AD_CONFIG.enabled = false;
        document.querySelectorAll('.ad-container').forEach(function(container) {
            container.style.display = 'none';
        });
        this.closeStickyAd();
    }
};

// ============================================================================
// AUTO-INITIALIZE ON DOM READY
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Defer ad initialization to avoid blocking scroll/interaction
    // Use requestIdleCallback if available, otherwise fallback to longer setTimeout
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function() {
            ValentineAds.init();
        }, { timeout: 3000 });
    } else {
        setTimeout(function() {
            ValentineAds.init();
        }, 1500);
    }
});
