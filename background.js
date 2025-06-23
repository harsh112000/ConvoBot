// Background script for ChatGPT Transfer extension
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Listen for extension icon clicks
    chrome.action.onClicked.addListener((tab) => {
      this.handleIconClick(tab);
    });

    // Monitor tab updates to detect ChatGPT sessions
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'openTransferPopup':
        this.openTransferPopup(request.conversation, request.isLimitReached);
        break;
      
      case 'saveConversation':
        this.saveConversation(request.conversation);
        break;
      
      case 'getStoredConversations':
        this.getStoredConversations().then(sendResponse);
        break;
      
      case 'generateSummary':
        this.generateSummary(request.conversation).then(sendResponse);
        break;
    }
  }

  handleIconClick(tab) {
    // Check if we're on a ChatGPT page
    if (this.isChatGPTPage(tab.url)) {
      // Open popup
      chrome.action.setPopup({ popup: 'popup.html' });
    } else {
      // Show notification that we need to be on ChatGPT
      this.showNotification(
        'ChatGPT Transfer',
        'Please navigate to ChatGPT to use this extension.',
        'warning'
      );
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && this.isChatGPTPage(tab.url)) {
      // Inject content script if not already present
      this.ensureContentScript(tabId);
    }
  }

  isChatGPTPage(url) {
    return url && (
      url.includes('chat.openai.com') || 
      url.includes('chatgpt.com')
    );
  }

  async ensureContentScript(tabId) {
    try {
      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.chatGPTTransferInjected
      });

      if (!results[0]?.result) {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['styles.css']
        });
      }
    } catch (error) {
      console.error('Error injecting content script:', error);
    }
  }

  openTransferPopup(conversation, isLimitReached) {
    // Store conversation data temporarily
    chrome.storage.local.set({
      currentConversation: conversation,
      isLimitReached: isLimitReached,
      timestamp: Date.now()
    });

    // Open popup
    chrome.action.setPopup({ popup: 'popup.html' });
  }

  async saveConversation(conversation) {
    try {
      const stored = await chrome.storage.local.get(['savedConversations']) || {};
      const savedConversations = stored.savedConversations || [];
      
      const conversationData = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        messageCount: conversation.length,
        preview: conversation[0]?.content?.substring(0, 100) || 'No preview',
        conversation: conversation
      };

      savedConversations.unshift(conversationData);
      
      // Keep only last 10 conversations
      const trimmed = savedConversations.slice(0, 10);
      
      await chrome.storage.local.set({ savedConversations: trimmed });
      
      return conversationData.id;
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  async getStoredConversations() {
    try {
      const result = await chrome.storage.local.get(['savedConversations']);
      return result.savedConversations || [];
    } catch (error) {
      console.error('Error getting stored conversations:', error);
      return [];
    }
  }

  async generateSummary(conversation) {
    // Enhanced summary generation with different templates
    const templates = {
      technical: this.generateTechnicalSummary,
      creative: this.generateCreativeSummary,
      general: this.generateGeneralSummary
    };

    const conversationType = this.detectConversationType(conversation);
    const generator = templates[conversationType] || templates.general;
    
    return generator.call(this, conversation);
  }

  detectConversationType(conversation) {
    const allText = conversation.map(msg => msg.content.toLowerCase()).join(' ');
    
    const technicalKeywords = ['code', 'programming', 'function', 'algorithm', 'debug', 'error'];
    const creativeKeywords = ['story', 'write', 'creative', 'character', 'plot', 'design'];
    
    const technicalScore = technicalKeywords.filter(word => allText.includes(word)).length;
    const creativeScore = creativeKeywords.filter(word => allText.includes(word)).length;
    
    if (technicalScore > creativeScore && technicalScore > 0) return 'technical';
    if (creativeScore > technicalScore && creativeScore > 0) return 'creative';
    return 'general';
  }

  generateTechnicalSummary(conversation) {
    const userMessages = conversation.filter(msg => msg.role === 'user');
    const codeBlocks = this.extractCodeBlocks(conversation);
    const errors = this.extractErrors(conversation);
    
    return `TECHNICAL CONVERSATION TRANSFER

🔧 PROJECT CONTEXT:
${userMessages[0]?.content.substring(0, 200)}...

💻 CODE COMPONENTS:
${codeBlocks.length > 0 ? codeBlocks.map(block => `• ${block}`).join('\n') : '• No code blocks identified'}

🐛 ISSUES ADDRESSED:
${errors.length > 0 ? errors.map(error => `• ${error}`).join('\n') : '• No specific errors mentioned'}

📊 TECHNICAL DETAILS:
• Total technical exchanges: ${conversation.length}
• Implementation focus: ${this.identifyTechFocus(conversation)}
• Complexity level: ${this.assessTechnicalComplexity(conversation)}

🎯 CURRENT STATUS:
${conversation.slice(-1)[0]?.content.substring(0, 150)}...

Please continue providing technical assistance where we left off.`;
  }

  generateCreativeSummary(conversation) {
    const theme = this.extractCreativeTheme(conversation);
    const characters = this.extractCharacters(conversation);
    
    return `CREATIVE PROJECT TRANSFER

🎨 CREATIVE CONTEXT:
${conversation[0]?.content.substring(0, 200)}...

🎭 PROJECT THEME:
${theme}

👥 CHARACTERS/ELEMENTS:
${characters.length > 0 ? characters.map(char => `• ${char}`).join('\n') : '• No specific characters identified'}

📝 CREATIVE PROGRESS:
• Total creative exchanges: ${conversation.length}
• Style/Genre: ${this.identifyCreativeStyle(conversation)}
• Development stage: ${this.assessCreativeProgress(conversation)}

🎯 CURRENT DIRECTION:
${conversation.slice(-1)[0]?.content.substring(0, 150)}...

Please continue the creative collaboration from this point.`;
  }

  generateGeneralSummary(conversation) {
    const topics = this.extractTopics(conversation);
    const objectives = this.extractObjectives(conversation);
    
    return `CONVERSATION TRANSFER

🎯 MAIN DISCUSSION:
${conversation[0]?.content.substring(0, 200)}...

📋 KEY TOPICS:
${topics.map(topic => `• ${topic}`).join('\n')}

🎪 OBJECTIVES:
${objectives.map(obj => `• ${obj}`).join('\n')}

📊 CONVERSATION SUMMARY:
• Total messages: ${conversation.length}
• Discussion depth: ${this.assessDiscussionDepth(conversation)}
• Interaction style: ${this.analyzeInteractionStyle(conversation)}

🎯 CURRENT CONTEXT:
${conversation.slice(-2).map(msg => `${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}...`).join('\n\n')}

Please continue our discussion from where we left off.`;
  }

  // Helper methods for analysis
  extractCodeBlocks(conversation) {
    const codeBlocks = [];
    conversation.forEach(msg => {
      const codeMatches = msg.content.match(/```[\s\S]*?```/g) || [];
      codeMatches.forEach(match => {
        const language = match.split('\n')[0].replace('```', '').trim();
        codeBlocks.push(language || 'Code block');
      });
    });
    return [...new Set(codeBlocks)];
  }

  extractErrors(conversation) {
    const errors = [];
    conversation.forEach(msg => {
      if (msg.content.toLowerCase().includes('error') || 
          msg.content.toLowerCase().includes('bug') ||
          msg.content.toLowerCase().includes('issue')) {
        const errorLine = msg.content.split('\n').find(line => 
          line.toLowerCase().includes('error') || 
          line.toLowerCase().includes('bug')
        );
        if (errorLine) {
          errors.push(errorLine.substring(0, 100));
        }
      }
    });
    return errors.slice(0, 3);
  }

  identifyTechFocus(conversation) {
    const allText = conversation.map(msg => msg.content.toLowerCase()).join(' ');
    const focuses = {
      'Web Development': ['html', 'css', 'javascript', 'react', 'vue'],
      'Backend Development': ['server', 'api', 'database', 'node', 'python'],
      'Data Science': ['data', 'analysis', 'pandas', 'numpy', 'machine learning'],
      'Mobile Development': ['mobile', 'app', 'ios', 'android', 'flutter']
    };
    
    for (const [focus, keywords] of Object.entries(focuses)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        return focus;
      }
    }
    return 'General Programming';
  }

  assessTechnicalComplexity(conversation) {
    const indicators = {
      high: ['algorithm', 'optimization', 'architecture', 'design pattern'],
      medium: ['function', 'class', 'method', 'implementation'],
      low: ['variable', 'basic', 'simple', 'beginner']
    };
    
    const allText = conversation.map(msg => msg.content.toLowerCase()).join(' ');
    
    for (const [level, keywords] of Object.entries(indicators)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        return level.charAt(0).toUpperCase() + level.slice(1);
      }
    }
    return 'Medium';
  }

  extractCreativeTheme(conversation) {
    const userMessages = conversation.filter(msg => msg.role === 'user');
    const firstMessage = userMessages[0]?.content || '';
    
    if (firstMessage.toLowerCase().includes('story')) return 'Storytelling';
    if (firstMessage.toLowerCase().includes('character')) return 'Character Development';
    if (firstMessage.toLowerCase().includes('write')) return 'Writing Project';
    if (firstMessage.toLowerCase().includes('design')) return 'Design Project';
    
    return 'Creative Project';
  }

  extractCharacters(conversation) {
    const characters = [];
    conversation.forEach(msg => {
      // Simple character extraction - look for names mentioned
      const names = msg.content.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
      characters.push(...names);
    });
    return [...new Set(characters)].slice(0, 5);
  }

  identifyCreativeStyle(conversation) {
    const allText = conversation.map(msg => msg.content.toLowerCase()).join(' ');
    const styles = {
      'Fiction': ['story', 'character', 'plot', 'narrative'],
      'Poetry': ['poem', 'verse', 'rhyme', 'stanza'],
      'Screenplay': ['script', 'dialogue', 'scene', 'screenplay'],
      'Article': ['article', 'blog', 'content', 'writing']
    };
    
    for (const [style, keywords] of Object.entries(styles)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        return style;
      }
    }
    return 'General Creative';
  }

  assessCreativeProgress(conversation) {
    const length = conversation.length;
    if (length < 4) return 'Initial brainstorming';
    if (length < 8) return 'Concept development';
    if (length < 12) return 'Active creation';
    return 'Refinement stage';
  }

  extractTopics(conversation) {
    const topics = new Set();
    conversation.forEach(msg => {
      if (msg.role === 'user') {
        const sentences = msg.content.split(/[.!?]+/);
        sentences.forEach(sentence => {
          if (sentence.trim().length > 20) {
            topics.add(sentence.trim().substring(0, 80) + '...');
          }
        });
      }
    });
    return Array.from(topics).slice(0, 5);
  }

  extractObjectives(conversation) {
    const objectives = [];
    conversation.forEach(msg => {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase();
        if (content.includes('i want') || content.includes('i need')) {
          const objective = msg.content.substring(0, 100) + '...';
          objectives.push(objective);
        }
      }
    });
    return objectives.slice(0, 3);
  }

  assessDiscussionDepth(conversation) {
    const avgLength = conversation.reduce((sum, msg) => sum + msg.content.length, 0) / conversation.length;
    if (avgLength > 400) return 'Deep, detailed discussion';
    if (avgLength > 150) return 'Moderate depth';
    return 'Brief exchanges';
  }

  analyzeInteractionStyle(conversation) {
    const userMessages = conversation.filter(msg => msg.role === 'user');
    const hasQuestions = userMessages.some(msg => msg.content.includes('?'));
    const hasPoliteLanguage = userMessages.some(msg => 
      msg.content.toLowerCase().includes('please') || 
      msg.content.toLowerCase().includes('thank')
    );
    
    if (hasQuestions && hasPoliteLanguage) return 'Collaborative and polite';
    if (hasQuestions) return 'Inquisitive';
    if (hasPoliteLanguage) return 'Polite and formal';
    return 'Direct and focused';
  }

  showNotification(title, message, type = 'info') {
    const iconUrl = type === 'warning' ? 'icons/warning.png' : 'icons/icon48.png';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: title,
      message: message
    });
  }
}

// Initialize background service
new BackgroundService();