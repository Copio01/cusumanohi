/**
 * Enhanced Image Slider with Accessibility Features
 * Supports touch events, keyboard navigation, and lazy loading
 */

// Global function that can be called after dynamic content is loaded
function initializeSliders() {
  const sliders = document.querySelectorAll('.image-slider');
  
  sliders.forEach(slider => {
    // Skip if already initialized
    if (slider.dataset.initialized === 'true') return;
    
    const slidesContainer = slider.querySelector('.slides-container') || slider;
    const slides = slidesContainer.querySelectorAll('.slide');
    const totalSlides = slides.length;
    
    // Skip initialization if no slides
    if (totalSlides === 0) return;
    
    // Create controls if they don't exist
    if (!slider.querySelector('.slider-controls')) {
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'slider-controls';
      
      const prevButton = document.createElement('button');
      prevButton.className = 'slider-prev';
      prevButton.innerHTML = '<span aria-hidden="true">&#8592;</span><span class="sr-only">Previous</span>';
      prevButton.setAttribute('aria-label', 'Previous slide');
      
      const nextButton = document.createElement('button');
      nextButton.className = 'slider-next';
      nextButton.innerHTML = '<span aria-hidden="true">&#8594;</span><span class="sr-only">Next</span>';
      nextButton.setAttribute('aria-label', 'Next slide');
      
      const indicators = document.createElement('div');
      indicators.className = 'slider-indicators';
      indicators.setAttribute('role', 'tablist');
      
      // Create indicators for each slide
      for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('button');
        dot.className = 'slider-indicator';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        dot.setAttribute('aria-label', `Slide ${i + 1}`);
        dot.dataset.index = i;
        indicators.appendChild(dot);
      }
      
      controlsContainer.appendChild(prevButton);
      controlsContainer.appendChild(indicators);
      controlsContainer.appendChild(nextButton);
      slider.appendChild(controlsContainer);
    }
    
    // Get control elements
    const prevButton = slider.querySelector('.slider-prev');
    const nextButton = slider.querySelector('.slider-next');
    const indicators = slider.querySelectorAll('.slider-indicator');
    
    // Set up state
    let currentIndex = 0;
    let isTransitioning = false;
    let autoplayTimer = null;
    let touchStartX = 0;
    let touchEndX = 0;
    
    // Set ARIA attributes for accessibility
    slidesContainer.setAttribute('aria-live', 'polite');
    slides.forEach((slide, index) => {
      slide.setAttribute('role', 'tabpanel');
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
      slide.id = `slide-${slider.id || Math.random().toString(36).substring(2, 9)}-${index}`;
    });
    
    // Initialize the first slide
    slides[0].classList.add('active');
    
    // Lazy load images
    function lazyLoadImages() {
      const visibleSlides = [
        slides[currentIndex],
        slides[(currentIndex + 1) % totalSlides],
        slides[(currentIndex - 1 + totalSlides) % totalSlides]
      ];
      
      visibleSlides.forEach(slide => {
        if (!slide) return;
        
        const lazyImage = slide.querySelector('img[data-src]');
        if (lazyImage) {
          lazyImage.src = lazyImage.dataset.src;
          lazyImage.removeAttribute('data-src');
        }
      });
    }
    
    // Update slide state
    function updateSlideState(newIndex) {
      if (isTransitioning || newIndex === currentIndex) return;
      
      isTransitioning = true;
      
      // Update slides
      slides[currentIndex].classList.remove('active');
      slides[currentIndex].setAttribute('aria-hidden', 'true');
      
      slides[newIndex].classList.add('active');
      slides[newIndex].setAttribute('aria-hidden', 'false');
      
      // Update indicators
      indicators.forEach((indicator, i) => {
        indicator.setAttribute('aria-selected', i === newIndex ? 'true' : 'false');
        indicator.classList.toggle('active', i === newIndex);
      });
      
      // Load images for visible and adjacent slides
      lazyLoadImages();
      
      currentIndex = newIndex;
      
      // Reset transition lock after animation completes
      setTimeout(() => {
        isTransitioning = false;
      }, 500); // Match this to CSS transition time
    }
    
    // Navigation functions
    function goToNextSlide() {
      updateSlideState((currentIndex + 1) % totalSlides);
    }
    
    function goToPrevSlide() {
      updateSlideState((currentIndex - 1 + totalSlides) % totalSlides);
    }
    
    function goToSlide(index) {
      updateSlideState(parseInt(index) % totalSlides);
    }
    
    // Set up autoplay if enabled
    function startAutoplay() {
      const autoplayDelay = parseInt(slider.dataset.autoplayDelay || 5000);
      
      if (slider.dataset.autoplay === 'true' && autoplayDelay > 0) {
        autoplayTimer = setInterval(goToNextSlide, autoplayDelay);
      }
    }
    
    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }
    
    // Event listeners
    prevButton.addEventListener('click', (e) => {
      e.preventDefault();
      goToPrevSlide();
      stopAutoplay(); // Stop autoplay when user interacts
    });
    
    nextButton.addEventListener('click', (e) => {
      e.preventDefault();
      goToNextSlide();
      stopAutoplay(); // Stop autoplay when user interacts
    });
    
    indicators.forEach(indicator => {
      indicator.addEventListener('click', (e) => {
        e.preventDefault();
        goToSlide(indicator.dataset.index);
        stopAutoplay(); // Stop autoplay when user interacts
      });
    });
    
    // Keyboard navigation
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        goToPrevSlide();
        stopAutoplay();
      } else if (e.key === 'ArrowRight') {
        goToNextSlide();
        stopAutoplay();
      }
    });
    
    // Touch events for mobile
    slider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    slider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
      const threshold = 50;
      const swipeDistance = touchEndX - touchStartX;
      
      if (swipeDistance > threshold) {
        goToPrevSlide();
        stopAutoplay();
      } else if (swipeDistance < -threshold) {
        goToNextSlide();
        stopAutoplay();
      }
    }
    
    // Handle visibility changes to pause autoplay when not visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });
    
    // Start autoplay
    startAutoplay();
    
    // Preload adjacent images
    lazyLoadImages();
    
    // Mark as initialized
    slider.dataset.initialized = 'true';
    
    // Announce to screen readers
    const announcer = document.createElement('div');
    announcer.className = 'sr-only';
    announcer.setAttribute('aria-live', 'polite');
    announcer.textContent = `Slider initialized with ${totalSlides} slides. Use arrow keys to navigate.`;
    slider.appendChild(announcer);
    
    // Clear announcement after it's read
    setTimeout(() => {
      announcer.textContent = '';
    }, 3000);
  });
}

// Initialize sliders when the document is ready
document.addEventListener('DOMContentLoaded', initializeSliders);

// Also export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initializeSliders };
}