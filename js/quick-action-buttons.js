// Simple Quick Actions implementation
document.addEventListener('DOMContentLoaded', function() {
  // Wait for assistant to fully load
  setTimeout(function() {
    try {
      // Add quick action buttons
      addQuickActionButtons();
    } catch(e) {
      console.error('Error adding quick actions:', e);
    }
  }, 2000);
  
  function addQuickActionButtons() {
    // Get assistant description element
    const description = document.getElementById('assistant-description');
    if (!description) return;
    
    // Create container
    const container = document.createElement('div');
    container.className = 'quick-action-container';
    container.style.marginTop = '15px';
    container.style.marginBottom = '15px';
    container.style.padding = '10px';
    container.style.border = '1px solid #eee';
    container.style.borderRadius = '4px';
    
    // Add header
    const header = document.createElement('div');
    header.textContent = 'Quick Actions:';
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '10px';
    container.appendChild(header);
    
    // Define buttons
    const buttons = [
      { text: "Improve Headline", prompt: "Improve the headline to be more compelling" },
      { text: "Fix Grammar", prompt: "Fix any grammar or spelling issues in the text" },
      { text: "Add Paragraph", prompt: "Add a new paragraph at the end on this topic" }
    ];
    
    // Create buttons
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.textContent = btn.text;
      button.style.margin = '4px';
      button.style.padding = '8px 12px';
      button.style.backgroundColor = '#f0f0f0';
      button.style.border = '1px solid #ddd';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      
      button.onclick = function() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-button');
        
        if (input && sendBtn) {
          input.value = btn.prompt;
          setTimeout(() => sendBtn.click(), 100);
        }
      };
      
      container.appendChild(button);
    });
    
    // Add to description
    description.appendChild(container);
  }
});
