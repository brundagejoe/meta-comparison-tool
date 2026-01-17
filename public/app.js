const form = document.getElementById('compareForm');
const loading = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const submitBtn = document.getElementById('submitBtn');
const exportSection = document.getElementById('exportSection');
const exportBtn = document.getElementById('exportBtn');
const exportFeedback = document.getElementById('exportFeedback');

let currentComparisons = null;

form.addEventListener('submit', handleSubmit);
exportBtn.addEventListener('click', exportToMarkdown);

async function handleSubmit(e) {
  e.preventDefault();

  const baseUrl1 = document.getElementById('baseUrl1').value.trim();
  const baseUrl2 = document.getElementById('baseUrl2').value.trim();
  const pathsText = document.getElementById('paths').value.trim();

  if (!baseUrl1 || !baseUrl2 || !pathsText) {
    alert('Please fill in all fields');
    return;
  }

  const paths = pathsText
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => p.startsWith('/') ? p : '/' + p);

  if (paths.length === 0) {
    alert('Please enter at least one path');
    return;
  }

  submitBtn.disabled = true;
  loading.style.display = 'block';
  resultsDiv.innerHTML = '';
  exportSection.style.display = 'none';

  try {
    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ baseUrl1, baseUrl2, paths })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch comparisons');
    }

    const data = await response.json();
    currentComparisons = data.comparisons;
    displayResults(data.comparisons);
    exportSection.style.display = 'block';
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    currentComparisons = null;
  } finally {
    loading.style.display = 'none';
    submitBtn.disabled = false;
  }
}

function getTagKey(tag, tagType) {
  if (tagType === 'meta') {
    return tag.name || tag.property || tag.charset || tag['http-equiv'] || 'other';
  } else if (tagType === 'link') {
    return tag.rel || tag.type || 'other';
  }
  return 'other';
}

function getTagIdentifier(tag, tagType) {
  const key = getTagKey(tag, tagType);
  return JSON.stringify({ key, ...tag });
}

function getMetaKey(tag) {
  return getTagKey(tag, 'meta');
}

function getMetaIdentifier(tag) {
  return getTagIdentifier(tag, 'meta');
}

function compareTags(tags1, tags2, tagType) {
  const map1 = new Map();
  const map2 = new Map();

  tags1.forEach(tag => {
    const id = getTagIdentifier(tag, tagType);
    map1.set(id, tag);
  });

  tags2.forEach(tag => {
    const id = getTagIdentifier(tag, tagType);
    map2.set(id, tag);
  });

  const result = {
    onlyLeft: [],
    onlyRight: [],
    different: [],
    identical: []
  };

  map1.forEach((tag, id) => {
    if (map2.has(id)) {
      result.identical.push({ left: tag, right: map2.get(id) });
    } else {
      const key = getTagKey(tag, tagType);
      let foundDifferent = false;

      map2.forEach((tag2, id2) => {
        if (getTagKey(tag2, tagType) === key && !foundDifferent) {
          const isSimilar = areSimilarTags(tag, tag2, tagType);
          if (isSimilar) {
            result.different.push({ left: tag, right: tag2 });
            foundDifferent = true;
          }
        }
      });

      if (!foundDifferent) {
        result.onlyLeft.push(tag);
      }
    }
  });

  map2.forEach((tag, id) => {
    if (!map1.has(id)) {
      const key = getTagKey(tag, tagType);
      let alreadyCategorized = false;

      result.different.forEach(diff => {
        if (getTagIdentifier(diff.right, tagType) === id) {
          alreadyCategorized = true;
        }
      });

      if (!alreadyCategorized) {
        result.onlyRight.push(tag);
      }
    }
  });

  return result;
}

function compareMeta(tags1, tags2) {
  return compareTags(tags1, tags2, 'meta');
}

function compareLinks(tags1, tags2) {
  return compareTags(tags1, tags2, 'link');
}

function areSimilarTags(tag1, tag2, tagType) {
  const key1 = getTagKey(tag1, tagType);
  const key2 = getTagKey(tag2, tagType);

  if (key1 !== key2) {
    return false;
  }

  if (tagType === 'meta') {
    if (tag1.name && tag2.name && tag1.name === tag2.name) {
      return true;
    }

    if (tag1.property && tag2.property && tag1.property === tag2.property) {
      return true;
    }

    if (tag1['http-equiv'] && tag2['http-equiv'] && tag1['http-equiv'] === tag2['http-equiv']) {
      return true;
    }
  } else if (tagType === 'link') {
    if (tag1.rel && tag2.rel && tag1.rel === tag2.rel) {
      return true;
    }

    if (tag1.type && tag2.type && tag1.type === tag2.type) {
      return true;
    }
  }

  return false;
}

function formatTag(tag, tagType) {
  const parts = [];
  Object.entries(tag).forEach(([key, value]) => {
    parts.push(`${key}="${escapeHtml(value)}"`);
  });
  return `&lt;${tagType} ${parts.join(' ')}&gt;`;
}

function formatMetaTag(tag) {
  return formatTag(tag, 'meta');
}

function formatLinkTag(tag) {
  return formatTag(tag, 'link');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function displayResults(comparisons) {
  if (comparisons.length === 0) {
    resultsDiv.innerHTML = '<p>No comparisons to display.</p>';
    return;
  }

  resultsDiv.innerHTML = '';

  comparisons.forEach((comparison, index) => {
    const comparisonDiv = document.createElement('div');
    comparisonDiv.className = 'comparison-item';

    const header = document.createElement('div');
    header.className = 'comparison-header';
    header.innerHTML = `
      <h2>Path: ${escapeHtml(comparison.path)}</h2>
      <div class="url-pair">
        <div class="url-info">
          <strong>URL 1:</strong> <a href="${escapeHtml(comparison.url1.url)}" target="_blank">${escapeHtml(comparison.url1.url)}</a>
          ${comparison.url1.error ? `<span class="error-badge">Error: ${escapeHtml(comparison.url1.error)}</span>` : ''}
        </div>
        <div class="url-info">
          <strong>URL 2:</strong> <a href="${escapeHtml(comparison.url2.url)}" target="_blank">${escapeHtml(comparison.url2.url)}</a>
          ${comparison.url2.error ? `<span class="error-badge">Error: ${escapeHtml(comparison.url2.error)}</span>` : ''}
        </div>
      </div>
    `;

    comparisonDiv.appendChild(header);

    if (comparison.url1.error && comparison.url2.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-both';
      errorDiv.textContent = 'Both URLs failed to load';
      comparisonDiv.appendChild(errorDiv);
      resultsDiv.appendChild(comparisonDiv);
      return;
    }

    // Compare meta tags
    const metaDiff = compareMeta(comparison.url1.metaTags, comparison.url2.metaTags);

    // Compare link tags
    const linkDiff = compareLinks(comparison.url1.linkTags, comparison.url2.linkTags);

    // Display Meta Tags Section
    const metaSectionTitle = document.createElement('h3');
    metaSectionTitle.className = 'section-title';
    metaSectionTitle.textContent = 'Meta Tags';
    comparisonDiv.appendChild(metaSectionTitle);

    const metaGridDiv = document.createElement('div');
    metaGridDiv.className = 'comparison-grid';

    const metaLeftColumn = document.createElement('div');
    metaLeftColumn.className = 'column';
    metaLeftColumn.innerHTML = '<h4>URL 1</h4>';

    const metaRightColumn = document.createElement('div');
    metaRightColumn.className = 'column';
    metaRightColumn.innerHTML = '<h4>URL 2</h4>';

    renderTagDiff(metaDiff, metaLeftColumn, metaRightColumn, formatMetaTag);

    metaGridDiv.appendChild(metaLeftColumn);
    metaGridDiv.appendChild(metaRightColumn);
    comparisonDiv.appendChild(metaGridDiv);

    const metaSummary = document.createElement('div');
    metaSummary.className = 'comparison-summary';
    metaSummary.innerHTML = `
      <strong>Meta Tags:</strong>
      <span class="only-left">${metaDiff.onlyLeft.length} only in URL 1</span> |
      <span class="only-right">${metaDiff.onlyRight.length} only in URL 2</span> |
      <span class="different">${metaDiff.different.length} different</span> |
      <span class="identical">${metaDiff.identical.length} identical</span>
    `;
    comparisonDiv.appendChild(metaSummary);

    // Display Link Tags Section
    const linkSectionTitle = document.createElement('h3');
    linkSectionTitle.className = 'section-title';
    linkSectionTitle.textContent = 'Link Tags';
    comparisonDiv.appendChild(linkSectionTitle);

    const linkGridDiv = document.createElement('div');
    linkGridDiv.className = 'comparison-grid';

    const linkLeftColumn = document.createElement('div');
    linkLeftColumn.className = 'column';
    linkLeftColumn.innerHTML = '<h4>URL 1</h4>';

    const linkRightColumn = document.createElement('div');
    linkRightColumn.className = 'column';
    linkRightColumn.innerHTML = '<h4>URL 2</h4>';

    renderTagDiff(linkDiff, linkLeftColumn, linkRightColumn, formatLinkTag);

    linkGridDiv.appendChild(linkLeftColumn);
    linkGridDiv.appendChild(linkRightColumn);
    comparisonDiv.appendChild(linkGridDiv);

    const linkSummary = document.createElement('div');
    linkSummary.className = 'comparison-summary';
    linkSummary.innerHTML = `
      <strong>Link Tags:</strong>
      <span class="only-left">${linkDiff.onlyLeft.length} only in URL 1</span> |
      <span class="only-right">${linkDiff.onlyRight.length} only in URL 2</span> |
      <span class="different">${linkDiff.different.length} different</span> |
      <span class="identical">${linkDiff.identical.length} identical</span>
    `;
    comparisonDiv.appendChild(linkSummary);

    resultsDiv.appendChild(comparisonDiv);
  });
}

function renderTagDiff(diff, leftColumn, rightColumn, formatFunction) {
  diff.onlyLeft.forEach(tag => {
    const tagDiv = document.createElement('div');
    tagDiv.className = 'meta-tag only-left';
    tagDiv.innerHTML = formatFunction(tag);
    leftColumn.appendChild(tagDiv);

    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'meta-tag empty';
    emptyDiv.innerHTML = '<em>Not present</em>';
    rightColumn.appendChild(emptyDiv);
  });

  diff.onlyRight.forEach(tag => {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'meta-tag empty';
    emptyDiv.innerHTML = '<em>Not present</em>';
    leftColumn.appendChild(emptyDiv);

    const tagDiv = document.createElement('div');
    tagDiv.className = 'meta-tag only-right';
    tagDiv.innerHTML = formatFunction(tag);
    rightColumn.appendChild(tagDiv);
  });

  diff.different.forEach(pair => {
    const leftDiv = document.createElement('div');
    leftDiv.className = 'meta-tag different';
    leftDiv.innerHTML = formatFunction(pair.left);
    leftColumn.appendChild(leftDiv);

    const rightDiv = document.createElement('div');
    rightDiv.className = 'meta-tag different';
    rightDiv.innerHTML = formatFunction(pair.right);
    rightColumn.appendChild(rightDiv);
  });

  diff.identical.forEach(pair => {
    const leftDiv = document.createElement('div');
    leftDiv.className = 'meta-tag identical';
    leftDiv.innerHTML = formatFunction(pair.left);
    leftColumn.appendChild(leftDiv);

    const rightDiv = document.createElement('div');
    rightDiv.className = 'meta-tag identical';
    rightDiv.innerHTML = formatFunction(pair.right);
    rightColumn.appendChild(rightDiv);
  });
}

function formatTagForMarkdown(tag) {
  const parts = [];
  Object.entries(tag).forEach(([key, value]) => {
    parts.push(`${key}="${value}"`);
  });
  return parts.join(' ');
}

async function exportToMarkdown() {
  if (!currentComparisons || currentComparisons.length === 0) {
    exportFeedback.textContent = 'No data to export';
    exportFeedback.style.color = '#e74c3c';
    setTimeout(() => exportFeedback.textContent = '', 3000);
    return;
  }

  let markdown = '# Meta & Link Tag Differences\n\n';
  markdown += '| Path | Type | URL 1 | URL 2 | Status |\n';
  markdown += '|------|------|-------|-------|--------|\n';

  currentComparisons.forEach(comparison => {
    const path = comparison.path;

    // Process meta tags
    const metaDiff = compareMeta(comparison.url1.metaTags, comparison.url2.metaTags);

    metaDiff.onlyLeft.forEach(tag => {
      const tagStr = formatTagForMarkdown(tag);
      markdown += `| ${path} | Meta | \`${tagStr}\` | _(not present)_ | Only in URL 1 |\n`;
    });

    metaDiff.onlyRight.forEach(tag => {
      const tagStr = formatTagForMarkdown(tag);
      markdown += `| ${path} | Meta | _(not present)_ | \`${tagStr}\` | Only in URL 2 |\n`;
    });

    metaDiff.different.forEach(pair => {
      const leftStr = formatTagForMarkdown(pair.left);
      const rightStr = formatTagForMarkdown(pair.right);
      markdown += `| ${path} | Meta | \`${leftStr}\` | \`${rightStr}\` | Different |\n`;
    });

    // Process link tags
    const linkDiff = compareLinks(comparison.url1.linkTags, comparison.url2.linkTags);

    linkDiff.onlyLeft.forEach(tag => {
      const tagStr = formatTagForMarkdown(tag);
      markdown += `| ${path} | Link | \`${tagStr}\` | _(not present)_ | Only in URL 1 |\n`;
    });

    linkDiff.onlyRight.forEach(tag => {
      const tagStr = formatTagForMarkdown(tag);
      markdown += `| ${path} | Link | _(not present)_ | \`${tagStr}\` | Only in URL 2 |\n`;
    });

    linkDiff.different.forEach(pair => {
      const leftStr = formatTagForMarkdown(pair.left);
      const rightStr = formatTagForMarkdown(pair.right);
      markdown += `| ${path} | Link | \`${leftStr}\` | \`${rightStr}\` | Different |\n`;
    });
  });

  try {
    await navigator.clipboard.writeText(markdown);
    exportFeedback.textContent = '✓ Copied to clipboard!';
    exportFeedback.style.color = '#27ae60';
    setTimeout(() => exportFeedback.textContent = '', 3000);
  } catch (error) {
    exportFeedback.textContent = '✗ Failed to copy to clipboard';
    exportFeedback.style.color = '#e74c3c';
    setTimeout(() => exportFeedback.textContent = '', 3000);
  }
}
