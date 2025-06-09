// --- Firebase Setup ---
// Using standard script loading instead of dynamic imports for better reliability
document.addEventListener('DOMContentLoaded', function() {
  console.log('Admin page loaded - initializing Firebase...');
  
  // Firebase config
  const firebaseConfig = {
    apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
    authDomain: "cusumano-website.firebaseapp.com",
    projectId: "cusumano-website",
    storageBucket: "cusumano-website.appspot.com",
    messagingSenderId: "20051552210",
    appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
  };

  // Initialize Firebase
  // Check if Firebase is already loaded
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded! Make sure you have the proper script tags in your admin.html file.');
    alert('Firebase SDK not loaded. Please check console for details.');
    return;
  }

  try {
    // Initialize Firebase if not already initialized
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    }
    const db = firebase.firestore();
    
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
        console.log(`Attempting to load ${docId} data...`);
        showSpinner(`${docId}-spinner`, true);
        
        const docRef = db.collection('siteContent').doc(docId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
          console.log(`✓ Data found for ${docId}:`, docSnap.data());
          const data = docSnap.data();
          
          // Populate form fields with existing data
          Object.entries(fields).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
              if (el.type === 'checkbox') {
                el.checked = data[key] === true;
              } else {
                // Explicitly convert null/undefined to empty string
                el.value = data[key] !== null && data[key] !== undefined ? data[key] : '';
              }
              console.log(`Set ${id} to ${el.type === 'checkbox' ? el.checked : el.value}`);
            } else {
              console.warn(`Element ${id} not found in the DOM`);
            }
          });
          
          showToast(`${docId}-toast`, 'Data loaded successfully!', 'success');
        } else {
          console.log(`No data found for ${docId}, creating empty document`);
          // Create empty document to avoid errors
          const emptyData = {};
          Object.values(fields).forEach(key => {
            emptyData[key] = '';
          });
          await docRef.set(emptyData);
          showToast(`${docId}-toast`, 'Created new empty document', 'info');
        }
      } catch (e) { 
        console.error(`Error loading ${docId}:`, e); 
        showToast(`${docId}-toast`, 'Error loading data. Check console.', 'error');
      } finally {
        showSpinner(`${docId}-spinner`, false);
      }
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
        await db.collection('siteContent').doc(docId).set(data, { merge: true });
        showToast(toastId, 'Saved successfully!', 'success');
      } catch (e) {
        console.error(`Error saving ${docId}:`, e);
        showToast(toastId, 'Error saving. Try again.', 'error');
      }
      showSpinner(spinnerId, false);
    }
    
    console.log('Admin script initialized, loading all section data...');
    
    // Initialize all sections - wait for DOM to be fully ready
    setTimeout(() => {
      // --- Hero Section ---
      loadSection('hero', {
        'hero-heading': 'heading',
        'hero-subheading': 'subheading',
        'hero-button-text': 'buttonText'
      });
      
      // --- About Section ---
      loadSection('about', {
        'about-heading': 'heading',
        'about-p1': 'p1',
        'about-p2': 'p2',
        'about-features': 'features'
      });
      
      // --- Services Section ---
      async function loadServices() {
        try {
          console.log('Loading services data...');
          showSpinner('services-spinner', true);
          
          const docRef = db.collection('siteContent').doc('services');
          const docSnap = await docRef.get();
          const list = document.getElementById('services-list');
          
          if (list) {
            list.innerHTML = '';
            
            if (docSnap.exists && Array.isArray(docSnap.data().services)) {
              console.log('Services data found:', docSnap.data().services);
              docSnap.data().services.forEach((svc, idx) => {
                const div = document.createElement('div');
                div.className = 'service-item';
                div.innerHTML = `
                  <label>Icon: <input type="text" value="${svc.icon || ''}" data-idx="${idx}" data-field="icon"></label>
                  <label>Title: <input type="text" value="${svc.title || ''}" data-idx="${idx}" data-field="title"></label>
                  <label>Description: <textarea data-idx="${idx}" data-field="description">${svc.description || ''}</textarea></label>
                  <button type="button" class="remove-service" data-idx="${idx}">Remove</button>
                  <hr>`;
                list.appendChild(div);
              });
              
              // Add event listeners for remove buttons
              list.querySelectorAll('.remove-service').forEach(btn => {
                btn.addEventListener('click', function() {
                  this.closest('.service-item').remove();
                });
              });
              
              showToast('services-toast', 'Services loaded successfully!', 'success');
            } else {
              console.log('No services found or invalid format - creating empty array');
              // If no services exist yet, create an empty array
              await docRef.set({ services: [] }, { merge: true });
            }
          }
        } catch (e) {
          console.error('Error loading services:', e);
          showToast('services-toast', 'Error loading services. Check console.', 'error');
        } finally {
          showSpinner('services-spinner', false);
        }
      }
      
      loadServices();
      
      // Add service button
      const addServiceBtn = document.getElementById('add-service');
      if (addServiceBtn) {
        addServiceBtn.addEventListener('click', () => {
          const list = document.getElementById('services-list');
          if (list) {
            const idx = list.children.length;
            const div = document.createElement('div');
            div.className = 'service-item';
            div.innerHTML = `
              <label>Icon: <input type="text" value="" data-idx="${idx}" data-field="icon"></label>
              <label>Title: <input type="text" value="" data-idx="${idx}" data-field="title"></label>
              <label>Description: <textarea data-idx="${idx}" data-field="description"></textarea></label>
              <button type="button" class="remove-service" data-idx="${idx}">Remove</button>
              <hr>`;
            list.appendChild(div);
            
            // Add event listener for the new remove button
            div.querySelector('.remove-service').addEventListener('click', function() {
              this.closest('.service-item').remove();
            });
          }
        });
      }
      
      // Services save form
      const servicesForm = document.getElementById('services-form');
      if (servicesForm) {
        servicesForm.addEventListener('submit', async e => {
          e.preventDefault();
          showSpinner('services-spinner', true);
          
          try {
            const list = document.getElementById('services-list');
            const services = [];
            
            if (list) {
              const divs = list.querySelectorAll('.service-item');
              divs.forEach(div => {
                const icon = div.querySelector('input[data-field="icon"]')?.value || '';
                const title = div.querySelector('input[data-field="title"]')?.value || '';
                const description = div.querySelector('textarea[data-field="description"]')?.value || '';
                
                if (title || description) {
                  services.push({ icon, title, description });
                }
              });
              
              await db.collection('siteContent').doc('services').set({ services }, { merge: true });
              showToast('services-toast', 'Services saved successfully!', 'success');
            }
          } catch (e) {
            console.error('Error saving services:', e);
            showToast('services-toast', 'Error saving services. Try again.', 'error');
          } finally {
            showSpinner('services-spinner', false);
          }
        });
      }
      
      // --- Set up event listeners for all save buttons ---
      const heroForm = document.getElementById('hero-form');
      if (heroForm) {
        heroForm.addEventListener('submit', e => {
          e.preventDefault();
          saveSection('hero', {
            'hero-heading': 'heading',
            'hero-subheading': 'subheading',
            'hero-button-text': 'buttonText'
          }, 'hero-spinner', 'hero-toast');
        });
      }
      
      const aboutForm = document.getElementById('about-form');
      if (aboutForm) {
        aboutForm.addEventListener('submit', e => {
          e.preventDefault();
          saveSection('about', {
            'about-heading': 'heading',
            'about-p1': 'p1',
            'about-p2': 'p2',
            'about-features': 'features'
          }, 'about-spinner', 'about-toast');
        });
      }
      
      // --- Gallery Image Management ---
      async function loadGalleryImages() {
        try {
          console.log('Loading gallery images data...');
          showSpinner('gallery-spinner', true);
          
          const docRef = db.collection('siteContent').doc('gallery');
          const docSnap = await docRef.get();
          const imagesList = document.getElementById('gallery-images-list');
          
          if (imagesList) {
            imagesList.innerHTML = '';
            
            if (docSnap.exists && Array.isArray(docSnap.data().images)) {
              console.log('Gallery images data found:', docSnap.data().images);
              
              // Store images in localStorage for the frontend to use
              localStorage.setItem('filebaseGalleryImages', JSON.stringify(docSnap.data().images));
              
              docSnap.data().images.forEach((img, idx) => {
                const div = document.createElement('div');
                div.className = 'gallery-image-item';
                div.innerHTML = `
                  <div class="image-preview">
                    <img src="${img.url}" alt="${img.alt || 'Gallery image'}" 
                         onerror="this.src='https://placehold.co/300x200/0a4d68/white?text=${img.category || 'Image'}'">
                  </div>
                  <div class="image-details">
                    <label>Image URL: <input type="text" value="${img.url || ''}" data-idx="${idx}" data-field="url"></label>
                    <label>Alt Text: <input type="text" value="${img.alt || ''}" data-idx="${idx}" data-field="alt"></label>
                    <label>Category: 
                      <select data-idx="${idx}" data-field="category">
                        <option value="siding" ${img.category === 'siding' ? 'selected' : ''}>Siding</option>
                        <option value="windows" ${img.category === 'windows' ? 'selected' : ''}>Windows</option>
                        <option value="decks" ${img.category === 'decks' ? 'selected' : ''}>Decks</option>
                        <option value="dumpsters" ${img.category === 'dumpsters' ? 'selected' : ''}>Dumpsters</option>
                        <option value="other" ${img.category === 'other' ? 'selected' : ''}>Other</option>
                      </select>
                    </label>
                  </div>
                  <button type="button" class="remove-image" data-idx="${idx}">Remove</button>
                  <hr>`;
                imagesList.appendChild(div);
              });
              
              // Add event listeners for remove buttons
              imagesList.querySelectorAll('.remove-image').forEach(btn => {
                btn.addEventListener('click', function() {
                  this.closest('.gallery-image-item').remove();
                });
              });
              
              showToast('gallery-toast', 'Gallery images loaded successfully!', 'success');
            } else {
              console.log('No gallery images found or invalid format - creating empty array');
              // If no images exist yet, create an empty array
              await docRef.set({ images: [] }, { merge: true });
            }
          }
        } catch (e) {
          console.error('Error loading gallery images:', e);
          showToast('gallery-toast', 'Error loading gallery images. Check console.', 'error');
        } finally {
          showSpinner('gallery-spinner', false);
        }
      }
      
      loadGalleryImages();
      
      // File upload functionality for gallery images
      const fileUploadInput = document.getElementById('gallery-image-upload');
      const storageRef = firebase.storage().ref();
      
      if (fileUploadInput) {
        fileUploadInput.addEventListener('change', async (e) => {
          const files = e.target.files;
          if (!files.length) return;
          
          showSpinner('gallery-spinner', true);
          showToast('gallery-toast', 'Uploading image...', 'info');
          
          try {
            const file = files[0];
            const fileExtension = file.name.split('.').pop();
            const fileName = `gallery_${Date.now()}.${fileExtension}`;
            const fileRef = storageRef.child(`gallery/${fileName}`);
            
            // Upload the file to Firebase Storage
            const uploadTask = fileRef.put(file);
            
            // Monitor upload progress
            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
              }, 
              (error) => {
                console.error('Error during upload:', error);
                showToast('gallery-toast', 'Error uploading image. Please try again.', 'error');
              }, 
              async () => {
                // Get the download URL and add to the gallery list
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                
                const imagesList = document.getElementById('gallery-images-list');
                if (imagesList) {
                  const idx = imagesList.children.length;
                  const div = document.createElement('div');
                  div.className = 'gallery-image-item';
                  
                  // Get image category from the file name if possible
                  let category = 'other';
                  if (file.name.toLowerCase().includes('siding')) category = 'siding';
                  else if (file.name.toLowerCase().includes('window')) category = 'windows';
                  else if (file.name.toLowerCase().includes('deck')) category = 'decks';
                  else if (file.name.toLowerCase().includes('dumpster')) category = 'dumpsters';
                  
                  div.innerHTML = `
                    <div class="image-preview">
                      <img src="${downloadURL}" alt="Gallery image">
                    </div>
                    <div class="image-details">
                      <label>Image URL: <input type="text" value="${downloadURL}" data-idx="${idx}" data-field="url"></label>
                      <label>Alt Text: <input type="text" value="${file.name.split('.')[0]}" data-idx="${idx}" data-field="alt"></label>
                      <label>Category: 
                        <select data-idx="${idx}" data-field="category">
                          <option value="siding" ${category === 'siding' ? 'selected' : ''}>Siding</option>
                          <option value="windows" ${category === 'windows' ? 'selected' : ''}>Windows</option>
                          <option value="decks" ${category === 'decks' ? 'selected' : ''}>Decks</option>
                          <option value="dumpsters" ${category === 'dumpsters' ? 'selected' : ''}>Dumpsters</option>
                          <option value="other" ${category === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                      </label>
                    </div>
                    <button type="button" class="remove-image" data-idx="${idx}">Remove</button>
                    <hr>`;
                  imagesList.appendChild(div);
                  
                  // Add event listener for the new remove button
                  div.querySelector('.remove-image').addEventListener('click', function() {
                    this.closest('.gallery-image-item').remove();
                  });
                }
                
                showToast('gallery-toast', 'Image uploaded successfully!', 'success');
              }
            );
          } catch (e) {
            console.error('Error uploading image:', e);
            showToast('gallery-toast', 'Error uploading image. Check console.', 'error');
          } finally {
            showSpinner('gallery-spinner', false);
            // Clear the file input for future uploads
            fileUploadInput.value = '';
          }
        });
      }
      
      // Add gallery image button (for direct URL entry)
      const addGalleryImageBtn = document.getElementById('add-gallery-image');
      if (addGalleryImageBtn) {
        addGalleryImageBtn.addEventListener('click', () => {
          const imagesList = document.getElementById('gallery-images-list');
          if (imagesList) {
            const idx = imagesList.children.length;
            const div = document.createElement('div');
            div.className = 'gallery-image-item';
            div.innerHTML = `
              <div class="image-preview">
                <img src="https://placehold.co/300x200/0a4d68/white?text=New+Image" alt="New gallery image">
              </div>
              <div class="image-details">
                <label>Image URL: <input type="text" value="" data-idx="${idx}" data-field="url"></label>
                <label>Alt Text: <input type="text" value="" data-idx="${idx}" data-field="alt"></label>
                <label>Category: 
                  <select data-idx="${idx}" data-field="category">
                    <option value="siding">Siding</option>
                    <option value="windows">Windows</option>
                    <option value="decks">Decks</option>
                    <option value="dumpsters">Dumpsters</option>
                    <option value="other" selected>Other</option>
                  </select>
                </label>
              </div>
              <button type="button" class="remove-image" data-idx="${idx}">Remove</button>
              <hr>`;
            imagesList.appendChild(div);
            
            // Add event listener for the new remove button
            div.querySelector('.remove-image').addEventListener('click', function() {
              this.closest('.gallery-image-item').remove();
            });

            // Add change listener to update preview image
            const urlInput = div.querySelector('input[data-field="url"]');
            const previewImg = div.querySelector('.image-preview img');
            
            urlInput.addEventListener('change', function() {
              previewImg.src = this.value || 'https://placehold.co/300x200/0a4d68/white?text=New+Image';
            });
          }
        });
      }
      
      // Gallery save form
      const galleryForm = document.getElementById('gallery-form');
      if (galleryForm) {
        galleryForm.addEventListener('submit', async e => {
          e.preventDefault();
          showSpinner('gallery-spinner', true);
          
          try {
            const imagesList = document.getElementById('gallery-images-list');
            const images = [];
            
            if (imagesList) {
              const divs = imagesList.querySelectorAll('.gallery-image-item');
              divs.forEach(div => {
                const url = div.querySelector('input[data-field="url"]')?.value || '';
                const alt = div.querySelector('input[data-field="alt"]')?.value || '';
                const category = div.querySelector('select[data-field="category"]')?.value || 'other';
                
                if (url) {
                  images.push({ url, alt, category });
                }
              });
              
              await db.collection('siteContent').doc('gallery').set({ images }, { merge: true });
              
              // Store images in localStorage for the frontend to use
              localStorage.setItem('filebaseGalleryImages', JSON.stringify(images));
              
              showToast('gallery-toast', 'Gallery images saved successfully!', 'success');
            }
          } catch (e) {
            console.error('Error saving gallery images:', e);
            showToast('gallery-toast', 'Error saving gallery images. Try again.', 'error');
          } finally {
            showSpinner('gallery-spinner', false);
          }
        });
      }
      
      // Show notification that everything is ready
      console.log('All admin components initialized successfully!');
    }, 500); // Half-second delay to ensure DOM is fully loaded
    
  } catch (error) {
    console.error('Failed to initialize admin panel:', error);
    alert('Failed to initialize admin panel. Check console for details.');
  }
});