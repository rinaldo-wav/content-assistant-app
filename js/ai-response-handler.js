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
    
    // Determine the approach based on content type
    if (parsedContent.options && parsedContent.options.length > 1) {
      // Multiple options - already handled by the existing UI
      console.log('Multiple options detected, using chat UI');
      // The existing chat UI with buttons will handle this
    } 
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

      // If using the visualizer, remove the content preview from the AI message
      if (aiMessageElement) {
        const contentPreview = aiMessageElement.querySelector('.content-preview');
        if (contentPreview) {
          contentPreview.style.display = 'none';
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
      rewrite: null
    };
    
    if (!message) return result;
    
    // Extract comment
    const commentMatch = message.match(/\[COMMENT\]([\s\S]*?)\[\/COMMENT\]/i);
    if (commentMatch) {
      result.comment = commentMatch[1].trim();
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
    } else if (result.options.length === 0) {
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
   */
  visualizeAppendedContent(newText, messageElement) {
    if (!this.changeVisualizer) return;
    
    const length = this.quill.getLength();
    
    this.changeVisualizer.showChanges({
      originalText: '',
      suggestedText: this.stripHtml(newText),
      range: { index: length - 1, length: 0 },
      messageElement: messageElement,
      onApply: (text) => {
        console.log('Content appended');
        this.updateChatUIAfterChange(true, messageElement);
      },
      onReject: () => {
        console.log('Appended content rejected');
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
