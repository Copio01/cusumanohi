// --- Firebase Setup ---
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

// --- Sidebar Navigation ---
const navLinks = document.querySelectorAll('.admin-nav-link');
const sections = document.querySelectorAll('.admin-section');
navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const target = link.getAttribute('href').replace('#', '');
    sections.forEach(section => {
      section.classList.toggle('active', section.id === target);
    });
  });
});

// --- Helper: Show Spinner/Toast ---
function showSpinner(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'inline-block' : 'none';
}
function showToast(id, msg, type) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.className = 'section-toast ' + (type || '');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

// --- Load and Save Logic for Each Section ---
async function loadSection(docId, fields) {
  try {
    const docRef = firebaseFirestore.doc(db, 'siteContent', docId);
    const docSnap = await firebaseFirestore.getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      Object.entries(fields).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el && data[key] !== undefined) {
          if (el.type === 'checkbox') el.checked = !!data[key];
          else el.value = data[key];
        }
      });
    }
  } catch (e) { /* ignore */ }
}
async function saveSection(docId, fields, spinnerId, toastId) {
  showSpinner(spinnerId, true);
  try {
    const data = {};
    Object.entries(fields).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') data[key] = el.checked;
        else data[key] = el.value;
      }
    });
    await firebaseFirestore.setDoc(firebaseFirestore.doc(db, 'siteContent', docId), data, { merge: true });
    showToast(toastId, 'Saved!', 'success');
  } catch (e) {
    showToast(toastId, 'Error saving. Try again.', 'error');
  }
  showSpinner(spinnerId, false);
}

// --- Hero Section ---
loadSection('hero', {
  'hero-heading': 'heading',
  'hero-subheading': 'subheading',
  'hero-button-text': 'buttonText'
});
const heroForm = document.getElementById('hero-form');
if (heroForm) heroForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('hero', {
    'hero-heading': 'heading',
    'hero-subheading': 'subheading',
    'hero-button-text': 'buttonText'
  }, 'hero-spinner', 'hero-toast');
});

// --- About Section ---
loadSection('about', {
  'about-heading': 'heading',
  'about-p1': 'p1',
  'about-p2': 'p2',
  'about-features': 'features'
});
const aboutForm = document.getElementById('about-form');
if (aboutForm) aboutForm.addEventListener('submit', e => {
  e.preventDefault();
  // Features as array
  const features = document.getElementById('about-features').value.split(',').map(f => f.trim()).filter(Boolean);
  saveSection('about', {
    'about-heading': 'heading',
    'about-p1': 'p1',
    'about-p2': 'p2',
    'about-features': 'features'
  }, 'about-spinner', 'about-toast');
});

// --- Services Section ---
async function loadServices() {
  try {
    const docRef = firebaseFirestore.doc(db, 'siteContent', 'services');
    const docSnap = await firebaseFirestore.getDoc(docRef);
    const list = document.getElementById('services-list');
    if (list) {
      list.innerHTML = '';
      if (docSnap.exists() && Array.isArray(docSnap.data().services)) {
        docSnap.data().services.forEach((svc, idx) => {
          const div = document.createElement('div');
          div.innerHTML = `
            <label>Icon <input type="text" value="${svc.icon || ''}" data-idx="${idx}" data-field="icon"></label>
            <label>Title <input type="text" value="${svc.title || ''}" data-idx="${idx}" data-field="title"></label>
            <label>Description <input type="text" value="${svc.description || ''}" data-idx="${idx}" data-field="description"></label>
            <button type="button" class="remove-service" data-idx="${idx}">Remove</button>
            <hr>`;
          list.appendChild(div);
        });
      }
    }
  } catch (e) {}
}
loadServices();
const addServiceBtn = document.getElementById('add-service');
if (addServiceBtn) addServiceBtn.addEventListener('click', () => {
  const list = document.getElementById('services-list');
  if (list) {
    const idx = list.children.length;
    const div = document.createElement('div');
    div.innerHTML = `
      <label>Icon <input type="text" value="" data-idx="${idx}" data-field="icon"></label>
      <label>Title <input type="text" value="" data-idx="${idx}" data-field="title"></label>
      <label>Description <input type="text" value="" data-idx="${idx}" data-field="description"></label>
      <button type="button" class="remove-service" data-idx="${idx}">Remove</button>
      <hr>`;
    list.appendChild(div);
  }
});
const servicesForm = document.getElementById('services-form');
if (servicesForm) servicesForm.addEventListener('submit', async e => {
  e.preventDefault();
  showSpinner('services-spinner', true);
  const list = document.getElementById('services-list');
  const services = [];
  if (list) {
    const divs = list.querySelectorAll('div');
    divs.forEach(div => {
      const icon = div.querySelector('input[data-field="icon"]')?.value || '';
      const title = div.querySelector('input[data-field="title"]')?.value || '';
      const description = div.querySelector('input[data-field="description"]')?.value || '';
      if (title) services.push({ icon, title, description });
    });
  }
  try {
    await firebaseFirestore.setDoc(firebaseFirestore.doc(db, 'siteContent', 'services'), { services }, { merge: true });
    showToast('services-toast', 'Saved!', 'success');
    loadServices();
  } catch (e) {
    showToast('services-toast', 'Error saving. Try again.', 'error');
  }
  showSpinner('services-spinner', false);
});
document.addEventListener('click', e => {
  if (e.target && e.target.classList.contains('remove-service')) {
    e.target.parentElement.remove();
  }
});

// --- Map Section ---
loadSection('map', {
  'map-heading': 'heading',
  'map-desc': 'desc',
  'map-link': 'link',
  'map-lat': 'lat',
  'map-lng': 'lng'
});
const mapForm = document.getElementById('map-form');
if (mapForm) mapForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('map', {
    'map-heading': 'heading',
    'map-desc': 'desc',
    'map-link': 'link',
    'map-lat': 'lat',
    'map-lng': 'lng'
  }, 'map-spinner', 'map-toast');
});

// --- Facebook Section ---
loadSection('facebook', {
  'fb-url': 'url',
  'fb-tabs': 'tabs',
  'fb-width': 'width',
  'fb-height': 'height',
  'fb-cover': 'cover',
  'fb-facepile': 'facepile'
});
const facebookForm = document.getElementById('facebook-form');
if (facebookForm) facebookForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('facebook', {
    'fb-url': 'url',
    'fb-tabs': 'tabs',
    'fb-width': 'width',
    'fb-height': 'height',
    'fb-cover': 'cover',
    'fb-facepile': 'facepile'
  }, 'facebook-spinner', 'facebook-toast');
});

// --- Contact Section ---
loadSection('contact', {
  'contact-intro': 'intro',
  'contact-phone': 'phone',
  'contact-email': 'email',
  'contact-hours': 'hours',
  'contact-cta': 'cta'
});
const contactFormAdmin = document.getElementById('contact-form-admin');
if (contactFormAdmin) contactFormAdmin.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('contact', {
    'contact-intro': 'intro',
    'contact-phone': 'phone',
    'contact-email': 'email',
    'contact-hours': 'hours',
    'contact-cta': 'cta'
  }, 'contact-spinner', 'contact-toast');
});

// --- Footer Section ---
loadSection('footer', {
  'footer-info': 'info',
  'footer-copyright': 'copyright'
});
const footerForm = document.getElementById('footer-form');
if (footerForm) footerForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('footer', {
    'footer-info': 'info',
    'footer-copyright': 'copyright'
  }, 'footer-spinner', 'footer-toast');
});

// --- Social Section ---
loadSection('social', {
  'social-facebook': 'facebook',
  'social-instagram': 'instagram',
  'social-twitter': 'twitter'
});
const socialForm = document.getElementById('social-form');
if (socialForm) socialForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('social', {
    'social-facebook': 'facebook',
    'social-instagram': 'instagram',
    'social-twitter': 'twitter'
  }, 'social-spinner', 'social-toast');
});

// --- Announcement Section ---
loadSection('announcement', {
  'announcement-text': 'text',
  'announcement-active': 'active'
});
const announcementForm = document.getElementById('announcement-form');
if (announcementForm) announcementForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSection('announcement', {
    'announcement-text': 'text',
    'announcement-active': 'active'
  }, 'announcement-spinner', 'announcement-toast');
});

// --- Logout ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => {
  // Implement logout logic if using Firebase Auth
  window.location.href = 'index.html';
});

// --- Gallery Section ---
// You can integrate your existing gallery/image management logic here
// ...existing code...
});
});