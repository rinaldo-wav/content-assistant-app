/**
 * Simplified AI Response Handler
 * Processes AI responses and shows changes using the overlay view
 */

class SimpleAIHandler {
  constructor(quill) {
    this.quill = quill;
    this.overlayView = new OverlayDiffView();
    
    // Initialize common change patterns for detecting change types
    this.changePatterns = {
      headline: [
        /change (the )?headline/i,
        /improve (the )?title/i,
        /better (headline|title)/i,
        /make (the )?(headline|title) more/i
      ],
      subtitle: [
        /add (a )?subtitle/i,
        /insert (a )?subtitle/i,
        /create (a )?subtitle/i
      ],
      expand: [
        /expand (the )?(article|content|text)/i,
        /make (the )?(article|content|text) longer/i,
        /add more (content|details|information)/i
      ],
      shorten: [
        /shorten (the )?(article|content|text)/i,
        /make (the )?(article|content|text) (shorter|briefer)/i,
        /reduce (the )?(word count|length)/i
      ],
      rewrite: [
        /rewrite (the )?(article|content|text|intro|paragraph)/i,
        /revise (the )?(article|content|text|intro|paragraph)/i
      ],
      lists: [
        /add (a )?list/i,
        /include (a )?list/i,
        /create (a )?list/i
      ],
      paragraph: [
        /add (a )?paragraph/i,
        /insert (a )?paragraph/i,
        /include (a )?paragraph/i,
        /write (a )?paragraph/i
      ]
    };
  }

  /**
   * Process an AI response and show the appropriate overlay
   * @param {Object} data The AI response data
   * @param {string} userRequest Original user request
   */
  processResponse(data, userRequest) {
    // Validate that we have suggested content
    if (!data.suggestedContent) {
      console.warn('No suggested content in AI response');
      return;
    }
    
    // Determine what kind of change this is
    const changeType = this.detectChangeType(userRequest, data.message);
    console.log('Detected change type:', changeType);
    
    // Show the overlay with the changes
    this.overlayView.showChanges({
      suggestedContent: data.suggestedContent,
      description: this.getChangeDescription(changeType, userRequest),
      changeType: changeType,
      onApply: (html) => this.applyChanges(html, changeType, data.originalContent)
    });
  }

  /**
   * Determine the type of change requested
   * @param {string} userRequest The user's request
   * @param {string} aiResponse The AI's response message
   * @returns {string} The change type
   */
  detectChangeType(userRequest, aiResponse) {
    const request = userRequest.toLowerCase();
    
    // Check each pattern group to see if it matches the request
    for (const [type, patterns] of Object.entries(this.changePatterns)) {
      if (patterns.some(pattern => pattern.test(request))) {
        return type;
      }
    }
    
    // If we can't determine from the user request, try to infer from the AI response
    if (aiResponse.includes('headline') || aiResponse.includes('title')) {
      return 'headline';
    }
    
    if (aiResponse.includes('subtitle')) {
      return 'subtitle';
    }
    
    if (aiResponse.includes('list')) {
      return 'lists';
    }
    
    // Default to 'rewrite' if we can't determine the specific type
    return 'rewrite';
  }

  /**
   * Get a human-readable description of the change
   */
  getChangeDescription(changeType, userRequest) {
    const descriptions = {
      headline: 'Suggested Headline Change',
      subtitle: 'Suggested Subtitle Addition',
      expand: 'Expanded Content',
      shorten: 'Shortened Content',
      rewrite: 'Rewritten Content',
      lists: 'Content with Added List',
      paragraph: 'Added Paragraph'
    };
    
    return descriptions[changeType] || `Changes for: "${userRequest}"`;
  }

  /**
   * Apply changes to the editor
   * @param {string} html HTML content to apply
   * @param {string} changeType Type of change
   * @param {Object} originalContent Original content information
   */
  applyChanges(html, changeType, originalContent) {
    // Sanitize the HTML first
    const sanitizedHtml = this.sanitizeHtml(html);
    
    // Different handling based on change type
    if (changeType === 'headline') {
      this.applyHeadlineChange(sanitizedHtml);
    }
    else if (changeType === 'subtitle') {
      this.applySubtitleChange(sanitizedHtml);
    }
    else if (changeType === 'paragraph') {
      this.applyParagraphAddition(sanitizedHtml);
    }
    else if (originalContent && originalContent.selectedText) {
      // For selected text improvements
      this.applySelectedTextChange(sanitizedHtml, originalContent);
    }
    else {
      // For full content replacements (rewrite, expand, shorten)
      this.applyFullContentChange(sanitizedHtml);
    }
    
    // Trigger a save after applying changes
    this.triggerContentSave();
  }

  /**
   * Apply changes to a headline
   */
  applyHeadlineChange(html) {
    // Extract the headline
    const headlineMatch = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
    
    if (!headlineMatch) {
      console.warn('No headline found in content');
      return;
    }
    
    const newHeadline = headlineMatch[0];
    
    // Find existing headline
    const documentHtml = this.quill.root.innerHTML;
    const existingHeadlineMatch = documentHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
    
    if (existingHeadlineMatch) {
      // Replace existing headline
      const updatedHtml = documentHtml.replace(existingHeadlineMatch[0], newHeadline);
      this.quill.root.innerHTML = updatedHtml;
    } else {
      // Add at beginning
      this.quill.clipboard.dangerouslyPasteHTML(0, newHeadline);
    }
  }

  /**
   * Apply a subtitle change
   */
  applySubtitleChange(html) {
    // Extract subtitle
    const subtitleMatch = html.match(/<h[2-3][^>]*>(.*?)<\/h[2-3]>/i);
    
    if (!subtitleMatch) {
      console.warn('No subtitle found in content');
      return;
    }
    
    const newSubtitle = subtitleMatch[0];
    
    // Find where to insert subtitle (after headline)
    const documentHtml = this.quill.root.innerHTML;
    const headlineMatch = documentHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
    
    if (headlineMatch) {
      const headlineEndIndex = documentHtml.indexOf(headlineMatch[0]) + headlineMatch[0].length;
      const updatedHtml = 
        documentHtml.substring(0, headlineEndIndex) + 
        newSubtitle + 
        documentHtml.substring(headlineEndIndex);
        
      this.quill.root.innerHTML = updatedHtml;
    } else {
      // No headline, add at beginning
      this.quill.clipboard.dangerouslyPasteHTML(0, newSubtitle);
    }
  }

  /**
   * Add a new paragraph
   */
  applyParagraphAddition(html) {
    // Extract paragraphs
    const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/ig);
    
    if (!paragraphs || paragraphs.length === 0) {
      console.warn('No paragraphs found in content');
      return;
    }
    
    // Add at the end
    const length = this.quill.getLength();
    this.quill.clipboard.dangerouslyPasteHTML(length, paragraphs.join(''));
  }

  /**
   * Apply changes to selected text
   */
  applySelectedTextChange(html, originalContent) {
    const selectedText = originalContent.selectedText;
    
    if (!selectedText) {
      console.warn('No selected text found');
      return this.applyFullContentChange(html);
    }
    
    // Try to find the selected text in the document
    const documentHtml = this.quill.root.innerHTML;
    
    // First try direct replacement (if the HTML matches exactly)
    if (documentHtml.includes(selectedText)) {
      const updatedHtml = documentHtml.replace(selectedText, html);
      this.quill.root.innerHTML = updatedHtml;
      return;
    }
    
    // If direct replacement fails, try to use Quill range if available
    if (originalContent.selectionRange) {
      const range = originalContent.selectionRange;
      if (range.index !== undefined && range.length !== undefined) {
        this.quill.deleteText(range.index, range.length);
        this.quill.clipboard.dangerouslyPasteHTML(range.index, html);
        return;
      }
    }
    
    // If all else fails, try to find the plain text version
    const plainText = this.stripHtml(selectedText);
    if (plainText) {
      const quillText = this.quill.getText();
      const index = quillText.indexOf(plainText);
      
      if (index !== -1) {
        this.quill.deleteText(index, plainText.length);
        this.quill.clipboard.dangerouslyPasteHTML(index, html);
        return;
      }
    }
    
    // Last resort: append to the end
    console.warn('Could not find selected text in document, appending at end');
    const length = this.quill.getLength();
    this.quill.clipboard.dangerouslyPasteHTML(length, html);
  }

  /**
   * Apply changes to the full content
   */
  applyFullContentChange(html) {
    this.quill.setText('');
    this.quill.clipboard.dangerouslyPasteHTML(0, html);
  }

  /**
   * Trigger a save after content changes
   */
  triggerContentSave() {
    setTimeout(() => {
      const event = new Event('text-change', { bubbles: true });
      this.quill.root.dispatchEvent(event);
    }, 100);
  }

  /**
   * Sanitize HTML to prevent issues
   */
  sanitizeHtml(html) {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }

  /**
   * Strip HTML tags to get plain text
   */
  stripHtml(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }
}

// Export for use in the main application
window.SimpleAIHandler = SimpleAIHandler;
