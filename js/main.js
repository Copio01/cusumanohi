/**
 * Main JavaScript for Cusumano Home Improvements
 */

document.addEventListener('DOMContentLoaded', () => {
    // Set up core functionality
    setupModalFunctionality();
    setupScrollBehavior();
    setupAdminButton();
    setupContactForm();
    setupFacebookSDK(); // Add Facebook SDK setup
});

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
            if (href.startsWith('#') && document.querySelector(href)) {
                e.preventDefault();
                const targetSection = document.querySelector(href);
                window.scrollTo({
                    top: targetSection.offsetTop - 80, // Adjust for header height
                    behavior: 'smooth'
                });
            }
        });
    });
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

// Fix Facebook SDK integration
function setupFacebookSDK() {
    // Only load Facebook SDK if the page has Facebook elements
    if (document.querySelector('.fb-page') || document.querySelector('.fb-like') || document.querySelector('.fb-share-button')) {
        // Create a more robust Facebook SDK loader with error handling
        window.fbAsyncInit = function() {
            try {
                FB.init({
                    appId: '', // Leave empty if you don't have an app ID
                    autoLogAppEvents: true,
                    xfbml: true,
                    version: 'v17.0'
                });
                
                // Only parse XFBML if Facebook elements exist
                setTimeout(function() {
                    if (FB && FB.XFBML) {
                        FB.XFBML.parse();
                    }
                }, 1000);
            } catch (error) {
                console.log('Facebook SDK initialization error:', error);
            }
        };
        
        // Load the SDK asynchronously with error handling
        (function(d, s, id) {
            try {
                if (d.getElementById(id)) return;
                var js = d.createElement(s);
                js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                js.onerror = function() {
                    console.log('Error loading Facebook SDK');
                    // Remove any dependency on Facebook elements
                    const fbElements = document.querySelectorAll('.fb-page, .fb-like, .fb-share-button');
                    fbElements.forEach(el => {
                        el.style.display = 'none';
                    });
                };
                var fjs = d.getElementsByTagName(s)[0];
                fjs.parentNode.insertBefore(js, fjs);
            } catch (error) {
                console.log('Error setting up Facebook SDK:', error);
            }
        }(document, 'script', 'facebook-jssdk'));
    } else {
        // No Facebook elements found, no need to load the SDK
        console.log('No Facebook elements found, Facebook SDK not loaded');
    }
}

// --- Facebook SDK Error Handler ---
window.addEventListener('load', function() {
  // Check if FB SDK is available after page load
  setTimeout(() => {
    if (typeof FB === 'undefined') {
      console.log('Facebook SDK failed to load. Hiding FB elements.');
      const fbContainer = document.querySelector('.facebook-feed');
      if (fbContainer) {
        fbContainer.innerHTML = '<div class="fb-fallback"><p>Facebook content is currently unavailable. Please check our <a href="https://www.facebook.com/cusumanocement/" target="_blank" rel="noopener noreferrer">Facebook page</a> directly.</p></div>';
      }
    } else {
      // Try to parse XFBML again if SDK is available but elements aren't rendered
      try {
        FB.XFBML.parse();
        console.log('FB XFBML parsed successfully');
      } catch (err) {
        console.log('Error parsing FB XFBML:', err);
      }
    }
  }, 3000); // Give the SDK some time to load
});

// --- Firebase Dynamic Content Loader ---
import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js').then(firebaseApp => {
  import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js').then(async firebaseFirestore => {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
        authDomain: "cusumano-website.firebaseapp.com",
        projectId: "cusumano-website",
        storageBucket: "cusumano-website.appspot.com",
        messagingSenderId: "20051552210",
        appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
      };
      
      // Initialize Firebase
      const app = firebaseApp.initializeApp(firebaseConfig);
      const db = firebaseFirestore.getFirestore(app);
      
      // Import auth module for public read access with better error handling
      try {
        const authModule = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
        const auth = authModule.getAuth(app);
        
        // Check if already logged in anonymously
        if (!auth.currentUser) {
          await authModule.signInAnonymously(auth);
          console.log("Anonymous auth successful");
        }
      } catch (authError) {
        console.log("Anonymous auth failed:", authError);
        // Continue without authentication - will use static fallback content
      }
      
      // Retry logic and fallback system for Firebase calls
      async function getSection(id, maxRetries = 2) {
        let retries = 0;
        
        while (retries <= maxRetries) {
          try {
            const docRef = firebaseFirestore.doc(db, 'siteContent', id);
            const docSnap = await firebaseFirestore.getDoc(docRef);
            
            if (docSnap.exists()) {
              console.log(`Successfully loaded section: ${id}`);
              return docSnap.data();
            } else {
              console.log(`No document found for section ${id}`);
              // Try public collection instead
              return await getFallbackContent(id);
            }
          } catch (error) {
            console.log(`Error fetching section ${id} (attempt ${retries + 1}):`, error);
            
            if (error.code === 'permission-denied') {
              console.log(`Permission denied for section ${id}. Using public collection.`);
              return await getFallbackContent(id);
            }
            
            retries++;
            // Wait before retrying
            if (retries <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        console.log(`Failed to fetch section ${id} after ${maxRetries} retries. Using static content.`);
        return null;
      }
      
      // Helper function for fallback content
      async function getFallbackContent(id) {
        try {
          const fallbackRef = firebaseFirestore.doc(db, 'publicContent', id);
          const fallbackSnap = await firebaseFirestore.getDoc(fallbackRef);
          
          if (fallbackSnap.exists()) {
            console.log(`Retrieved fallback content for ${id}`);
            return fallbackSnap.data();
          }
        } catch (fallbackError) {
          console.log(`Fallback attempt failed for ${id}:`, fallbackError);
        }
        
        return null;
      }

      // Process each section independently with better error handling
      const sections = [
        {id: 'hero', selector: '.hero-section'},
        {id: 'services', selector: '.services-section'},
        {id: 'about', selector: '.about-section'},
        {id: 'testimonials', selector: '.testimonials-section'},
        {id: 'gallery', selector: '.gallery-section'}
      ];
      
      // Process sections in parallel for better performance
      Promise.allSettled(sections.map(async section => {
        try {
          const content = await getSection(section.id);
          if (!content) {
            console.log(`No content available for ${section.id}, keeping static content.`);
            return;
          }
          
          const sectionElement = document.querySelector(section.selector);
          if (!sectionElement) {
            console.log(`Section element not found for ${section.id}`);
            return;
          }
          
          // Apply content based on section type
          updateSectionContent(sectionElement, content, section.id);
        } catch (error) {
          console.error(`Error processing section ${section.id}:`, error);
        }
      })).then(() => {
        // Initialize sliders after all content is loaded
        if (typeof initializeSliders === 'function') {
          initializeSliders();
        }
      });
      
      // Update section content
      function updateSectionContent(element, content, sectionId) {
        // Common updates
        if (content.title) {
          const titleEl = element.querySelector('h2, h3, .section-title');
          if (titleEl) titleEl.textContent = content.title;
        }
        
        if (content.subtitle) {
          const subtitleEl = element.querySelector('.section-subtitle, p:first-of-type');
          if (subtitleEl) subtitleEl.textContent = content.subtitle;
        }
        
        // Section-specific updates
        switch(sectionId) {
          case 'hero':
            updateHeroSection(element, content);
            break;
          case 'services':
            updateServicesSection(element, content);
            break;
          case 'gallery':
            updateGallerySection(element, content);
            break;
          case 'testimonials':
            updateTestimonialsSection(element, content);
            break;
        }
        
        // Show the element if it was hidden
        element.classList.remove('loading');
      }
      
      function updateHeroSection(element, content) {
        if (content.backgroundImage) {
          element.style.backgroundImage = `url(${content.backgroundImage})`;
        }
        
        if (content.ctaText) {
          const ctaBtn = element.querySelector('.cta-button');
          if (ctaBtn) ctaBtn.textContent = content.ctaText;
        }
        
        if (content.ctaLink) {
          const ctaBtn = element.querySelector('.cta-button');
          if (ctaBtn) ctaBtn.setAttribute('href', content.ctaLink);
        }
      }
      
      function updateServicesSection(element, content) {
        if (content.services && Array.isArray(content.services)) {
          const servicesList = element.querySelector('.services-list');
          if (servicesList) {
            // Keep the original service items as templates
            const templateItem = servicesList.querySelector('.service-item').cloneNode(true);
            
            // Clear the list
            servicesList.innerHTML = '';
            
            // Add each service
            content.services.forEach(service => {
              const newItem = templateItem.cloneNode(true);
              
              // Update service item content
              const titleEl = newItem.querySelector('.service-title');
              if (titleEl) titleEl.textContent = service.title || '';
              
              const descEl = newItem.querySelector('.service-description');
              if (descEl) descEl.textContent = service.description || '';
              
              const iconEl = newItem.querySelector('.service-icon');
              if (iconEl && service.icon) iconEl.className = `service-icon ${service.icon}`;
              
              servicesList.appendChild(newItem);
            });
          }
        }
      }
      
      function updateGallerySection(element, content) {
        if (content.images && Array.isArray(content.images)) {
          const slider = element.querySelector('.image-slider');
          if (slider) {
            const slideContainer = slider.querySelector('.slides-container') || slider;
            
            // Keep one slide as a template
            const templateSlide = slideContainer.querySelector('.slide').cloneNode(true);
            
            // Clear the container
            slideContainer.innerHTML = '';
            
            // Add each image as a slide
            content.images.forEach((image, index) => {
              const newSlide = templateSlide.cloneNode(true);
              
              const imgEl = newSlide.querySelector('img');
              if (imgEl) {
                imgEl.setAttribute('data-src', image.url);
                imgEl.setAttribute('alt', image.alt || `Gallery image ${index + 1}`);
                
                // Preload the first image
                if (index === 0) {
                  imgEl.src = image.url;
                  imgEl.removeAttribute('data-src');
                }
              }
              
              slideContainer.appendChild(newSlide);
            });
            
            // Re-initialize the slider
            if (typeof initializeSliders === 'function') {
              initializeSliders();
            }
          }
        }
      }
      
      function updateTestimonialsSection(element, content) {
        if (content.testimonials && Array.isArray(content.testimonials)) {
          const testimonialsList = element.querySelector('.testimonials-list');
          if (testimonialsList) {
            // Keep a template
            const templateItem = testimonialsList.querySelector('.testimonial-item').cloneNode(true);
            
            // Clear the list
            testimonialsList.innerHTML = '';
            
            // Add each testimonial
            content.testimonials.forEach(testimonial => {
              const newItem = templateItem.cloneNode(true);
              
              const quoteEl = newItem.querySelector('.testimonial-quote');
              if (quoteEl) quoteEl.textContent = testimonial.quote || '';
              
              const authorEl = newItem.querySelector('.testimonial-author');
              if (authorEl) authorEl.textContent = testimonial.author || '';
              
              testimonialsList.appendChild(newItem);
            });
          }
        }
      }
      
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }
  }).catch(error => {
    console.error("Error loading Firestore module:", error);
  });
}).catch(error => {
  console.error("Error loading Firebase App module:", error);
});

// Fallback function to ensure site works even if Firebase fails
function loadStaticFallbackContent() {
  console.log('Loading static fallback content...');
  // The site will continue to work with static HTML content
}