### Step 1: Set Up Your Local Project for Firebase

1. **Install Node.js:**
   - Go to [nodejs.org](https://nodejs.org/) and download the LTS version.
   - Follow the installation instructions for your operating system.

2. **Install the Firebase CLI:**
   - Open your terminal (Command Prompt, PowerShell, or Terminal).
   - Run the following command:
     ```bash
     npm install -g firebase-tools
     ```

3. **Log In to Firebase:**
   - In the terminal, run:
     ```bash
     firebase login
     ```
   - This will open a browser window for you to log in to your Google account.

4. **Initialize Firebase in Your Project Folder:**
   - Create a new folder on your computer (e.g., `cusumano-functions`).
   - Navigate into that folder using the terminal:
     ```bash
     cd path/to/cusumano-functions
     ```
   - Run the following command to initialize Firebase functions:
     ```bash
     firebase init functions
     ```
   - Follow the prompts:
     - Choose **Use an existing project**.
     - Select your Firebase project (e.g., `cusumano-website`).
     - Choose **JavaScript** for the language.
     - Type `n` for ESLint.
     - Type `y` to install dependencies with npm.

### Step 2: Write the Cloud Function Code

1. **Open the `index.js` file:**
   - Navigate to the `functions` folder created during initialization.
   - Open `index.js` in your code editor.

2. **Replace the contents of `index.js`:**
   - Copy and paste the following code into `index.js`:

   ```javascript
   const functions = require("firebase-functions");
   const fetch = require("node-fetch");
   const cors = require("cors")({ origin: true });

   const GEMINI_API_KEY = functions.config().gemini.key;
   const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

   exports.geminiProxy = functions.https.onRequest((request, response) => {
     cors(request, response, async () => {
       if (request.method !== "POST") {
         return response.status(405).send("Method Not Allowed");
       }

       if (!request.body || !request.body.chatHistory) {
         return response.status(400).send("Bad Request: Missing chatHistory.");
       }

       try {
         const geminiResponse = await fetch(GEMINI_API_URL, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
           },
           body: JSON.stringify({ contents: request.body.chatHistory }),
         });

         if (!geminiResponse.ok) {
           const errorText = await geminiResponse.text();
           console.error("Gemini API Error:", errorText);
           return response.status(geminiResponse.status).send(errorText);
         }

         const geminiResult = await geminiResponse.json();
         response.status(200).json(geminiResult);

       } catch (error) {
         console.error("Error in the proxy function:", error);
         response.status(500).send("Internal Server Error");
       }
     });
   });
   ```

3. **Add Dependencies:**
   - Make sure you are in the `functions` folder in your terminal.
   - Run the following command to install the required packages:
     ```bash
     npm install node-fetch@2 cors
     ```

### Step 3: Securely Store Your API Key

1. **Set your API key:**
   - Run the following command in your terminal (from the main project folder, not the `functions` subfolder):
     ```bash
     firebase functions:config:set gemini.key="YOUR_SECRET_API_KEY"
     ```
   - Replace `YOUR_SECRET_API_KEY` with your actual Gemini API key.

### Step 4: Deploy Your Cloud Function

1. **Deploy the function:**
   - Run the following command from your terminal (inside your main project folder):
     ```bash
     firebase deploy --only functions
     ```
   - After deployment, note the Function URL provided in the terminal.

### Step 5: Update Your Website to Use the Proxy

1. **Edit your HTML file:**
   - Find the `chatForm.addEventListener('submit', ...)` section in your `index.html` file.
   - Remove the old `apiKey` and `apiUrl` variables.
   - Replace the fetch call with a call to your new Function URL:

   ```javascript
   const proxyApiUrl = 'https://us-central1-cusumano-website.cloudfunctions.net/geminiProxy'; // <-- PASTE YOUR FUNCTION URL HERE

   const response = await fetch(proxyApiUrl, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ chatHistory: chatHistory })
   });
   ```

2. **Remove the old API key:**
   - Delete any references to the old API key from your `index.html` file.

### Final Notes
- After completing these steps, your website should now securely communicate with the Gemini API through your Firebase Cloud Function.
- Make sure to test the functionality to ensure everything is working as expected.

If you encounter any issues or have questions about specific steps, feel free to ask!