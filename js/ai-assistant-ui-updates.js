/**
 * Enhanced AI Assistant with Quick Actions
 * 
 * Adds quick action buttons and improved UI to the AI Assistant
 */

(function() {
  // Additional initialization to add quick action buttons
  document.addEventListener('editor-initialized', function(event) {
    console.log('Editor initialized, setting up AI Assistant quick actions');
    setupQuickActions();
  });
  
  /**
   * Set up quick action buttons for the current assistant
   */
  function setupQuickActions() {
    // Wait for AI Assistant to load
    const checkAssistant = setInterval(() => {
      const description = document.getElementById('assistant-description');
      const assistantDropdown = document.getElementById('assistant-dropdown');
      
      if (description && assistantDropdown && assistantDropdown.textContent !== 'Loading...') {
        clearInterval(checkAssistant);
        addQuickActionButtons();
        
        // Also listen for assistant changes
        const assistantOptions = document.querySelectorAll('.assistant-option');
        assistantOptions.forEach(option => {
          option.addEventListener('click', () => {
            // Short delay to allow assistant selection to complete
            setTimeout(addQuickActionButtons, 100);
          });
        });
      }
    }, 500);
  }
  
  /**
   * Add quick action buttons based on current assistant
   */
  async function addQuickActionButtons() {
    try {
      // Get current assistant key
      const currentAssistant = getCurrentAssistantKey();
      if (!currentAssistant) return;
      
      // Remove any existing quick action buttons
      removeExistingQuickActions();
      
      // Get quick actions for this assistant
      const quickActions = await getQuickActionsForAssistant(currentAssistant);
      if (!quickActions || Object.keys(quickActions).length === 0) return;
      
      // Create container for quick action buttons
      const quickActionContainer = document.createElement('div');
      quickActionContainer.className = 'quick-action-container';
      quickActionContainer.style.display = 'flex';
      quickActionContainer.style.flexWrap = 'wrap';
      quickActionContainer.style.gap = '8px';
      quickActionContainer.style.marginTop = '12px';
      quickActionContainer.style.marginBottom = '12px';
      
      // Add a header
      const header = document.createElement('div');
      header.className = 'quick-action-header';
      header.textContent = 'Quick Actions:';
      header.style.width = '100%';
      header.style.marginBottom = '6px';
      header.style.fontWeight = '600';
      quickActionContainer.appendChild(header);
      
      // Add buttons for each quick action
      for (const [actionKey, action] of Object.entries(quickActions)) {
        if (!action.buttonText) continue;
        
        const button = document.createElement('button');
        button.className = 'quick-action-button';
        button.textContent = action.buttonText;
        button.title = action.description || '';
        button.dataset.action = actionKey;
        
        // Style the button
        button.style.backgroundColor = '#f5f5f5';
        button.style.border = '1px solid #e5e5e5';
        button.style.borderRadius = '4px';
        button.style.padding = '6px 12px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '13px';
        button.style.fontFamily = 'Montserrat, sans-serif';
        
        // Hover effect
        button.onmouseover = () => {
          button.style.backgroundColor = '#e9e9e9';
        };
        button.onmouseout = () => {
          button.style.backgroundColor = '#f5f5f5';
        };
        
        // Add click handler
        button.addEventListener('click', () => {
          handleQuickAction(actionKey, action.prompt);
        });
        
        quickActionContainer.appendChild(button);
      }
      
      // Add to the assistant description section
      const description = document.getElementById('assistant-description');
      if (description) {
        description.appendChild(quickActionContainer);
      }
      
      // Add empty document helper if applicable
      checkForEmptyDocument();
      
    } catch (error) {
      console.error('Error setting up quick action buttons:', error);
    }
  }
  
  /**
   * Handle click on a quick action button
   */
  function handleQuickAction(actionKey, prompt) {
    // Get AI assistant elements
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    if (!messageInput || !sendButton) return;
    
    // Set input text if provided
    if (prompt) {
      messageInput.value = prompt;
      // Trigger height adjustment
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Add quick action info to message
    window.currentQuickAction = actionKey;
    
    // Send the message
    setTimeout(() => {
      sendButton.click();
    }, 100);
  }
  
  /**
   * Get the current assistant key
   */
  function getCurrentAssistantKey() {
    try {
      // Get from dataset if available
      const options = document.querySelectorAll('.assistant-option');
      const dropdown = document.getElementById('assistant-dropdown');
      
      if (!dropdown) return null;
      
      const currentName = dropdown.textContent.trim();
      
      for (const option of options) {
        if (option.textContent.trim() === currentName) {
          return option.dataset.assistant;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current assistant:', error);
      return null;
    }
  }
  
  /**
   * Remove existing quick action buttons
   */
  function removeExistingQuickActions() {
    const container = document.querySelector('.quick-action-container');
    if (container) {
      container.remove();
    }
    
    const emptyDocHelper = document.querySelector('.empty-doc-helper');
    if (emptyDocHelper) {
      emptyDocHelper.remove();
    }
  }
  
  /**
   * Fetch quick actions for the current assistant from Airtable
   */
  async function getQuickActionsForAssistant(assistantKey) {
    // First check if we have this in cache
    const cacheKey = `quickActions_${assistantKey}`;
    const cached = sessionStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached quick actions:', e);
      }
    }
    
    try {
      // In a real implementation, you would fetch this from your serverless function
      // For now, return mock data based on assistant type
      let mockActions = {};
      
      if (assistantKey.includes('seo')) {
        mockActions = {
          seo_optimize: {
            buttonText: "Optimize for SEO",
            prompt: "Optimize this content for search engines while maintaining readability and flow.",
            description: "Enhances content with SEO best practices"
          },
          keyword_research: {
            buttonText: "Keyword Ideas",
            prompt: "Suggest relevant keywords for this content that could improve its search visibility.",
            description: "Suggests keywords for better search visibility"
          }
        };
      } else if (assistantKey.includes('proofread')) {
        mockActions = {
          grammar_check: {
            buttonText: "Fix Grammar",
            prompt: "Check and fix any grammar or spelling issues in this text.",
            description: "Corrects grammar and spelling errors"
          },
          simplify: {
            buttonText: "Simplify",
            prompt: "Make this content easier to read by simplifying language and sentence structure.",
            description: "Simplifies complex language"
          }
        };
      } else {
        // Default quick actions for all assistants
        mockActions = {
          improve: {
            buttonText: "Improve",
            prompt: "Please improve this content to make it more engaging and effective.",
            description: "Makes general improvements to the content"
          },
          rewrite: {
            buttonText: "Rewrite",
            prompt: "Rewrite this text while maintaining its key points and meaning.",
            description: "Completely rewrites the selected text"
          }
        };
      }
      
      // In a real implementation, you would cache the fetched data
      sessionStorage.setItem(cacheKey, JSON.stringify(mockActions));
      
      return mockActions;
    } catch (error) {
      console.error('Error fetching quick actions:', error);
      return {};
    }
  }
  
  /**
   * Check if the document is empty and offer first draft help
   */
  function checkForEmptyDocument() {
    if (!window.editorQuill) return;
    
    const text = window.editorQuill.getText().trim();
    
    if (text.length === 0) {
      // Document is empty, show helper
      const description = document.getElementById('assistant-description');
      if (!description) return;
      
      const emptyDocHelper = document.createElement('div');
      emptyDocHelper.className = 'empty-doc-helper';
      emptyDocHelper.style.backgroundColor = '#f0f9ff';
      emptyDocHelper.style.border = '1px solid #bae6fd';
      emptyDocHelper.style.borderRadius = '4px';
      emptyDocHelper.style.padding = '12px';
      emptyDocHelper.style.marginTop = '16px';
      
      emptyDocHelper.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">New Document</div>
        <p style="margin: 0 0 8px 0;">Need help getting started? I can create a first draft for you.</p>
        <button id="first-draft-button" style="background-color: #0284c7; color: white; border: none; padding: 6px 12px; cursor: pointer; font-size: 14px;">Create First Draft</button>
      `;
      
      description.appendChild(emptyDocHelper);
      
      // Add click handler
      const firstDraftButton = document.getElementById('first-draft-button');
      if (firstDraftButton) {
        firstDraftButton.addEventListener('click', () => {
          handleQuickAction('first_draft', "Please create a complete first draft for this document. Include a compelling headline, introduction, main sections with subheadings, and a conclusion.");
        });
      }
    }
  }
  
  // PATCHING THE SEND MESSAGE FUNCTION TO INCLUDE QUICK ACTION INFO
  
  // Wait for the AI Assistant Core to initialize
  const waitForAIAssistantCore = setInterval(() => {
    if (window.handleSendMessage) {
      clearInterval(waitForAIAssistantCore);
      patchSendMessageFunction();
    }
  }, 500);
  
  /**
   * Patch the original handleSendMessage function to include quick action data
   */
  function patchSendMessageFunction() {
    // Store reference to the original function
    const originalHandleSendMessage = window.handleSendMessage;
    
    // Replace with our enhanced version
    window.handleSendMessage = async function() {
      const message = messageInput.value.trim();
      if (!message) return;
      
      // Store quick action if present
      const quickAction = window.currentQuickAction;
      
      // Clear input and reset height
      addMessage(message, true);
      messageInput.value = '';
      messageInput.style.height = 'auto';
      
      // Reset quick action
      window.currentQuickAction = null;
      
      // Check if this is a simple implementation command
      if (isImplementationCommand(message)) {
        await handleImplementationCommand();
        return;
      }
      
      // Check if this is selecting a specific option
      const optionNumber = extractOptionSelection(message);
      if (optionNumber) {
        await handleOptionSelection(optionNumber);
        return;
      }
      
      // Regular message handling with quick action
      await handleRegularMessage(message, quickAction);
    };
    
    /**
     * Enhanced sendToAI function to include quick action
     */
    const originalSendToAI = window.sendToAI;
    window.sendToAI = async function(message, assistant, quickAction) {
      try {
        // Determine if this is a content request
        const isContentRequest = detectContentRequest(message) || currentlySelectedText;
        const mode = isContentRequest ? 'content' : 'conversation';
        
        // Check if this is potentially a large content operation
        const isLargeContent = message.includes('whole piece') || 
                              message.includes('expand') || 
                              message.includes('rewrite') ||
                              message.includes('longer') ||
                              (currentlySelectedText && currentlySelectedText.length > 3000);
        
        // Prepare payload with mode and history
        const payload = {
          prompt: message,
          assistantType: assistant,
          recordId: recordId,
          interactionMode: mode,
          conversationHistory: chatHistory,
          actionOriented: true,
          isLargeContent: isLargeContent,
          quickAction: quickAction // Add the quick action
        };
        
        // Rest of function remains the same as original
        // ...
        
        // For brevity, let's call the original function
        return originalSendToAI.call(this, message, assistant);
      } catch (error) {
        console.error('Error in enhanced sendToAI:', error);
        return handleApiError(error);
      }
    };
    
    /**
     * Enhanced regular message handler
     */
    async function handleRegularMessage(message, quickAction) {
      // Show typing indicator
      addTypingIndicator('thinking');
      
      // Get response from AI, passing quick action if available
      const response = await sendToAI(message, currentAssistant, quickAction);
      
      // Remove typing indicator
      removeTypingIndicator();
      
      // Format the response to hide markup tags
      const formattedMessage = formatResponseForDisplay(response.message);
      
      // Display the formatted response in the chat
      addMessage(formattedMessage, false, response.suggestedContent, response.originalContent, response.mode || 'content');
      
      // Store original message in history for context
      addToHistory(response.message, 'assistant');
      
      // Process the response with our handler if it contains suggestions
      if (response.suggestedContent && window.aiHandler) {
        try {
          window.aiHandler.processResponse(response, message);
        } catch (e) {
          console.error("Error processing response with handler:", e);
        }
      }
      
      // Clear selection info
      currentlySelectedText = null;
      currentlySelectedRange = null;
    }
  }
})();
