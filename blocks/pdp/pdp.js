import renderAddToCart from "./add-to-cart.js";
import renderGallery from "./gallery.js";
import renderPricing, { extractPricing } from "./pricing.js";
import renderSpecs from './specs.js';
import { checkOutOfStock } from "../../scripts/scripts.js";

/**
 * Renders the title section of the PDP block.
 * @param {Element} block - The PDP block element
 * @returns {Element} The title container element
 */
function renderTitle(block, custom) {
  const titleContainer = document.createElement("div");
  titleContainer.classList.add("title");

  const { collection } = custom;
  const collectionContainer = document.createElement("p");
  collectionContainer.classList.add("pdp-collection-placeholder", "eyebrow");
  collectionContainer.textContent = `${collection || ""}`;

  titleContainer.append(
    collectionContainer,
    block.querySelector("h1:first-of-type")
  );

  return titleContainer;
}

/**
 * Renders the details section of the PDP block.
 * @param {Element} features - The features element from the fragment
 * @returns {Element} The details container element
 */
function renderDetails(features) {
  const detailsContainer = document.createElement('div');
  detailsContainer.classList.add('details');
  detailsContainer.append(...features.children);
  const h2 = document.createElement('h2');
  h2.textContent = 'About';
  detailsContainer.prepend(h2);
  // remove the h3 title
  const h3 = detailsContainer.querySelector('h3');
  if (h3) {
    h3.remove();
  }
  return detailsContainer;
}

function renderContent(block) {
  const { jsonLdData } = window;
  const { custom } = jsonLdData;

  block.querySelectorAll(":scope > div")?.forEach((div) => {
    // Temporary fix to remove divs that don't have a class
    // or the specifications block in initial html
    if (
      div.classList.length === 0 ||
      div.classList.contains("specifications")
    ) {
      div.remove();
    }
  });

  const { features } = window;
  if (features) {
    const detailsContainer = renderDetails(features);
    block.append(detailsContainer);
  }

  const { specifications } = window;
  if (specifications) {
    const specsContainer = renderSpecs(specifications, custom, jsonLdData.name);
    block.append(specsContainer);
  }
}

function renderFreeShipping(offers) {
  if (!offers[0] || offers[0].price < 150) return null;
  const freeShippingContainer = document.createElement("div");
  freeShippingContainer.classList.add("pdp-free-shipping-container");
  freeShippingContainer.innerHTML = `
      <img src="/icons/delivery.svg" alt="Free Shipping" />
      <span>Eligible for FREE shipping</span>
  `;
  return freeShippingContainer;
}

function renderAlert(block, custom) {
  try {
    const alertContainer = document.createElement("div");
    alertContainer.classList.add("pdp-alert");

    /* retired and coming soon */
    if (custom && custom.retired === "Yes") {
      alertContainer.innerText = "Retired Product";
      block.classList.add("pdp-retired");
      return alertContainer;
    }
    /* promos */
    const { promoButton } = custom;
    if (promoButton) {
      alertContainer.classList.add("pdp-promo-alert");
      alertContainer.innerText = promoButton;
      return alertContainer;
    }

    /* save now */
    const pricingElement = block.querySelector("p:nth-of-type(1)");
    const pricing = extractPricing(pricingElement);
    console.log("pricing", pricing);
    if (pricing.regular && pricing.regular > pricing.final) {
      alertContainer.classList.add("pdp-promo-alert");
      alertContainer.innerText = "Save Now!";
      return alertContainer;
    }

    block.dataset.alert = false;
    return null;
  } catch (e) {
    console.error("Error rendering alert", e);
    return null;
  }
}

function renderRelatedProducts(custom) {
  const { relatedSkus } = custom;
  const relatedProducts = relatedSkus || [];
  if (relatedProducts.length > 0) {
    const relatedProductsContainer = document.createElement("div");
    relatedProductsContainer.classList.add("pdp-related-products-container");
    const fillProducts = async () => {
      const products = await Promise.all(
        relatedProducts.map(async (url) => {
          const resp = await fetch(`${url}.json`);
          if (!resp.ok) return null;
          const json = await resp.json();
          json.url = url;
          return json;
        })
      );
      const currentRelatedProducts = products.filter(
        (product) => product && product.custom.retired === "No"
      );
      if (currentRelatedProducts.length > 0) {
        relatedProductsContainer.innerHTML = `
          <h2>Related Products</h2>
        `;
        const ul = document.createElement("ul");
        currentRelatedProducts.forEach((product) => {
          const li = document.createElement("li");
          const title = product.name;
          const image = new URL(product.images[0].url, window.location.href);
          const price = +product.price.final;
          li.innerHTML = `<a href="${
            product.url
          }"><img src="${image}?width=750&#x26;format=webply&#x26;optimize=medium" alt="${title}" /><div><p>${title}</p><strong>$${price.toFixed(
            2
          )}</strong></div></a>`;
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
  const shareContainer = document.createElement("div");
  shareContainer.classList.add("pdp-share-container");
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

  const galleryContainer = renderGallery(block, variants);
  const titleContainer = renderTitle(block, custom);
  const alertContainer = renderAlert(block, custom);
  const relatedProductsContainer = renderRelatedProducts(custom);

  const buyBox = document.createElement("div");
  buyBox.classList.add("pdp-buy-box");

  const pricingContainer = renderPricing(block);
  const addToCartContainer = renderAddToCart(block, jsonLdData);
  const freeShippingContainer = renderFreeShipping(offers);
  const shareContainer = renderShare();

  buyBox.append(
    pricingContainer,
    "", // options container
    addToCartContainer,
    freeShippingContainer || "",
    shareContainer
  );

  renderContent(block);

  block.append(
    alertContainer || "",
    titleContainer,
    galleryContainer,
    buyBox,
    relatedProductsContainer || ""
  );

  buyBox.dataset.sku = window.selectedVariant?.sku || offers[0].sku;
  buyBox.dataset.oos = checkOutOfStock(
    window.selectedVariant
      ? offers.find((offer) => offer.sku === window.selectedVariant.sku).sku
      : offers[0].sku
  );
}
