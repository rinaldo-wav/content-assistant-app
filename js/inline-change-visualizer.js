/**
 * InlineChangeVisualizer
 * 
 * Provides inline visualization of AI suggested changes in the Quill editor
 * with color-coded additions and deletions and buttons to accept/reject changes.
 */

window.InlineChangeVisualizer = class {
  constructor(quill) {
    this.quill = quill;
    this.originalContent = null;
    this.originalRange = null;
    this.changeControls = null;
    this.applyCallback = null;
    this.rejectCallback = null;
  }

  /**
   * Show suggested changes directly in the editor
   * @param {Object} options Configuration options
   * @param {string} options.originalText Original text
   * @param {string} options.suggestedText Suggested text
   * @param {Object} options.range Quill range object {index, length}
   * @param {Function} options.onApply Callback when changes are applied
   * @param {Function} options.onReject Callback when changes are rejected
   */
  showChanges(options) {
    // Store the original content and range
    this.originalContent = options.originalText;
    this.originalRange = options.range || this.quill.getSelection();
    
    if (!this.originalRange) {
      console.error("No range provided for change visualization");
      return;
    }
    
    // Temporarily insert suggested content with custom colors
    this.quill.deleteText(this.originalRange.index, this.originalRange.length);
    
    // Add styling for deletions (red) and additions (blue)
    this.quill.insertText(this.originalRange.index, "⟦", { color: '#E30613', bold: true });
    this.quill.insertText(this.originalRange.index + 1, options.originalText, { color: '#E30613', strike: true });
    this.quill.insertText(this.originalRange.index + options.originalText.length + 1, "⟧", { color: '#E30613', bold: true });
    
    this.quill.insertText(this.originalRange.index + options.originalText.length + 2, " ⟦", { color: '#109FCC', bold: true });
    this.quill.insertText(this.originalRange.index + options.originalText.length + 4, options.suggestedText, { color: '#109FCC' });
    this.quill.insertText(this.originalRange.index + options.originalText.length + 4 + options.suggestedText.length, "⟧", { color: '#109FCC', bold: true });
    
    // Create and display controls
    this.showChangeControls(options);
    
    // Store callbacks
    this.applyCallback = options.onApply;
    this.rejectCallback = options.onReject;
  }
  
  /**
   * Show controls for accepting/rejecting changes
   */
  showChangeControls(options) {
    // Remove existing controls if any
    this.removeChangeControls();
    
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
    
    // Calculate the length of visualization
    const visualizationLength = this.originalContent.length * 2 + suggestedText.length + 6; // +6 for brackets
    
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
    
    // Calculate visualization length
    const suggestedTextIndex = this.originalContent.length + 3; // Start after original text + brackets
    let suggestedText = '';
    
    try {
      suggestedText = this.quill.getText(
        this.originalRange.index + suggestedTextIndex,
        this.originalRange.length || 50
      );
    } catch (e) {
      console.error("Error getting suggested text:", e);
    }
    
    const visualizationLength = this.originalContent.length * 2 + (suggestedText?.length || 0) + 6; // +6 for brackets
    
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
