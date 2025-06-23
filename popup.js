// Popup script for ChatGPT Transfer extension
class TransferPopup {
  constructor() {
    this.conversation = [];
    this.summary = '';
    this.isLimitReached = false;
    this.init();
  }

  async init() {
    await this.loadConversation();
    this.setupEventListeners();
    this.hideLoading();
  }

  async loadConversation() {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getConversation' 
      });
      
      if (response) {
        this.conversation = response.conversation || [];
        this.summary = response.summary || '';
        this.isLimitReached = response.isLimitReached || false;
        this.updateUI();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      this.showError('Unable to load conversation. Make sure you\'re on ChatGPT.');
    }
  }

  updateUI() {
    // Update status
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusContainer = document.getElementById('status');
    
    if (this.isLimitReached) {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'Message limit reached';
      statusContainer.className = 'status limit-reached';
    } else if (this.conversation.length > 0) {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Conversation detected';
    } else {
      statusDot.className = 'status-dot warning';
      statusText.textContent = 'No conversation found';
    }
    
    // Update stats
    document.getElementById('messageCount').textContent = 
      `${this.conversation.length} messages`;
    document.getElementById('conversationLength').textContent = 
      `${this.summary.length} chars`;
    
    // Update summary preview
    const summaryPreview = document.getElementById('summaryPreview');
    summaryPreview.textContent = this.summary || 'No summary available';
  }

  setupEventListeners() {
    // Copy button
    document.getElementById('copyBtn').onclick = () => this.copySummary();
    
    // Refresh button
    document.getElementById('refreshBtn').onclick = () => this.refreshConversation();
    
    // Platform buttons
    document.getElementById('claudeBtn').onclick = () => 
      this.openPlatform('https://claude.ai');
    document.getElementById('geminiBtn').onclick = () => 
      this.openPlatform('https://gemini.google.com');
    document.getElementById('chatgptBtn').onclick = () => 
      this.openPlatform('https://chat.openai.com');
    document.getElementById('customBtn').onclick = () => 
      this.promptCustomURL();
  }

  async copySummary() {
    try {
      await navigator.clipboard.writeText(this.summary);
      this.showNotification('Summary copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = this.summary;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotification('Summary copied to clipboard!');
    }
  }

  async refreshConversation() {
    this.showLoading();
    await this.loadConversation();
    this.hideLoading();
  }

  openPlatform(url) {
    // Copy summary first
    this.copySummary();
    
    // Open platform
    chrome.tabs.create({ url });
    
    // Close popup
    window.close();
  }

  promptCustomURL() {
    const url = prompt('Enter the URL of the AI platform:');
    if (url) {
      try {
        new URL(url); // Validate URL
        this.openPlatform(url);
      } catch {
        alert('Please enter a valid URL');
      }
    }
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(52, 211, 153, 0.9);
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 1000;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 2000);
  }

  showError(message) {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="header">
        <h1>❌ Error</h1>
        <p>${message}</p>
      </div>
      <div class="actions">
        <button onclick="window.close()" class="btn btn-primary">
          Close
        </button>
      </div>
    `;
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  }
}

// Enhanced conversation analysis
class ConversationAnalyzer {
  static generateAdvancedSummary(conversation) {
    if (!conversation.length) return '';

    const analysis = this.analyzeConversation(conversation);
    
    return `CONVERSATION TRANSFER CONTEXT

🎯 PRIMARY OBJECTIVE:
${analysis.mainObjective}

🔍 KEY DISCUSSION POINTS:
${analysis.keyPoints.map(point => `• ${point}`).join('\n')}

📊 CONVERSATION METRICS:
• Total exchanges: ${conversation.length} messages
• User queries: ${analysis.userQueries}
• Topics covered: ${analysis.topics.length}
• Complexity level: ${analysis.complexityLevel}

🎭 CONVERSATION STYLE:
${analysis.conversationStyle}

💡 CURRENT CONTEXT:
${analysis.recentContext}

📋 CONTINUATION INSTRUCTIONS:
Please continue this conversation maintaining the same level of detail and expertise. The user has reached their message limit on ChatGPT and is continuing here. Feel free to reference previous points discussed and build upon the established context.

READY TO CONTINUE FROM WHERE WE LEFT OFF.`;
  }

  static analyzeConversation(conversation) {
    const userMessages = conversation.filter(msg => msg.role === 'user');
    const assistantMessages = conversation.filter(msg => msg.role === 'assistant');
    
    // Analyze main objective
    const firstUserMessage = userMessages[0]?.content || '';
    const mainObjective = firstUserMessage.length > 100 ? 
      firstUserMessage.substring(0, 100) + '...' : firstUserMessage;
    
    // Extract key points
    const keyPoints = this.extractKeyPoints(conversation);
    
    // Determine topics
    const topics = this.identifyTopics(conversation);
    
    // Assess complexity
    const complexityLevel = this.assessComplexity(conversation);
    
    // Analyze conversation style
    const conversationStyle = this.analyzeStyle(conversation);
    
    // Get recent context
    const recentContext = this.getRecentContext(conversation);
    
    return {
      mainObjective,
      keyPoints,
      topics,
      complexityLevel,
      conversationStyle,
      recentContext,
      userQueries: userMessages.length
    };
  }

  static extractKeyPoints(conversation) {
    const points = [];
    
    conversation.forEach(msg => {
      if (msg.role === 'user') {
        // Look for questions, requests, or specific topics
        const content = msg.content.toLowerCase();
        if (content.includes('how to') || content.includes('how can')) {
          points.push(`How-to request: ${msg.content.substring(0, 80)}...`);
        } else if (content.includes('what is') || content.includes('explain')) {
          points.push(`Explanation needed: ${msg.content.substring(0, 80)}...`);
        } else if (content.includes('help') || content.includes('problem')) {
          points.push(`Problem solving: ${msg.content.substring(0, 80)}...`);
        }
      }
    });
    
    return points.slice(0, 5); // Top 5 key points
  }

  static identifyTopics(conversation) {
    const topics = new Set();
    const topicKeywords = {
      'programming': ['code', 'programming', 'javascript', 'python', 'html', 'css'],
      'business': ['business', 'marketing', 'strategy', 'company', 'revenue'],
      'education': ['learn', 'study', 'explain', 'understand', 'teach'],
      'creative': ['write', 'creative', 'story', 'design', 'art'],
      'technical': ['technical', 'system', 'software', 'hardware', 'tech']
    };
    
    const allText = conversation.map(msg => msg.content.toLowerCase()).join(' ');
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => allText.includes(keyword))) {
        topics.add(topic);
      }
    });
    
    return Array.from(topics);
  }

  static assessComplexity(conversation) {
    const totalLength = conversation.reduce((sum, msg) => sum + msg.content.length, 0);
    const avgLength = totalLength / conversation.length;
    
    if (avgLength > 500) return 'High (detailed, technical)';
    if (avgLength > 200) return 'Medium (moderate detail)';
    return 'Low (brief exchanges)';
  }

  static analyzeStyle(conversation) {
    const userMessages = conversation.filter(msg => msg.role === 'user');
    const styles = [];
    
    const hasQuestions = userMessages.some(msg => msg.content.includes('?'));
    const hasRequests = userMessages.some(msg => 
      msg.content.toLowerCase().includes('please') || 
      msg.content.toLowerCase().includes('can you'));
    const isInformal = userMessages.some(msg => 
      msg.content.toLowerCase().includes('hey') || 
      msg.content.toLowerCase().includes('thanks'));
    
    if (hasQuestions) styles.push('Inquisitive');
    if (hasRequests) styles.push('Collaborative');
    if (isInformal) styles.push('Casual');
    
    return styles.length ? styles.join(', ') : 'Professional';
  }

  static getRecentContext(conversation) {
    const recent = conversation.slice(-2);
    return recent.map(msg => 
      `${msg.role.toUpperCase()}: ${msg.content.substring(0, 150)}...`
    ).join('\n\n');
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new TransferPopup();
});