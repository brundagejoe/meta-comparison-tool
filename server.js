const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

function extractMetaTags(html) {
  const $ = cheerio.load(html);
  const metaTags = [];

  $('meta').each((i, elem) => {
    const tag = {};
    const attributes = elem.attribs;

    Object.keys(attributes).forEach(attr => {
      tag[attr] = attributes[attr];
    });

    if (Object.keys(tag).length > 0) {
      metaTags.push(tag);
    }
  });

  return metaTags;
}

function extractLinkTags(html) {
  const $ = cheerio.load(html);
  const linkTags = [];

  $('link').each((i, elem) => {
    const tag = {};
    const attributes = elem.attribs;

    Object.keys(attributes).forEach(attr => {
      tag[attr] = attributes[attr];
    });

    // Filter out links with href containing "build"
    if (Object.keys(tag).length > 0 && (!tag.href || !tag.href.includes('build'))) {
      linkTags.push(tag);
    }
  });

  return linkTags;
}

async function fetchUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MetaAnalyzer/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        url,
        metaTags: [],
        linkTags: [],
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const html = await response.text();
    const metaTags = extractMetaTags(html);
    const linkTags = extractLinkTags(html);

    return {
      url,
      metaTags,
      linkTags,
      error: null
    };
  } catch (error) {
    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout (10s)';
    }

    return {
      url,
      metaTags: [],
      linkTags: [],
      error: errorMessage
    };
  }
}

app.post('/api/compare', async (req, res) => {
  try {
    const { baseUrl1, baseUrl2, paths } = req.body;

    if ((!baseUrl1 && !baseUrl2) || !paths || !Array.isArray(paths)) {
      return res.status(400).json({
        error: 'Invalid request. Required: at least one of baseUrl1 or baseUrl2, and paths[]'
      });
    }

    const comparisons = await Promise.all(
      paths.map(async (pathItem) => {
        const result = {
          path: pathItem
        };

        if (baseUrl1) {
          const url1 = baseUrl1.replace(/\/$/, '') + pathItem;
          result.url1 = await fetchUrl(url1);
        } else {
          result.url1 = {
            url: null,
            metaTags: [],
            linkTags: [],
            error: null
          };
        }

        if (baseUrl2) {
          const url2 = baseUrl2.replace(/\/$/, '') + pathItem;
          result.url2 = await fetchUrl(url2);
        } else {
          result.url2 = {
            url: null,
            metaTags: [],
            linkTags: [],
            error: null
          };
        }

        return result;
      })
    );

    res.json({ comparisons });
  } catch (error) {
    console.error('Error in /api/compare:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Meta Analyzer running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});
