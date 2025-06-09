/**
 * Image Slider for Cusumano Home Improvements
 */

document.addEventListener('DOMContentLoaded', () => {
    // Sample images for the slider as fallback if Firebase fails
    const slidesData = [
        { src: 'images/siding-project1.jpg', alt: 'Siding Project' },
        { src: 'images/window-project1.jpg', alt: 'Window Project' },
        { src: 'images/deck-project1.jpg', alt: 'Deck Project' },
        { src: 'images/dumpster-rental.jpg', alt: 'Dumpster Rental' }
    ];
    
    // Slider elements
    const slider = document.querySelector('.slider');
    const prevBtn = document.querySelector('.slider-arrow.left');
    const nextBtn = document.querySelector('.slider-arrow.right');
    const dotsContainer = document.querySelector('.slider-dots');
    const progressBar = document.querySelector('.slider-progress');
    
    // If elements don't exist, exit early
    if (!slider || !prevBtn || !nextBtn || !dotsContainer || !progressBar) {
        console.error('Slider elements not found');
        return;
    }
    
    let currentSlide = 0;
    const slideInterval = 5000; // 5 seconds per slide
    let autoSlideTimer;
    
    // Initialize slider with images (fallback option)
    function initSlider() {
        // If slider is empty, create slides
        if (slider.children.length === 0) {
            // Sample images for the slider - use placeholder colors if images don't exist
            const placeholderColors = ['#0a4d68', '#088395', '#f5a623', '#2a9d8f'];
            
            slidesData.forEach((slide, index) => {
                const slideElement = document.createElement('div');
                slideElement.className = 'slide';
                
                // Try to load the image, fall back to placeholder
                const img = new Image();
                img.onerror = () => {
                    // Image failed to load, use placeholder
                    slideElement.innerHTML = `
                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: ${placeholderColors[index % placeholderColors.length]}; color: white; font-size: 1.5rem; text-align: center; padding: 1rem;">
                            <div>
                                <h3>Project ${index + 1}</h3>
                            </div>
                        </div>
                    `;
                };
                
                img.onload = () => {
                    // Image loaded successfully, use it without caption
                    slideElement.innerHTML = `
                        <img src="${slide.src}" alt="${slide.alt}">
                    `;
                };
                
                // Start loading the image
                img.src = slide.src;
                
                slider.appendChild(slideElement);
                
                // Create dot for this slide
                const dot = document.createElement('div');
                dot.className = 'dot';
                dot.dataset.slideIndex = index;
                dot.addEventListener('click', () => goToSlide(index));
                dotsContainer.appendChild(dot);
            });
        }
        
        // Show first slide
        updateSlider();
        
        // Start auto-slide
        startAutoSlide();
    }
    
    // --- Firebase Slider Integration ---
    function loadFirebaseSlides() {
        try {
            // Import Firebase modules
            import('https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js').then(firebaseApp => {
                import('https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js').then(firebaseFirestore => {
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
                    const imagesCol = firebaseFirestore.collection(db, 'sliderImages');
                    
                    firebaseFirestore.onSnapshot(imagesCol, (snapshot) => {
                        if (!snapshot.empty) {
                            // Clear existing slides
                            slider.innerHTML = '';
                            dotsContainer.innerHTML = '';
                            
                            // Sort by order
                            const sortedDocs = snapshot.docs.slice().sort((a, b) => {
                                const orderA = a.data().order || 999;
                                const orderB = b.data().order || 999;
                                return orderA - orderB;
                            });
                            
                            // Create slides from Firebase data
                            sortedDocs.forEach((doc, index) => {
                                const imgData = doc.data();
                                const slideElement = document.createElement('div');
                                slideElement.className = 'slide';
                                
                                // Create slide with image only (no caption)
                                slideElement.innerHTML = `
                                    <img src="${imgData.url}" alt="Project Image ${index + 1}">
                                `;
                                slider.appendChild(slideElement);
                                
                                // Create dot
                                const dot = document.createElement('div');
                                dot.className = 'dot';
                                dot.dataset.slideIndex = index;
                                dot.addEventListener('click', () => goToSlide(index));
                                dotsContainer.appendChild(dot);
                            });
                            
                            // Show first slide
                            currentSlide = 0;
                            updateSlider();
                            startAutoSlide();
                        } else {
                            // No images in Firebase, use default images
                            console.log("No images found in Firebase, using static slides");
                            initSlider();
                        }
                    }, (error) => {
                        console.error("Error loading Firebase images:", error);
                        initSlider();
                    });
                }).catch(error => {
                    console.error("Error loading Firebase Firestore:", error);
                    initSlider();
                });
            }).catch(error => {
                console.error("Error loading Firebase App:", error);
                initSlider();
            });
        } catch (error) {
            console.error("Error with Firebase setup:", error);
            initSlider();
        }
    }
    
    // Update slider state
    function updateSlider() {
        // Update slides visibility
        const slides = document.querySelectorAll('.slide');
        slides.forEach((slide, index) => {
            slide.style.display = index === currentSlide ? 'block' : 'none';
        });
        
        // Update dots
        const dots = document.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
        
        // Update progress bar
        const totalSlides = document.querySelectorAll('.slide').length;
        const progressPercentage = ((currentSlide + 1) / totalSlides) * 100;
        progressBar.style.width = `${progressPercentage}%`;
    }
    
    // Go to specific slide
    function goToSlide(index) {
        const totalSlides = document.querySelectorAll('.slide').length;
        currentSlide = index;
        if (currentSlide < 0) currentSlide = totalSlides - 1;
        if (currentSlide >= totalSlides) currentSlide = 0;
        updateSlider();
        
        // Reset auto-slide timer
        resetAutoSlide();
    }
    
    // Next slide
    function nextSlide() {
        goToSlide(currentSlide + 1);
    }
    
    // Previous slide
    function prevSlide() {
        goToSlide(currentSlide - 1);
    }
    
    // Auto-slide functionality
    function startAutoSlide() {
        autoSlideTimer = setInterval(nextSlide, slideInterval);
    }
    
    function resetAutoSlide() {
        clearInterval(autoSlideTimer);
        startAutoSlide();
    }
    
    // Event listeners
    prevBtn.addEventListener('click', () => {
        prevSlide();
    });
    
    nextBtn.addEventListener('click', () => {
        nextSlide();
    });
    
    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
    
    // Try to load Firebase slides, fall back to static slides
    loadFirebaseSlides();
});