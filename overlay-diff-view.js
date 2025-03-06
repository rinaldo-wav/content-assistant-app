/**
 * Overlay Diff View Component
 * Shows content changes with inline highlighting in a modal overlay
 */

// CSS for the overlay diff view
const overlayDiffStyles = `
.overlay-diff-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Montserrat', sans-serif;
}

.overlay-diff-modal {
  width: 90%;
  max-width: 800px;
  max-height: 80%;
  background-color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.overlay-diff-header {
  padding: 16px;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overlay-diff-title {
  font-weight: 600;
  font-size: 18px;
  color: #333;
}

.overlay-diff-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.overlay-diff-content {
  padding: 20px;
  overflow-y: auto;
}

.overlay-diff-content h1, 
.overlay-diff-content h2, 
.overlay-diff-content h3 {
  margin-top: 0.8em;
  margin-bottom: 0.5em;
}

.overlay-diff-content p {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.overlay-diff-content ul, 
.overlay-diff-content ol {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding-left: 20px;
}

.overlay-diff-footer {
  padding: 16px;
  border-top: 1px solid #e5e5e5;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.overlay-diff-btn {
  padding: 10px 16px;
  border: none;
  font-family: 'Montserrat', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.overlay-diff-apply-btn {
  background-color: #109FCC;
  color: white;
}

.overlay-diff-cancel-btn {
  background-color: #f5f5f5;
  color: #333;
}

.added-text {
  background-color: #e6ffed;
  padding: 2px 0;
}

.deleted-text {
  background-color: #ffeef0;
  text-decoration: line-through;
  color: #666;
  padding: 2px 0;
}

.change-summary {
  background-color: #f6f8fa;
  padding: 12px;
  margin-bottom: 16px;
  border-left: 4px solid #109FCC;
  font-size: 14px;
}
`;

class OverlayDiffView {
  constructor() {
    this.addStyles();
    this.container = null;
    this.callback = null;
  }

  addStyles() {
    if (!document.getElementById('overlay-diff-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'overlay-diff-styles';
      styleElement.textContent = overlayDiffStyles;
      document.head.appendChild(styleElement);
    }
  }

  /**
   * Show content changes in an overlay
   * @param {Object} options Configuration options
   * @param {string} options.suggestedContent Suggested HTML content
   * @param {string} options.description Description of the changes
   * @param {Function} options.onApply Callback when user applies changes
   * @param {string} options.changeType Type of change (headline, paragraph, etc.)
   */
  showChanges(options) {
    this.callback = options.onApply || (() => {});
    
    // Create and add the overlay to the document
    this.createOverlay(options);
  }

  createOverlay(options) {
    // Remove any existing overlay
    this.close();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'overlay-diff-container';

    // Create the overlay UI
    this.container.innerHTML = `
      <div class="overlay-diff-modal">
        <div class="overlay-diff-header">
          <div class="overlay-diff-title">${options.description || 'AI-suggested changes'}</div>
          <button class="overlay-diff-close">&times;</button>
        </div>
        <div class="overlay-diff-content">
          <div class="change-summary">
            Here's the improved content based on your request. 
            ${this.getChangeTypeSummary(options.changeType)}
          </div>
          <div class="highlighted-content">
            ${options.suggestedContent}
          </div>
        </div>
        <div class="overlay-diff-footer">
          <button class="overlay-diff-btn overlay-diff-cancel-btn">Cancel</button>
          <button class="overlay-diff-btn overlay-diff-apply-btn">Apply Changes</button>
        </div>
      </div>
    `;

    // Add to document
    document.body.appendChild(this.container);

    // Set up event listeners
    this.container.querySelector('.overlay-diff-close').addEventListener('click', () => this.close());
    this.container.querySelector('.overlay-diff-cancel-btn').addEventListener('click', () => this.close());
    this.container.querySelector('.overlay-diff-apply-btn').addEventListener('click', () => this.applyChanges(options.suggestedContent));
  }

  /**
   * Get a descriptive summary based on change type
   */
  getChangeTypeSummary(changeType) {
    const summaries = {
      'headline': 'The headline has been improved for better engagement.',
      'subtitle': 'A subtitle has been added to provide more context.',
      'expand': 'The content has been expanded with additional details.',
      'shorten': 'The content has been condensed while preserving key information.',
      'paragraph': 'A new paragraph has been added to enhance the content.',
      'lists': 'A list has been added to organize the information better.',
      'rewrite': 'The content has been rewritten for improved clarity and impact.'
    };
    
    return summaries[changeType] || 'Review the changes below.';
  }

  applyChanges(content) {
    if (typeof this.callback === 'function') {
      this.callback(content);
    }
    this.close();
  }

  close() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

// Export for use in the main application
window.OverlayDiffView = OverlayDiffView;
