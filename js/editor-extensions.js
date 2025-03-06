/**
 * Editor Extensions - Adds AI capabilities to the editor
 * 
 * This module is responsible for:
 * - Adding AI Assistant buttons for text selection
 * - Handling text selection in the editor
 * - Communicating with the AI Assistant
 */

(function() {
  // Variables
  let selectionTimeout;
  let aiDiscussButton, aiImproveButton;
  
  // Initialize when editor is ready
  document.addEventListener('editor-initialized', function(event) {
    console.log('Editor initialized, setting up extensions');
    
    // Create AI buttons
    createAIButtons();
    
    // Set up selection handling
    setupSelectionHandling();
    
    // Set up integration with AI Assistant
    setupAIAssistantIntegration();
  });
  
  /**
   * Create AI Assistant buttons
   */
  function createAIButtons() {
    // Create Discuss button if it doesn't exist
    if (!document.querySelector('.ai-discuss')) {
      aiDiscussButton = document.createElement('button');
      aiDiscussButton.className = 'ai-assistant-button ai-discuss';
      aiDiscussButton.textContent = 'Discuss with AI';
      aiDiscussButton.style.display = 'none';
      document.body.appendChild(aiDiscussButton);
    } else {
      aiDiscussButton = document.querySelector('.ai-discuss');
    }
    
    // Create Improve button if it doesn't exist
    if (!document.querySelector('.ai-improve')) {
      aiImproveButton = document.createElement('button');
      aiImproveButton.className = 'ai-assistant-button ai-improve';
      aiImproveButton.textContent = 'Improve';
      aiImproveButton.style.display = 'none';
      document.body.appendChild(aiImproveButton);
    } else {
      aiImproveButton = document.querySelector('.ai-improve');
    }
    
    // Set up button click handlers
    setupButtonClickHandlers();
  }
  
  /**
   * Set up click handlers for AI buttons
   */
  function setupButtonClickHandlers() {
    // Skip if already set up
    if (aiDiscussButton.dataset.handlerSet) return;
    
    // Handle Discuss button click
    aiDiscussButton.addEventListener('click', function() {
      const selectedText = aiDiscussButton.dataset.selectedText;
      let quillRange = null;
      
      // Parse stored range information
      try {
        if (aiDiscussButton.dataset.quillRange) {
          quillRange = JSON.parse(aiDiscussButton.dataset.quillRange);
        }
      } catch (e) {
        console.error("Error parsing quill range:", e);
      }
      
      if (selectedText) {
        const aiAssistant = document.querySelector('.assistant-container');
        if (aiAssistant) {
          // Scroll to AI assistant
          aiAssistant.scrollIntoView({ behavior: 'smooth' });
          
          // Pre-populate message input
          const messageInput = aiAssistant.querySelector('.message-input');
          if (messageInput) {
            messageInput.value = `Let's discuss how to improve this text`;
            messageInput.focus();
            
            // Simulate input event to adjust height
            messageInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Send selection to AI Assistant
          window.postMessage({
            type: 'selectedText',
            text: selectedText,
            mode: 'discuss',
            range: quillRange
          }, '*');
        } else {
          console.warn('AI Assistant not found on the page');
          displayMessage('AI Assistant not found on the page', 'error');
        }
        
        // Hide buttons
        hideSelectionButtons();
      }
    });
    
    // Handle Improve button click
    aiImproveButton.addEventListener('click', function() {
      const selectedText = aiImproveButton.dataset.selectedText;
      let quillRange = null;
      
      // Parse stored range information
      try {
        if (aiImproveButton.dataset.quillRange) {
          quillRange = JSON.parse(aiImproveButton.dataset.quillRange);
        }
      } catch (e) {
        console.error("Error parsing quill range:", e);
      }
      
      if (selectedText) {
        const aiAssistant = document.querySelector('.assistant-container');
        if (aiAssistant) {
          // Scroll to AI assistant
          aiAssistant.scrollIntoView({ behavior: 'smooth' });
          
          // Send selection to AI Assistant
          window.postMessage({
            type: 'selectedText',
            text: selectedText,
            mode: 'improve',
            range: quillRange
          }, '*');
          
          // Auto-send improve request
          const sendButton = aiAssistant.querySelector('.send-button');
          if (sendButton) {
            // Set input text
            const messageInput = aiAssistant.querySelector('.message-input');
            if (messageInput) {
              messageInput.value = "Improve this text with specific suggestions";
              
              // Click send button
              setTimeout(() => {
                sendButton.click();
              }, 100);
            }
          }
        } else {
          console.warn('AI Assistant not found on the page');
          displayMessage('AI Assistant not found on the page', 'error');
        }
        
        // Hide buttons
        hideSelectionButtons();
      }
    });
    
    // Hide buttons when clicking elsewhere
    document.addEventListener('click', function(event) {
      const editorElement = document.querySelector('.ql-editor');
      if (event.target !== aiDiscussButton && 
          event.target !== aiImproveButton && 
          (!editorElement || !editorElement.contains(event.target))) {
        hideSelectionButtons();
      }
    });
    
    // Mark as set up
    aiDiscussButton.dataset.handlerSet = 'true';
    aiImproveButton.dataset.handlerSet = 'true';
  }
  
  /**
   * Set up handlers for text selection in the editor
   */
  function setupSelectionHandling() {
    const editorElement = document.querySelector('.ql-editor');
    if (!editorElement) {
      console.warn("Editor element not found for selection handling");
      return;
    }
    
    // Handle selection via mouse
    editorElement.addEventListener('mouseup', function() {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(handleEditorSelection, 200);
    });
    
    // Handle selection via keyboard
    editorElement.addEventListener('keyup', function(e) {
      if (e.shiftKey || e.key === 'Shift') {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(handleEditorSelection, 200);
      }
    });
    
    // Hide buttons when starting new selection
    editorElement.addEventListener('mousedown', function(event) {
      if (event.target !== aiDiscussButton && event.target !== aiImproveButton) {
        hideSelectionButtons();
      }
    });
  }
  
  /**
   * Handle text selection in the editor
   */
  function handleEditorSelection() {
    const selection = window.getSelection();
    
    // No selection or empty selection
    if (!selection || selection.toString().trim().length === 0) {
      hideSelectionButtons();
      return;
    }
    
    // Get selection range
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Verify selection is in editor
    const editorElement = document.querySelector('.ql-editor');
    if (!editorElement) return;
    
    const editorRect = editorElement.getBoundingClientRect();
    
    if (rect.top < editorRect.top || rect.bottom > editorRect.bottom) {
      hideSelectionButtons();
      return;
    }
    
    // Position the buttons below selection
    const buttonsTop = window.scrollY + rect.bottom + 10;
    const buttonsLeft = window.scrollX + rect.left;
    
    // Position Discuss button
    aiDiscussButton.style.top = `${buttonsTop}px`;
    aiDiscussButton.style.left = `${buttonsLeft}px`;
    aiDiscussButton.style.display = 'block';
    
    // Position Improve button
    aiImproveButton.style.top = `${buttonsTop}px`;
    aiImproveButton.style.left = `${buttonsLeft + 120}px`;
    aiImproveButton.style.display = 'block';
    
    // Get selection HTML
    const selectedHtml = getSelectionHtml();
    
    // Store Quill range information if available
    if (window.editorQuill) {
      const quillRange = window.editorQuill.getSelection();
      if (quillRange) {
        // Store as JSON string to prevent circular reference
        const rangeString = JSON.stringify({
          index: quillRange.index,
          length: quillRange.length
        });
        
        // Save to button data
        aiDiscussButton.dataset.quillRange = rangeString;
        aiImproveButton.dataset.quillRange = rangeString;
      }
    }
    
    // Store selected text
    aiDiscussButton.dataset.selectedText = selectedHtml;
    aiImproveButton.dataset.selectedText = selectedHtml;
  }
  
  /**
   * Get HTML of the current selection
   */
  function getSelectionHtml() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const clonedRange = range.cloneContents();
      const div = document.createElement('div');
      div.appendChild(clonedRange);
      return div.innerHTML;
    }
    return '';
  }
  
  /**
   * Hide selection buttons
   */
  function hideSelectionButtons() {
    if (aiDiscussButton) aiDiscussButton.style.display = 'none';
    if (aiImproveButton) aiImproveButton.style.display = 'none';
  }
  
  /**
   * Set up integration with AI Assistant
   */
  function setupAIAssistantIntegration() {
    // Listen for content updates from AI Assistant
    document.addEventListener('contentUpdated', (event) => {
      if (event.detail && event.detail.source === 'assistant' && event.detail.content) {
        console.log('Content update from assistant detected');
        
        if (!window.editorQuill) {
          console.error('Quill instance not found for AI content update');
          return;
        }
        
        // Update editor content
        window.editorQuill.clipboard.dangerouslyPasteHTML(event.detail.content);
        
        // Trigger word count update
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
          const text = window.editorQuill.getText().trim();
          const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
          wordCountElement.innerText = `${wordCount} Words`;
        }
        
        // Notify user
        displayMessage('Content updated by AI assistant', 'success');
      }
    });
  }
  
  /**
   * Display a status message
   */
  function displayMessage(message, type) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;
    
    messageContainer.innerHTML = `<span class="${type}">${message}</span>`;
    setTimeout(() => messageContainer.innerHTML = '', 5000);
  }
})();
