/**
 * Main JavaScript for Cusumano Home Improvements
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase for contact form
    try {
        // Load Firebase modules dynamically
        import('https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js')
            .then(firebaseApp => {
                import('https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js')
                    .then(firebaseFirestore => {
                        // Firebase configuration
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
                        
                        // Now we can use Firebase in our main code
                        setupContactForm(db, firebaseFirestore);
                    })
                    .catch(error => console.error("Error loading Firebase Firestore:", error));
            })
            .catch(error => console.error("Error loading Firebase App:", error));
    } catch (error) {
        console.error("Error setting up Firebase:", error);
        // Continue with non-Firebase functionality
    }
    
    // Set up non-Firebase functionality
    setupModalFunctionality();
    setupScrollBehavior();
    setupAdminButton();
});

// Contact form with Firebase
function setupContactForm(db, firebaseFirestore) {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const message = document.getElementById('message').value;
            
            try {
                // Add to Firebase
                await firebaseFirestore.addDoc(firebaseFirestore.collection(db, 'inquiries'), {
                    name,
                    email,
                    phone,
                    message,
                    date: new Date(),
                    status: 'New'
                });
                
                // Show success message
                alert('Thank you for your message! We will contact you shortly.');
                
                // Reset form
                contactForm.reset();
                
                // Close modal
                const modal = document.getElementById('contact-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
            } catch (error) {
                console.error("Error submitting form:", error);
                alert('There was a problem submitting your message. Please try again later.');
            }
        });
    } else {
        // Fallback for when the form isn't found or Firebase isn't available
        setupNonFirebaseContactForm();
    }
}

// Non-Firebase contact form fallback
function setupNonFirebaseContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const message = document.getElementById('message').value;
            
            // Log form submission (in a real app, this would send to a server)
            console.log('Form submitted:', { name, email, phone, message });
            
            // Show submission success message
            alert('Thank you for your message! We will contact you shortly.');
            
            // Reset form
            contactForm.reset();
            
            // Close modal
            const modal = document.getElementById('contact-modal');
            if (modal) {
                modal.classList.remove('active');
                document.body.classList.remove('modal-open');
            }
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