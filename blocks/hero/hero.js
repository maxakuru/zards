import { buildVideo } from '../../scripts/scripts.js';

export default function decorate(block) {
  // set background
  buildVideo(block);

  const disclaimer = block.querySelector('.disclaimer');
  if (disclaimer) {
    block.dataset.disclaimer = disclaimer.textContent;
  }
}