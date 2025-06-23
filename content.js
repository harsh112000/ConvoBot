// Content script for ChatGPT conversation extraction
class ChatGPTTransfer {
  constructor() {
    this.isLimitReached = false;
    this.conversation = [];
    this.init();
  }

  init() {
    this.injectTransferButton();
    this.observeMessageLimit();
    this.observeConversation();
    this.setupMessageListener();
  }

  // Inject transfer button into ChatGPT interface
  injectTransferButton() {
    const button = document.createElement('button');
    button.id = 'chatgpt-transfer-btn';
    button.className = 'transfer-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
      Transfer Chat
    `;
    button.title = 'Transfer conversation to another AI';
    button.onclick = () => this.openTransferPopup();

    // Try multiple locations to inject the button
    const insertButton = () => {
      const nav = document.querySelector('nav') || 
                  document.querySelector('[data-testid="nav"]') ||
                  document.querySelector('.sticky.top-0');
      
      if (nav && !document.getElementById('chatgpt-transfer-btn')) {
        nav.appendChild(button);
        return true;
      }
      return false;
    };

    if (!insertButton()) {
      // Retry injection after DOM loads
      setTimeout(() => insertButton(), 2000);
    }
  }

  // Monitor for message limit indicators
  observeMessageLimit() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for common limit messages
            const text = node.textContent?.toLowerCase() || '';
            if (text.includes('message limit') || 
                text.includes('rate limit') ||
                text.includes('too many requests') ||
                text.includes('upgrade') && text.includes('continue')) {
              this.handleMessageLimit();
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Monitor conversation changes
  observeConversation() {
    const observer = new MutationObserver(() => {
      this.extractConversation();
    });

    // Observe the main chat container
    const chatContainer = document.querySelector('[role="main"]') || 
                         document.querySelector('.conversation') ||
                         document.body;
    
    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }

  // Extract conversation from ChatGPT interface
  extractConversation() {
    const messages = [];
    
    // Common selectors for ChatGPT messages
    const messageSelectors = [
      '[data-message-author-role]',
      '.message',
      '[class*="message"]',
      '.conversation-turn'
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }

    messageElements.forEach((element, index) => {
      const role = this.determineMessageRole(element, index);
      const content = this.extractMessageContent(element);
      
      if (content.trim()) {
        messages.push({ role, content: content.trim() });
      }
    });

    this.conversation = messages;
    return messages;
  }

  // Determine if message is from user or assistant
  determineMessageRole(element, index) {
    const text = element.textContent?.toLowerCase() || '';
    const classes = element.className?.toLowerCase() || '';
    
    // Check data attributes
    const authorRole = element.getAttribute('data-message-author-role');
    if (authorRole) return authorRole === 'user' ? 'user' : 'assistant';
    
    // Check for visual indicators
    if (classes.includes('user') || element.querySelector('[class*="user"]')) {
      return 'user';
    }
    if (classes.includes('assistant') || element.querySelector('[class*="assistant"]')) {
      return 'assistant';
    }
    
    // Fallback: alternate based on position
    return index % 2 === 0 ? 'user' : 'assistant';
  }

  // Extract clean message content
  extractMessageContent(element) {
    // Remove buttons, timestamps, and other UI elements
    const clone = element.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll('button, .timestamp, [class*="button"], svg');
    elementsToRemove.forEach(el => el.remove());
    
    return clone.textContent || '';
  }

  // Handle when message limit is reached
  handleMessageLimit() {
    this.isLimitReached = true;
    this.showLimitNotification();
  }

  // Show notification when limit is reached
  showLimitNotification() {
    const notification = document.createElement('div');
    notification.className = 'transfer-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <strong>Message limit reached!</strong>
        <p>Transfer your conversation to continue elsewhere.</p>
        <button onclick="document.querySelector('#chatgpt-transfer-btn').click()">
          Transfer Now
        </button>
        <button onclick="this.parentElement.parentElement.remove()">
          Dismiss
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  // Generate conversation summary
  generateSummary(conversation) {
    if (!conversation.length) return '';

    const userMessages = conversation.filter(msg => msg.role === 'user');
    const assistantMessages = conversation.filter(msg => msg.role === 'assistant');
    
    // Extract key topics and context
    const topics = this.extractTopics(conversation);
    const mainQuery = userMessages[0]?.content || '';
    const recentContext = conversation.slice(-4); // Last 4 messages
    
    const summary = `CONVERSATION TRANSFER - Continue this discussion:

ORIGINAL TOPIC: ${mainQuery}

KEY TOPICS DISCUSSED:
${topics.join('\n')}

RECENT CONTEXT:
${recentContext.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

CURRENT STATUS:
- Total messages exchanged: ${conversation.length}
- Main areas covered: ${topics.slice(0, 3).join(', ')}
- Ready to continue discussion on these topics

Please continue helping with this conversation where we left off.`;

    return summary;
  }

  // Extract key topics from conversation
  extractTopics(conversation) {
    const topics = [];
    const userMessages = conversation.filter(msg => msg.role === 'user');
    
    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      // Simple keyword extraction
      if (content.includes('how to') || content.includes('how can')) {
        topics.push(`• How-to guidance: ${msg.content.substring(0, 100)}...`);
      } else if (content.includes('what is') || content.includes('explain')) {
        topics.push(`• Explanation request: ${msg.content.substring(0, 100)}...`);
      } else if (content.includes('code') || content.includes('programming')) {
        topics.push(`• Programming/coding assistance`);
      } else if (content.length > 20) {
        topics.push(`• ${msg.content.substring(0, 100)}...`);
      }
    });
    
    return topics.slice(0, 5); // Limit to 5 key topics
  }

  // Open transfer popup
  openTransferPopup() {
    chrome.runtime.sendMessage({
      action: 'openTransferPopup',
      conversation: this.extractConversation(),
      isLimitReached: this.isLimitReached
    });
  }

  // Setup message listener for popup communication
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getConversation') {
        const conversation = this.extractConversation();
        const summary = this.generateSummary(conversation);
        sendResponse({
          conversation,
          summary,
          isLimitReached: this.isLimitReached
        });
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ChatGPTTransfer());
} else {
  new ChatGPTTransfer();
}