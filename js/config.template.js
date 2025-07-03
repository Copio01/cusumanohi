// config.template.js - Template for API configuration
// Copy this file to config.js and add your real API keys

const API_CONFIG = {
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
  MAPS_API_KEY: "YOUR_MAPS_API_KEY_HERE", 
  GEMINI_API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}
