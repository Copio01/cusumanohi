/**
 * Main JavaScript for Cusumano Home Improvements
 */

document.addEventListener('DOMContentLoaded', () => {
    // Set up core functionality
    setupModalFunctionality();
    setupScrollBehavior();
    setupMobileNavigation();
    setupHeaderEffects();
    setupAdminButton();
    setupContactForm();
    setupFacebookSDK(); 
    setupServiceCardEffects();
});

// Apply header effects on scroll
function setupHeaderEffects() {
    const header = document.querySelector('.main-header');
    
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
}

// Set up mobile navigation toggle
function setupMobileNavigation() {
    const mobileToggle = document.getElementById('mobile-toggle');
    const mainNav = document.getElementById('main-nav');
    
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', () => {
            mainNav.classList.toggle('open');
            mobileToggle.setAttribute('aria-expanded', 
                mainNav.classList.contains('open') ? 'true' : 'false');
        });
        
        // Close menu when clicking a link
        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    mainNav.classList.remove('open');
                    mobileToggle.setAttribute('aria-expanded', 'false');
                }
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && 
                !mainNav.contains(event.target) && 
                !mobileToggle.contains(event.target) && 
                mainNav.classList.contains('open')) {
                mainNav.classList.remove('open');
                mobileToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// Add visual effects to service cards
function setupServiceCardEffects() {
    const serviceCards = document.querySelectorAll('.service-card');
    
    if (serviceCards.length) {
        // Add entrance animation
        serviceCards.forEach((card, index) => {
            // Delayed appearance for staggered effect
            setTimeout(() => {
                card.classList.add('visible');
            }, 100 * index);
            
            // Add hover interaction to cards
            card.addEventListener('mouseenter', () => {
                // Remove active class from all other cards
                serviceCards.forEach(otherCard => {
                    if (otherCard !== card) {
                        otherCard.classList.remove('active');
                    }
                });
                
                // Add active class to current card
                card.classList.add('active');
            });
        });
    }
}

// Contact form with secure form handling
function setupContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent default form submission
            
            // Get form data
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const message = document.getElementById('message').value;
            
            // Store form data in sessionStorage for demonstration
            // In production, you would send this to a server endpoint over HTTPS
            sessionStorage.setItem('contactFormSubmission', JSON.stringify({
                name,
                email,
                phone,
                message,
                timestamp: new Date().toISOString()
            }));
            
            // Show a confirmation message
            // Reset the form
            contactForm.reset();
            
            // Close modal if it exists
            const modal = document.getElementById('contact-modal');
            if (modal) {
                modal.classList.remove('active');
                document.body.classList.remove('modal-open');
            }
            
            // Show success message
            alert('Thank you for your message! We will get back to you soon.');
        });
    }
}

// Modal functionality
function setupModalFunctionality() {
    const modal = document.getElementById('contact-modal');
    const openModalBtn = document.getElementById('open-contact-modal');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    
    if (openModalBtn && modal && closeModalBtn) {
        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        });
        
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.classList.remove('modal-open');
            }
        });
        
        // Accessibility: Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
                document.body.classList.remove('modal-open');
            }
        });
    }
}

// Scroll behavior
function setupScrollBehavior() {
    // Scroll to top button
    const scrollTopBtn = document.getElementById('scroll-top');
    
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });
        
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.main-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Check if the link is pointing to a section on the page
            const href = link.getAttribute('href');
            if (href && href.startsWith('#') && document.querySelector(href)) {
                e.preventDefault();
                const targetSection = document.querySelector(href);
                window.scrollTo({
                    top: targetSection.offsetTop - 80, // Adjust for header height
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Highlight sections in viewport
    const sections = document.querySelectorAll('section[id]');
    
    function highlightNavLink() {
        let scrollPosition = window.scrollY;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100; // Adjust for header
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                const activeLink = document.querySelector(`.main-nav a[href="#${sectionId}"]`);
                if (activeLink) activeLink.classList.add('active');
            } else {
                const inactiveLink = document.querySelector(`.main-nav a[href="#${sectionId}"]`);
                if (inactiveLink) inactiveLink.classList.remove('active');
            }
        });
    }
    
    // Call once on load and then on scroll
    highlightNavLink();
    window.addEventListener('scroll', highlightNavLink);
    
    // Add reveal animations for sections
    const revealElements = document.querySelectorAll('.container');
    
    function revealOnScroll() {
        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('revealed');
            }
        });
    }
    
    // Call once on load and then on scroll
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();
}

// Admin login button functionality
function setupAdminButton() {
    const adminLoginBtn = document.getElementById('admin-login-btn');
    
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Redirect to admin panel
            window.location.href = 'admin.html';
        });
    }
}

// Simple Facebook setup without SDK dependencies
function setupFacebookSDK() {
    const fbContainer = document.querySelector('.facebook-feed');
    if (fbContainer) {
        fbContainer.innerHTML = `
            <div class="fb-fallback">
                <p>View our latest projects and updates on our Facebook page!</p>
                <a href="https://www.facebook.com/cusumanocement/" target="_blank" rel="noopener noreferrer" class="btn-facebook">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
                    </svg>
                    Visit Our Facebook Page
                </a>
            </div>
        `;
    }
}