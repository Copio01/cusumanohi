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
    setupFacebookPlugin(); 
    setupServiceCardEffects();
    loadGalleryImages(); // Load images from IndexedDB or localStorage
});

// Load gallery images from IndexedDB with localStorage fallback
function loadGalleryImages() {
    const slider = document.querySelector('.slider');
    const dotsContainer = document.querySelector('.slider-dots');
    
    if (!slider || !dotsContainer) return;
    
    // Clear existing slides and dots
    slider.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    // Try to load from IndexedDB first, then fallback to localStorage
    loadImagesFromIndexedDB()
        .then(success => {
            if (!success) {
                loadImagesFromLocalStorage();
            }
        })
        .catch(() => {
            loadImagesFromLocalStorage();
        });
    
    // Function to load from IndexedDB
    async function loadImagesFromIndexedDB() {
        try {
            // Set up IndexedDB
            const DB_NAME = 'cusumanoGallery';
            const DB_VERSION = 1;
            const STORE_NAME = 'images';
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                
                request.onerror = () => {
                    console.log('IndexedDB error, falling back to localStorage');
                    resolve(false);
                };
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    
                    try {
                        const transaction = db.transaction([STORE_NAME], 'readonly');
                        const store = transaction.objectStore(STORE_NAME);
                        const getRequest = store.getAll();
                        
                        getRequest.onsuccess = (event) => {
                            const images = event.target.result;
                            
                            if (images && images.length > 0) {
                                console.log('Loaded gallery images from IndexedDB:', images.length);
                                renderGallerySlides(images, slider, dotsContainer);
                                resolve(true);
                            } else {
                                console.log('No images found in IndexedDB');
                                resolve(false);
                            }
                        };
                        
                        getRequest.onerror = () => {
                            console.error('Error getting images from IndexedDB');
                            resolve(false);
                        };
                    } catch (error) {
                        console.error('Transaction error:', error);
                        resolve(false);
                    }
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    }
                };
            });
        } catch (error) {
            console.error('IndexedDB error:', error);
            return false;
        }
    }
    
    // Function to load from localStorage
    function loadImagesFromLocalStorage() {
        try {
            const storedImages = localStorage.getItem('galleryImages');
            if (storedImages) {
                const galleryImages = JSON.parse(storedImages);
                console.log('Loaded gallery images from localStorage:', galleryImages.length);
                renderGallerySlides(galleryImages, slider, dotsContainer);
            } else {
                // Check if there are image references (from IndexedDB)
                const imageRefs = localStorage.getItem('galleryImageRefs');
                if (imageRefs) {
                    console.log('Found image references, but need actual images from IndexedDB');
                    loadDefaultCategories();
                } else {
                    console.log('No gallery images found in localStorage, using defaults');
                    loadDefaultCategories();
                }
            }
        } catch (error) {
            console.error('Error loading images from local storage:', error);
            loadDefaultCategories();
        }
    }
    
    // Load placeholders organized by category
    function loadDefaultCategories() {
        const galleryImages = [
            { 
                dataUrl: 'https://placehold.co/800x400/0a4d68/white?text=Siding+Installation', 
                alt: 'Siding Installation', 
                category: 'siding' 
            },
            { 
                dataUrl: 'https://placehold.co/800x400/088395/white?text=Window+Replacement', 
                alt: 'Window Replacement', 
                category: 'windows' 
            },
            { 
                dataUrl: 'https://placehold.co/800x400/0a4d68/white?text=Custom+Deck+Building', 
                alt: 'Custom Deck', 
                category: 'decks' 
            },
            { 
                dataUrl: 'https://placehold.co/800x400/088395/white?text=Dumpster+Rental', 
                alt: 'Dumpster Rental', 
                category: 'dumpsters' 
            }
        ];
        
        renderGallerySlides(galleryImages, slider, dotsContainer);
    }
}

// Function to render gallery slides
function renderGallerySlides(images, sliderElement, dotsContainer) {
    if (!images || !Array.isArray(images) || images.length === 0) return;
    
    // Create slides
    images.forEach((image, index) => {
        const slide = document.createElement('div');
        slide.className = `slide${index === 0 ? ' active' : ''}`;
        
        const img = document.createElement('img');
        img.src = image.dataUrl;
        img.alt = image.alt || `Gallery Image ${index + 1}`;
        img.onerror = function() {
            // If image fails to load, use a placeholder
            this.src = `https://placehold.co/800x400/${index % 2 ? '0a4d68' : '088395'}/white?text=${encodeURIComponent(image.category || 'Gallery Image')}`;
        };
        
        slide.appendChild(img);
        sliderElement.appendChild(slide);
        
        // Create dot
        const dot = document.createElement('button');
        dot.className = `dot${index === 0 ? ' active' : ''}`;
        dot.setAttribute('aria-label', `Slide ${index + 1}`);
        dotsContainer.appendChild(dot);
    });
    
    // Set up slider navigation
    setupSliderNavigation(sliderElement, dotsContainer);
}

// Set up slider navigation
function setupSliderNavigation(slider, dotsContainer) {
    const slides = slider.querySelectorAll('.slide');
    const dots = dotsContainer.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.slider-arrow.left');
    const nextBtn = document.querySelector('.slider-arrow.right');
    
    let currentIndex = 0;
    
    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        
        currentIndex = index;
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            const newIndex = (currentIndex - 1 + slides.length) % slides.length;
            showSlide(newIndex);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const newIndex = (currentIndex + 1) % slides.length;
            showSlide(newIndex);
        });
    }
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showSlide(index);
        });
    });
}

// Modal functionality
function setupModalFunctionality() {
    const modalTrigger = document.getElementById('open-contact-modal');
    const modal = document.getElementById('contact-modal');
    const closeBtn = modal?.querySelector('.modal-close-btn');
    
    if (modalTrigger && modal) {
        modalTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });
        
        // Close on X button click
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                document.body.style.overflow = ''; // Re-enable scrolling
            });
        }
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.style.overflow = ''; // Re-enable scrolling
            }
        });
        
        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
                document.body.style.overflow = ''; // Re-enable scrolling
            }
        });
    }
}

// Scroll behavior
function setupScrollBehavior() {
    const scrollTopBtn = document.getElementById('scroll-top');
    
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
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
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                e.preventDefault();
                window.scrollTo({
                    top: target.offsetTop - 80, // Offset for fixed header
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                const mobileNav = document.getElementById('main-nav');
                if (mobileNav.classList.contains('active')) {
                    mobileNav.classList.remove('active');
                    document.getElementById('mobile-toggle').setAttribute('aria-expanded', 'false');
                }
            }
        });
    });
}

// Mobile navigation
function setupMobileNavigation() {
    const mobileToggle = document.getElementById('mobile-toggle');
    const mainNav = document.getElementById('main-nav');
    
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            const isExpanded = mainNav.classList.contains('active');
            mobileToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        });
    }
}

// Header effects
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

// Admin link (only show when logged in)
function setupAdminButton() {
    const adminButton = document.querySelector('.admin-login-float');
    
    if (adminButton) {
        // Check if user is logged in
        const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
        
        // Only show the button if logged in
        adminButton.style.display = isLoggedIn ? 'block' : 'none';
    }
}

// Contact form functionality
function setupContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Form validation
            const formValid = validateForm(contactForm);
            
            if (formValid) {
                // Here you would normally send the form data to a server
                // But for now, we'll just simulate a successful submission
                
                const formData = new FormData(contactForm);
                const formValues = {};
                
                formData.forEach((value, key) => {
                    formValues[key] = value;
                });
                
                // Store in localStorage for reference
                const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
                inquiries.push({
                    ...formValues,
                    date: new Date().toISOString()
                });
                localStorage.setItem('inquiries', JSON.stringify(inquiries));
                
                // Reset form and show success message
                contactForm.reset();
                
                // Show success message
                alert('Thank you for your message! We will get back to you soon.');
                
                // Close modal
                const modal = document.getElementById('contact-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = ''; // Re-enable scrolling
                }
            }
        });
    }
}

// Form validation helper
function validateForm(form) {
    let valid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            valid = false;
            field.classList.add('error');
            
            // Add error message if it doesn't exist
            let errorMsg = field.parentNode.querySelector('.error-message');
            if (!errorMsg) {
                errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.textContent = `${field.getAttribute('name')} is required`;
                field.parentNode.appendChild(errorMsg);
            }
        } else {
            field.classList.remove('error');
            const errorMsg = field.parentNode.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        }
    });
    
    return valid;
}

// Facebook plugin
function setupFacebookPlugin() {
    // This loads the Facebook SDK and initializes the FB Page plugin
    // The configuration is handled in the HTML
}

// Service card hover effects
function setupServiceCardEffects() {
    const serviceCards = document.querySelectorAll('.service-card');
    
    serviceCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.classList.add('hover');
        });
        
        card.addEventListener('mouseleave', () => {
            card.classList.remove('hover');
        });
    });
}