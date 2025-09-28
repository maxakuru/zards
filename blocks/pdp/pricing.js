/**
 * Extracts pricing information from a given element.
 * @param {Element} element - The element containing the pricing information.
 * @returns {Object} An object containing the final price and regular price.
 */
export function extractPricing(element) {
  if (!element) return null;

  const pricingText = element.textContent.trim();

  // Matches price values in the format $XXX.XX (e.g. $399.95, $1,299.99)
  // \$ - matches literal dollar sign
  // ([\d,]+) - matches one or more digits or commas (for thousands)
  // \.\d{2} - matches decimal point followed by exactly 2 digits
  const priceMatch = pricingText.match(/\$([\d,]+\.\d{2})/g);

  if (!priceMatch) return null;

  const finalPrice = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
  const regularPrice = priceMatch[1] ? parseFloat(priceMatch[1].replace(/[$,]/g, '')) : null;

  return {
    final: finalPrice,
    regular: regularPrice,
  };
}

/**
 * Renders the pricing section of the PDP block.
 * @param {Element} block - The PDP block element
 * @returns {Element} The pricing container element
 */
export default function renderPricing(block, variant) {
  const pricingContainer = document.createElement('div');
  pricingContainer.classList.add('pricing');

  const pricingElement = block.querySelector('p:nth-of-type(1)');
  const pricing = variant ? variant.price : extractPricing(pricingElement);
  if (!pricing) {
    return null;
  }

  if (!variant) pricingElement.remove();

  if (pricing.regular && pricing.regular > pricing.final) {
    const nowLabel = document.createElement('div');
    nowLabel.className = 'pricing-now';
    nowLabel.textContent = 'Now';
    pricingContainer.appendChild(nowLabel);
  }

  const finalPrice = document.createElement('div');
  finalPrice.className = 'pricing-final';
  finalPrice.textContent = `$${pricing.final.toFixed(2)}`;
  pricingContainer.appendChild(finalPrice);

  if (pricing.regular && pricing.regular > pricing.final) {
    const savingsContainer = document.createElement('div');
    savingsContainer.className = 'pricing-savings';

    const savingsAmount = pricing.regular - pricing.final;
    const saveText = document.createElement('span');
    saveText.className = 'pricing-save';
    saveText.textContent = `Save $${savingsAmount.toFixed(2)} | `;

    const regularPrice = document.createElement('del');
    regularPrice.className = 'pricing-regular';
    regularPrice.textContent = `$${pricing.regular.toFixed(2)}`;

    savingsContainer.appendChild(saveText);
    savingsContainer.appendChild(regularPrice);
    pricingContainer.appendChild(savingsContainer);
  }

  const paymentsPlaceholder = document.createElement('div');
  paymentsPlaceholder.classList.add('pdp-payments-placeholder');
  pricingContainer.append(paymentsPlaceholder);

  return pricingContainer;
}
