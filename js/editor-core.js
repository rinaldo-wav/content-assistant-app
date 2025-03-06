/**
 * Editor Core - Handles Quill initialization and basic functionality
 * 
 * This module is responsible for:
 * - Initializing the Quill editor
 * - Loading/saving content from/to Airtable
 * - Handling basic editor controls (undo, redo, word count)
 */

// Config
const EditorConfig = {
  AIRTABLE_API_KEY: 'pat3BscwlarNjW9t4.e1284e5aec3b83f654a959380c8ce7bdaede00f0486ce085164e67e628189bfb',
  AIRTABLE_BASE_ID: 'apptv25rN4A3SoYn8',
  AIRTABLE_TABLE_NAME: 'Content',
  AUTOSAVE_DELAY: 2000
};

// Global initialization flag
window.editorInitialized = false;

// Editor initialization wrapper
(function() {
  // Prevent multiple initializations
  if (window.editorInitialized) {
    console.log("Editor already initialized");
    return;
  }
  
  // Main initialization function
  function initializeEditor() {
    // Don't initialize multiple times
    if (window.editorInitialized) return;
    
    console.log("Initializing Quill editor");
    
    try {
      // Make sure we have the editor container
      const editorContainer = document.getElementById('editor-container');
      if (!editorContainer) {
        console.error("Editor container not found");
        return;
      }
      
      // Create Quill instance
      const quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link']
          ],
          history: {
            delay: 1000,
            maxStack: 100
          }
        },
        placeholder: 'Start writing...'
      });
      
      // Expose globally for other modules to use
      window.editorQuill = quill;
      
      // Set up basic editor controls
      setupEditorControls(quill);
      
      // Remove loading indicator if present
      const loadingIndicator = document.querySelector('.editor-loading');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      
      // Load content from Airtable
      retrieveFromAirtable(quill);
      
      // Set the initialization flag
      window.editorInitialized = true;
      
      // Clean up any duplicate toolbars
      setTimeout(removeDuplicateToolbars, 500);
      setTimeout(removeDuplicateToolbars, 1500);
      
      console.log("Editor initialization complete");
      
      // Dispatch an event so other modules know the editor is ready
      document.dispatchEvent(new CustomEvent('editor-initialized', { 
        detail: { quill: quill }
      }));
      
      return quill;
    } catch (error) {
      console.error("Error initializing editor:", error);
      return null;
    }
  }
  
  // Wait for DOM and Quill to be ready, then initialize
  function initWhenReady() {
    if (typeof Quill === 'undefined') {
      console.log("Waiting for Quill to load...");
      setTimeout(initWhenReady, 300);
      return;
    }
    
    initializeEditor();
  }
  
  // Start initialization process when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhenReady);
  } else {
    initWhenReady();
  }
  
  // Helper Functions
  
  /**
   * Remove duplicate toolbars that may have been created
   */
  function removeDuplicateToolbars() {
    const toolbars = document.querySelectorAll('.ql-toolbar');
    if (toolbars.length > 1) {
      console.log(`Found ${toolbars.length} toolbars, removing duplicates`);
      for (let i = 1; i < toolbars.length; i++) {
        toolbars[i].parentNode.removeChild(toolbars[i]);
      }
    }
  }
  
  /**
   * Set up basic editor controls (undo, redo, word count)
   */
  function setupEditorControls(quill) {
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    const wordCountElement = document.getElementById('wordCount');
    const saveStatus = document.getElementById('saveStatus');
    
    if (!undoButton || !redoButton || !wordCountElement) {
      console.warn("Some editor control elements not found");
      return;
    }
    
    // Initial word count
    updateWordCount(quill, wordCountElement);
    
    // Undo/redo buttons
    undoButton.addEventListener('click', () => {
      quill.history.undo();
      updateWordCount(quill, wordCountElement);
    });
    
    redoButton.addEventListener('click', () => {
      quill.history.redo();
      updateWordCount(quill, wordCountElement);
    });
    
    // Auto-save with debounce
    const debouncedUpdate = debounce(() => {
      updateAirtableRecord(quill, saveStatus);
    }, EditorConfig.AUTOSAVE_DELAY);
    
    quill.on('text-change', () => {
      updateWordCount(quill, wordCountElement);
      
      if (saveStatus) {
        saveStatus.className = 'saving';
        saveStatus.textContent = 'Saving...';
      }
      
      debouncedUpdate();
    });
    
    // Keyboard shortcut for manual save
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        updateAirtableRecord(quill, saveStatus);
      }
    });
  }
  
  /**
   * Calculate and update word count
   */
  function updateWordCount(quill, element) {
    if (!element || !quill) return 0;
    
    const text = quill.getText().trim();
    const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
    
    element.innerText = `${wordCount} Words`;
    return wordCount;
  }
  
  /**
   * Simple debounce function for limiting frequent calls
   */
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }
  
  /**
   * Get record ID from URL parameters
   */
  function getRecordIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('recordId');
  }
  
  /**
   * Display status message
   */
  function displayMessage(message, type) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;
    
    messageContainer.innerHTML = `<span class="${type}">${message}</span>`;
    setTimeout(() => messageContainer.innerHTML = '', 5000);
  }
  
  /**
   * Update save status indicator
   */
  function updateSaveStatus(element, status, message) {
    if (!element) return;
    
    element.className = status;
    element.textContent = message;
    
    if (status === 'saved' || status === 'save-error') {
      setTimeout(() => {
        element.className = '';
        element.textContent = '';
      }, 3000);
    }
  }
  
  /**
   * Save content to Airtable
   */
  async function updateAirtableRecord(quill, statusElement) {
    const recordId = getRecordIdFromUrl();
    if (!recordId) {
      displayMessage('Record ID not found in URL', 'error');
      if (statusElement) updateSaveStatus(statusElement, 'save-error', 'Error: No Record ID');
      return;
    }
    
    if (statusElement) updateSaveStatus(statusElement, 'saving', 'Saving...');
    
    const content = quill.root.innerHTML;
    const wordCount = updateWordCount(quill, document.getElementById('wordCount'));
    
    try {
      const response = await fetch(`https://api.airtable.com/v0/${EditorConfig.AIRTABLE_BASE_ID}/${EditorConfig.AIRTABLE_TABLE_NAME}/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${EditorConfig.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            Content: content,
            Words: wordCount,
            Timestamp: new Date().toISOString()
          }
        })
      });
      
      if (response.ok) {
        if (statusElement) updateSaveStatus(statusElement, 'saved', 'Saved');
        
        // Notify that content was updated
        document.dispatchEvent(
          new CustomEvent('contentUpdated', {
            detail: { 
              source: 'editor',
              content: content
            }
          })
        );
      } else {
        if (statusElement) updateSaveStatus(statusElement, 'save-error', 'Error');
        displayMessage('Save failed', 'error');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      if (statusElement) updateSaveStatus(statusElement, 'save-error', 'Error');
      displayMessage('Connection error', 'error');
    }
  }
  
  /**
   * Load content from Airtable
   */
  async function retrieveFromAirtable(quill) {
    const recordId = getRecordIdFromUrl();
    if (!recordId) {
      displayMessage('Record ID not found in URL', 'error');
      return;
    }
    
    try {
      const response = await fetch(`https://api.airtable.com/v0/${EditorConfig.AIRTABLE_BASE_ID}/${EditorConfig.AIRTABLE_TABLE_NAME}/${recordId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${EditorConfig.AIRTABLE_API_KEY}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.fields && data.fields.Content) {
          quill.clipboard.dangerouslyPasteHTML(data.fields.Content);
          updateWordCount(quill, document.getElementById('wordCount'));
        }
      } else {
        displayMessage('Failed to load content', 'error');
      }
    } catch (error) {
      console.error('Error loading content:', error);
      displayMessage('Failed to load content', 'error');
    }
  }
})();
