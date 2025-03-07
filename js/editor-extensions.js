/**
 * Improved Editor Extensions
 * 
 * Enhances the "Discuss with AI" and "Improve" buttons with more distinct functionality
 * and support for specialized AI assistants.
 */

(function() {
  // Variables
  let selectionTimeout;
  let aiDiscussButton, aiImproveButton;
  let buttonInitialized = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  
  // Try to initialize immediately
  initializeExtensions();
  
  // And also listen for the editor-initialized event as a backup
  document.addEventListener('editor-initialized', function(event) {
    console.log('Editor initialized event received, setting up extensions');
    initializeExtensions();
  });
  
  // Poll for editor to be ready
  function checkAndInitialize() {
    if (window.editorQuill) {
      console.log('Editor detected, initializing extensions');
      initializeExtensions();
      return true;
    }
    
    retryCount++;
    if (retryCount < MAX_RETRIES) {
      console.log(`Editor not ready, retry ${retryCount}/${MAX_RETRIES}`);
      setTimeout(checkAndInitialize, 1000);
      return false;
    }
    
    console.warn('Editor not found after maximum retries');
    return false;
  }
  
  // Main initialization function
  function initializeExtensions() {
    if (buttonInitialized) {
      console.log('Extensions already initialized');
      return;
    }
    
    // Check if editor exists
    const editorElement = document.querySelector('.ql-editor');
    if (!editorElement && !window.editorQuill) {
      console.log('Editor not found yet, will retry');
      setTimeout(checkAndInitialize, 1000);
      return;
    }
    
    console.log('Initializing editor extensions');
    
    // Create custom CSS for the buttons
    addCustomStyles();
    
    // Create AI buttons
    createAIButtons();
    
    // Set up selection handling
    setupSelectionHandling();
    
    // Set up integration with AI Assistant
    setupAIAssistantIntegration();
    
    // Mark as initialized
    buttonInitialized = true;
    
    console.log('Editor extensions successfully initialized');
  }
  
  /**
   * Add custom styles for AI buttons
   */
  function addCustomStyles() {
    if (document.getElementById('ai-button-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'ai-button-styles';
    styleElement.textContent = `
      .ai-assistant-button {
        position: absolute;
        display: none;
        color: white;
        border: none;
        padding: 8px 12px;
        font-family: 'Montserrat', sans-serif;
        font-size: 14px;
        cursor: pointer;
        z-index: 9999;
        border-radius: 0;
      }
      
      .ai-discuss {
        background-color: #109FCC;
        margin-right: 8px;
      }
      
      .ai-improve {
        background-color: #4CAF50;
        margin-left: 8px;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
  
  /**
   * Create AI Assistant buttons with enhanced labels
   */
  function createAIButtons() {
    // Remove existing buttons first to avoid duplicates
    const existingDiscussButton = document.querySelector('.ai-discuss');
    const existingImproveButton = document.querySelector('.ai-improve');
    
    if (existingDiscussButton) existingDiscussButton.remove();
    if (existingImproveButton) existingImproveButton.remove();
    
    // Create Discuss button (renamed to "Ask About")
    aiDiscussButton = document.createElement('button');
    aiDiscussButton.className = 'ai-assistant-button ai-discuss';
    aiDiscussButton.textContent = 'Ask About';
    aiDiscussButton.style.display = 'none';
    
    // Create Improve button
    aiImproveButton = document.createElement('button');
    aiImproveButton.className = 'ai-assistant-button ai-improve';
    aiImproveButton.textContent = 'Improve';
    aiImproveButton.style.display = 'none';
    
    // Add buttons to body (to avoid container issues in Softr)
    document.body.appendChild(aiDiscussButton);
    document.body.appendChild(aiImproveButton);
    
    // Set up button click handlers
    setupButtonClickHandlers();
    
    console.log('AI buttons created');
  }
  
  /**
   * Set up click handlers for AI buttons with distinct behaviors
   */
  function setupButtonClickHandlers() {
    // Clear existing listeners if any (to prevent duplicates)
    const newDiscussButton = aiDiscussButton.cloneNode(true);
    const newImproveButton = aiImproveButton.cloneNode(true);
    
    aiDiscussButton.parentNode.replaceChild(newDiscussButton, aiDiscussButton);
    aiImproveButton.parentNode.replaceChild(newImproveButton, aiImproveButton);
    
    aiDiscussButton = newDiscussButton;
    aiImproveButton = newImproveButton;
    
    // Handle Discuss button click - now "Ask About"
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
          
          // Pre-populate message input with a question format
          const messageInput = aiAssistant.querySelector('.message-input');
          if (messageInput) {
            messageInput.value = `Can you explain this section: "${stripHtml(selectedText).substring(0, 50)}..."?`;
            messageInput.focus();
            
            // Simulate input event to adjust height
            messageInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Send selection to AI Assistant with discussion mode
          window.postMessage({
            type: 'selectedText',
            text: selectedText,
            mode: 'ask',
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
    
    // Handle Improve button click with contextual behavior
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
          
          // Auto-send improve request adapted to current AI Assistant
          const sendButton = aiAssistant.querySelector('.send-button');
          if (sendButton) {
            // Set input text based on current assistant type
            const messageInput = aiAssistant.querySelector('.message-input');
            if (messageInput) {
              // Get the current assistant type from the dropdown
              const assistantDropdown = document.getElementById('assistant-dropdown');
              const assistantName = assistantDropdown ? assistantDropdown.textContent.trim().toLowerCase() : '';
              
              // Customize message based on assistant type
              let message = "Improve this text with specific suggestions";
              
              if (assistantName.includes('seo') || assistantName.includes('keyword')) {
                message = "Optimize this text for SEO with better keywords";
              } else if (assistantName.includes('proofread') || assistantName.includes('grammar')) {
                message = "Fix any grammar and spelling issues in this text";
              } else if (assistantName.includes('concise') || assistantName.includes('brevity')) {
                message = "Make this text more concise while keeping key points";
              } else if (assistantName.includes('tone') || assistantName.includes('voice')) {
                message = "Improve the tone and voice of this text";
              }
              
              messageInput.value = message;
              
              // Click send button
              setTimeout(() => {
                // First store the text selection message in sessionStorage
                window.sessionStorage.setItem('selectedTextContent', selectedText);
                window.sessionStorage.setItem('selectionMode', 'improve');
                
                // Then click send
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
    
    console.log('AI button handlers set up');
  }
  
  /**
   * Strip HTML from text helper function
   */
  function stripHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }
  
  // Rest of the file remains the same
  
  /**
   * Set up handlers for text selection in the editor
   */
  function setupSelectionHandling() {
    // First try to find the editor element
    let editorElement = document.querySelector('.ql-editor');
    
    // If not found directly, look for it in iframes (Softr sometimes uses iframes)
    if (!editorElement) {
      const iframes = document.querySelectorAll('iframe');
      for (let i = 0; i < iframes.length; i++) {
        try {
          const iframeEditor = iframes[i].contentDocument.querySelector('.ql-editor');
          if (iframeEditor) {
            editorElement = iframeEditor;
            break;
          }
        } catch (e) {
          // Cross-origin iframe access error, ignore
        }
      }
    }
    
    if (!editorElement) {
      console.warn("Editor element not found for selection handling");
      
      // Try with the Quill instance instead
      if (window.editorQuill) {
        console.log("Using Quill instance for selection handling");
        
        // Set up Quill selection-change event
        window.editorQuill.on('selection-change', function(range, oldRange, source) {
          if (range && range.length > 0) {
            // We have a selection
            setTimeout(() => {
              const selection = window.getSelection();
              if (selection && selection.toString().trim().length > 0) {
                handleQuillSelection(window.editorQuill, range);
              }
            }, 50);
          } else {
            // Reset selection
            setTimeout(() => {
              const selection = window.getSelection();
              if (!selection || selection.toString().trim().length === 0) {
                hideSelectionButtons();
              }
            }, 50);
          }
        });
        
        return;
      }
      
      return;
    }
    
    console.log('Setting up selection handling on editor element');
    
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
    
    // Also set up document-wide handler for clicks outside the editor
    document.addEventListener('click', function(event) {
      if (event.target !== aiDiscussButton && 
          event.target !== aiImproveButton && 
          (!editorElement || !editorElement.contains(event.target))) {
        hideSelectionButtons();
      }
    });
  }
  
  /**
   * Handle selection specifically using Quill API
   */
  function handleQuillSelection(quill, range) {
    // Get the bounds from Quill
    const bounds = quill.getBounds(range.index, range.length);
    if (!bounds) return;
    
    // Get the editor element
    const editorElement = quill.root;
    if (!editorElement) return;
    
    // Get editor position
    const editorRect = editorElement.getBoundingClientRect();
    
    // Calculate absolute position
    const buttonsTop = editorRect.top + bounds.bottom + window.scrollY + 10;
    const buttonsLeft = editorRect.left + bounds.left + window.scrollX;
    
    // Position Discuss button
    aiDiscussButton.style.top = `${buttonsTop}px`;
    aiDiscussButton.style.left = `${buttonsLeft}px`;
    aiDiscussButton.style.display = 'block';
    
    // Position Improve button
    aiImproveButton.style.top = `${buttonsTop}px`;
    aiImproveButton.style.left = `${buttonsLeft + 120}px`;
    aiImproveButton.style.display = 'block';
    
    // Get selected HTML
    const selectedHtml = quill.getSemanticHTML(range.index, range.length);
    
    // Store as JSON string to prevent circular reference
    const rangeString = JSON.stringify({
      index: range.index,
      length: range.length
    });
    
    // Save to button data
    aiDiscussButton.dataset.quillRange = rangeString;
    aiImproveButton.dataset.quillRange = rangeString;
    
    // Store selected text
    aiDiscussButton.dataset.selectedText = selectedHtml;
    aiImproveButton.dataset.selectedText = selectedHtml;
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
    if (!editorElement) {
      // If we can't find editor element, use Quill API
      if (window.editorQuill) {
        const quillRange = window.editorQuill.getSelection();
        if (quillRange && quillRange.length > 0) {
          handleQuillSelection(window.editorQuill, quillRange);
        }
      }
      return;
    }
    
    const editorRect = editorElement.getBoundingClientRect();
    
    // Check if selection is inside editor
    let isInEditor = false;
    let node = range.startContainer;
    while (node && !isInEditor) {
      if (node === editorElement) {
        isInEditor = true;
      }
      node = node.parentNode;
    }
    
    if (!isInEditor) {
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
    
    // Global handler for selection messages from the editor
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'selectedText') {
        console.log('Selection message received:', event.data.mode);
        // The AI assistant will handle this
      }
    });
  }
  
  /**
   * Display a status message
   */
  function displayMessage(message, type) {
    // Try to find the message container
    let messageContainer = document.getElementById('messageContainer');
    
    // If it doesn't exist, create one
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'messageContainer';
      messageContainer.style.position = 'fixed';
      messageContainer.style.bottom = '20px';
      messageContainer.style.right = '20px';
      messageContainer.style.zIndex = '9999';
      messageContainer.style.fontFamily = 'Montserrat, sans-serif';
      document.body.appendChild(messageContainer);
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.style.padding = '10px 15px';
    messageElement.style.marginBottom = '10px';
    messageElement.style.borderRadius = '5px';
    messageElement.style.color = 'white';
    messageElement.style.backgroundColor = type === 'error' ? '#e53935' : '#4caf50';
    messageElement.textContent = message;
    
    // Add to container
    messageContainer.appendChild(messageElement);
    
    // Remove after delay
    setTimeout(() => {
      if (messageElement.parentNode === messageContainer) {
        messageContainer.removeChild(messageElement);
      }
    }, 5000);
  }
})();
