# Web Scraper

A simple and powerful web scraper built with Node.js, Puppeteer, and Cheerio.

## Features

- 🚀 Easy-to-use web scraping with Puppeteer
- 📊 Extract links, images, and page content
- 💾 Save scraped data to JSON files
- 🔧 Configurable browser options
- 📝 Clean, readable code structure

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

### Basic Usage

Run the scraper with a URL:
```bash
npm run dev https://example.com
```

Or without arguments (defaults to example.com):
```bash
npm run dev
```

### Programmatic Usage

```javascript
const WebScraper = require('./index.js');

async function scrapeWebsite() {
  const scraper = new WebScraper();
  
  try {
    const data = await scraper.scrapeUrl('https://example.com');
    await scraper.saveData(data, 'my-data.json');
  } finally {
    await scraper.close();
  }
}

scrapeWebsite();
```

## Configuration

The scraper can be customized by modifying the `WebScraper` class:

- **Headless mode**: Set `headless: true` in the `init()` method for production
- **Timeout**: Adjust the `timeout` value in `scrapeUrl()`
- **Data extraction**: Modify the `page.evaluate()` function to extract different data

## Output

The scraper extracts:
- Page title
- All links with text and URLs
- All images with src and alt attributes
- Current URL

Data is saved to `scraped-data.json` by default.

## Dependencies

- **puppeteer**: Browser automation
- **cheerio**: Server-side jQuery implementation
- **axios**: HTTP client
- **fs-extra**: Enhanced file system operations

## License

MIT
