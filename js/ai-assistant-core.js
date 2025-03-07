/**
 * AI Assistant Core
 * 
 * Handles the core functionality of the AI Assistant:
 * - Loading available assistants
 * - Chat interface
 * - Sending messages to API
 * - Processing and displaying responses
 */

// Add this at the VERY TOP of your ai-assistant-core.js file
// This ensures the visualizer starts loading as early as possible

// Preload the InlineChangeVisualizer
(function preloadVisualizer() {
  console.log("Preloading InlineChangeVisualizer...");
  if (!window.InlineChangeVisualizer && !window.visualizerLoading) {
    window.visualizerLoading = true;
    
    const script = document.createElement('script');
    script.src = 'https://lively-bombolone-92a577.netlify.app/js/inline-change-visualizer.js';
    script.async = false; // Make this synchronous for more predictable loading
    
    script.onload = function() {
      console.log("InlineChangeVisualizer preloaded successfully");
      window.visualizerLoaded = true;
    };
    
    script.onerror = function() {
      console.error("Failed to preload InlineChangeVisualizer");
      window.visualizerLoading = false;
    };
    
    document.head.appendChild(script);
  }
})();

(function() {
  // Constants and configuration
  const CONFIG = {
    API_ENDPOINT: 'https://lively-bombolone-92a577.netlify.app/.netlify/functions/ai-assistant',
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  };

  // Add the test function here
  async function testNetlifyConnection() {
    try {
      console.log('Testing connection to Netlify functions...');
      const response = await fetch('https://lively-bombolone-92a577.netlify.app/.netlify/functions/airtable-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Remove credentials for this test
        body: JSON.stringify({ operation: 'test' })
      });
      
      const responseText = await response.text();
      console.log('Test response:', responseText);
      
      // Add a second test to the AI function
      console.log('Testing connection to AI assistant function...');
      const aiResponse = await fetch('https://lively-bombolone-92a577.netlify.app/.netlify/functions/ai-assistant', {
        method: 'OPTIONS'
      });
      console.log('AI OPTIONS test status:', aiResponse.status);
      
      return response.ok;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }
  
  // Global state
  let currentAssistant = null;
  let contentRecord = null;
  let recordId = null;
  let assistantList = [];
  let currentlySelectedText = null;
  let currentlySelectedRange = null;
  let chatHistory = [];
  
  // DOM elements
  let chatContainer;
  let messageInput;
  let sendButton;
  let assistantDropdown;
  let assistantSelector;
  let assistantOptions;
  let assistantDescription;
  
  // Initialize when DOM is loaded
onDocumentReady(function() {
  // Get DOM elements
  chatContainer = document.getElementById('chat-container');
  messageInput = document.getElementById('message-input');
  sendButton = document.getElementById('send-button');
  assistantDropdown = document.getElementById('assistant-dropdown');
  assistantSelector = document.getElementById('assistant-selector');
  assistantOptions = document.getElementById('assistant-options');
  assistantDescription = document.getElementById('assistant-description');
  
  // Verify that required elements exist
  const requiredElements = {
    'chatContainer': chatContainer,
    'messageInput': messageInput,
    'sendButton': sendButton,
    'assistantDropdown': assistantDropdown
  };
  
  let missingElements = [];
  for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
      missingElements.push(name);
    }
  }
  
  if (missingElements.length > 0) {
    console.error(`Required AI Assistant elements not found: ${missingElements.join(', ')}`);
    
    // Try again after a short delay to account for lazy loading
    setTimeout(() => {
      chatContainer = document.getElementById('chat-container');
      messageInput = document.getElementById('message-input');
      sendButton = document.getElementById('send-button');
      assistantDropdown = document.getElementById('assistant-dropdown');
      assistantSelector = document.getElementById('assistant-selector');
      assistantOptions = document.getElementById('assistant-options');
      assistantDescription = document.getElementById('assistant-description');
      
      // Check again
      let stillMissing = [];
      for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
          stillMissing.push(name);
        }
      }
      
      if (stillMissing.length === 0) {
        console.log('Required elements found after delay, initializing...');
        initialize();
      } else {
        console.error(`Still missing elements after delay: ${stillMissing.join(', ')}`);
        return;
      }
    }, 1000);
    
    return;
  }
  
  // Initialize the assistant
  initialize();
});

// Add a global error handler that will attempt recovery
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
  
  // Only handle errors from our own scripts
  const errorSource = event.filename || '';
  if (errorSource.includes('ai-assistant-core.js') || 
      errorSource.includes('ai-response-handler.js') ||
      errorSource.includes('inline-change-visualizer.js')) {
    
    console.log('Error in AI assistant component, attempting recovery...');
    
    // Add a retry button if initialization has already happened
    if (window.editorInitialized) {
      addRetryButton();
    }
  }
});
  
/**
 * Modified initialize function with proper sequencing
 */
async function initialize() {
  try {
    console.log('Starting AI Assistant initialization');
    
    // Add this section to test connectivity first
    const connectionTest = await testNetlifyConnection();
    if (!connectionTest) {
      console.warn('Initial connection test failed - proceeding anyway but expect issues');
      // You could also choose to show an error and return early here
    } else {
      console.log('Connection test successful!');
    }

    // Clear any previous error state
    showLoadingState('Loading AI assistants...');
    
    // Get record ID from URL with fallback mechanism
    recordId = getRecordIdFromUrl();
    
    if (!recordId) {
      showError('No record ID found. Please ensure you are viewing a specific content item.');
      return;
    }
    
    console.log('Record ID found:', recordId);
    
    // Initialize AI handler if editor is ready with better error handling
    // Wait for this to complete before proceeding
    const handlerInitialized = await initializeAIHandler();
    console.log("Handler initialization completed:", handlerInitialized);
    
    // Load assistants from Airtable with retry mechanism
    let assistants = [];
    try {
      assistants = await loadAvailableAssistantsWithRetry(recordId, 3);
    } catch (error) {
      console.error('Failed to load assistants after retries:', error);
      showError('Unable to connect to assistant service. Please refresh the page or try again later.');
      return;
    }
    
    if (assistants.length === 0) {
      showError('No assistants are available for this content. Please link some assistants in Airtable.');
      return;
    }
    
    // Store the assistant list
    assistantList = assistants;
    console.log('Loaded assistants:', assistantList.length);
    
    // Populate dropdown with available assistants
    populateAssistantDropdown(assistants);
    
    // Enable the input
    if (messageInput) messageInput.disabled = false;
    if (sendButton) sendButton.disabled = false;
    
    // Set up event listeners
    setupEventListeners();
    
    // Add test button if in development mode
    if (window.location.hostname.includes('localhost') || 
        window.location.hostname.includes('127.0.0.1') ||
        window.location.search.includes('debug=true')) {
      addTestButton();
    }
    
    console.log('AI Assistant initialization completed successfully');
    
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize the AI assistant. Please try refreshing the page.');
    
    // Add a retry button for user-initiated retry
    addRetryButton();
  }
}

/**
 * Show error with retry option
 */
function showError(message) {
  const container = chatContainer || document.getElementById('chat-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="error-container">
      <p style="color: #b91c1c; margin-bottom: 15px;">${message}</p>
      <button id="retry-button" style="background-color: #109FCC; color: white; border: none; padding: 8px 16px; cursor: pointer;">
        Retry Connection
      </button>
    </div>
  `;
  
  // Update description
  if (assistantDescription) {
    assistantDescription.textContent = 'Connection error';
  }
  
  // Update dropdown
  if (assistantDropdown) {
    assistantDropdown.textContent = 'No assistants available';
  }
  
  // Add click handler to retry button
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', function() {
      initialize();
    });
  }
}

/**
 * Show loading state
 */
function showLoadingState(message) {
  const container = chatContainer || document.getElementById('chat-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div>${message}</div>
    </div>
  `;
}

/**
 * Add a manual retry button
 */
function addRetryButton() {
  const container = document.querySelector('.assistant-container');
  if (!container) return;
  
  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry Connection';
  retryBtn.style.backgroundColor = '#109FCC';
  retryBtn.style.color = 'white';
  retryBtn.style.border = 'none';
  retryBtn.style.padding = '8px 12px';
  retryBtn.style.marginTop = '10px';
  retryBtn.style.cursor = 'pointer';
  
  retryBtn.onclick = function() {
    initialize();
  };
  
  // Insert at the top of the container
  if (container.firstChild) {
    container.insertBefore(retryBtn, container.firstChild);
  } else {
    container.appendChild(retryBtn);
  }
}

/**
 * Initialize AI handler with improved visualizer handling
 */
function initializeAIHandler() {
  return new Promise((resolve) => {
    console.log('Initializing AI Handler');
    
    // Function to attempt handler creation
    const createHandler = () => {
      if (window.editorQuill && window.SimpleAIHandler) {
        try {
          // Check if visualizer is available
          if (window.InlineChangeVisualizer) {
            console.log("InlineChangeVisualizer found, creating handler");
          } else {
            console.warn("InlineChangeVisualizer still not available");
          }
          
          window.aiHandler = new SimpleAIHandler(window.editorQuill);
          console.log("AI Handler initialized with Quill editor");
          resolve(true);
          return true;
        } catch (e) {
          console.error("Error initializing AI Handler:", e);
        }
      }
      return false;
    };
    
    // First, check if we need to load the visualizer
    if (!window.InlineChangeVisualizer && !window.visualizerLoading) {
      console.log("InlineChangeVisualizer not loaded, loading from CDN...");
      
      // Set the flag to prevent multiple loads
      window.visualizerLoading = true;
      
      const script = document.createElement('script');
      script.src = 'https://lively-bombolone-92a577.netlify.app/js/inline-change-visualizer.js';
      
      script.onload = function() {
        console.log("InlineChangeVisualizer loaded from CDN");
        window.visualizerLoaded = true;
        
        // Wait a moment for the script to initialize
        setTimeout(() => {
          if (!createHandler()) {
            setupRetry(resolve);
          }
        }, 300);
      };
      
      script.onerror = function() {
        console.error("Failed to load InlineChangeVisualizer from CDN");
        window.visualizerLoading = false;
        
        // Try to initialize handler anyway, but it won't have visualization capabilities
        if (!createHandler()) {
          setupRetry(resolve);
        }
      };
      
      document.head.appendChild(script);
    }
    // If visualizer is already loaded or loading
    else if (window.visualizerLoaded || window.visualizerLoading) {
      console.log("InlineChangeVisualizer is already loading or loaded");
      
      // If we know it's loaded, try immediately
      if (window.visualizerLoaded) {
        if (!createHandler()) {
          setupRetry(resolve);
        }
      }
      // Otherwise, wait a bit for it to finish loading
      else {
        setTimeout(() => {
          if (!createHandler()) {
            setupRetry(resolve);
          }
        }, 500);
      }
    }
    // If the visualizer isn't available and we can't load it
    else {
      console.warn("Unable to load InlineChangeVisualizer, proceeding without visualization");
      
      if (!createHandler()) {
        setupRetry(resolve);
      }
    }
  });
}

// Helper function to set up retry mechanism
function setupRetry(resolveFunction) {
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 1000;
  
  const checkInterval = setInterval(() => {
    retryCount++;
    console.log(`Retry ${retryCount}/${maxRetries} for AI Handler initialization`);
    
    if (window.editorQuill && window.SimpleAIHandler) {
      try {
        window.aiHandler = new SimpleAIHandler(window.editorQuill);
        console.log("AI Handler initialized after retry");
        clearInterval(checkInterval);
        resolveFunction(true);
        return;
      } catch (e) {
        console.error("Error initializing AI Handler on retry:", e);
      }
    }
    
    if (retryCount >= maxRetries) {
      console.warn("Max retries reached for AI Handler initialization");
      clearInterval(checkInterval);
      resolveFunction(false);
    }
  }, retryDelay);
  
  // Stop trying after 10 seconds regardless
  setTimeout(() => {
    if (checkInterval) {
      clearInterval(checkInterval);
      console.log("Stopped AI Handler initialization retries after timeout");
      resolveFunction(false);
    }
  }, 10000);
}

/**
 * Load available assistants with retry mechanism
 */
async function loadAvailableAssistantsWithRetry(recordId, maxRetries = 3) {
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempt ${retryCount + 1}/${maxRetries} to load assistants`);
      const assistants = await loadAvailableAssistants(recordId);
      return assistants;
    } catch (error) {
      lastError = error;
      console.error(`Error loading assistants (attempt ${retryCount + 1}/${maxRetries}):`, error);
      retryCount++;
      
      if (retryCount < maxRetries) {
        // Exponential backoff
        const delay = 1000 * Math.pow(2, retryCount - 1);
        console.log(`Waiting ${delay}ms before next attempt`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we've exhausted retries, throw the last error
  throw lastError || new Error('Failed to load assistants after maximum retries');
}
  
/**
 * Load available assistants for the current content with improved error handling
 */
async function loadAvailableAssistants(recordId) {
  try {
    console.log(`Loading assistants for record ID: ${recordId}`);
    
    // Use Netlify function as a proxy to Airtable
    // Use the full, absolute URL instead of replacing parts
const proxyEndpoint = 'https://lively-bombolone-92a577.netlify.app/.netlify/functions/airtable-proxy';
    console.log('Using proxy endpoint:', proxyEndpoint);
    
    const response = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin', // Match with your other fetch calls
      body: JSON.stringify({
        operation: 'getAssistants',
        recordId: recordId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch assistants: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // If we get an empty response, try a fallback query
    if (!data.records || data.records.length === 0) {
      console.log('No active assistants found, trying fallback...');
      
      // We don't have linkedAssistantIds here, so we can't use a fallback query directly
      // Instead, just return the empty result
      return [];
    }
    
    return data.records || [];
  } catch (error) {
    console.error('Error loading assistants:', error);
    throw error;
  }
}

// Utility function to check if a DOM element exists and is visible
function isElementReadyAndVisible(selector) {
  const element = document.querySelector(selector);
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

// Document ready with fallbacks
function onDocumentReady(callback) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(callback, 1);
  } else {
    document.addEventListener('DOMContentLoaded', callback);
    
    // Fallback if DOMContentLoaded doesn't fire (e.g., in some Softr environments)
    setTimeout(() => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        callback();
      }
    }, 2000);
  }
}

// Add window load event as another initialization trigger
window.addEventListener('load', function() {
  console.log('Window load event triggered');
  
  // If the chat container is still showing loading after the page has fully loaded,
  // try initializing again
  setTimeout(() => {
    const container = document.getElementById('chat-container');
    if (container && container.querySelector('.loading-container')) {
      console.log('Chat still loading after window load, attempting re-initialization');
      initialize();
    }
  }, 1500);
});
  
  /**
   * Add a test button for debugging
   */
  function addTestButton() {
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Inline Changes';
    testBtn.style.backgroundColor = '#109FCC';
    testBtn.style.color = 'white';
    testBtn.style.border = 'none';
    testBtn.style.padding = '8px 12px';
    testBtn.style.marginBottom = '10px';
    testBtn.style.cursor = 'pointer';
    
    testBtn.onclick = function() {
      console.log('Testing inline changes');
      
      if (window.editorQuill && window.InlineChangeVisualizer) {
        console.log('Quill editor found');
        
        // Create a visualizer and test it
        const visualizer = new window.InlineChangeVisualizer(window.editorQuill);
        
        // Get the current selection or use the first paragraph
        let range = window.editorQuill.getSelection();
        
        if (!range) {
          // No selection, use first paragraph
          const text = window.editorQuill.getText();
          const firstParagraphEnd = text.indexOf('\n\n');
          range = { 
            index: 0, 
            length: firstParagraphEnd > 0 ? firstParagraphEnd : Math.min(50, text.length) 
          };
        }
        
        // Get the text at this range
        const originalText = window.editorQuill.getText(range.index, range.length);
        
        // Show test changes
        visualizer.showChanges({
          originalText: originalText,
          suggestedText: "This is AI suggested text that replaces the original selection.",
          range: range,
          onApply: (text) => console.log('Test change applied:', text),
          onReject: () => console.log('Test change rejected')
        });
      } else {
        alert('Quill editor or visualizer not found');
      }
    };
    
    chatContainer.prepend(testBtn);
  }
  
  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Handle dropdown toggling
    assistantDropdown.addEventListener('click', function() {
      assistantSelector.classList.toggle('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
      if (!assistantSelector.contains(event.target)) {
        assistantSelector.classList.remove('open');
      }
    });
    
    // Handle sending messages
    sendButton.addEventListener('click', handleSendMessage);
    
    // Handle Enter key in message input
    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    });
    
    // Adjust textarea height based on content
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });
    
    // Listen for content updates from Editor
    document.addEventListener('contentUpdated', function(event) {
      // Reset selected text when content changes
      currentlySelectedText = null;
      currentlySelectedRange = null;
    });
    
    // Listen for messages about selected text from Editor
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'selectedText') {
        handleTextSelection(event.data);
      }
    });
  }
  
  /**
   * Handle text selection messages from the editor
   */
  function handleTextSelection(data) {
    currentlySelectedText = data.text;
    
    // Store the range information if available
    if (data.range) {
      currentlySelectedRange = data.range;
    } else {
      currentlySelectedRange = null;
    }
    
    // Handle different modes (discuss or improve)
    const mode = data.mode || 'discuss';
    
    if (mode === 'improve') {
      // For 'improve' mode, trigger immediate content improvement
      messageInput.value = "Improve this text with specific suggestions";
      setTimeout(() => handleSendMessage(), 100);
    } else {
      // For 'discuss' mode, just pre-populate the message input
      messageInput.value = `Let's discuss how to improve this text`;
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }
  }
  
  /**
   * Get record ID from URL
   */
  function getRecordIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const recordId = urlParams.get('recordId');
  console.log('Got record ID from URL:', recordId);
  return recordId;
}
  
  /**
   * Populate the dropdown with available assistants
   */
  function populateAssistantDropdown(assistants) {
    // Clear existing options
    assistantOptions.innerHTML = '';
    
    // Add each assistant to the dropdown
    assistants.forEach(assistant => {
      const option = document.createElement('div');
      option.className = 'assistant-option';
      option.dataset.assistant = assistant.fields.Key;
      option.dataset.assistantId = assistant.id;
      option.textContent = assistant.fields.Name;
      assistantOptions.appendChild(option);
      
      // Add click event to select this assistant
      option.addEventListener('click', function() {
        selectAssistant(assistant);
      });
    });
    
    // Select the first assistant by default
    if (assistants.length > 0) {
      selectAssistant(assistants[0]);
    }
  }
  
  /**
   * Select an assistant and initialize chat with greeting
   */
  function selectAssistant(assistant) {
    // Update current assistant
    currentAssistant = assistant.fields.Key;
    
    // Update dropdown display
    assistantDropdown.textContent = assistant.fields.Name;
    
    // Close dropdown
    assistantSelector.classList.remove('open');
    
    // Update description
    assistantDescription.textContent = assistant.fields.Description || '';
    
    // Update profile picture if available
    const profilePic = document.querySelector('.assistant-profile img');
    if (profilePic && assistant.fields.Pic && assistant.fields.Pic[0]) {
      profilePic.src = assistant.fields.Pic[0].url;
      profilePic.alt = assistant.fields.Name;
      document.querySelector('.assistant-profile').style.display = 'flex';
    } else if (profilePic) {
      profilePic.src = 'https://via.placeholder.com/46x46';
      profilePic.alt = 'Assistant';
    }
    
    // Clear chat and add greeting
    chatContainer.innerHTML = '';
    chatHistory = [];
    
    // Use greeting from Airtable if available, otherwise generate a default one
    const greeting = assistant.fields.Greeting || 
      `Hi there! I'm your ${assistant.fields.Name.toLowerCase()}. How can I help you today?`;
    
    addMessage(greeting, false);
    addToHistory(greeting, 'assistant');
  }
  
  /**
   * Show an error in the chat container
   */
  function showError(message) {
    chatContainer.innerHTML = `
      <div class="error-container">
        <p>${message}</p>
      </div>
    `;
    
    // Update description
    assistantDescription.textContent = 'Error loading assistants';
    
    // Update dropdown
    assistantDropdown.textContent = 'No assistants available';
  }
  
  /**
   * Format text in messages (bold, italics, etc.)
   */
  function formatText(text) {
    // Handle bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle italics
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Handle inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Handle line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }
  
  /**
   * Add message to chat history
   */
  function addToHistory(message, role) {
    // Keep history to a reasonable size
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(chatHistory.length - 20);
    }
    
    chatHistory.push({
      role: role,
      content: message
    });
  }
  
  /**
   * Handle sending a message to the AI
   */
  async function handleSendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Check for stored selection from editor buttons
   const storedText = window.sessionStorage.getItem('selectedTextContent');
   const selectionMode = window.sessionStorage.getItem('selectionMode');
  
  if (storedText && selectionMode) {
    // Set the selection text for AI processing
    currentlySelectedText = storedText;
    // Clear storage after use
    window.sessionStorage.removeItem('selectedTextContent');
    window.sessionStorage.removeItem('selectionMode');
  }
    
    // Clear input and reset height
    addMessage(message, true);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
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
    
    // Regular message handling
    await handleRegularMessage(message);
  }
  
  /**
   * Check if the message is a simple implementation command
   */
  function isImplementationCommand(message) {
    const implementCommands = [
      /^implement( it)?$/i, 
      /^do it$/i, 
      /^apply( it)?$/i, 
      /^use( it)?$/i, 
      /^insert( it)?$/i,
      /^yes$/i,
      /^ok$/i,
      /^sounds good$/i
    ];
    return implementCommands.some(regex => regex.test(message));
  }
  
  /**
   * Extract option selection number if present
   */
  function extractOptionSelection(message) {
    const optionSelectionPattern = /^(?:(?:I|Let's|Let) (?:like|choose|prefer|go with|select|use|want|choose|pick)|Use|Select|Choose|Pick|Option|I like option) (?:option |#)?(\d+)\.?$/i;
    const match = message.match(optionSelectionPattern);
    return match ? parseInt(match[1]) : null;
  }
  
  /**
   * Handle implementation commands like "implement it"
   */
  async function handleImplementationCommand() {
    const lastAIMessage = findLastAssistantMessageWithOptions();
    
    if (!lastAIMessage) {
      addMessage("I don't have any previous suggestions to implement. Please ask me to help with something specific.", false);
      return;
    }
    
    // Show typing indicator
    addTypingIndicator();
    
    // Extract options from the last message
    const options = extractOptionsFromMessage(lastAIMessage);
    if (options.length === 0) {
      removeTypingIndicator();
      addMessage("I don't see any specific content to implement.", false);
      return;
    }
    
    // Get context from previous messages
    const originalContent = lastAIMessage.getAttribute('data-original-content') ? 
      JSON.parse(lastAIMessage.getAttribute('data-original-content')) : {};
    
    const userRequests = chatHistory.filter(msg => msg.role === 'user');
    const relevantRequest = userRequests[userRequests.length - 2]?.content || '';
    
    // Implement the first option
    const success = await implementOption(options, 1, originalContent, relevantRequest);
    
    // Remove typing indicator
    removeTypingIndicator();
    
    // Add confirmation message
    const responseMessage = success ? 
      `I've implemented the suggestion for you. The changes have been applied to your document.` :
      `I tried to implement the suggestion, but encountered an issue. Please try again or be more specific.`;
    
    addMessage(responseMessage, false);
  }
  
  /**
   * Handle option selection from user
   */
  async function handleOptionSelection(optionNumber) {
    const lastAIMessage = findLastAssistantMessageWithOptions();
    
    if (!lastAIMessage) {
      addMessage("I don't have any options for you to select from currently.", false);
      return;
    }
    
    // Find options in the last AI message
    const options = extractOptionsFromMessage(lastAIMessage);
    
    if (options.length < optionNumber) {
      addMessage(`I only have ${options.length} options available. Please select a valid option number.`, false);
      return;
    }
    
    // Show typing indicator
    addTypingIndicator();
    
    // Implement the selected option
    const originalContent = lastAIMessage.getAttribute('data-original-content') ? 
      JSON.parse(lastAIMessage.getAttribute('data-original-content')) : {};
    
    // Get context from previous messages
    const userRequests = chatHistory.filter(msg => msg.role === 'user');
    const relevantRequest = userRequests[userRequests.length - 2]?.content || '';
    
    // Smart detection for headline updates
    if (relevantRequest.toLowerCase().includes('headline') || 
        lastAIMessage.innerHTML.toLowerCase().includes('headline') ||
        (originalContent.selectedText && originalContent.selectedText.includes('<h1>'))) {
      currentlySelectedText = "headline";
    }
    
    const success = await implementOption(options, optionNumber, originalContent, relevantRequest);
    
    // Remove typing indicator
    removeTypingIndicator();
    
    // Add confirmation message
    const responseMessage = success ? 
      `I've implemented option ${optionNumber} for you. The changes have been applied to your document.` :
      `I tried to implement option ${optionNumber}, but encountered an issue. Please try again.`;
    
    addMessage(responseMessage, false);
  }
  
 /**
 * Handle regular message to AI
 */
async function handleRegularMessage(message) {
  // Show typing indicator
  addTypingIndicator('thinking');
  
  // Get response from AI
  const response = await sendToAI(message, currentAssistant);
  
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
  
  /**
 * Send message to AI API via serverless function
 */
async function sendToAI(message, assistant) {
  try {
    // Comprehensive initial logging
    console.log('AI Request Initialization:', {
      message: message,
      assistant: assistant,
      recordId: recordId,
      selectedTextPresent: !!currentlySelectedText,
      selectedTextLength: currentlySelectedText ? currentlySelectedText.length : 0
    });

    // Validate required parameters with more detailed error handling
    if (!assistant) {
      console.error('Critical Error: No assistant specified');
      return handleApiError(new Error('No assistant specified for AI call'));
    }

    if (!recordId) {
      console.error('Critical Error: No record ID available');
      return handleApiError(new Error('No content record ID specified'));
    }

    // Determine request type and content characteristics
    const isContentRequest = detectContentRequest(message) || currentlySelectedText;
    const mode = isContentRequest ? 'content' : 'conversation';
    
    // Detect large content scenarios
    const isLargeContent = message.includes('whole piece') || 
                           message.includes('expand') || 
                           message.includes('rewrite') ||
                           message.includes('longer') ||
                           (currentlySelectedText && currentlySelectedText.length > 3000);

    // Prepare comprehensive payload
    const payload = {
      prompt: message,
      assistantType: assistant,
      recordId: recordId,
      interactionMode: mode,
      conversationHistory: chatHistory || [],
      actionOriented: true,
      isLargeContent: isLargeContent
    };

    // Enhanced selected text handling
    if (currentlySelectedText) {
      payload.selectedText = currentlySelectedText;
      payload.interactionMode = 'content'; // Force content mode
      
      // Robust range information inclusion
      if (currentlySelectedRange && 
          !isNaN(currentlySelectedRange.index) && 
          !isNaN(currentlySelectedRange.length)) {
        payload.selectionRange = {
          index: currentlySelectedRange.index,
          length: currentlySelectedRange.length
        };
      }
    }

    // Content size validation
    if (currentlySelectedText) {
      if (currentlySelectedText.length > 15000) {
        return {
          message: `The selected text (${Math.round(currentlySelectedText.length/1000)}KB) is too large. Please select a smaller portion.`,
          suggestedContent: null,
          mode: 'conversation',
          errorType: 'content_too_large'
        };
      }
    }

    // Document size warning for comprehensive operations
    if (message.includes('whole piece') || 
        message.includes('entire document') || 
        message.includes('complete text')) {
      try {
        const editorElement = document.querySelector('.ql-editor');
        if (editorElement && editorElement.innerHTML.length > 20000) {
          return {
            message: `Document size (${Math.round(editorElement.innerHTML.length/1000)}KB) is too large. Please:
1. Select a specific section
2. Ask about a particular paragraph
3. Break your request into smaller parts`,
            suggestedContent: null,
            mode: 'conversation',
            errorType: 'document_too_large'
          };
        }
      } catch (sizeCheckError) {
        console.error('Document size check error:', sizeCheckError);
      }
    }

    // Modified fetch options - FIXES CORS ISSUE
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Remove Origin and other headers that might cause CORS issues
      },
      // Use omit to prevent credentials CORS issues
      credentials: 'omit',
      body: JSON.stringify(payload)
    };
    
    console.log('Sending to AI with options:', fetchOptions);
    
    // Use a CORS-friendly approach
    const response = await fetch(CONFIG.API_ENDPOINT, fetchOptions);

    // Detailed error handling for non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Detailed API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));

    // Reset selected text
    currentlySelectedText = null;

    // Update conversation history
    addToHistory(message, 'user');
    if (data.message) {
      addToHistory(data.message, 'assistant');
    }

    // Content extraction for content mode
    let suggestedContent = null;
    if (mode === 'content') {
      suggestedContent = extractSuggestedContent(data.message);
    }

    return {
      message: data.message,
      suggestedContent: suggestedContent,
      originalContent: data.original || {},
      mode: mode
    };

  } catch (error) {
    console.error('Comprehensive AI API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Use consistent error handling
    return handleApiError(error);
  }
}
  
  /**
   * Handle API errors with user-friendly messages
   */
  function handleApiError(error) {
    // Extract error message
    let errorMessage = error.message || 'Unknown error occurred';
    
    // Check for specific error types and provide helpful messages
    if (errorMessage.includes('token limit') || errorMessage.includes('content too large') || errorMessage.includes('content too long')) {
      return {
        message: `I can't process this much text at once. Please try selecting a smaller portion or breaking your request into smaller parts.`,
        suggestedContent: null,
        mode: 'conversation',
        errorType: 'token_limit'
      };
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        message: `The request timed out. This usually happens when processing very large content. Try selecting a smaller portion of text or breaking your request into parts.`,
        suggestedContent: null,
        mode: 'conversation',
        errorType: 'timeout'
      };
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        message: `I'm getting too many requests right now. Please wait a moment and try again.`,
        suggestedContent: null,
        mode: 'conversation',
        errorType: 'rate_limit'
      };
    }
    
    // Default error message
    return {
      message: `Sorry, I encountered an error: ${errorMessage}. Please try again later.`,
      suggestedContent: null,
      mode: 'conversation',
      errorType: 'general'
    };
  }
  
  /**
   * Helper function for retrying operations with exponential backoff
   */
  async function retryOperation(operation, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    let delay = initialDelay;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check for specific error types
        const isTokenLimitError = error.message && (
          error.message.includes('token limit') || 
          error.message.includes('max tokens') ||
          error.message.includes('content too long')
        );
        
        const isOverloaded = error.message && (
          error.message.includes('status code 529') || 
          error.message.includes('overloaded') ||
          error.message.includes('rate limit') ||
          error.message.includes('status code 429')
        );
        
        const isTimeout = error.message && (
          error.message.includes('timeout') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('504')
        );
        
        // Handle token limit errors differently - don't retry these
        if (isTokenLimitError) {
          throw new Error('Content is too large for AI processing. Try selecting a smaller portion of text.');
        }
        
        // For timeouts and overload errors, use exponential backoff
        if (attempt < maxRetries - 1) {
          // If it's an overload error or timeout, use exponential backoff
          if (isOverloaded || isTimeout) {
            delay = delay * 2; // Double the delay each time
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we've exhausted retries, throw a user-friendly error
    if (lastError.message && lastError.message.includes('timeout')) {
      throw new Error('The request timed out. The content might be too large to process at once.');
    }
    
    throw lastError;
  }
  
  /**
   * Function to detect if a message is requesting content changes
   */
  function detectContentRequest(message) {
    const contentRequestPatterns = [
      /improve|edit|rewrite|revise|update|change|fix|correct|optimize|enhance/i,
      /help me with this|make this better|suggestions for|how would you|what if|offer ideas|consider options|make.*more powerful/i,
      /seo|grammar|spelling|tone|style|clarity|flow|readability|headline|paragraph|content/i,
      /suggest|propose|provide options|alternatives|versions|variations/i
    ];
    
    return contentRequestPatterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Add typing indicator with enhanced progress visualization
   */
  function addTypingIndicator(operationType = 'thinking') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'assistant-message');
    messageElement.id = 'typing-indicator-container';
    
    // Create a more informative indicator based on operation type
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('typing-indicator');
    
    // Different messages based on operation type
    let message = 'Thinking';
    if (operationType === 'processing_large_content') {
      message = 'Processing large content';
    } else if (operationType === 'improving') {
      message = 'Generating improvements';
    } else if (operationType === 'expanding') {
      message = 'Expanding content';
    }
    
    typingIndicator.innerHTML = `${message}<span></span><span></span><span></span>`;
    
    // Add a progress bar for longer operations
    if (operationType !== 'thinking') {
      const progressContainer = document.createElement('div');
      progressContainer.style.width = '100%';
      progressContainer.style.height = '4px';
      progressContainer.style.backgroundColor = '#e0e0e0';
      progressContainer.style.marginTop = '8px';
      progressContainer.style.position = 'relative';
      
      const progressBar = document.createElement('div');
      progressBar.id = 'progress-bar';
      progressBar.style.width = '0%';
      progressBar.style.height = '100%';
      progressBar.style.backgroundColor = '#109FCC';
      progressBar.style.transition = 'width 0.5s ease';
      
      progressContainer.appendChild(progressBar);
      messageElement.appendChild(typingIndicator);
      messageElement.appendChild(progressContainer);
      
      // Simulate progress for long operations
      simulateProgress();
    } else {
      messageElement.appendChild(typingIndicator);
    }
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  /**
   * Simulate progress for long operations
   */
  function simulateProgress() {
    let progress = 0;
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;
    
    const interval = setInterval(() => {
      // Slow start, faster middle, slow end
      if (progress < 30) {
        progress += 0.5;
      } else if (progress < 85) {
        progress += 1;
      } else if (progress < 95) {
        progress += 0.2;
      } else {
        // Hold at 95% until complete
        progress = 95;
      }
      
      progressBar.style.width = `${progress}%`;
      
      // Complete when needed
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 150);
    
    // Store the interval ID to clear it later
    window.progressInterval = interval;
  }
  
  /**
   * Remove typing indicator and clean up any progress animation
   */
  function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator-container');
    if (indicator) {
      chatContainer.removeChild(indicator);
    }
    
    // Clear any progress simulation
    if (window.progressInterval) {
      clearInterval(window.progressInterval);
      window.progressInterval = null;
    }
  }

 /**
   * Add message to the chat
   */
  function addMessage(text, isUser = false, suggestedContent = null, originalContent = {}, mode = 'conversation') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
    
    // Apply formatting
    let formattedText = text;
    
    // Hide code blocks and "Suggested Content:" sections only in content mode
    if (mode === 'content' && suggestedContent) {
      // Hide code blocks
      formattedText = formattedText.replace(/```[\s\S]*?```/g, '');
      
      // Hide "Suggested Content:" sections
      if (formattedText.includes('Suggested Content:')) {
        formattedText = formattedText.split('Suggested Content:')[0].trim();
      }
      
      // Hide "Option X:" sections if we're showing them separately
      if (formattedText.includes('Option 1:') && extractOptions(suggestedContent).length > 1) {
        const firstOptionIndex = formattedText.indexOf('Option 1:');
        if (firstOptionIndex > 0) {
          formattedText = formattedText.substring(0, firstOptionIndex).trim();
        }
      }
    }
    
    formattedText = formatText(formattedText);
    
    // Add the message text
    messageElement.innerHTML = formattedText;
    
    // Only show content preview and apply buttons when there's a suggestion
    if (!isUser && suggestedContent) {
      // Always try to add implementation button for AI responses with content
      // Check if this looks like a first draft when the editor is empty
      if (window.editorQuill && window.editorQuill.getText().trim() === '' && 
          (text.includes('draft') || text.includes('article') || text.includes('content'))) {
        addUseAsDraftButton(messageElement, suggestedContent);
      }
      
      // Store original content as data attribute for later reference
      if (originalContent) {
        messageElement.setAttribute('data-original-content', JSON.stringify(originalContent));
      }
      
      // Always provide implement button for content suggestions
      if (mode === 'content' || text.includes('option') || text.includes('suggest') || 
          text.includes('improve') || text.includes('change') || text.includes('draft')) {
        
        // Extract multiple options if present
        const options = extractOptions(suggestedContent);
        
        // Add a heading for suggested content
        const previewHeading = document.createElement('div');
        previewHeading.style.fontWeight = '600';
        previewHeading.style.marginTop = '16px';
        previewHeading.textContent = options.length > 1 ? 'Suggested Options:' : 'Suggested Content:';
        messageElement.appendChild(previewHeading);
        
        // For multiple options, create individual option containers
        if (options.length > 1) {
          addMultipleOptionsUI(messageElement, options, originalContent);
        } 
        // For a single option, show the content preview and a single "Apply" button
        else {
          addSingleOptionUI(messageElement, options[0], originalContent);
        }
      }
    }
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return messageElement;
  }
  
  /**
 * Add UI for multiple options
 */
function addMultipleOptionsUI(messageElement, options, originalContent) {
  console.log('Adding multiple options UI with', options.length, 'options');
  
  // Create a container for all options
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'all-options-container';
  
  options.forEach((option, index) => {
    // Create a container for each option and its button
    const optionContainer = document.createElement('div');
    optionContainer.className = 'option-container';
    optionContainer.style.margin = '10px 0 20px 0';
    optionContainer.style.padding = '15px';
    optionContainer.style.backgroundColor = '#f9fafb';
    optionContainer.style.border = '1px solid #e5e5e5';
    
    // Add option heading
    const optionHeading = document.createElement('div');
    optionHeading.style.fontWeight = '600';
    optionHeading.style.marginTop = '0'; // Start at top of container
    optionHeading.textContent = `Option ${index + 1}:`;
    optionContainer.appendChild(optionHeading);
    
    // Add option content
    const optionContent = document.createElement('div');
    optionContent.className = 'option-content';
    optionContent.style.margin = '10px 0';
    optionContent.innerHTML = option;
    optionContainer.appendChild(optionContent);
    
    // Add implementation button right below this option
    const implementButton = document.createElement('button');
    implementButton.classList.add('action-button');
    implementButton.style.marginTop = '16px';
    implementButton.style.padding = '8px 16px';
    implementButton.style.backgroundColor = '#109FCC';
    implementButton.style.color = 'white';
    implementButton.style.border = 'none';
    implementButton.style.cursor = 'pointer';
    implementButton.style.fontFamily = 'Montserrat, sans-serif';
    implementButton.style.fontSize = '13px';
    implementButton.style.fontWeight = '500';
    implementButton.style.display = 'inline-block';
    implementButton.style.transition = 'background-color 0.2s';
    implementButton.style.borderRadius = '0';
    implementButton.textContent = `Implement Option ${index + 1}`;
    
    implementButton.addEventListener('click', async () => {
      console.log(`Implement button clicked for option ${index + 1}`);
      // Get the last user request before the options were presented
      const userRequests = chatHistory.filter(msg => msg.role === 'user');
      const relevantRequest = userRequests[userRequests.length - 2]?.content || '';
      
      const success = await implementOption(options, index + 1, originalContent, relevantRequest);
      if (success) {
        // Add success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.style.backgroundColor = '#f0fdf4';
        successMessage.style.border = '1px solid #bbf7d0';
        successMessage.style.padding = '12px 16px';
        successMessage.style.marginTop = '10px';
        successMessage.style.marginBottom = '0';
        successMessage.style.display = 'flex';
        successMessage.style.alignItems = 'center';
        successMessage.style.gap = '8px';
        successMessage.style.borderRadius = '0';
        successMessage.innerHTML = `<span class="success-icon" style="color: #22c55e; font-weight: bold;">✓</span> Option ${index + 1} applied successfully!`;
        optionContainer.appendChild(successMessage);
        
        // Hide all option buttons
        optionsContainer.querySelectorAll('.action-button').forEach(btn => {
          btn.style.display = 'none';
        });
      } else {
        // Add failure message
        const failureMessage = document.createElement('div');
        failureMessage.style.color = 'red';
        failureMessage.style.marginTop = '10px';
        failureMessage.style.marginBottom = '0';
        failureMessage.textContent = 'Failed to apply changes. Please try again.';
        optionContainer.appendChild(failureMessage);
      }
    });
    
    optionContainer.appendChild(implementButton);
    
    // Add this option container to the main options container
    optionsContainer.appendChild(optionContainer);
  });
  
  // Add all options container to the message
  messageElement.appendChild(optionsContainer);
}
  
  /**
   * Add UI for a single option
   */
  function addSingleOptionUI(messageElement, optionContent, originalContent) {
    // Add the content preview
    const contentPreview = document.createElement('div');
    contentPreview.className = 'content-preview';
    contentPreview.style.display = 'block';
    contentPreview.innerHTML = optionContent.replace(/\n/g, '<br>');
    messageElement.appendChild(contentPreview);
    
    // Add standard apply button for single suggestion
    const actionButton = document.createElement('button');
    actionButton.classList.add('action-button');
    actionButton.style.borderRadius = '0'; // No rounded corners
    actionButton.textContent = originalContent && originalContent.selectedText ? 
      'Apply to Selected Text' : 'Apply Changes';
      
    actionButton.addEventListener('click', async () => {
      // Get context from previous user message
      const userRequests = chatHistory.filter(msg => msg.role === 'user');
      const relevantRequest = userRequests[userRequests.length - 2]?.content || '';
      
      // Apply changes
      let success = false;
      
      if (originalContent && originalContent.selectedText) {
        // For selected text, use direct Quill updates with accurate range information
        const options = { searchText: originalContent.selectedText };
        
        // If we have range information, use it
        if (originalContent.selectionRange) {
          options.range = originalContent.selectionRange;
        }
        
        // Detect heading replacements
        if (originalContent.selectedText.includes('<h1>') || 
            originalContent.selectedText.includes('<h2>') ||
            originalContent.selectedText.includes('<h3>')) {
          options.position = 'replace-heading';
        }
        
        success = await directQuillUpdate(optionContent, options);
      } else {
        // Use the user request for context about placement
        const requestPosition = interpretRequest(relevantRequest || '');
        success = await directQuillUpdate(optionContent, { position: requestPosition });
      }
      
      if (success) {
        // Add success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.style.marginTop = '10px';
        successMessage.style.marginBottom = '0';
        successMessage.style.borderRadius = '0'; // No rounded corners
        successMessage.innerHTML = '<span class="success-icon">✓</span> Changes applied successfully!';
        messageElement.appendChild(successMessage);
        
        // Remove the apply button
        actionButton.style.display = 'none';
      } else {
        // Add failure message
        const failureMessage = document.createElement('div');
        failureMessage.style.color = 'red';
        failureMessage.style.marginTop = '10px';
        failureMessage.style.marginBottom = '0';
        failureMessage.textContent = 'Failed to apply changes. Please try again.';
        messageElement.appendChild(failureMessage);
      }
    });
    
    messageElement.appendChild(actionButton);
  }
  
  /**
   * Add "Use as Draft" button for empty documents
   */
  function addUseAsDraftButton(messageElement, content) {
    // Check if button already exists (to avoid duplicates)
    if (messageElement.querySelector('.draft-button')) return;
    
    const draftButton = document.createElement('button');
    draftButton.classList.add('action-button', 'draft-button');
    draftButton.textContent = 'Use as Draft in Editor';
    draftButton.style.marginTop = '10px';
    
    draftButton.addEventListener('click', () => {
      // Get the Quill instance
      if (window.editorQuill) {
        // Clear the editor and insert the content
        window.editorQuill.setText('');
        window.editorQuill.clipboard.dangerouslyPasteHTML(0, content);
        
        // Trigger save
        setTimeout(() => {
          const event = new Event('text-change', { bubbles: true });
          window.editorQuill.root.dispatchEvent(event);
        }, 100);
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.innerHTML = '<span class="success-icon">✓</span> Draft inserted into editor!';
        messageElement.appendChild(successMessage);
        
        // Hide the button
        draftButton.style.display = 'none';
      }
    });
    
    messageElement.appendChild(draftButton);
  }
  
  /**
   * Helper function to find the last assistant message that has options
   */
  function findLastAssistantMessageWithOptions() {
    const messages = chatContainer.querySelectorAll('.assistant-message');
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const contentPreview = message.querySelector('.content-preview');
      
      if (contentPreview && (
          contentPreview.innerHTML.includes('Option 1') || 
          contentPreview.innerHTML.includes('suggestion-option')
      )) {
        return message;
      }
    }
    
    return null;
  }
  
  /**
   * Helper function to extract options from a message element
   */
  function extractOptionsFromMessage(messageElement) {
    const contentPreview = messageElement.querySelector('.content-preview');
    if (!contentPreview) return [];
    
    return extractOptions(contentPreview.innerHTML);
  }
  
  /**
   * Function to extract multiple options from suggested content
   */
  function extractOptions(suggestedContent) {
    if (!suggestedContent) return [];
    
    // Check if we have a div with suggestion-options class
    if (suggestedContent.includes('suggestion-options')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = suggestedContent;
      
      // Get all option content divs
      const optionContents = tempDiv.querySelectorAll('.option-content');
      if (optionContents && optionContents.length > 0) {
        return Array.from(optionContents).map(div => div.innerHTML);
      }
    }
    
    // Alternative: look for Option 1, Option 2, etc. in the content
    const optionPattern = /Option\s+(\d+)[\s\n]*:[\s\n]*([\s\S]*?)(?=(?:\s*Option\s+\d+[\s\n]*:)|$)/gi;
    const matches = [...suggestedContent.matchAll(optionPattern)];
    
    if (matches && matches.length > 0) {
      return matches.map(match => match[2].trim());
    }
    
    // No multiple options found, treat the whole content as one option
    return [suggestedContent];
    }
  
  /**
   * Helper function to escape regex special characters
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

/**
 * Format AI response to hide markup tags but only show comments
 */
function formatResponseForDisplay(responseText) {
  if (!responseText) return '';
  
  // Extract only the comment section
  let commentText = '';
  const commentMatch = responseText.match(/\[COMMENT\]([\s\S]*?)\[\/COMMENT\]/i);
  if (commentMatch && commentMatch[1]) {
    commentText = commentMatch[1].trim();
    return commentText; // Only return the comment text
  }
  
  // If no comment section found, return a cleaned version of the original
  // This removes all markup tags
  return responseText
    .replace(/\[COMMENT\]([\s\S]*?)\[\/COMMENT\]/gi, '')
    .replace(/\[OPTIONS\]([\s\S]*?)\[\/OPTIONS\]/gi, '')
    .replace(/\[REWRITE\]([\s\S]*?)\[\/REWRITE\]/gi, '')
    .trim();
}
  
  /**
 * Extract suggested content from AI response
 */
function extractSuggestedContent(responseMessage) {
  if (!responseMessage) return null;
  
  try {
    // Helper function to clean code block markers
    function cleanCodeBlockMarkers(content) {
      return content.replace(/```html\n/g, '').replace(/```\n/g, '').replace(/```/g, '');
    }
    
    // First priority: Look for [OPTIONS] and [REWRITE] structured format
    const optionsBlock = responseMessage.match(/\[OPTIONS\]([\s\S]*?)\[\/OPTIONS\]/i);
    if (optionsBlock) {
      console.log('Found [OPTIONS] block in response');
      const optionsContent = optionsBlock[1];
      const formattedOptions = '<div class="suggestion-options">\n' + 
        optionsContent.replace(/Option\s+(\d+):\s*([\s\S]*?)(?=Option\s+\d+:|$)/gi, 
          (match, num, content) => `<div class="suggestion-option">
            <h4>Option ${num}:</h4>
            <div class="option-content">${sanitizeContent(content.trim())}</div>
          </div>\n`
        ) + '</div>';
      
      return formattedOptions;
    }
    
    const rewriteMatch = responseMessage.match(/\[REWRITE\]([\s\S]*?)\[\/REWRITE\]/i);
    if (rewriteMatch) {
      console.log('Found [REWRITE] block in response');
      return sanitizeContent(rewriteMatch[1].trim());
    }
    
    // Check for Option 1, Option 2 format
    const optionMatch = responseMessage.match(/Option\s+\d+\s*:/);
    if (optionMatch) {
      console.log('Found Option format in response');
      // Extract everything starting from the first option
      const optionStartIndex = responseMessage.indexOf(optionMatch[0]);
      let optionsContent = responseMessage.substring(optionStartIndex);
      
      // Format the options with proper HTML
      // Check if options have HTML tags
      if (optionsContent.includes('<') && optionsContent.includes('>')) {
        return sanitizeContent(optionsContent);
      } else {
        // Add a div wrapper for the options
        let formattedOptions = '<div class="suggestion-options">\n';
        
        // Extract each option
        const optionPattern = /Option\s+(\d+)\s*:([\s\S]*?)(?=(?:\s*Option\s+\d+\s*:)|$)/g;
        let optionMatch;
        let foundOptions = false;
        
        while ((optionMatch = optionPattern.exec(optionsContent)) !== null) {
          foundOptions = true;
          const optionNumber = optionMatch[1];
          let optionContent = optionMatch[2].trim();
          
          // Clean code block markers
          optionContent = cleanCodeBlockMarkers(optionContent);
          
          // Convert to HTML if it looks like markdown
          if (optionContent.startsWith('#') || 
              (optionContent.includes('#') && !optionContent.includes('<'))) {
            optionContent = convertMarkdownToHtml(optionContent);
          }
          // If it's not HTML already, wrap it in paragraph tags
          else if (!optionContent.includes('<') && !optionContent.includes('>')) {
            optionContent = `<p>${optionContent}</p>`;
          }
          
          formattedOptions += `<div class="suggestion-option">
            <h4>Option ${optionNumber}:</h4>
            <div class="option-content">${optionContent}</div>
          </div>\n`;
        }
        
        formattedOptions += '</div>';
        
        if (foundOptions) {
          return formattedOptions;
        }
      }
    }
    
    // Look for content after "Suggested Content:" heading
    if (responseMessage.includes('Suggested Content:')) {
      console.log('Found Suggested Content section');
      const parts = responseMessage.split('Suggested Content:');
      if (parts.length > 1) {
        let content = parts[1].trim();
        
        // Check if there are backticks in this section
        const backtickMatch = content.match(/```([\s\S]*?)```/);
        if (backtickMatch && backtickMatch.length > 1) {
          // Extract content from backticks if present
          let extractedContent = backtickMatch[1].trim();
          
          // Clean code block markers
          extractedContent = cleanCodeBlockMarkers(extractedContent);
          
          // If content might be markdown, convert it
          if (extractedContent.startsWith('#') || 
              (extractedContent.includes('#') && !extractedContent.includes('<'))) {
            extractedContent = convertMarkdownToHtml(extractedContent);
          }
          // If it's not HTML already, wrap it in paragraph tags
          else if (!extractedContent.includes('<') && !extractedContent.includes('>')) {
            extractedContent = `<p>${extractedContent}</p>`;
          }
          
          return sanitizeContent(extractedContent);
        }
        
        // If no backticks, look for direct HTML content
        if (content.includes('<') && content.includes('>')) {
          // Look for the first HTML tag
          const htmlStart = content.indexOf('<');
          content = content.substring(htmlStart);
          
          // Clean code block markers
          content = cleanCodeBlockMarkers(content);
          
          // If there's another heading after, only take content up to that heading
          const nextHeadingMatch = content.match(/\n\s*([A-Z][A-Za-z\s]+:)/);
          if (nextHeadingMatch && nextHeadingMatch.index) {
            content = content.substring(0, nextHeadingMatch.index).trim();
          }
          
          return sanitizeContent(content);
        }
        
        // If neither backticks nor HTML, just use the raw content
        // If there's another heading or section, only take until that point
        const nextHeadingMatch = content.match(/\n\s*([A-Z][A-Za-z\s]+:)/);
        if (nextHeadingMatch && nextHeadingMatch.index) {
          content = content.substring(0, nextHeadingMatch.index).trim();
        }
        
        // Clean code block markers
        content = cleanCodeBlockMarkers(content);
        
        // If content might be markdown, convert it
        if (content.startsWith('#') || 
            (content.includes('#') && !content.includes('<'))) {
          content = convertMarkdownToHtml(content);
        }
        // If it's not HTML already, wrap it in paragraph tags
        else if (!content.includes('<') && !content.includes('>')) {
          content = `<p>${content}</p>`;
        }
        
        return sanitizeContent(content);
      }
    }
    
    // Second priority: Look for content in backticks
    const backtickMatches = [...responseMessage.matchAll(/```([\s\S]*?)```/g)];
    if (backtickMatches && backtickMatches.length > 0) {
      // Use the last backtick block (most likely to be the suggestion)
      const lastMatch = backtickMatches[backtickMatches.length - 1];
      let suggestedContent = lastMatch[1].trim();
      
      // Clean code block markers
      suggestedContent = cleanCodeBlockMarkers(suggestedContent);
      
      // Convert markdown to HTML if needed
      if (suggestedContent.startsWith('#') || 
          (suggestedContent.includes('#') && !suggestedContent.includes('<'))) {
        suggestedContent = convertMarkdownToHtml(suggestedContent);
      } 
      // If it's not HTML already, wrap it in paragraph tags
      else if (!suggestedContent.includes('<') && !suggestedContent.includes('>')) {
        suggestedContent = `<p>${suggestedContent}</p>`;
      }
      
      return sanitizeContent(suggestedContent);
    }
    
    // No suggestion patterns matched, try using the entire response as content
    if (responseMessage.includes('[COMMENT]') && responseMessage.includes('[/COMMENT]')) {
      // The response has structure but no explicit content sections
      // Try to use everything after [/COMMENT] as content
      const commentEndIndex = responseMessage.indexOf('[/COMMENT]') + 10;
      if (commentEndIndex < responseMessage.length) {
        let remainingContent = responseMessage.substring(commentEndIndex).trim();
        if (remainingContent) {
          // Clean and format it
          remainingContent = sanitizeContent(remainingContent);
          if (!remainingContent.includes('<') && !remainingContent.includes('>')) {
            remainingContent = `<p>${remainingContent}</p>`;
          }
          return remainingContent;
        }
      }
    }
    
    // No suggestion patterns matched
    console.log('No content patterns matched in response');
    return null;
    
  } catch (error) {
    console.error('Error in extractSuggestedContent:', error);
    return null;
  }
}
  
  /**
   * Helper function to clean and sanitize HTML content
   */
  function sanitizeContent(html) {
    if (!html) return '';
    
    // Step 1: Basic cleanup - remove excess whitespace and empty elements
    let cleaned = html
      .replace(/>\s+</g, '><')         // Remove whitespace between tags
      .replace(/<p>\s*<\/p>/g, '')     // Remove empty paragraphs
      .replace(/<h[1-6]><br><\/h[1-6]>/gi, '')  // Remove empty headings with breaks
      .replace(/<p><br><\/p>/gi, '')   // Remove paragraphs with just breaks
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>')  // Reduce multiple breaks
      .replace(/\s{2,}/g, ' ');        // Normalize spaces
    
    // Step 2: Fix malformed tags and structure
    cleaned = cleaned
      .replace(/<\/p><\/p>/g, '</p>')  // Fix duplicate closing paragraph tags
      .replace(/<\/h[1-6]><\/h[1-6]>/g, '</h1>')  // Fix duplicate closing heading tags
      .replace(/<p><h([1-6])>(.*?)<\/h\1><\/p>/g, '<h$1>$2</h$1>')  // Fix nested headings
      .replace(/<!--[\s\S]*?-->/g, '');  // Remove HTML comments
    
    // Step 3: Clean up duplicate content fragments
    const paragraphs = cleaned.match(/<p[^>]*>(.*?)<\/p>/g) || [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const content = paragraph.replace(/<[^>]*>/g, '');
      
      // Look for repeated phrases of 3+ words
      const words = content.split(' ');
      if (words.length > 10) {
        for (let phraseLength = 3; phraseLength < 8; phraseLength++) {
          const lastPhrase = words.slice(-phraseLength).join(' ');
          const earlierContent = words.slice(0, -phraseLength).join(' ');
          
          if (earlierContent.includes(lastPhrase)) {
            // Remove repetition
            const cleanedContent = content.substring(0, content.lastIndexOf(lastPhrase));
            const cleanedParagraph = `<p>${cleanedContent}</p>`;
            cleaned = cleaned.replace(paragraph, cleanedParagraph);
            break;
          }
        }
      }
    }
    
    // Step 4: Remove strange fragments
    const fragmentPatterns = [
      /<p>([a-z] [a-z]+\.[a-z]+\.)<\/p>/g,  // e.g., "y coexist.xist."
      /<p>([a-z]+\.[a-z]+\.)<\/p>/g,        // e.g., "coexist.xist."
      /<p>([a-z]{1,3})<\/p>/g                // Single very short word paragraphs
    ];
    
    fragmentPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    return cleaned;
  }
  
  /**
   * Convert markdown to HTML
   */
  function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // First, handle heading conversions
    // Convert # Heading to <h1>Heading</h1>, ## Heading to <h2>Heading</h2>, etc.
    let html = markdown.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    
    // Handle paragraphs - text blocks separated by empty lines
    html = html.replace(/^(?!<h[1-6]>)(.*$)/gm, function(match) {
      if (match.trim() === '') return '';
      return '<p>' + match + '</p>';
    });
    
    // Clean up any empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
  }
  
  /**
   * Function to interpret user requests and determine insertion position
   */
  function interpretRequest(message) {
    const lowerMsg = message.toLowerCase();
    
    // More specific patterns for different parts of the document
    if (lowerMsg.includes('headline') || lowerMsg.includes('title') || lowerMsg.includes('heading')) {
      return 'replace-heading';
    }
    
    if (lowerMsg.match(/first\s+paragraph|opening\s+paragraph|introduction/i)) {
      return 'replace-paragraph-1';
    }
    
    if (lowerMsg.match(/second\s+paragraph|2nd\s+paragraph/i)) {
      return 'replace-paragraph-2';
    }
    
    if (lowerMsg.match(/last\s+paragraph|final\s+paragraph|ending|conclusion/i)) {
      return 'replace-last-paragraph';
    }
    
    if (lowerMsg.includes('beginning') || lowerMsg.includes('start')) {
      return 'beginning';
    }
    
    if (lowerMsg.includes('end') || lowerMsg.includes('bottom')) {
      return 'end';
    }
    
    // For specific phrase replacements
    if (lowerMsg.match(/phrase|term|word|expression/i)) {
      return 'find-and-replace';
    }
    
    // Default to end if nothing specific is found
    return 'end';
  }
  
  /**
   * Implement a specific option
   */
  async function implementOption(options, optionNumber, originalContent, userRequest) {
    // Validate option number
    const index = optionNumber - 1; // Convert to 0-based index
    if (index < 0 || index >= options.length) {
      console.error(`Invalid option number: ${optionNumber}. Only ${options.length} options available.`);
      return false;
    }
    
    // Get the selected option content
    const selectedOption = options[index];
    
    // Determine the appropriate placement strategy
    let updateOptions = {};
    
    // Case 1: We have Quill selection range
    if (currentlySelectedRange && 
        !isNaN(currentlySelectedRange.index) && 
        !isNaN(currentlySelectedRange.length)) {
      updateOptions.range = currentlySelectedRange;
    }
    // Case 2: We have original selected text 
    else if (originalContent && originalContent.selectedText) {
      // Is this a headline?
      const isHeadline = 
        originalContent.selectedText.includes("<h1>") || 
        originalContent.selectedText.includes("<h2>") || 
        currentlySelectedText === "headline";
      
      if (isHeadline) {
        updateOptions.position = 'replace-heading';
      } else {
        updateOptions.searchText = originalContent.selectedText;
      }
    }
    // Case 3: Use context from user request for positioning
    else {
      const requestPosition = interpretRequest(userRequest || '');
      updateOptions.position = requestPosition;
      
      // For specific paragraph placements
      if (requestPosition === 'replace-paragraph-1') {
        updateOptions.position = 'replace-paragraph';
        updateOptions.paragraphIndex = 0;
      } else if (requestPosition === 'replace-paragraph-2') {
        updateOptions.position = 'replace-paragraph';
        updateOptions.paragraphIndex = 1;
      } else if (requestPosition === 'replace-last-paragraph') {
        const structure = analyzeDocumentStructure();
        updateOptions.position = 'replace-paragraph';
        updateOptions.paragraphIndex = structure.paragraphs.length - 1;
      }
    }
    
    // Perform the update using the direct Quill update function
    return directQuillUpdate(selectedOption, updateOptions);
  }
  
  /**
   * Analyze document structure using Quill API
   */
  function analyzeDocumentStructure() {
    if (!window.editorQuill) return null;
    
    const content = window.editorQuill.root.innerHTML;
    const text = window.editorQuill.getText();
    
    // Parse headings, paragraphs, and lists
    const headings = [];
    const paragraphs = [];
    
    // Use DOM parsing for better structure analysis
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // Find all headings
    const headingElements = doc.querySelectorAll('h1, h2, h3');
    headingElements.forEach((h, index) => {
      headings.push({
        text: h.textContent,
        level: parseInt(h.tagName[1]),
        index: getPositionInQuill(h.textContent),
        position: index === 0 ? 'first' : index === headingElements.length - 1 ? 'last' : 'middle'
      });
    });
    
    // Find all paragraphs
    const paragraphElements = doc.querySelectorAll('p');
    paragraphElements.forEach((p, index) => {
      paragraphs.push({
        text: p.textContent,
        index: getPositionInQuill(p.textContent),
        position: index === 0 ? 'first' : index === paragraphElements.length - 1 ? 'last' : 'middle'
      });
    });
    
    // Helper function to find text position in Quill
    function getPositionInQuill(text) {
      const fullText = window.editorQuill.getText();
      return fullText.indexOf(text);
    }
    
    return {
      headings,
      paragraphs,
      totalParagraphs: paragraphElements.length,
      hasHeading: headingElements.length > 0,
      isEmpty: text.trim().length === 0
    };
  }
  
  /**
   * Update content directly using the Quill API
   */
  function directQuillUpdate(newContent, options = {}) {
    const quill = window.editorQuill;
    if (!quill) {
      console.error('Quill instance not found');
      return false;
    }
    
    // Sanitize the content first
    newContent = sanitizeContent(newContent);
    
    try {
      // Different update strategies based on the options
      if (options.range && !isNaN(options.range.index) && !isNaN(options.range.length)) {
        // Option 1: Use a specific range
        quill.deleteText(options.range.index, options.range.length);
        quill.clipboard.dangerouslyPasteHTML(options.range.index, newContent);
      } 
      else if (options.position === 'beginning') {
        // Option 2: Insert at the beginning
        quill.clipboard.dangerouslyPasteHTML(0, newContent);
      } 
      else if (options.position === 'end') {
        // Option 3: Append at the end
        const length = quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(length, newContent);
      } 
      else if (options.position === 'replace-heading') {
        // Option 4: Replace the first heading
        const structure = analyzeDocumentStructure();
        if (structure && structure.headings.length > 0) {
          const heading = structure.headings[0];
          quill.deleteText(heading.index, heading.text.length);
          quill.clipboard.dangerouslyPasteHTML(heading.index, newContent);
        } else {
          // No heading found, insert at beginning
          quill.clipboard.dangerouslyPasteHTML(0, newContent);
        }
      } 
      else if (options.position === 'replace-paragraph' && options.paragraphIndex !== undefined) {
        // Option 5: Replace a specific paragraph
        const structure = analyzeDocumentStructure();
        if (structure && structure.paragraphs.length > options.paragraphIndex) {
          const paragraph = structure.paragraphs[options.paragraphIndex];
          quill.deleteText(paragraph.index, paragraph.text.length);
          quill.clipboard.dangerouslyPasteHTML(paragraph.index, newContent);
        } else {
          // Paragraph not found, append at end
          const length = quill.getLength();
          quill.clipboard.dangerouslyPasteHTML(length, newContent);
        }
      }
      else if (options.searchText) {
        // Option 6: Find and replace text
        const quillText = quill.getText();
        const plainSearchText = options.searchText.replace(/<[^>]*>/g, '');
        const index = quillText.indexOf(plainSearchText);
        
        if (index !== -1) {
          quill.deleteText(index, plainSearchText.length);
          quill.clipboard.dangerouslyPasteHTML(index, newContent);
        } else {
          // Try keyword matching as a fallback
          const contentWords = newContent.replace(/<[^>]*>/g, '').trim().split(' ').filter(w => w.length > 4);
          
          let found = false;
          for (const word of contentWords) {
            const wordIndex = quillText.indexOf(word);
            if (wordIndex !== -1) {
              quill.clipboard.dangerouslyPasteHTML(wordIndex, newContent);
              found = true;
              break;
            }
          }
          
          if (!found) {
            // No match found, append at end
            const length = quill.getLength();
            quill.clipboard.dangerouslyPasteHTML(length, newContent);
          }
        }
      }
      else {
        // Default: Append at end
        const length = quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(length, newContent);
      }
      
      // Trigger a save after the change
      setTimeout(() => {
        const event = new Event('text-change', { bubbles: true });
        quill.root.dispatchEvent(event);
      }, 100);
      
      return true;
    } catch (error) {
      console.error('Error updating content via Quill API:', error);
      return false;
    }
  }
})();
