import { loadScript, toClassName, getMetadata } from '../../scripts/aem.js';
import renderAddToCart from './add-to-cart.js';
import renderGallery from './gallery.js';
import renderPricing, { extractPricing } from './pricing.js';
// eslint-disable-next-line import/no-cycle
import { renderOptions, onOptionChange } from './options.js';
import { loadFragment } from '../fragment/fragment.js';
import { checkOutOfStock } from '../../scripts/scripts.js';
import { openModal } from '../modal/modal.js';

/**
 * Renders the title section of the PDP block.
 * @param {Element} block - The PDP block element
 * @returns {Element} The title container element
 */
function renderTitle(block, custom, reviewsId) {
  const titleContainer = document.createElement('div');
  titleContainer.classList.add('title');

  const reviewsPlaceholder = document.createElement('div');
  reviewsPlaceholder.classList.add('pdp-reviews-summary-placeholder');
  reviewsPlaceholder.innerHTML = `<div data-bv-show="rating_summary" data-bv-product-id="${reviewsId}">`;

  const { collection } = custom;
  const collectionContainer = document.createElement('p');
  collectionContainer.classList.add('pdp-collection-placeholder', 'eyebrow');
  collectionContainer.textContent = `${collection || ''}`;

  titleContainer.append(
    collectionContainer,
    block.querySelector('h1:first-of-type'),
    reviewsPlaceholder,
  );

  return titleContainer;
}

/**
 * Renders the details section of the PDP block.
 * @param {Element} block - The PDP block element
 * @returns {Element} The details container element
 */
function renderDetails(block) {
  const detailsContainer = document.createElement('div');
  detailsContainer.classList.add('details');
  detailsContainer.append(...block.children);
  const h2 = document.createElement('h2');
  h2.textContent = 'About';
  detailsContainer.prepend(h2);
  return detailsContainer;
}

function renderContent(detailsContainer) {
  const contentContainer = document.createElement('div');
  contentContainer.classList.add('pdp-content-fragment');
  const fragmentPath = window.location.pathname.replace('/products/', '/products/fragments/');
  const insertFragment = async () => {
    const fragment = await loadFragment(fragmentPath);
    if (fragment) {
      const sections = [...fragment.querySelectorAll('main > div.section')];
      while (sections.length > 0) {
        const section = sections.shift();
        if (section.querySelector('h3#features')) {
          detailsContainer.innerHTML = '<h2>About</h2>';
          detailsContainer.append(section);
        } else {
          contentContainer.append(section);
        }
      }
    }
  };
  insertFragment();
  return contentContainer;
}

function renderFreeShipping(offers) {
  if (!offers[0] || offers[0].price < 150) return null;
  const freeShippingContainer = document.createElement('div');
  freeShippingContainer.classList.add('pdp-free-shipping-container');
  freeShippingContainer.innerHTML = `
      <img src="/icons/delivery.svg" alt="Free Shipping" />
      <span>Eligible for FREE shipping</span>
  `;
  return freeShippingContainer;
}

function renderAlert(block, custom) {
  const alertContainer = document.createElement('div');
  alertContainer.classList.add('pdp-alert');

  /* retired and coming soon */
  if (custom && custom.retired === 'Yes') {
    alertContainer.innerText = 'Retired Product';
    block.classList.add('pdp-retired');
    return alertContainer;
  }
  /* promos */
  const { promoButton } = custom;
  if (promoButton) {
    alertContainer.classList.add('pdp-promo-alert');
    alertContainer.innerText = promoButton;
    return alertContainer;
  }

  /* save now */
  const pricingElement = block.querySelector('p:nth-of-type(1)');
  const pricing = extractPricing(pricingElement);
  if (pricing.regular && pricing.regular > pricing.final) {
    alertContainer.classList.add('pdp-promo-alert');
    alertContainer.innerText = 'Save Now!';
    return alertContainer;
  }

  block.dataset.alert = false;
  return null;
}

function renderRelatedProducts(custom) {
  const { relatedSkus } = custom;
  const relatedProducts = relatedSkus || [];
  if (relatedProducts.length > 0) {
    const relatedProductsContainer = document.createElement('div');
    relatedProductsContainer.classList.add('pdp-related-products-container');
    const fillProducts = async () => {
      const products = await Promise.all(relatedProducts.map(async (url) => {
        const resp = await fetch(`${url}.json`);
        if (!resp.ok) return null;
        const json = await resp.json();
        json.url = url;
        return json;
      }));
      const currentRelatedProducts = products.filter((product) => product && product.custom.retired === 'No');
      if (currentRelatedProducts.length > 0) {
        relatedProductsContainer.innerHTML = `
          <h2>Related Products</h2>
        `;
        const ul = document.createElement('ul');
        currentRelatedProducts.forEach((product) => {
          const li = document.createElement('li');
          const title = product.name;
          const image = new URL(product.images[0].url, window.location.href);
          const price = +product.price.final;
          li.innerHTML = `<a href="${product.url}"><img src="${image}?width=750&#x26;format=webply&#x26;optimize=medium" alt="${title}" /><div><p>${title}</p><strong>$${price.toFixed(2)}</strong></div></a>`;
          ul.appendChild(li);
        });
        relatedProductsContainer.appendChild(ul);
      }
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          fillProducts();
          io.disconnect();
        }
      });
    });
    io.observe(relatedProductsContainer);
    return relatedProductsContainer;
  }
  return null;
}

function renderShare() {
  const shareContainer = document.createElement('div');
  shareContainer.classList.add('pdp-share-container');
  const url = decodeURIComponent(window.location.href);
  shareContainer.innerHTML = `
    Share: 
    <a rel="noopener noreferrer nofollow" href="https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${url}"><img src="/icons/facebook.svg" alt="Facebook" /></a>
    <a rel="noopener noreferrer nofollow" href="https://www.twitter.com/share?url=${url}"><img src="/icons/x.svg" alt="X" /></a>
    <a rel="noopener noreferrer nofollow" href="https://www.pinterest.com/pin/create/button/?url=${url}"><img src="/icons/pinterest.svg" alt="Pinterest" /></a>
    <a rel="noopener noreferrer nofollow" class="pdp-share-email" href="mailto:hi@zards.cards?subject=Check this out&body=${url}"><img src="/icons/email.svg" alt="Email" /></a>
  `;
  return shareContainer;
}

/**
 * Decorates the PDP block.
 * @param {Element} block - The PDP block element
 */
export default async function decorate(block) {
  const { jsonLdData, variants } = window;
  const { custom, offers } = jsonLdData;

  const reviewsId = custom.reviewsId || toClassName(getMetadata('sku')).replace(/-/g, '');
  const galleryContainer = renderGallery(block, variants);
  const titleContainer = renderTitle(block, custom, reviewsId);
  const alertContainer = renderAlert(block, custom);
  const relatedProductsContainer = renderRelatedProducts(custom);

  const buyBox = document.createElement('div');
  buyBox.classList.add('pdp-buy-box');

  const pricingContainer = renderPricing(block);
  const optionsContainer = renderOptions(block, variants, custom);
  const addToCartContainer = renderAddToCart(block, jsonLdData);
  const freeShippingContainer = renderFreeShipping(offers);
  const shareContainer = renderShare();
  buyBox.append(
    pricingContainer,
    optionsContainer || '',
    '', // free gift container
    addToCartContainer,
    '',
    freeShippingContainer || '',
    shareContainer,
  );

  const detailsContainer = renderDetails(block);
  const contentContainer = renderContent(detailsContainer);

  /* remove buttons styling from details */
  detailsContainer.querySelectorAll('.button').forEach((button) => {
    button.classList.remove('button');
    button.parentElement.classList.remove('button-wrapper');
  });

  block.append(
    alertContainer || '',
    titleContainer,
    galleryContainer,
    buyBox,
    contentContainer,
    detailsContainer,
    '',
    '',
    relatedProductsContainer || '',
  );

  const queryParams = new URLSearchParams(window.location.search);
  const color = queryParams.get('color');

  if (color) {
    onOptionChange(block, variants, color);
  } else if (variants.length > 0) {
    [window.selectedVariant] = variants;
  }

  buyBox.dataset.sku = window.selectedVariant?.sku || offers[0].sku;
  buyBox.dataset.oos = checkOutOfStock(
    window.selectedVariant
      ? offers.find((offer) => offer.sku === window.selectedVariant.sku).sku
      : offers[0].sku,
  );
}
