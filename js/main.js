/**
 * Main JavaScript for Cusumano Home Improvements
 */

document.addEventListener('DOMContentLoaded', () => {
    // Set up core functionality
    setupModalFunctionality();
    setupScrollBehavior();
    setupAdminButton();
    setupContactForm();
});

// Contact form with client-side email
function setupContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        // The form is already set up with mailto: action, but we can enhance the user experience
        contactForm.addEventListener('submit', (e) => {
            // Allow the default form submission which will open the user's email client
            
            // Set the subject line
            const subject = "Cusumano Home Improvements - Website Inquiry";
            contactForm.action = `mailto:copernan@yahoo.com?subject=${encodeURIComponent(subject)}`;
            
            // Show a confirmation message after a small delay to ensure the email client opens
            setTimeout(() => {
                // Close modal
                const modal = document.getElementById('contact-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
            }, 500);
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

// --- Firebase Dynamic Content Loader ---
import('https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js').then(firebaseApp => {
  import('https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js').then(firebaseFirestore => {
    const firebaseConfig = {
      apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
      authDomain: "cusumano-website.firebaseapp.com",
      projectId: "cusumano-website",
      storageBucket: "cusumano-website.appspot.com",
      messagingSenderId: "20051552210",
      appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
    };
    const app = firebaseApp.initializeApp(firebaseConfig);
    const db = firebaseFirestore.getFirestore(app);
    // Fetch all site content
    firebaseFirestore.getDocs(firebaseFirestore.collection(db, 'siteContent')).then(async (snap) => {
      // Helper to get a doc by id
      async function getSection(id) {
        const docRef = firebaseFirestore.doc(db, 'siteContent', id);
        const docSnap = await firebaseFirestore.getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
      }
      // HERO
      getSection('hero').then(hero => {
        if (hero) {
          const h = document.querySelector('.hero-overlay h1');
          const p = document.querySelector('.hero-overlay p');
          const btn = document.querySelector('.hero-overlay .btn-primary');
          if (h) h.textContent = hero.heading;
          if (p) p.textContent = hero.subheading;
          if (btn) btn.textContent = hero.buttonText;
        }
      });
      // ABOUT
      getSection('about').then(about => {
        if (about) {
          const heading = document.querySelector('#about .section-title');
          const aboutText = document.querySelector('#about .about-text');
          if (heading) heading.textContent = about.heading;
          if (aboutText) {
            aboutText.innerHTML =
              `<p>${about.p1 || ''}</p>` +
              `<p>${about.p2 || ''}</p>` +
              (about.features ? `<div class="about-features">${about.features.map(f => `<div class="feature"><div class="feature-icon">✓</div><div class="feature-text">${f.trim()}</div></div>`).join('')}</div>` : '');
          }
        }
      });
      // SERVICES
      getSection('services').then(services => {
        if (services && services.services) {
          const grid = document.querySelector('.services-grid');
          if (grid) {
            grid.innerHTML = services.services.map(s =>
              `<div class="service-card">
                <div class="service-icon">🏗️</div>
                <h3>${s.title}</h3>
                <p>${s.description}</p>
              </div>`).join('');
          }
        }
      });
      // MAP
      getSection('map').then(map => {
        if (map) {
          const heading = document.querySelector('#map .section-title');
          const info = document.querySelector('#map .map-info');
          if (heading) heading.textContent = map.heading;
          if (info) {
            info.innerHTML = `<h3>${map.heading}</h3><p>${map.desc}</p><div class="map-actions"><a href="${map.link}" class="btn-secondary" target="_blank" rel="noopener noreferrer">Get Directions</a></div>`;
          }
          // Optionally update the map marker if you use a JS map
        }
      });
      // FACEBOOK
      getSection('facebook').then(fb => {
        if (fb) {
          const fbPage = document.querySelector('.fb-page');
          if (fbPage) {
            fbPage.setAttribute('data-href', fb.url);
            fbPage.setAttribute('data-tabs', fb.tabs.join(','));
            fbPage.setAttribute('data-width', fb.width);
            fbPage.setAttribute('data-height', fb.height);
            fbPage.setAttribute('data-hide-cover', !fb.cover);
            fbPage.setAttribute('data-show-facepile', fb.facepile);
            if (window.FB && window.FB.XFBML) window.FB.XFBML.parse();
          }
        }
      });
      // CONTACT
      getSection('contact').then(contact => {
        if (contact) {
          const intro = document.querySelector('.contact-intro');
          const phone = document.querySelector('.contact-method a[href^="tel"]');
          const email = document.querySelector('.contact-method a[href^="mailto"]');
          const hours = document.querySelectorAll('.contact-method')[2];
          const cta = document.querySelector('.contact-cta h3');
          if (intro) intro.textContent = contact.intro;
          if (phone) phone.textContent = contact.phone;
          if (email) email.textContent = contact.email;
          if (hours) hours.innerHTML = `<div class="contact-icon">🕒</div><h3>Business Hours</h3><p>${contact.hours}</p>`;
          if (cta) cta.textContent = contact.cta;
        }
      });
      // FOOTER
      getSection('footer').then(footer => {
        if (footer) {
          const info = document.querySelector('.footer-info');
          const copyright = document.querySelector('.footer-copyright p');
          if (info) info.innerHTML = `<h3>Cusumano Home Improvements</h3><p>${footer.info}</p>`;
          if (copyright) copyright.textContent = footer.copyright;
        }
      });
      // SOCIAL
      getSection('social').then(social => {
        if (social) {
          const fb = document.querySelector('.footer-social a[aria-label="Facebook"]');
          const ig = document.querySelector('.footer-social a[aria-label="Instagram"]');
          const tw = document.querySelector('.footer-social a[aria-label="Twitter"]');
          if (fb && social.facebook) fb.href = social.facebook;
          if (ig && social.instagram) ig.href = social.instagram;
          if (tw && social.twitter) tw.href = social.twitter;
        }
      });
      // ANNOUNCEMENT
      getSection('announcement').then(ann => {
        if (ann && ann.active) {
          let banner = document.getElementById('site-announcement');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'site-announcement';
            banner.style = 'background:var(--accent-color);color:white;text-align:center;padding:1rem;font-weight:600;';
            document.body.insertBefore(banner, document.body.firstChild);
          }
          banner.textContent = ann.text;
        }
      });
    });
  });
});