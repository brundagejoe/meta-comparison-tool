const form = document.getElementById('compareForm');
const loading = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', handleSubmit);

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
    displayResults(data.comparisons);
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  } finally {
    loading.style.display = 'none';
    submitBtn.disabled = false;
  }
}

function getMetaKey(tag) {
  return tag.name || tag.property || tag.charset || tag['http-equiv'] || 'other';
}

function getMetaIdentifier(tag) {
  const key = getMetaKey(tag);
  return JSON.stringify({ key, ...tag });
}

function compareMeta(tags1, tags2) {
  const map1 = new Map();
  const map2 = new Map();

  tags1.forEach(tag => {
    const id = getMetaIdentifier(tag);
    map1.set(id, tag);
  });

  tags2.forEach(tag => {
    const id = getMetaIdentifier(tag);
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
      const key = getMetaKey(tag);
      let foundDifferent = false;

      map2.forEach((tag2, id2) => {
        if (getMetaKey(tag2) === key && !foundDifferent) {
          const isSimilar = areSimilarTags(tag, tag2);
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
      const key = getMetaKey(tag);
      let alreadyCategorized = false;

      result.different.forEach(diff => {
        if (getMetaIdentifier(diff.right) === id) {
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

function areSimilarTags(tag1, tag2) {
  const key1 = getMetaKey(tag1);
  const key2 = getMetaKey(tag2);

  if (key1 !== key2) {
    return false;
  }

  if (tag1.name && tag2.name && tag1.name === tag2.name) {
    return true;
  }

  if (tag1.property && tag2.property && tag1.property === tag2.property) {
    return true;
  }

  if (tag1['http-equiv'] && tag2['http-equiv'] && tag1['http-equiv'] === tag2['http-equiv']) {
    return true;
  }

  return false;
}

function formatMetaTag(tag) {
  const parts = [];
  Object.entries(tag).forEach(([key, value]) => {
    parts.push(`${key}="${escapeHtml(value)}"`);
  });
  return `&lt;meta ${parts.join(' ')}&gt;`;
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

    const diff = compareMeta(comparison.url1.metaTags, comparison.url2.metaTags);

    const gridDiv = document.createElement('div');
    gridDiv.className = 'comparison-grid';

    const leftColumn = document.createElement('div');
    leftColumn.className = 'column';
    leftColumn.innerHTML = '<h3>URL 1 Meta Tags</h3>';

    const rightColumn = document.createElement('div');
    rightColumn.className = 'column';
    rightColumn.innerHTML = '<h3>URL 2 Meta Tags</h3>';

    diff.onlyLeft.forEach(tag => {
      const tagDiv = document.createElement('div');
      tagDiv.className = 'meta-tag only-left';
      tagDiv.innerHTML = formatMetaTag(tag);
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
      tagDiv.innerHTML = formatMetaTag(tag);
      rightColumn.appendChild(tagDiv);
    });

    diff.different.forEach(pair => {
      const leftDiv = document.createElement('div');
      leftDiv.className = 'meta-tag different';
      leftDiv.innerHTML = formatMetaTag(pair.left);
      leftColumn.appendChild(leftDiv);

      const rightDiv = document.createElement('div');
      rightDiv.className = 'meta-tag different';
      rightDiv.innerHTML = formatMetaTag(pair.right);
      rightColumn.appendChild(rightDiv);
    });

    diff.identical.forEach(pair => {
      const leftDiv = document.createElement('div');
      leftDiv.className = 'meta-tag identical';
      leftDiv.innerHTML = formatMetaTag(pair.left);
      leftColumn.appendChild(leftDiv);

      const rightDiv = document.createElement('div');
      rightDiv.className = 'meta-tag identical';
      rightDiv.innerHTML = formatMetaTag(pair.right);
      rightColumn.appendChild(rightDiv);
    });

    gridDiv.appendChild(leftColumn);
    gridDiv.appendChild(rightColumn);
    comparisonDiv.appendChild(gridDiv);

    const summary = document.createElement('div');
    summary.className = 'comparison-summary';
    summary.innerHTML = `
      <strong>Summary:</strong>
      <span class="only-left">${diff.onlyLeft.length} only in URL 1</span> |
      <span class="only-right">${diff.onlyRight.length} only in URL 2</span> |
      <span class="different">${diff.different.length} different</span> |
      <span class="identical">${diff.identical.length} identical</span>
    `;
    comparisonDiv.appendChild(summary);

    resultsDiv.appendChild(comparisonDiv);
  });
}
