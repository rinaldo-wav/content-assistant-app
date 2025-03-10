/**
 * Improved AI Response Handler
 * 
 * Processes responses from the AI Assistant with enhanced integration between
 * chat UI and inline visualizer.
 */

window.SimpleAIHandler = class {
  constructor(quill) {
    this.quill = quill;
    
    // Create change visualizer if it doesn't exist
    if (!window.InlineChangeVisualizer) {
      console.error("InlineChangeVisualizer not found - inline changes won't work");
    } else {
      this.changeVisualizer = new window.InlineChangeVisualizer(quill);
    }
  }
  
  /**
 * Process an AI response and handle appropriately
 */
processResponse(response, userRequest) {
  if (!response.suggestedContent) {
    console.warn('No suggested content found in AI response');
    return;
  }
  
  // Parse the structured format if available
  const parsedContent = this.parseStructuredContent(response.message, response.suggestedContent);
  
  // Get the most recent AI message element for integrating the visualizer controls
  const aiMessageElement = this.findLatestAIMessage();
  
  // Check for operation first (new format)
  if (parsedContent.operation) {
    console.log('Operation detected:', parsedContent.operation);
    this.handleOperation(parsedContent.operation, aiMessageElement, response.originalContent);
  }
  // Then check for multiple options
  else if (parsedContent.options && parsedContent.options.length > 1) {
    // Multiple options - already handled by the existing UI
    console.log('Multiple options detected, using chat UI');
    // The existing chat UI with buttons will handle this
  } 
  // Then check for rewrite
  else if (parsedContent.rewrite) {
    // Single rewrite - use inline visualization
    console.log('Single rewrite detected, using inline visualization');
    
    const originalContent = response.originalContent || {};
    
    if (originalContent.selectedText) {
      // Rewriting selected text
      this.visualizeSelectedTextChange(
        originalContent.selectedText,
        parsedContent.rewrite,
        originalContent.selectionRange,
        aiMessageElement
      );
    } else {
      // Rewriting a section based on the user's request
      const operationType = this.detectOperationType(userRequest);
      
      if (operationType === 'paragraph-first') {
        this.visualizeFirstParagraphChange(parsedContent.rewrite, aiMessageElement);
      } else if (operationType === 'paragraph-last') {
        this.visualizeLastParagraphChange(parsedContent.rewrite, aiMessageElement);
      } else if (operationType === 'headline') {
        this.visualizeHeadlineChange(parsedContent.rewrite, aiMessageElement);
      } else {
        // Default case - append or replace based on context
        this.visualizeAppendedContent(parsedContent.rewrite, aiMessageElement);
      }
    }
  }
  else {
    // Fallback - treat the entire suggested content as a change
    console.log('Treating entire content as a change');
    
    const originalContent = response.originalContent || {};
    
    if (originalContent.selectedText) {
      this.visualizeSelectedTextChange(
        originalContent.selectedText,
        response.suggestedContent,
        originalContent.selectionRange,
        aiMessageElement
      );
    } else {
      // Append the content at the end
      this.visualizeAppendedContent(response.suggestedContent, aiMessageElement);
    }
  }
  
  // Hide content preview when using visualizer in any mode
  if (parsedContent.operation || parsedContent.rewrite) {
    this.hideContentPreview(aiMessageElement);
  }
}

/**
 * Helper to hide content preview
 */
hideContentPreview(messageElement) {
  if (!messageElement) return;
  
  // Hide all elements related to content preview
  const elementsToHide = [
    '.content-preview',
    '.all-options-container',
    '.action-button:not(.visualizer-button)'
  ];
  
  // Hide each element if found
  elementsToHide.forEach(selector => {
    const elements = messageElement.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.display = 'none';
    });
  });
}

/**
 * Handle operation format
 */
handleOperation(operation, messageElement, originalContent) {
  // Make sure operation has required fields
  if (!operation.type || !operation.content) {
    console.error("Invalid operation", operation);
    return;
  }
  
  console.log(`Handling operation: ${operation.type} at ${operation.position || 'default position'}`);
  
  switch (operation.type.toLowerCase()) {
    case 'replace':
      // For replace operations with selected text
      if (originalContent && originalContent.selectedText) {
        this.visualizeSelectedTextChange(
          originalContent.selectedText,
          operation.content,
          originalContent.selectionRange,
          messageElement
        );
      } else {
        // Replace without selection - use the position hint
        this.handlePositionalInsert(operation, messageElement);
      }
      break;
      
    case 'insert':
    case 'append':
      // Handle insertion at specific position
      this.handlePositionalInsert(operation, messageElement);
      break;
      
    default:
      console.warn("Unknown operation type:", operation.type);
      // Default to append at end
      this.visualizeAppendedContent(operation.content, messageElement);
  }
}

/**
 * Helper to handle positional insert operations
 */
handlePositionalInsert(operation, messageElement) {
  // Default to end if no position specified
  const position = operation.position?.toLowerCase() || 'end';
  
  console.log(`Inserting content at position: ${position}`);
  
  if (position === 'after_headline' || position === 'after_title') {
    this.visualizeInsertionAfterHeadline(operation.content, messageElement);
  }
  else if (position === 'after_first_paragraph' || position === 'after_paragraph_1') {
    this.visualizeInsertionAfterFirstParagraph(operation.content, messageElement);
  }
  else {
    // Default to end of document
    this.visualizeAppendedContent(operation.content, messageElement);
  }
}

/**
 * Visualize insertion after the headline
 */
visualizeInsertionAfterHeadline(newText, messageElement) {
  if (!this.changeVisualizer) return;
  
  // Find the headline in the document
  const headlineMatch = this.quill.root.innerHTML.match(/<h1[^>]*>(.*?)<\/h1>/i);
  
  if (headlineMatch) {
    const headlineText = this.stripHtml(headlineMatch[1]);
    const index = this.quill.getText().indexOf(headlineText);
    
    if (index !== -1) {
      // Calculate insertion point after the headline
      const insertionIndex = index + headlineText.length + 1; // +1 for newline
      
      this.visualizeAppendedContent(newText, messageElement, insertionIndex);
    } else {
      // Fallback to appending at the end
      this.visualizeAppendedContent(newText, messageElement);
    }
  } else {
    // No headline found, append at the beginning
    this.visualizeAppendedContent(newText, messageElement, 0);
  }
}

/**
 * Visualize insertion after the first paragraph
 */
visualizeInsertionAfterFirstParagraph(newText, messageElement) {
  if (!this.changeVisualizer) return;
  
  // Find the first paragraph end
  const text = this.quill.getText();
  const firstParaEnd = text.indexOf('\n\n');
  
  if (firstParaEnd !== -1) {
    // Insert after the first paragraph
    const insertionIndex = firstParaEnd + 2; // +2 for the two newlines
    this.visualizeAppendedContent(newText, messageElement, insertionIndex);
  } else {
    // No paragraph break found, append at the end
    this.visualizeAppendedContent(newText, messageElement);
  }
}
  
  /**
   * Find the latest AI message element for adding controls
   */
  findLatestAIMessage() {
    const messages = document.querySelectorAll('.assistant-message');
    if (messages.length > 0) {
      return messages[messages.length - 1];
    }
    return null;
  }
  
  /**
 * Parse structured content from the AI response
 */
parseStructuredContent(message, suggestedContent) {
  const result = {
    comment: null,
    options: [],
    rewrite: null,
    operation: null
  };
  
  if (!message) return result;
  
  // Extract comment
  const commentMatch = message.match(/\[COMMENT\]([\s\S]*?)\[\/COMMENT\]/i);
  if (commentMatch) {
    result.comment = commentMatch[1].trim();
  }
  
  // Extract operation JSON
  const operationMatch = message.match(/\[OPERATION\]([\s\S]*?)\[\/OPERATION\]/i);
  if (operationMatch) {
    try {
      // Parse the JSON operation data
      const operationText = operationMatch[1].trim();
      result.operation = JSON.parse(operationText);
      console.log('Parsed operation:', result.operation);
    } catch (e) {
      console.error("Failed to parse operation JSON:", e);
    }
  }
  
  // Extract options
  const optionsMatch = message.match(/\[OPTIONS\]([\s\S]*?)\[\/OPTIONS\]/i);
  if (optionsMatch) {
    const optionsContent = optionsMatch[1];
    const optionPattern = /Option\s+(\d+):\s*([\s\S]*?)(?=Option\s+\d+:|$)/gi;
    let match;
    
    while ((match = optionPattern.exec(optionsContent)) !== null) {
      result.options.push(match[2].trim());
    }
  } else {
    // Fallback: try to extract options using standard pattern
    result.options = this.extractLegacyOptions(suggestedContent);
  }
  
  // Extract rewrite
  const rewriteMatch = message.match(/\[REWRITE\]([\s\S]*?)\[\/REWRITE\]/i);
  if (rewriteMatch) {
    result.rewrite = rewriteMatch[1].trim();
  } else if (result.options.length === 0 && !result.operation) {
    // If no explicit rewrite and no options, treat the whole content as a rewrite
    result.rewrite = suggestedContent;
  }
  
  return result;
}
  
  /**
   * Extract options using the legacy pattern
   */
  extractLegacyOptions(content) {
    const options = [];
    
    if (!content) return options;
    
    // Check for "Option X:" format
    const optionPattern = /Option\s+(\d+)[\s\n]*:[\s\n]*([\s\S]*?)(?=(?:\s*Option\s+\d+[\s\n]*:)|$)/gi;
    let match;
    
    while ((match = optionPattern.exec(content)) !== null) {
      options.push(match[2].trim());
    }
    
    return options;
  }
  
  /**
   * Detect the type of operation from the user request
   */
  detectOperationType(userRequest) {
    if (!userRequest) return 'generic';
    
    const request = userRequest.toLowerCase();
    
    if (request.includes('headline') || request.includes('title')) {
      return 'headline';
    }
    
    if (request.includes('first paragraph')) {
      return 'paragraph-first';
    }
    
    if (request.includes('last paragraph')) {
      return 'paragraph-last';
    }
    
    if (request.includes('paragraph')) {
      return 'paragraph';
    }
    
    // Add detection for proofreading and SEO operations
    if (request.includes('proofread') || request.includes('grammar') || 
        request.includes('spelling') || request.includes('fix errors')) {
      return 'proofreading';
    }
    
    if (request.includes('seo') || request.includes('keyword') || 
        request.includes('search engine')) {
      return 'seo';
    }
    
    return 'generic';
  }
  
  /**
   * Visualize changes to selected text
   */
  visualizeSelectedTextChange(originalText, newText, range, messageElement) {
    if (!this.changeVisualizer) {
      console.error("Inline change visualizer not available");
      return;
    }
    
    this.changeVisualizer.showChanges({
      originalText: this.stripHtml(originalText),
      suggestedText: this.stripHtml(newText),
      range: range,
      messageElement: messageElement,
      onApply: (text) => {
        console.log('Change applied:', text);
        // Update chat UI to show success
        this.updateChatUIAfterChange(true, messageElement);
      },
      onReject: () => {
        console.log('Change rejected');
        this.updateChatUIAfterChange(false, messageElement);
      }
    });
  }
  
  /**
   * Visualize changes to the first paragraph
   */
  visualizeFirstParagraphChange(newText, messageElement) {
    if (!this.changeVisualizer) return;
    
    // Find the first paragraph
    const text = this.quill.getText();
    const firstParaEnd = text.indexOf('\n\n');
    const firstParaLength = firstParaEnd > 0 ? firstParaEnd : Math.min(100, text.length);
    
    this.changeVisualizer.showChanges({
      originalText: text.substring(0, firstParaLength),
      suggestedText: this.stripHtml(newText),
      range: { index: 0, length: firstParaLength },
      messageElement: messageElement,
      onApply: (text) => {
        console.log('First paragraph updated');
        this.updateChatUIAfterChange(true, messageElement);
      },
      onReject: () => {
        console.log('First paragraph change rejected');
        this.updateChatUIAfterChange(false, messageElement);
      }
    });
  }
  
  /**
   * Visualize changes to the last paragraph
   */
  visualizeLastParagraphChange(newText, messageElement) {
    if (!this.changeVisualizer) return;
    
    // Find the last paragraph
    const text = this.quill.getText();
    const lastParaStart = text.lastIndexOf('\n\n') + 2;
    
    this.changeVisualizer.showChanges({
      originalText: text.substring(lastParaStart),
      suggestedText: this.stripHtml(newText),
      range: { index: lastParaStart, length: text.length - lastParaStart },
      messageElement: messageElement,
      onApply: (text) => {
        console.log('Last paragraph updated');
        this.updateChatUIAfterChange(true, messageElement);
      },
      onReject: () => {
        console.log('Last paragraph change rejected');
        this.updateChatUIAfterChange(false, messageElement);
      }
    });
  }
  
  /**
   * Visualize changes to the headline
   */
  visualizeHeadlineChange(newText, messageElement) {
    if (!this.changeVisualizer) return;
    
    // Find headline in the document
    const headlineMatch = this.quill.root.innerHTML.match(/<h1[^>]*>(.*?)<\/h1>/i);
    
    if (headlineMatch) {
      const originalHeadline = headlineMatch[1];
      const index = this.quill.getText().indexOf(this.stripHtml(originalHeadline));
      
      if (index !== -1) {
        this.changeVisualizer.showChanges({
          originalText: originalHeadline,
          suggestedText: this.stripHtml(newText),
          range: { index, length: originalHeadline.length },
          messageElement: messageElement,
          onApply: (text) => {
            console.log('Headline updated');
            this.updateChatUIAfterChange(true, messageElement);
          },
          onReject: () => {
            console.log('Headline change rejected');
            this.updateChatUIAfterChange(false, messageElement);
          }
        });
      }
    } else {
      // No headline found, append at beginning
      this.visualizeAppendedContent(newText, messageElement);
    }
  }
  
  /**
 * Visualize appended content
 * @param {string} newText The text to append
 * @param {HTMLElement} messageElement The AI message element
 * @param {number} insertionIndex Optional index to insert at (defaults to end)
 */
visualizeAppendedContent(newText, messageElement, insertionIndex) {
  if (!this.changeVisualizer) return;
  
  // If no insertion index provided, use end of document
  const index = (insertionIndex !== undefined) ? 
    insertionIndex : 
    this.quill.getLength() - 1; // -1 to account for trailing newline
  
  console.log(`Visualizing content insertion at index ${index}`);
  
  // For appended content, we use a special method that just shows
  // the new content in blue without any deletions
  this.changeVisualizer.showInsertedContent({
    suggestedText: this.stripHtml(newText),
    index: index,
    messageElement: messageElement,
    onApply: (text) => {
      console.log('Content addition applied');
      this.updateChatUIAfterChange(true, messageElement);
    },
    onReject: () => {
      console.log('Content addition rejected');
      this.updateChatUIAfterChange(false, messageElement);
    }
  });
}
  
  /**
   * Update the chat UI after a change has been applied or rejected
   */
  updateChatUIAfterChange(isSuccess, messageElement) {
    // Find the message element to update
    const targetMessage = messageElement || this.findLatestAIMessage();
    
    if (!targetMessage) {
      // Fall back to the old approach if we can't find the message
      this.updateChatUILegacy(isSuccess);
      return;
    }
    
    // Look for existing success/failure messages and remove them
    const existingMessages = targetMessage.querySelectorAll('.success-message, .failure-message');
    existingMessages.forEach(el => el.remove());
    
    if (isSuccess) {
      // Add success message
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.innerHTML = '<span class="success-icon">✓</span> Changes applied successfully!';
      targetMessage.appendChild(successMessage);
    } else {
      // Add canceled message
      const canceledMessage = document.createElement('div');
      canceledMessage.className = 'failure-message';
      canceledMessage.style.color = '#666';
      canceledMessage.textContent = 'Changes canceled';
      targetMessage.appendChild(canceledMessage);
    }
    
    // Hide any remaining action buttons
    const actionButtons = targetMessage.querySelectorAll('.action-button');
    actionButtons.forEach(button => {
      button.style.display = 'none';
    });
  }
  
  /**
   * Legacy method for updating chat UI (fallback)
   */
  updateChatUILegacy(isSuccess) {
    // Find the most recent message with action buttons
    const messages = document.querySelectorAll('.assistant-message');
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const actionButton = messages[i].querySelector('.action-button');
      if (actionButton) {
        if (isSuccess) {
          // Add success message
          const successMessage = document.createElement('div');
          successMessage.className = 'success-message';
          successMessage.innerHTML = '<span class="success-icon">✓</span> Changes applied successfully!';
          messages[i].appendChild(successMessage);
          
          // Hide the button
          actionButton.style.display = 'none';
        } else {
          // Add canceled message
          const canceledMessage = document.createElement('div');
          canceledMessage.style.color = '#666';
          canceledMessage.textContent = 'Changes canceled';
          messages[i].appendChild(canceledMessage);
          
          // Hide the button
          actionButton.style.display = 'none';
        }
        break;
      }
    }
  }
  
  /**
   * Strip HTML from text
   */
  stripHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }
};
