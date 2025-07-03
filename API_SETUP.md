# API Configuration Setup

This project uses external API keys that need to be configured locally.

## Setup Instructions

1. **Copy the template file:**
   ```bash
   cp js/config.template.js js/config.js
   ```

2. **Add your API keys:**
   Edit `js/config.js` and replace the placeholder values with your actual API keys:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `MAPS_API_KEY`: Your Google Maps API key (if using maps features)

3. **Security Note:**
   The `js/config.js` file is ignored by git to prevent accidental commits of API keys.

## Alternative: Environment Variables

For production deployments, consider using environment variables instead of the config file.

## Firebase Functions (Alternative Approach)

If you have Firebase Functions permissions, you can use the Cloud Functions approach in the `cusumano-functions/` directory for better security.
