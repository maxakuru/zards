import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Creates the tab buttons for the specifications section.
 * @param {Array<{id: string, label: string}>} tabs - Array of tab objects with id and label.
 * @returns {HTMLDivElement} The container with tab buttons.
 */
function createTabButtons(tabs) {
  const tabButtons = document.createElement('div');
  tabButtons.classList.add('tabs');

  tabs.forEach((tab) => {
    const button = document.createElement('button');
    button.classList.add('tab');
    button.setAttribute('data-target', tab.id);
    button.textContent = tab.label;
    tabButtons.appendChild(button);
  });

  return tabButtons;
}

/**
 * Creates the content for the Specifications tab.
 * @param {HTMLElement} specifications - The specifications content to clone.
 * @returns {HTMLDivElement} The specifications content container.
 */
function createSpecificationsContent(specifications) {
  const container = document.createElement('div');
  container.classList.add('specifications-container');
  container.append(specifications);
  // remove the h3 title
  const h3 = container.querySelector('h3');
  if (h3) {
    h3.remove();
  }
  return container;
}

/**
 * Creates the tab content based on the provided tab object and JSON-LD data.
 * @param {Object} tab - The tab object with id and label.
 * @param {HTMLElement} specifications - The specifications content to clone.
 * @returns {HTMLDivElement} The content container for the tab.
 */
function createTabContent(tab, specifications) {
  const content = document.createElement('div');
  content.classList.add('tab-content');
  content.id = tab.id;

  switch (tab.id) {
    case 'specifications':
      if (specifications) {
        content.appendChild(createSpecificationsContent(specifications));
      }
      break;
    default:
      break;
  }

  return content;
}

/**
 * Attaches click event listeners to the tabs for switching content.
 * @param {HTMLElement} container - The container with tab buttons and content.
 */
function attachTabListeners(container) {
  const tabs = container.querySelectorAll('.tab');
  const contents = container.querySelectorAll('.tab-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      contents.forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-target');
      const targetContent = container.querySelector(`#${target}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Initializes the first tab as active upon rendering.
 * @param {HTMLElement} container
 */
function initializeTabs(container) {
  const tabs = container.querySelectorAll('.tab');
  const contents = container.querySelectorAll('.tab-content');

  if (tabs.length > 0) {
    tabs[0].classList.add('active');
    contents[0].classList.add('active');
  }
}

/**
 * Renders the specifications section of the PDP block.
 * @param {Element} specifications - The specifications content to clone.
 * @returns {Element}
 */
export default function renderSpecs(specifications) {
  const tabs = [
    { id: 'specifications', label: 'Specifications', show: !!specifications },
  ].filter((tab) => tab.show);

  // if there are no tabs, don't render anything
  if (tabs.length === 0) {
    return null;
  }

  const specsContainer = document.createElement('div');
  specsContainer.classList.add('tabs-container');

  const tabButtons = createTabButtons(tabs);
  specsContainer.appendChild(tabButtons);

  const contents = document.createElement('div');
  contents.classList.add('tab-contents');

  tabs.forEach((tab) => {
    const content = createTabContent(tab, specifications);
    contents.appendChild(content);
  });

  specsContainer.appendChild(contents);

  attachTabListeners(specsContainer);
  initializeTabs(specsContainer);

  return specsContainer;
}