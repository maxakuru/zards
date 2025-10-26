import {
    fetchPlaceholders,
    readBlockConfig,
    toClassName,
    toCamelCase,
    buildBlock,
    decorateBlock,
    loadBlock,
  } from '../../scripts/aem.js';
  
  /**
   * Fetches and filters products from the product index.
   * @param {Array<string>|Object} config - An array of product paths or a config object
   * @param {Object} facets - Optional facets object to calculate counts for filtering options
   * @returns {Promise<Array<Object>>} Array of filtered product objects
   */
  export async function lookupProducts(config, facets = {}) {
    if (!window.productIndex) {
      // fetch the main product index
      const resp = await fetch('/products/index.json');
      const json = await resp.json();
  
      // build a lookup map of SKU > product data
      const skuIndex = {};
      json.data.forEach((row) => {
        skuIndex[row.sku] = row;
      });
  
      // fetch the catalog config
      const catalog = await fetch('/products/config/catalog.json');
      const catalogData = await catalog.json();
  
      // build a lookup map of product path > catalog data for category information
      const catalogProducts = {};
      catalogData.data.forEach((row) => {
        const path = new URL(row.URL).pathname;
        catalogProducts[path] = row;
      });
  
      const populateIndex = async (data) => {
        const topLevelProducts = data
          .filter((row) => !row.parentSku && row.title && row.price && (row.availability === 'InStock'));
        const products = [];
        for (let i = 0; i < topLevelProducts.length; i += 1) {
          const row = topLevelProducts[i];
          const variants = row.variantSkus ? row.variantSkus.split(',').map((e) => skuIndex[e.trim()]) : [];
          const colors = variants.map((child) => child.color);
          const availability = variants.map((child) => child.availability).join(',');
          if (availability.includes('InStock')) {
            row.availability = availability;
            row.path = `/products/${row.urlKey}`;
            row.colors = colors.join(',');
            row.category = catalogProducts[row.path] ? catalogProducts[row.path].Categories : '';
            row.collection = catalogProducts[row.path] ? catalogProducts[row.path].Collections : '';
            row.productType = catalogProducts[row.path] ? catalogProducts[row.path]['Product Type'] : '';
            const heroImage = variants[0] && variants[0].image ? variants[0].image : row.image;
            row.image = new URL(heroImage, new URL(row.path, window.location.href)).toString();
          }
          products.push(row);
        }
        return products;
      };
      const products = await populateIndex(json.data);
  
      // build a path-based lookup for direct product access
      const lookup = {};
      products.forEach((row) => {
        lookup[row.path] = row;
      });
      window.productIndex = { data: json.data, lookup };
    }
  
    // simple array lookup
    if (Array.isArray(config)) {
      const pathnames = config;
      // filter out any paths to products that don't exist
      return (pathnames.map((path) => window.productIndex.lookup[path]).filter((e) => e));
    }
  
    // setup filtering config
    const facetKeys = Object.keys(facets);
    const keys = Object.keys(config);
    const tokens = {};
    keys.forEach((key) => {
      tokens[key] = config[key].split(',').map((t) => t.trim());
    });
  
    // filter products based on config
    const results = window.productIndex.data.filter((row) => {
      const filterMatches = {};
      let matchedAll = keys.every((key) => {
        let matched = false;
        if (row[key]) {
          const rowValues = row[key].split(',').map((t) => t.trim());
          matched = tokens[key].some((t) => rowValues.includes(t));
        }
        if (key === 'fulltext') {
          const fulltext = row.title.toLowerCase();
          matched = fulltext.includes(config.fulltext.toLowerCase());
        }
        filterMatches[key] = matched;
        return matched;
      });
  
      // only include actual products (not variants or categories)
      const isProduct = () => !!row.price;
      if (!isProduct()) matchedAll = false;
  
      // calculate facet counts
      facetKeys.forEach((facetKey) => {
        let includeInFacet = true;
        Object.keys(filterMatches).forEach((filterKey) => {
          if (filterKey !== facetKey && !filterMatches[filterKey]) includeInFacet = false;
        });
        if (includeInFacet) {
          if (row[facetKey]) {
            const rowValues = row[facetKey].split(',').map((t) => t.trim());
            rowValues.forEach((val) => {
              if (facets[facetKey][val]) {
                facets[facetKey][val] += 1;
              } else {
                facets[facetKey][val] = 1;
              }
            });
          }
        }
      });
  
      // eslint-disable-next-line no-console
      if (matchedAll) console.log(row);
      return (matchedAll);
    });
    return results;
  }
  
  /**
   * Creates a product image element with lazy loading.
   * @param {Object} product - Product data object
   * @returns {HTMLImageElement} Product image element
   */
  function createProductImage(product) {
    const image = document.createElement('img');
    image.src = product.image || product.images?.[0]?.url || '';
    image.alt = product.title || product.name || '';
    image.loading = 'lazy';
    return image;
  }
  
  /**
   * Creates a product title heading with a link to the product page.
   * @param {Object} product - Product data object
   * @param {string} h - HTML heading tag to use (default: 'h4')
   * @returns {HTMLHeadingElement} Product title element
   */
  function createProductTitle(product, h = 'h4') {
    const title = document.createElement(h);
    const link = document.createElement('a');
    link.href = product.path || product.url || '#';
    link.textContent = product.title || product.name || '';
    title.appendChild(link);
    return title;
  }
  
  /**
   * Creates a product price display element.
   * @param {Object} product - Product data object
   * @returns {HTMLParagraphElement} Product price element
   */
  function createProductPrice(product) {
    const price = document.createElement('p');
    price.className = 'plp-price';
    price.textContent = product.price ? `$${product.price}` : '';
    return price;
  }
  
  /**
   * Creates color swatches showing available colors and their availability status.
   * @param {Object} product - Product data object with colors and availability
   * @returns {HTMLDivElement} Container element with color swatches
   */
  function createProductColors(product) {
    const colors = document.createElement('div');
    colors.className = 'plp-colors';
    const availability = product.availability.split(',');
    product.colors.split(',').forEach((color, index) => {
      const colorSwatch = document.createElement('div');
      colorSwatch.className = 'plp-color-swatch';
      const colorInner = document.createElement('div');
      colorInner.className = 'plp-color-inner';
      colorInner.style.backgroundColor = `var(--color-${toClassName(color)})`;
      colorSwatch.appendChild(colorInner);
      colors.appendChild(colorSwatch);
      // mark out-of-stock colors
      if (availability[index] !== 'InStock') {
        colorInner.classList.add('plp-color-swatch-oos');
      }
    });
    return colors;
  }
  
  /**
   * Creates a button element for product actions.
   * @param {Object} product - Product data object
   * @param {Object} ph - Placeholder object with localized text strings
   * @param {string} label - Button label text used for CSS class and placeholder lookup
   * @param {string} btnClass - Additional CSS class for the button (optional)
   * @returns {HTMLParagraphElement} Button container element
   */
  function createProductButton(product, ph, label, btnClass) {
    const button = document.createElement('p');
    button.classList.add(`plp-${toClassName(label)}`, 'button-container');
    button.innerHTML = `<a href="${product.path}" class="button ${btnClass}">${ph[toCamelCase(label)]}</a>`;
    return button;
  }
  
  /**
   * Creates a product card DOM element for display in the product listing.
   * @param {Object} product - Product data object with title, price, colors, etc.
   * @param {Object} ph - Placeholder object with localized text strings
   * @returns {HTMLElement} Product card element
   */
  function createProductCard(product, ph) {
    const card = document.createElement('div');
    card.className = 'plp-product-card';
  
    const image = createProductImage(product);
    const title = createProductTitle(product);
    const price = createProductPrice(product);
    const colors = createProductColors(product);
    const viewDetails = createProductButton(product, ph, 'View Details', 'emphasis');
    const compare = createProductButton(product, ph, 'Compare');
  
    card.append(image, title, price, colors, viewDetails, compare);
    card.addEventListener('click', () => {
      window.location.href = product.path;
    });
  
    return card;
  }
  
  /**
   * Creates a product slide for display in a carousel view.
   * @param {Object} product - Product data object with title, price, colors, etc.
   * @param {Object} ph - Placeholder object with localized text strings
   * @returns {Array<HTMLElement>} Array containing image and slide body elements
   */
  function createProductSlide(product, ph) {
    // product image
    const image = createProductImage(product);
  
    // product title as a link to PDP
    const slideBody = document.createElement('div');
    const title = createProductTitle(product, 'h3');
    slideBody.appendChild(title);
  
    // color options
    const colors = createProductColors(product);
    slideBody.appendChild(colors);
  
    // feature highlight
    // recipe programs
  
    // starting at price
    if (product.price) {
      const startingAt = document.createElement('p');
      startingAt.className = 'eyebrow';
      startingAt.textContent = ph.startingAt || 'Starting at';
  
      const price = createProductPrice(product);
      slideBody.append(startingAt, price);
    }
  
    // "Show Now" button
    const shopNow = createProductButton(product, ph, 'Shop Now');
    slideBody.appendChild(shopNow);
  
    return [image, slideBody];
  }
  
  function buildFiltering(block, ph, config) {
    block.innerHTML = `<div class="plp-controls">
        <input id="fulltext" placeholder="${ph.typeToSearch || 'Type to search'}">
        <p class="plp-results-count"><span id="plp-results-count"></span> ${ph.results || 'Results'}</p>
        <button class="plp-filter-button secondary">${ph.filter || 'Filter'}</button>
        <button class="plp-sort-button secondary">${ph.sort || 'Sort'}</button>
      </div>
      <div class="plp-facets"></div>
      <div class="plp-sortby">
        <p>${ph.sortBy || 'Sort By'} <span data-sort="featured" id="plp-sortby">${ph.featured || 'Featured'}</span></p>
        <ul>
          <li data-sort="featured">${ph.featured || 'Featured'}</li>
          <li data-sort="price-desc">${ph.priceHighToLow || 'Price High to Low'}</li>
          <li data-sort="price-asc">${ph.priceLowToHigh || 'Price Low to High'}</li>
          <li data-sort="name">${ph.productName || 'Product Name'}</li>
        </ul>
      </div>
      <div class="plp-results"></div>`;
  
    const resultsElement = block.querySelector('.plp-results');
    const facetsElement = block.querySelector('.plp-facets');
    block.querySelector('.plp-filter-button').addEventListener('click', () => {
      block.querySelector('.plp-facets').classList.toggle('visible');
    });
  
    const addEventListeners = (elements, event, callback) => {
      elements.forEach((e) => {
        e.addEventListener(event, callback);
      });
    };
  
    addEventListeners([
      block.querySelector('.plp-sort-button'),
      block.querySelector('.plp-sortby p'),
    ], 'click', () => {
      block.querySelector('.plp-sortby ul').classList.toggle('visible');
    });
  
    const sortList = block.querySelector('.plp-sortby ul');
    const selectSort = (selected) => {
      [...sortList.children].forEach((li) => li.classList.remove('selected'));
      selected.classList.add('selected');
      const sortBy = document.getElementById('plp-sortby');
      sortBy.textContent = selected.textContent;
      sortBy.dataset.sort = selected.dataset.sort;
      document.getElementById('plp-sortby').textContent = selected.textContent;
      block.querySelector('.plp-sortby ul').classList.remove('visible');
      // eslint-disable-next-line no-use-before-define
      runSearch(createFilterConfig());
    };
  
    sortList.addEventListener('click', (event) => {
      selectSort(event.target);
    });
  
    const highlightResults = (res) => {
      const fulltext = document.getElementById('fulltext').value;
      if (fulltext) {
        res.querySelectorAll('h4').forEach((title) => {
          const content = title.textContent;
          const offset = content.toLowerCase().indexOf(fulltext.toLowerCase());
          if (offset >= 0) {
            title.innerHTML = `${content.substring(0, offset)}<span class="highlight">${content.substring(offset, fulltext.length)}</span>${content.substring(offset + fulltext.length)}`;
          }
        });
      }
    };
  
    const displayResults = async (results) => {
      resultsElement.innerHTML = '';
      results.forEach((product) => {
        resultsElement.append(createProductCard(product, ph));
      });
      highlightResults(resultsElement);
    };
  
    const getSelectedFilters = () => [...block.querySelectorAll('input[type="checkbox"]:checked')];
  
    const createFilterConfig = () => {
      const filterConfig = { ...config };
      getSelectedFilters().forEach((checked) => {
        const facetKey = checked.name;
        const facetValue = checked.value;
        if (filterConfig[facetKey]) filterConfig[facetKey] += `, ${facetValue}`;
        else filterConfig[facetKey] = facetValue;
      });
      filterConfig.fulltext = document.getElementById('fulltext').value;
      return (filterConfig);
    };
  
    const displayFacets = (facets, filters) => {
      const selected = getSelectedFilters().map((check) => check.value);
      facetsElement.innerHTML = `<div>
          <div class="plp-filters">
            <h2>${ph.filters || 'Filters'}</h2>
            <div class="plp-filters-selected"></div>
            <p><button class="plp-filters-clear secondary">${ph.clearAll || 'Clear All'}</button></p>
            <div class="plp-filters-facetlist"></div>
          </div>
          <div class="plp-apply-filters">
            <button>See Results</button>
          </div>
        </div>`;
  
      addEventListeners([
        facetsElement.querySelector('.plp-apply-filters button'),
        facetsElement.querySelector(':scope > div'),
        facetsElement,
      ], 'click', (event) => {
        if (event.currentTarget === event.target) block.querySelector('.plp-facets').classList.remove('visible');
      });
  
      const selectedFilters = block.querySelector('.plp-filters-selected');
      selected.forEach((tag) => {
        const span = document.createElement('span');
        span.className = 'plp-filters-tag';
        span.textContent = tag;
        span.addEventListener('click', () => {
          document.getElementById(`plp-filter-${tag}`).checked = false;
          const filterConfig = createFilterConfig();
          // eslint-disable-next-line no-use-before-define
          runSearch(filterConfig);
        });
        selectedFilters.append(span);
      });
  
      facetsElement.querySelector('.plp-filters-clear').addEventListener('click', () => {
        selected.forEach((tag) => {
          document.getElementById(`plp-filter-${tag}`).checked = false;
        });
        const filterConfig = createFilterConfig();
        // eslint-disable-next-line no-use-before-define
        runSearch(filterConfig);
      });
  
      // build facet filter lists
      const facetsList = block.querySelector('.plp-filters-facetlist');
      const facetKeys = Object.keys(facets);
      facetKeys.forEach((facetKey) => {
        const filter = filters[facetKey];
        const filterValues = filter ? filter.split(',').map((t) => t.trim()) : [];
        const div = document.createElement('div');
        div.className = 'plp-facet';
        const h3 = document.createElement('h3');
        h3.innerHTML = ph[facetKey];
        div.append(h3);
        const facetValues = Object.keys(facets[facetKey]).sort((a, b) => a.localeCompare(b));
        facetValues.forEach((facetValue) => {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = facetValue;
          input.checked = filterValues.includes(facetValue);
          input.id = `plp-filter-${facetValue}`;
          input.name = facetKey;
          const label = document.createElement('label');
          label.setAttribute('for', input.id);
          label.textContent = `${facetValue} (${facets[facetKey][facetValue]})`;
          div.append(input, label);
          input.addEventListener('change', () => {
            const filterConfig = createFilterConfig();
            // eslint-disable-next-line no-use-before-define
            runSearch(filterConfig);
          });
        });
        facetsList.append(div);
      });
    };
  
    const getPrice = (string) => +string;
  
    const runSearch = async (filterConfig = config) => {
      const facets = {
        series: {}, collection: {}, colors: {}, productType: {},
      };
      const sorts = {
        name: (a, b) => a.title.localeCompare(b.title),
        'price-asc': (a, b) => getPrice(a.price) - getPrice(b.price),
        'price-desc': (a, b) => getPrice(b.price) - getPrice(a.price),
        featured: (a, b) => getPrice(b.price) - getPrice(a.price),
      };
      const results = await lookupProducts(filterConfig, facets);
      const sortBy = document.getElementById('plp-sortby') ? document.getElementById('plp-sortby').dataset.sort : 'featured';
      results.sort(sorts[sortBy]);
      block.querySelector('#plp-results-count').textContent = results.length;
      displayResults(results, null);
      displayFacets(facets, filterConfig);
    };
  
    const fulltextElement = block.querySelector('#fulltext');
    fulltextElement.addEventListener('input', () => {
      runSearch(createFilterConfig());
    });
  
    if (!Object.keys(config).includes('fulltext')) {
      fulltextElement.style.display = 'none';
    }
  
    runSearch(config);
  }
  
  /**
   * Builds a product carousel from a block containing product links.
   * @param {HTMLElement} block - Block element
   * @param {Object} ph - Placeholder object with localized text strings
   * @returns {Promise<void>}
   */
  async function buildProductCarousel(block, ph) {
    const links = block.querySelectorAll('a[href]');
    const urls = [...links].map((a) => new URL(a.href).pathname);
    const products = await lookupProducts(urls);
  
    const elems = products.map((product) => createProductSlide(product, ph));
  
    const carousel = buildBlock('carousel', elems);
    carousel.classList.add(...block.classList);
    block.replaceWith(carousel);
    decorateBlock(carousel);
    await loadBlock(carousel);
    [...carousel.querySelectorAll('li')].forEach((li) => {
      li.addEventListener('click', () => {
        li.querySelector('a[href]').click();
      });
    });
  }
  
  export default async function decorate(block) {
    // const ph = await fetchPlaceholders();
    const ph = {};
    const config = readBlockConfig(block);
    const isCarousel = block.classList.contains('carousel');
  
    if (isCarousel) await buildProductCarousel(block, ph);
    else buildFiltering(block, ph, config);
  }