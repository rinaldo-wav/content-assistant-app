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
  },

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
  },
  
  /**
   * Show just inserted content without deletion visualization
   * @param {Object} options Configuration options
   */
  showInsertedContent(options) {
    // Store the insertion point
    this.originalRange = { index: options.index, length: 0 };
    this.messageElement = options.messageElement;
    
    // For pure insertion, just add the new text in blue
    this.quill.insertText(
      options.index, 
      "\n\n" + options.suggestedText, 
      { color: '#109FCC' } // Blue color for new content
    );
    
    // Create and display controls in the AI Assistant message
    this.showChangeControlsInAssistant(options);
    
    // Store callbacks
    this.applyCallback = options.onApply;
    this.rejectCallback = options.onReject;
  },
  
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
    acceptButton.style.color = 'white';
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
  },
  
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
  },
  
  /**
   * Apply suggested changes
   */
  applyChanges(suggestedText) {
    if (!this.originalRange) return;
    
    // Check if this is an append/insert operation (length = 0)
    const isInsertOperation = this.originalRange.length === 0;
    
    if (isInsertOperation) {
      // For insert operations, we don't need to delete anything
      // Just remove the blue styling
      const insertionLength = (suggestedText.length + 2); // +2 for the newlines
      this.quill.formatText(this.originalRange.index, insertionLength, { color: null });
      
      console.log('Applied insertion without deletion');
    } else {
      // For replace operations, delete the visualization and insert the suggested text
      // Calculate the total visualization length (original + space + suggested)
      const visualizationLength = this.originalContent.length + 1 + suggestedText.length;
      
      // Delete the visualization
      this.quill.deleteText(this.originalRange.index, visualizationLength);
      
      // Insert just the suggested text
      this.quill.insertText(this.originalRange.index, suggestedText);
      
      console.log('Applied replacement of content');
    }
    
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
  },

  /**
   * Reject changes and restore original content
   */
  rejectChanges() {
    if (!this.originalRange) return;
    
    // Check if this is an insert operation (length = 0)
    const isInsertOperation = this.originalRange.length === 0;
    
    if (isInsertOperation) {
      // For insertions, just remove the inserted content
      // Find the blue text block
      const startIndex = this.originalRange.index;
      let endIndex = startIndex;
      
      // Find where the blue text ends
      const text = this.quill.getText(startIndex);
      for (let i = 0; i < text.length; i++) {
        const format = this.quill.getFormat(startIndex + i);
        if (!format.color || format.color !== '#109FCC') {
          if (i > 0) break;
        }
        endIndex++;
      }
      
      // Delete the inserted content (plus newlines)
      this.quill.deleteText(startIndex, endIndex - startIndex + 2);
    } else {
      // For replacements, we need the original content
      if (!this.originalContent) {
        console.error("Cannot reject changes - original content not available");
        return;
      }
      
      // Calculate a safe maximum length
      const maxLength = Math.max(
        500, // Some reasonable maximum
        this.originalContent.length * 3 // 3x the original text length
      );
      
      // Delete everything from the beginning of the range
      this.quill.deleteText(this.originalRange.index, maxLength);
      
      // Restore the original text
      this.quill.insertText(this.originalRange.index, this.originalContent);
    }
    
    // Remove controls
    this.removeChangeControls();
    
    // Call callback if provided
    if (typeof this.rejectCallback === 'function') {
      this.rejectCallback();
    }
  },
  
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
