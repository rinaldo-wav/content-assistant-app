# Content Assistant Editor

A powerful rich text editor with AI assistance for content creation.

## Overview

This project provides a modular, maintainable implementation of a rich text editor with integrated AI assistance. The system consists of:

1. **Quill Editor** - A rich text editor for content creation
2. **AI Assistant** - A chat interface for interacting with Claude AI
3. **Content Integration** - Tools for integrating AI suggestions directly into the content

## File Structure

```
/
├── css/
│   ├── editor.css          # Styles for the Quill editor
│   └── ai-assistant.css    # Styles for the AI Assistant
├── js/
│   ├── editor-core.js         # Core editor initialization and functionality
│   ├── editor-extensions.js   # AI selection and integration for the editor
│   ├── inline-change-visualizer.js # Visualization of AI changes in the editor
│   ├── ai-assistant-core.js   # Core chat interface with Claude
│   ├── ai-response-handler.js # Processing AI responses for content changes
├── netlify/
│   └── functions/
│       └── claude-assistant.js # Serverless function for Claude API
└── index.html              # Main HTML file
```

## Integration Guide

### Setting Up the Editor

1. Include the required CSS and JavaScript files in your HTML:

```html
<!-- CSS files -->
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" rel="stylesheet">
<link href="css/editor.css" rel="stylesheet">
<link href="css/ai-assistant.css" rel="stylesheet">

<!-- Editor DOM structure -->
<div id="editor-wrapper">
  <div class="editor-loading">
    <div class="spinner"></div>
    <span>Loading editor...</span>
  </div>
  <div id="editor-container"></div>
</div>

<!-- Simple controls -->
<div class="editor-controls">
  <button class="icon-button" id="undoButton" title="Undo">←</button>
  <button class="icon-button" id="redoButton" title="Redo">→</button>
  <span id="wordCount">0 Words</span>
  <span id="saveStatus"></span>
</div>
<div id="messageContainer"></div>

<!-- JavaScript files -->
<script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script>
<script src="js/editor-core.js"></script>
<script src="js/editor-extensions.js"></script>
<script src="js/inline-change-visualizer.js"></script>
```

### Setting Up the AI Assistant

```html
<!-- AI Assistant DOM structure -->
<div class="assistant-container">
  <div class="assistant-header">
    <div class="assistant-profile">
      <img src="https://via.placeholder.com/46x46" alt="Assistant">
    </div>
    <div class="assistant-toolbar">
      <div class="assistant-selector" id="assistant-selector">
        <div class="assistant-dropdown" id="assistant-dropdown">
          Loading...
        </div>
        <div class="assistant-options" id="assistant-options">
          <!-- Assistants will be populated here -->
        </div>
      </div>
    </div>
  </div>
  <div class="assistant-description" id="assistant-description">
    Loading AI assistants...
  </div>
  <div class="chat-container" id="chat-container">
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div>Loading AI assistants...</div>
    </div>
  </div>
  <div class="input-container">
    <textarea class="message-input" id="message-input" placeholder="Type your message..." rows="1" disabled></textarea>
    <button class="send-button" id="send-button" disabled>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>
</div>

<!-- AI Assistant JavaScript -->
<script src="js/ai-response-handler.js"></script>
<script src="js/ai-assistant-core.js"></script>
```

### Configuration

The system is configured with the following parameters:

1. Airtable configuration (in editor-core.js and ai-assistant-core.js):
   - API Key
   - Base ID
   - Table Name

2. Claude API configuration (in ai-assistant-core.js):
   - API Endpoint URL
   - Retry parameters

## Usage Flow

1. **Content Selection**:
   - User selects text in the editor
   - AI buttons appear: "Discuss with AI" and "Improve"

2. **AI Assistance**:
   - User can ask direct questions about the content
   - User can request improvements to selected text
   - User can provide instructions for content changes

3. **Suggestion Handling**:
   - Multiple suggestions appear as options in the AI chat
   - Complete rewrites appear in the editor with inline highlighting
   - Changes can be accepted or rejected

4. **Content Updates**:
   - Accepted changes are applied to the editor
   - Content is automatically saved to Airtable

## Modifying the System

### Adding New AI Assistant Types

1. Add a new Assistant record in your Airtable
2. Link the Assistant to the relevant Content records
3. The AI Assistant will automatically appear in the dropdown

### Customizing the Editor

The editor uses Quill with a basic set of formatting options. To customize:

1. Modify the toolbar options in editor-core.js:
   ```javascript
   toolbar: [
     [{ 'header': [1, 2, 3, false] }],
     ['bold', 'italic', 'underline'],
     [{ 'list': 'ordered'}, { 'list': 'bullet' }],
     ['link']
   ],
   ```

2. Adjust styling in editor.css

### Troubleshooting

**Double Toolbar Issue**: If you see duplicate toolbars, check:
- The initialization sequence in editor-core.js
- The DOM element creation in the HTML

**AI Assistant Not Responding**: Verify:
- Airtable configuration
- API key permissions
- Network connections to Netlify functions

## Advanced Configuration

### Claude API Prompts

To adjust how the AI responds, modify the claude-assistant.js file in the Netlify functions directory:

```javascript
// In claude-assistant.js
function preparePromptForContentMode(basePrompt, selectedText, requestType) {
  let specialInstructions = `
IMPORTANT RESPONSE FORMAT:
Please structure your response like this:

[COMMENT]
Brief explanation of your changes or suggestions
[/COMMENT]

For multiple options:
[OPTIONS]
Option 1:
Your first suggestion

Option 2:
Your second suggestion
[/OPTIONS]

For complete rewrites:
[REWRITE]
Your complete new version of the text
[/REWRITE]

Ensure all HTML tags are properly formatted and closed.
`;

  // Add specific instructions based on request type
  if (/headline|title/i.test(requestType)) {
    specialInstructions += `
Focus on creating a compelling headline. Present your suggestion in proper HTML format.`;
  } 
  
  return `${basePrompt}
  
${specialInstructions}`;
}
```

## Deployment

1. Deploy the Netlify functions to your Netlify site
2. Host the static assets (CSS, JS, HTML) on your web server
3. Ensure CORS is properly configured to allow API calls

## Dependencies

- Quill 2.0.3
- Montserrat font 
- Airtable API
- Claude API via Netlify functions
