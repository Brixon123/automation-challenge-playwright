# Automation Challenge — Playwright Script

This project automates inputting rows from a CSV/Excel file into the dynamic form on `https://www.theautomationchallenge.com/` using Playwright + Node.js.

Features:
- Reads data from an Excel (.xlsx) or CSV (.csv) file (first sheet) — each row is one form submission
- Logs in (credentials via environment variables)
- Dynamically locates fields (label, placeholder, aria-label, adjacent input) even when layout and selectors change
- Handles inputs, textareas, selects, radio/checkboxes, and contenteditable
- Detects reCAPTCHA. Optionally integrates with 2captcha to auto-solve, or waits for manual solve.
- Tuned for speed (headless) to complete 50 rows within the 4-minute objective if network & CPU allow.

Requirements
- Node.js 16+ (LTS recommended)
- Internet access
- (Optional) 2captcha API key if you want automated captcha solving

Install
1. Clone the repo
2. Install dependencies:
   npm install

Prepare data
- Place your data file at `./data/challenge1.csv` (or set EXCEL_FILE env var to another path). The script supports .csv, .tsv, .txt and .xlsx.
- The script uses the first sheet. Each column header is used as the label to find the corresponding form field.

Environment variables
- EXCEL_FILE (optional) — default `./data/challenge1.csv`
- USERNAME — login username/email
- PASSWORD — login password
- HEADLESS — `true` or `false` (default `true`)
- TWOCAPTCHA_APIKEY — (optional) API key for 2captcha service to auto-solve reCAPTCHA

Create a `.env` file or export variables. Example `.env`:

EXCEL_FILE=./data/challenge1.csv
USERNAME=you@example.com
PASSWORD=supersecret
HEADLESS=true
TWOCAPTCHA_APIKEY=your_2captcha_key_here

Run

npm start

Notes & Assumptions
- The script attempts robust strategies to find fields by label text; it assumes column headers match or closely match the visible label/placeholder/aria-label text.
- If reCAPTCHA appears and you don't provide TWOCAPTCHA_APIKEY, the script pauses and waits (2 minutes) for manual user solving.
- Handling complex custom widgets may need small adjustments (e.g., custom date pickers).
- Performance depends on network latency and CPU. Running in headless mode and avoiding long timeouts maximizes speed. Target is <240s for 50 rows — tune waits if needed.

License: MIT
