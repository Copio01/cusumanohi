/**
 * Image Slider for Cusumano Home Improvements
 */

document.addEventListener('DOMContentLoaded', () => {
    // Sample images for the slider - update these with your actual image paths
    const slidesData = [
        { src: '../images/siding-project1.jpg', alt: 'Siding Project', caption: 'Siding Installation' },
        { src: '../images/window-project1.jpg', alt: 'Window Project', caption: 'Window Replacement' },
        { src: '../images/deck-project1.jpg', alt: 'Deck Project', caption: 'Custom Deck' },
        { src: '../images/dumpster-rental.jpg', alt: 'Dumpster Rental', caption: 'Dumpster Rental' }
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
    
    // Initialize slider with images
    function initSlider() {
        // Create slides
        slidesData.forEach((slide, index) => {
            const slideElement = document.createElement('div');
            slideElement.className = 'slide';
            slideElement.innerHTML = `
                <img src="${slide.src}" alt="${slide.alt}">
                <div class="slide-caption">${slide.caption}</div>
            `;
            slider.appendChild(slideElement);
            
            // Create dot for this slide
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.slideIndex = index;
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        });
        
        // Show first slide
        updateSlider();
        
        // Start auto-slide
        startAutoSlide();
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
        const progressPercentage = ((currentSlide + 1) / slidesData.length) * 100;
        progressBar.style.width = `${progressPercentage}%`;
    }
    
    // Go to specific slide
    function goToSlide(index) {
        currentSlide = index;
        if (currentSlide < 0) currentSlide = slidesData.length - 1;
        if (currentSlide >= slidesData.length) currentSlide = 0;
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
    
    // Initialize the slider
    initSlider();
});