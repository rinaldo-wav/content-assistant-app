/**
 * Improved InlineChangeVisualizer
 * 
 * Enhances the visualization of AI suggested changes in the Quill editor
 * with cleaner text styling and integration with the AI Assistant UI
 */

window.InlineChangeVisualizer = class {
  constructor(quill) {
    this.quill = quill;
    this.originalContent = null;
    this.originalRange = null;
    this.changeControls = null;
    this.applyCallback = null;
    this.rejectCallback = null;
    this.messageElement = null; // Reference to AI message element
  }

  /**
   * Show suggested changes directly in the editor with cleaner styling
   * @param {Object} options Configuration options
   * @param {string} options.originalText Original text
   * @param {string} options.suggestedText Suggested text
   * @param {Object} options.range Quill range object {index, length}
   * @param {Function} options.onApply Callback when changes are applied
   * @param {Function} options.onReject Callback when changes are rejected
   * @param {HTMLElement} options.messageElement The AI message element to add controls to
   */
  showChanges(options) {
    // Store the original content and range
    this.originalContent = options.originalText;
    this.originalRange = options.range || this.quill.getSelection();
    this.messageElement = options.messageElement;
    
    if (!this.originalRange) {
      console.error("No range provided for change visualization");
      return;
    }
    
    // Temporarily insert suggested content with cleaner styling (no brackets)
    this.quill.deleteText(this.originalRange.index, this.originalRange.length);
    
    // Add styling for deletions (red strikethrough) without brackets
    this.quill.insertText(this.originalRange.index, options.originalText, { 
      color: '#E30613', 
      strike: true 
    });
    
    // Add a space between deletion and addition
    this.quill.insertText(this.originalRange.index + options.originalText.length, " ", {});
    
    // Add styling for additions (blue) without brackets
    this.quill.insertText(
      this.originalRange.index + options.originalText.length + 1, 
      options.suggestedText, 
      { color: '#109FCC' }
    );
    
    // Create and display controls in the AI Assistant message
    this.showChangeControlsInAssistant(options);
    
    // Store callbacks
    this.applyCallback = options.onApply;
    this.rejectCallback = options.onReject;
  }
  
  /**
   * Show controls for accepting/rejecting changes in the AI Assistant message
   */
  showChangeControlsInAssistant(options) {
    // Remove existing controls if any
    this.removeChangeControls();
    
    // If no message element is provided, fall back to the old behavior
    if (!this.messageElement) {
      return this.showChangeControls(options);
    }
    
    // Create container for controls within the AI message
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'option-buttons';
    controlsContainer.style.marginTop = '16px';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '8px';
    controlsContainer.style.flexWrap = 'wrap';
    
    // Create accept button
    const acceptButton = document.createElement('button');
    acceptButton.className = 'action-button';
    acceptButton.style.backgroundColor = '#36AD34';  // Green
    acceptButton.textContent = 'Accept Change';
    
    // Create reject button
    const rejectButton = document.createElement('button');
    rejectButton.className = 'action-button';
    rejectButton.style.backgroundColor = '#f5f5f5';
    rejectButton.style.color = '#333';
    rejectButton.textContent = 'Reject';
    
    // Add click handlers
    acceptButton.addEventListener('click', () => this.applyChanges(options.suggestedText));
    rejectButton.addEventListener('click', () => this.rejectChanges());
    
    // Assemble controls
    controlsContainer.appendChild(acceptButton);
    controlsContainer.appendChild(rejectButton);
    
    // Add to AI Assistant message
    this.messageElement.appendChild(controlsContainer);
    
    // Store reference to controls
    this.changeControls = controlsContainer;
  }
  
  /**
   * Legacy method to show controls at the bottom (fallback)
   */
  showChangeControls(options) {
    // Create container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'change-controls';
    controlsContainer.style.position = 'sticky';
    controlsContainer.style.bottom = '10px';
    controlsContainer.style.left = '50%';
    controlsContainer.style.transform = 'translateX(-50%)';
    controlsContainer.style.backgroundColor = 'white';
    controlsContainer.style.padding = '10px';
    controlsContainer.style.boxShadow = '0 -2px 6px rgba(0,0,0,0.1)';
    controlsContainer.style.zIndex = '100';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.justifyContent = 'center';
    controlsContainer.style.gap = '10px';
    controlsContainer.style.fontFamily = 'Montserrat, sans-serif';
    
    // Create message
    const message = document.createElement('div');
    message.textContent = 'AI Suggestion: ';
    message.style.marginRight = '10px';
    
    // Create accept button
    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Accept Change';
    acceptButton.style.backgroundColor = '#36AD34';
    acceptButton.style.color = 'white';
    acceptButton.style.border = 'none';
    acceptButton.style.padding = '8px 16px';
    acceptButton.style.cursor = 'pointer';
    
    // Create reject button
    const rejectButton = document.createElement('button');
    rejectButton.textContent = 'Reject';
    rejectButton.style.backgroundColor = '#f5f5f5';
    rejectButton.style.border = 'none';
    rejectButton.style.padding = '8px 16px';
    rejectButton.style.cursor = 'pointer';
    
    // Add click handlers
    acceptButton.addEventListener('click', () => this.applyChanges(options.suggestedText));
    rejectButton.addEventListener('click', () => this.rejectChanges());
    
    // Assemble controls
    controlsContainer.appendChild(message);
    controlsContainer.appendChild(acceptButton);
    controlsContainer.appendChild(rejectButton);
    
    // Add to editor
    const editorContainer = this.quill.root.parentNode.parentNode;
    editorContainer.appendChild(controlsContainer);
    
    // Store reference to controls
    this.changeControls = controlsContainer;
  }
  
  /**
   * Apply suggested changes
   */
  applyChanges(suggestedText) {
    if (!this.originalRange) return;
    
    // Calculate the length of visualization (original + space + suggested)
    const visualizationLength = this.originalContent.length + suggestedText.length + 1;
    
    // Delete the visualization
    this.quill.deleteText(this.originalRange.index, visualizationLength);
    
    // Insert just the suggested text
    this.quill.insertText(this.originalRange.index, suggestedText);
    
    // Remove controls
    this.removeChangeControls();
    
    // Call the callback if provided
    if (typeof this.applyCallback === 'function') {
      this.applyCallback(suggestedText);
    }
    
    // Trigger save
    setTimeout(() => {
      const event = new Event('text-change', { bubbles: true });
      this.quill.root.dispatchEvent(event);
    }, 100);
  }

  /**
   * Reject changes and restore original content
   */
  rejectChanges() {
    if (!this.originalRange || !this.originalContent) return;
    
    // Calculate visualization length (original + space + suggested)
    let visualizationLength = this.originalContent.length + 1; // Adding 1 for the space
    
    // Get the suggested text length
    let suggestedTextLength = 0;
    try {
      const suggestedTextStart = this.originalRange.index + this.originalContent.length + 1;
      const remainingText = this.quill.getText(suggestedTextStart);
      // Find where the blue text ends by checking for style changes
      const blueTextFormat = this.quill.getFormat(suggestedTextStart);
      
      for (let i = 0; i < remainingText.length; i++) {
        const currentFormat = this.quill.getFormat(suggestedTextStart + i);
        if (currentFormat.color !== blueTextFormat.color) {
          suggestedTextLength = i;
          break;
        }
      }
      
      if (suggestedTextLength === 0) {
        // If we couldn't determine the length, use a safer approach
        suggestedTextLength = 100; // A reasonable default
      }
    } catch (e) {
      console.error("Error getting suggested text length:", e);
      suggestedTextLength = 100; // Fallback length
    }
    
    visualizationLength += suggestedTextLength;
    
    // Delete the visualization
    this.quill.deleteText(this.originalRange.index, visualizationLength);
    
    // Restore the original text
    this.quill.insertText(this.originalRange.index, this.originalContent);
    
    // Remove controls
    this.removeChangeControls();
    
    // Call callback if provided
    if (typeof this.rejectCallback === 'function') {
      this.rejectCallback();
    }
  }
  
  /**
   * Remove change controls
   */
  removeChangeControls() {
    if (this.changeControls && this.changeControls.parentNode) {
      this.changeControls.parentNode.removeChild(this.changeControls);
    }
    this.changeControls = null;
  }
};
