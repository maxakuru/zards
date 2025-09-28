import { loadScript, toClassName, getMetadata } from '../../scripts/aem.js';
import renderAddToCart from './add-to-cart.js';
import renderGallery from './gallery.js';
import renderSpecs from './specification-tabs.js';
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

function renderFAQ() {
  const faqContainer = document.createElement('div');
  faqContainer.classList.add('faq-container');
  faqContainer.innerHTML = `
  <h4>Have a question?</h4>
  <ul>
    <li><a href="/faqs">Frequently Asked Questions</a></li>
    <li><a href="/contact">Contact Us</a></li>
  </ul>`;
  return faqContainer;
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
    <a rel="noopener noreferrer nofollow" class="pdp-share-email" href="mailto:?subject=Check this out&body=${url}"><img src="/icons/email.svg" alt="Email" /></a>
  `;
  return shareContainer;
}

async function renderFreeGift(offers) {
  try {
    const fetchGifts = async () => {
      const resp = await fetch('/us/en_us/products/config/free-gifts.plain.html');
      if (!resp.ok) return null;
      const text = await resp.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const gifts = doc.querySelector('.free-gifts');
      return [...gifts.children].map((gift) => {
        const [dates, minPrice, label, body] = gift.children;
        const datesText = dates.textContent;
        const minPriceText = minPrice.textContent.startsWith('$') ? minPrice.textContent.slice(1) : minPrice.textContent;
        const labelText = label.textContent;
        const bodyText = body.innerHTML.replaceAll('./media_', './config/media_');
        return {
          dates: datesText,
          minPrice: minPriceText,
          label: labelText,
          body: bodyText,
        };
      });
    };

    const gifts = await fetchGifts();
    const parseDateRange = (dates) => {
      const [startDateStr, endDateStr] = dates.split(' - ');

      // Helper function to parse individual date strings with time and timezone
      const parseDateWithTime = (dateStr) => {
        // Handle formats like "9/12/2025 9am EDT" or "9/19/2025 3pm EDT"
        const timeMatch = dateStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2})(am|pm)\s+([A-Z]{3,4})$/);

        if (timeMatch) {
          const [, datePart, hour, ampm, timezone] = timeMatch;

          // Parse the date part (M/D/YYYY)
          const [month, day, year] = datePart.split('/').map((num) => parseInt(num, 10));

          // Convert hour to 24-hour format
          let hour24 = parseInt(hour, 10);
          if (ampm.toLowerCase() === 'pm' && hour24 !== 12) {
            hour24 += 12;
          } else if (ampm.toLowerCase() === 'am' && hour24 === 12) {
            hour24 = 0;
          }

          // Handle timezone offset (simplified - you might want to use a proper timezone library)
          // For now, we'll assume EDT is UTC-4 (Eastern Daylight Time)
          const timezoneOffsets = {
            EDT: -4, // UTC-4 hours
            EST: -5, // UTC-5 hours
            CDT: -5, // UTC-5 hours
            CST: -6, // UTC-6 hours
            MDT: -6, // UTC-6 hours
            MST: -7, // UTC-7 hours
            PDT: -7, // UTC-7 hours
            PST: -8, // UTC-8 hours
          };

          const offsetHours = timezoneOffsets[timezone] || 0;

          // Convert the local time to UTC by adding the offset
          // If EDT is UTC-4, then 9am EDT = 1pm UTC (9 + 4 = 13)
          const utcHour = hour24 - offsetHours;

          // Create UTC date object directly
          const utcDate = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0));

          return utcDate;
        }

        // Fallback to simple date parsing for formats without time/timezone
        return new Date(dateStr);
      };

      return [parseDateWithTime(startDateStr), parseDateWithTime(endDateStr)];
    };

    const findGift = (giftList, price) => giftList.find((gift) => {
      const [startDate, endDate] = parseDateRange(gift.dates);
      const today = new Date();
      return today >= startDate && today <= endDate
        && price >= +gift.minPrice;
    });
    const gift = findGift(gifts, +offers[0].price);
    if (gift) {
      const freeGiftContainer = document.createElement('div');
      freeGiftContainer.classList.add('pdp-free-gift-container');
      freeGiftContainer.innerHTML = `
        <div class="pdp-free-gift-heading"><span>${gift.label}</span></div>
        <div class="pdp-free-gift-body">
          ${gift.body}
        </div>
      `;
      return freeGiftContainer;
    }
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching free gifts:', error);
    return null;
  }
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
  const freeGiftContainer = await renderFreeGift(offers);
  const freeShippingContainer = renderFreeShipping(offers);
  const shareContainer = renderShare();
  buyBox.append(
    pricingContainer,
    optionsContainer || '',
    freeGiftContainer || '',
    addToCartContainer,
    '',
    freeShippingContainer || '',
    shareContainer,
  );

  const detailsContainer = renderDetails(block);
  const specifications = detailsContainer.querySelector('.specifications');
  const specsContainer = renderSpecs(specifications, custom, jsonLdData.name);
  specifications.remove();

  const contentContainer = renderContent(detailsContainer);
  const faqContainer = renderFAQ(block);

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
    specsContainer,
    faqContainer,
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
