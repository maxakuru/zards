import { getMetadata } from "../../scripts/aem.js";
import { checkOutOfStock } from "../../scripts/scripts.js";

/**
 * Toggles "fixed" class on "Add to Cart" container when the user scrolls past the atc button.
 * @param {HTMLElement} container - "Add to Cart" container
 */
function toggleFixedAddToCart(container) {
  const rootStyles = getComputedStyle(document.documentElement);
  const headerHeight =
    parseInt(rootStyles.getPropertyValue("--header-height"), 10) || 0;
  const atcButton = container.querySelector("button");
  let ogBtnPos;

  window.addEventListener("scroll", () => {
    // disable fixed behavior on desktop
    if (window.innerWidth >= 900) {
      container.classList.remove("fixed");
      container.removeAttribute("style");
      return;
    }

    const { scrollY } = window;
    const atcBtnPos = atcButton.getBoundingClientRect().bottom;

    // apply or remove "fixed" class and dynamic top offset
    if (
      atcBtnPos < 0 ||
      (container.classList.contains("fixed") && ogBtnPos && scrollY > ogBtnPos)
    ) {
      if (!ogBtnPos) {
        ogBtnPos = scrollY;
      }
      const offset = Math.max(headerHeight - scrollY, 0);
      container.classList.add("fixed");
      container.style.top = `${offset}px`;
    } else {
      ogBtnPos = undefined;
      container.classList.remove("fixed");
      container.removeAttribute("style");
    }
  });
}

/**
 * Checks if a variant is available for sale.
 * @param {Object} variant - The variant object
 * @returns {boolean} True if the variant is available for sale, false otherwise
 */
export function isVariantAvailableForSale(variant) {
  const { managedStock, addToCart } = variant.custom;
  if (!variant || addToCart === "No") {
    return false;
  }

  if (managedStock === "0") {
    return true;
  }

  return !checkOutOfStock(variant.sku);
}

/**
 * Renders the main add to cart functionality with quantity selector and add to cart button.
 * @param {Object} product - product data
 * @param {string} variantSku - if undefined uses the first offer
 * @returns {HTMLElement} Container div with either add to cart functionality or alternative buttons
 */
export default function renderAddToCart(product, variantSku) {
  // find the applicable offer
  let offer = product.offers?.[0];
  if (variantSku) {
    offer = product.offers.find((variant) => variant.sku === variantSku);
  }

  const custom = {
    ...(product.custom || {}),
    ...(offer.custom || {}),
  };

  // create main add to cart container
  const addToCartContainer = document.createElement("div");
  addToCartContainer.classList.add("add-to-cart");

  // create and configure quantity label
  const quantityLabel = document.createElement("label");
  quantityLabel.textContent = "Quantity:";
  quantityLabel.classList.add("pdp-quantity-label");
  quantityLabel.htmlFor = "pdp-quantity-select";
  addToCartContainer.appendChild(quantityLabel);

  // create quantity selection container and dropdown
  const quantityContainer = document.createElement("div");
  quantityContainer.classList.add("quantity-container");
  const quantitySelect = document.createElement("select");
  quantitySelect.id = "pdp-quantity-select";

  // set maximum quantity (default to 3 if not specified)
  const maxQuantity = custom.maxCartQty ? +custom.maxCartQty : 3;

  // populate quantity dropdown with options from 1 to maxQuantity
  for (let i = 1; i <= maxQuantity; i += 1) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    quantitySelect.appendChild(option);
  }
  quantityContainer.appendChild(quantitySelect);

  // create and configure add to cart button
  const addToCartButton = document.createElement("button");
  addToCartButton.textContent = "Add to Cart";
  quantityContainer.appendChild(addToCartButton);
  addToCartContainer.appendChild(quantityContainer);

  toggleFixedAddToCart(addToCartContainer);

  // add click event handler for add to cart functionality
  addToCartButton.addEventListener("click", async () => {
    // disable button
    addToCartButton.textContent = "Adding...";
    addToCartButton.setAttribute("aria-disabled", "true");

    const cartApi = (await import("../../scripts/cart.js")).default;

    const quantity = quantitySelect?.value ? +quantitySelect.value : 1;
    const { sku, price, name } = offer;
    await cartApi.addItem({ 
      sku, 
      quantity, 
      price, 
      name, 
      urlKey: custom.urlKey,
      image: offer.image[0],
      square_item_id: custom.square_item_id,
      square_variation_id: custom.square_variation_id,
     });

    // reenable button
    addToCartButton.textContent = "Add to Cart";
    addToCartButton.removeAttribute("aria-disabled");
  });

  return addToCartContainer;
}
