# Meta Tag Comparison Tool

A simple local web application to compare meta tags and link tags between two domains across multiple URL paths. Perfect for SEO analysis, migration validation, and content auditing.

## Features

- **Side-by-side comparison** of meta tags and link tags from two domains
- **Color-coded diff highlighting** for easy identification of differences
- **Batch processing** of multiple URL paths
- **Error handling** for 404s, timeouts, and network failures
- **Concurrent fetching** for fast performance
- **Clean, responsive UI** that works on desktop and mobile
- **Comprehensive tag extraction** including stylesheets, canonical URLs, favicons, and more

## Prerequisites

- Node.js 18 or higher (for native fetch support)
- npm (comes with Node.js)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

1. Start the server:

```bash
npm start
```

2. Open your browser and navigate to:

```
http://localhost:3000
```

3. Fill in the form:
   - **Base URL 1**: First domain to compare (e.g., `https://example.com`)
   - **Base URL 2**: Second domain to compare (e.g., `https://example2.com`)
   - **URL Paths**: List of relative paths, one per line (e.g., `/page1`, `/about`, `/contact`)

4. Click "Compare Meta Tags" and wait for results

## Example Test URLs

Try these URLs to test the tool:

**Base URL 1**: `https://en.wikipedia.org`
**Base URL 2**: `https://es.wikipedia.org`
**Paths**:
```
/wiki/Python_(programming_language)
/wiki/JavaScript
/wiki/HTML
```

## Understanding the Results

The tool categorizes both meta tags and link tags into four types:

- **Green** (Only in URL 1): Tags that exist only in the first URL
- **Red** (Only in URL 2): Tags that exist only in the second URL
- **Yellow** (Different): Tags with the same name/property/rel but different values
- **Gray** (Identical): Tags that are exactly the same in both URLs

Each comparison shows:
- The path being compared
- Both full URLs with clickable links
- Side-by-side meta tag comparison with summary statistics
- Side-by-side link tag comparison with summary statistics
- Error messages if URLs fail to load

## Technical Details

### Tech Stack
- **Backend**: Node.js + Express
- **HTML Parsing**: Cheerio
- **Frontend**: Vanilla JavaScript (no frameworks)

### Features
- 10-second timeout per URL fetch
- Concurrent fetching using `Promise.all`
- Extracts all meta tag attributes (name, property, content, charset, http-equiv, etc.)
- Extracts all link tag attributes (rel, href, type, sizes, etc.)
- CORS-free operation (backend handles all fetching)

### Performance
- Typical performance: 20-30 URLs in 5-15 seconds (depending on target site speed)
- Requests are made concurrently for optimal speed
- Each URL has a 10-second timeout to prevent hanging

## Project Structure

```
meta-analyzer/
├── package.json          # Dependencies and scripts
├── server.js             # Express server + API endpoint
├── public/
│   ├── index.html        # UI and form
│   ├── app.js            # Frontend logic and diff algorithm
│   └── styles.css        # Styling and layout
└── README.md             # This file
```

## API Endpoint

The tool exposes one API endpoint:

### POST `/api/compare`

**Request body**:
```json
{
  "baseUrl1": "https://example.com",
  "baseUrl2": "https://example2.com",
  "paths": ["/page1", "/page2", "/page3"]
}
```

**Response**:
```json
{
  "comparisons": [
    {
      "path": "/page1",
      "url1": {
        "url": "https://example.com/page1",
        "metaTags": [...],
        "linkTags": [...],
        "error": null
      },
      "url2": {
        "url": "https://example2.com/page1",
        "metaTags": [...],
        "linkTags": [...],
        "error": null
      }
    }
  ]
}
```

## Troubleshooting

### Port 3000 already in use
If port 3000 is already in use, you can change it in `server.js`:
```javascript
const PORT = 3000; // Change to another port like 3001
```

### Timeout errors
If you're getting timeout errors, some sites may be slow to respond. The timeout is set to 10 seconds per URL. You can increase it in `server.js`:
```javascript
const timeoutId = setTimeout(() => controller.abort(), 10000); // Increase from 10000
```

### CORS errors
This tool runs a backend server specifically to avoid CORS issues. Make sure you're accessing the app through `http://localhost:3000` and not by opening `index.html` directly in your browser.

## License

ISC

## Contributing

Feel free to submit issues or pull requests if you find bugs or want to add features.
