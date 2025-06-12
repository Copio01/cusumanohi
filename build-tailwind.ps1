# PowerShell script to build Tailwind CSS for your project
# Usage: Run this script from your project root

# Ensure Node.js and npm are installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm is not installed. Please install Node.js and npm first." -ForegroundColor Red
    exit 1
}

# Install Tailwind CSS, PostCSS, and Autoprefixer if not already installed
if (-not (Test-Path "node_modules/tailwindcss")) {
    Write-Host "Installing Tailwind CSS and dependencies..." -ForegroundColor Yellow
    npm install -D tailwindcss postcss autoprefixer
}

# Create Tailwind config if it doesn't exist
if (-not (Test-Path "tailwind.config.js")) {
    Write-Host "Creating Tailwind config..." -ForegroundColor Yellow
    npx tailwindcss init
}

# Create input CSS if it doesn't exist
$inputCss = "css/tailwind.css"
if (-not (Test-Path $inputCss)) {
    Write-Host "Creating css/tailwind.css..." -ForegroundColor Yellow
    "@tailwind base;`n@tailwind components;`n@tailwind utilities;" | Out-File -Encoding utf8 $inputCss
}

# Build Tailwind CSS
$outputCss = "css/tailwind.output.css"
Write-Host "Building Tailwind CSS..." -ForegroundColor Green
npx tailwindcss -i $inputCss -o $outputCss --minify

Write-Host "Tailwind CSS build complete! Output: $outputCss" -ForegroundColor Green
