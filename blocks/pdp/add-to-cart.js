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
    if (atcBtnPos < 0 || (container.classList.contains("fixed") && ogBtnPos && scrollY > ogBtnPos)) {
      if(!ogBtnPos) {
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
 * Handles product variants, warranties, bundles, and cart integration with Magento.
 * Falls back to "Find Locally" or "Find Dealer" buttons based on product configuration.
 * @param {HTMLElement} block - PDP block element
 * @param {Object} parent - Parent product object
 * @returns {HTMLElement} Container div with either add to cart functionality or alternative buttons
 */
export default function renderAddToCart(block, parent) {
  // Default selectedVariant to parent product, if simple product, selectedVariant will be undefined
  let selectedVariant = parent.offers?.[0]?.custom ? parent.offers[0] : parent;
  if (window.selectedVariant) {
    // If we actually have a selected variant, use it instead of the parent product
    const { sku: selectedSku } = window.selectedVariant;
    selectedVariant = parent.offers.find(
      (variant) => variant.sku === selectedSku
    );
  }

  // Only look at findLocally and findDealer from parent product
  const { findLocally, findDealer } = parent;
  block.classList.remove("pdp-find-locally");
  block.classList.remove("pdp-find-dealer");

  // Figure out if the selected variant is available for sale
  const isAvailableForSale = isVariantAvailableForSale(selectedVariant);

  // If we have a selected variant, use it's custom object,
  // otherwise use the parent product's custom object
  const { custom } = selectedVariant || parent;

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

  // assemble the quantity container with select and button
  quantityContainer.appendChild(addToCartButton);

  // add quantity container to main add to cart container
  addToCartContainer.appendChild(quantityContainer);

  toggleFixedAddToCart(addToCartContainer);

  // add click event handler for add to cart functionality
  addToCartButton.addEventListener("click", async () => {
    // update button state to show loading
    addToCartButton.textContent = "Adding...";
    addToCartButton.setAttribute("aria-disabled", "true");

    // import required modules for cart functionality
    const { cartApi } = await import("../../scripts/minicart/api.js");

    // get selected quantity and product SKU
    const quantity =
      document.querySelector(".quantity-container select")?.value || 1;
    const sku = getMetadata("sku");

    // build array of selected options (variants, warranties, required bundles)
    const selectedOptions = [];

    // add selected variant option if available
    if (window.selectedVariant?.options?.uid) {
      selectedOptions.push(window.selectedVariant.options.uid);
    }

    // add product to cart with selected options and quantity
    await cartApi.addToCart(sku, selectedOptions, quantity);

    // update button state to show ATC
    addToCartButton.textContent = "Add to Cart";
    addToCartButton.removeAttribute("aria-disabled");
  });

  return addToCartContainer;
}
