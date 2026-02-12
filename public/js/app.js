const app = document.getElementById('app');

function getHelperStats() {
  const stats = localStorage.getItem('helperStats');
  return stats ? JSON.parse(stats) : { repliesCount: 0, visitsCount: 0 };
}

function saveHelperStats(stats) {
  localStorage.setItem('helperStats', JSON.stringify(stats));
}

function incrementReplyCount() {
  const stats = getHelperStats();
  stats.repliesCount++;
  saveHelperStats(stats);
  return stats.repliesCount;
}

function isTrustedHelper() {
  return getHelperStats().repliesCount >= 5;
}

const forums = {
  anger: {
    name: 'Anger',
    tagline: 'Let it out! It\'s okay to feel angry.',
    image: '/images/anger.png',
    description: 'Sometimes things make us SO MAD! Share what\'s making you angry and let others help you cool down.'
  },
  fear: {
    name: 'Fear',
    tagline: 'Being scared is normal. You\'re not alone.',
    image: '/images/fear.png',
    description: 'Fears can feel really big sometimes. Share what scares you and find comfort from others who understand.'
  },
  sadness: {
    name: 'Sadness',
    tagline: 'It\'s okay to feel sad. Let it flow.',
    image: '/images/sadness.png',
    description: 'Sometimes we just need a good cry. Share your sadness here and find friends who care.'
  },
  anxiety: {
    name: 'Anxiety',
    tagline: 'Worries are heavy. Let\'s share the load.',
    image: '/images/anxiety.png',
    description: 'That worried feeling in your tummy? Others feel it too. Share your worries and breathe easier.'
  },
  disgust: {
    name: 'Disgust',
    tagline: 'Some things just feel wrong. That\'s valid.',
    image: '/images/disgust.png',
    description: 'When something feels icky or unfair, talk about it here. We get it.'
  },
  embarrassment: {
    name: 'Embarrassment',
    tagline: 'We\'ve all been there. You\'re not alone.',
    image: '/images/embarrassment.png',
    description: 'Those cringey moments happen to everyone. Share yours and feel the relief.'
  }
};

function navigate(path) {
  window.history.pushState({}, '', path);
  router();
}

window.addEventListener('popstate', router);

function router() {
  const path = window.location.pathname;

  if (path === '/' || path === '') {
    renderHome();
    return;
  }

  const forumMatch = path.match(/^\/forum\/(\w+)$/);
  if (forumMatch) {
    const forumName = forumMatch[1];
    if (forums[forumName]) {
      renderForum(forumName);
      return;
    }
  }

  const postMatch = path.match(/^\/forum\/(\w+)\/([a-f0-9-]+)$/);
  if (postMatch) {
    const forumName = postMatch[1];
    const postId = postMatch[2];
    if (forums[forumName]) {
      renderPost(forumName, postId);
      return;
    }
  }

  navigate('/');
}

function renderHome() {
  document.body.className = 'theme-home';
  const stats = getHelperStats();

  app.innerHTML = `
    <div class="container">
      <header class="header">
        <h1>The Worry Website</h1>
        <p>A safe place to share your feelings anonymously and get support from others who understand</p>
        ${isTrustedHelper() ? `
          <div class="trusted-helper-banner">
            <span class="trusted-badge">⭐ Trusted Helper</span>
            <span>Thank you for being kind! You've helped ${stats.repliesCount} people.</span>
          </div>
        ` : stats.repliesCount > 0 ? `
          <div class="helper-progress">
            <span>🌟 ${stats.repliesCount}/5 helpful replies to become a Trusted Helper!</span>
          </div>
        ` : ''}
      </header>

      <div class="forums-grid">
        ${Object.entries(forums).map(([key, forum]) => `
          <div class="forum-card ${key}" onclick="navigate('/forum/${key}')">
            <img src="${forum.image}" alt="${forum.name}" class="character-image" >
            <h2>${forum.name}</h2>
            <p>${forum.description}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function renderForum(forumName) {
  const forum = forums[forumName];
  document.body.className = `theme-${forumName}`;

  app.innerHTML = `
    <div class="container">
      <button class="back-btn" onclick="navigate('/')">← Back to Home</button>

      <header class="header">
        <img src="${forum.image}" alt="${forum.name}" class="character-image-large" >
        <h1>${forum.name}</h1>
        <p>${forum.tagline}</p>
      </header>

      <div class="post-form">
        <h3>Share what's on your mind</h3>
        <form id="newPostForm">
          <div class="form-group">
            <label for="nickname">Your nickname (optional)</label>
            <input type="text" id="nickname" placeholder="Anonymous" maxlength="50">
          </div>
          <div class="form-group">
            <label for="content">What's bothering you?</label>
            <textarea id="content" placeholder="Share your feelings here... We're listening." required maxlength="1000"></textarea>
          </div>
          <button type="submit" class="btn-primary">Share Anonymously</button>
        </form>
      </div>

      <div class="forum-container">
        <h3>Recent Posts</h3>
        <div id="postsList" class="posts-list">
          <div class="loading">Loading posts</div>
        </div>
      </div>
    </div>
  `;

  loadPosts(forumName);

  document.getElementById('newPostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('content').value.trim();
    const nickname = document.getElementById('nickname').value.trim();

    if (!content) return;

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sharing...';

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forum: forumName, content, nickname })
      });

      if (response.ok) {
        document.getElementById('content').value = '';
        document.getElementById('nickname').value = '';
        loadPosts(forumName);
        showToast('Your feelings have been shared! 💙', 'success');
      } else {
        const data = await response.json();
        if (data.error === 'moderation') {
          showToast(`🛡️ ${data.message || 'Please try to be kinder in your message.'}`, 'warning');
        } else {
          showToast('Something went wrong. Please try again.', 'error');
        }
      }
    } catch (error) {
      showToast('Could not connect to server. Please try again.', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Share Anonymously';
  });
}

async function loadPosts(forumName) {
  const postsList = document.getElementById('postsList');

  try {
    const response = await fetch(`/api/posts/${forumName}`);
    const posts = await response.json();

    if (posts.length === 0) {
      postsList.innerHTML = `
        <div class="empty-state">
          <img src="${forums[forumName].image}" alt="${forums[forumName].name}" class="character-image-small" >
          <h3>No posts yet</h3>
          <p>Be the first to share how you're feeling!</p>
        </div>
      `;
      return;
    }

    postsList.innerHTML = posts.map(post => `
      <div class="post-card" onclick="navigate('/forum/${forumName}/${post.id}')">
        <div class="post-card-content">
          <h3>${escapeHtml(post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)}</h3>
          <div class="meta">
            <span class="nickname">— ${escapeHtml(post.nickname)}</span>
            <span class="time">${formatTime(post.created_at)}</span>
          </div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    postsList.innerHTML = '<p>Could not load posts. Please refresh the page.</p>';
  }
}

async function renderPost(forumName, postId) {
  const forum = forums[forumName];
  document.body.className = `theme-${forumName}`;

  app.innerHTML = `
    <div class="container">
      <button class="back-btn" onclick="navigate('/forum/${forumName}')">← Back to ${forum.name}</button>

      <div id="postContent">
        <div class="loading">Loading post</div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`/api/posts/${forumName}/${postId}`);

    if (!response.ok) {
      app.innerHTML = `
        <div class="container">
          <button class="back-btn" onclick="navigate('/forum/${forumName}')">← Back to ${forum.name}</button>
          <div class="empty-state">
            <img src="${forum.image}" alt="${forum.name}" class="character-image-small" >
            <h3>Post not found</h3>
            <p>This post may have been removed.</p>
          </div>
        </div>
      `;
      return;
    }

    const { post, replies } = await response.json();

    document.getElementById('postContent').innerHTML = `
      <div class="post-detail">
        <div class="content">${escapeHtml(post.content)}</div>
        <div class="post-detail-footer">
          <div class="meta">
            <span class="nickname">— ${escapeHtml(post.nickname)}</span>
            <span class="time">${formatTime(post.created_at)}</span>
          </div>
        </div>
      </div>

      <div class="replies-section">
        <h3>Helpful Replies (${replies.length})</h3>
        <div id="repliesList">
          ${replies.length === 0 ? `
            <div class="empty-state" style="padding: 30px;">
              <p>No replies yet. Be the first to help!</p>
            </div>
          ` : replies.map(reply => `
            <div class="reply-card">
              <div class="content">${escapeHtml(reply.content)}</div>
              <div class="reply-footer">
                <div class="meta">
                  <span class="nickname">— ${escapeHtml(reply.nickname)}</span>
                  ${reply.is_trusted ? '<span class="trusted-badge-small">⭐ Trusted</span>' : ''}
                  <span class="time">${formatTime(reply.created_at)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="ai-helper-section">
        <div class="ai-helper-header">
          <div class="ai-helper-icon">✨</div>
          <div>
            <h4>AI Helper</h4>
            <p>Get instant, kind support from our AI friend</p>
          </div>
        </div>
        <button id="askAiBtn" class="btn-ai" onclick="askAiHelper('${postId}', '${forumName}')">
          <span class="ai-sparkle">✨</span> Ask AI Helper
        </button>
        <div id="aiResponse" class="ai-response-container" style="display: none;"></div>
      </div>

      <div class="reply-form">
        <h4>Send some support ${isTrustedHelper() ? '<span class="trusted-badge-small">⭐ Trusted Helper</span>' : ''}</h4>
        <form id="replyForm">
          <div class="form-group">
            <label for="replyNickname">Your nickname (optional)</label>
            <input type="text" id="replyNickname" placeholder="Helper" maxlength="50">
          </div>
          <div class="form-group">
            <label for="replyContent">Your helpful message</label>
            <textarea id="replyContent" placeholder="Write something kind and supportive..." required maxlength="1000"></textarea>
          </div>
          <button type="submit" class="btn-primary">Send Support 💙</button>
        </form>
      </div>
    `;

    document.getElementById('replyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('replyContent').value.trim();
      const nickname = document.getElementById('replyNickname').value.trim();

      if (!content) return;

      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        const response = await fetch('/api/replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: postId,
            content,
            nickname,
            is_trusted: isTrustedHelper()
          })
        });

        if (response.ok) {
          const newCount = incrementReplyCount();

          if (newCount === 5) {
            showToast('🎉 Congratulations! You are now a Trusted Helper!', 'success');
          } else {
            showToast('Thank you for your support! 💙', 'success');
          }

          renderPost(forumName, postId);
        } else {
          const data = await response.json();
          if (data.error === 'moderation') {
            showToast(`🛡️ ${data.message || 'Please try to be kinder in your message.'}`, 'warning');
          } else {
            showToast('Something went wrong. Please try again.', 'error');
          }
          btn.disabled = false;
          btn.textContent = 'Send Support 💙';
        }
      } catch (error) {
        showToast('Could not connect to server. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Send Support 💙';
      }
    });

  } catch (error) {
    document.getElementById('postContent').innerHTML = '<p>Could not load post. Please refresh the page.</p>';
  }
}

async function askAiHelper(postId, forumName) {
  const btn = document.getElementById('askAiBtn');
  const responseDiv = document.getElementById('aiResponse');

  const postContent = document.querySelector('.post-detail .content')?.textContent || '';

  if (!postContent) {
    showToast('Could not read the post content.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="ai-sparkle spinning">✨</span> Thinking...';
  responseDiv.style.display = 'block';
  responseDiv.innerHTML = `
    <div class="ai-thinking">
      <div class="ai-thinking-dots">
        <span></span><span></span><span></span>
      </div>
      <p>AI Helper is thinking of something kind to say...</p>
    </div>
  `;

  try {
    const response = await fetch('/api/ai-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: postContent, forum: forumName })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Something went wrong');
    }

    const data = await response.json();

    const formattedReply = data.reply
      .split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${escapeHtml(line)}</p>`)
      .join('');

    responseDiv.innerHTML = `
      <div class="ai-reply-card">
        <div class="ai-reply-header">
          <span class="ai-avatar">✨</span>
          <span class="ai-name">AI Helper</span>
          <span class="ai-badge">AI</span>
        </div>
        <div class="ai-reply-content">
          ${formattedReply}
        </div>
        <div class="ai-reply-footer">
          <span>Remember: You can always talk to a trusted adult too!</span>
        </div>
      </div>
    `;

    btn.innerHTML = '<span class="ai-sparkle">✨</span> Ask Again';
    btn.disabled = false;

  } catch (error) {
    responseDiv.innerHTML = `
      <div class="ai-error">
        <p>Oops! The AI Helper couldn't respond right now. Please try again in a moment.</p>
      </div>
    `;
    btn.innerHTML = '<span class="ai-sparkle">✨</span> Try Again';
    btn.disabled = false;
    showToast(error.message || 'AI Helper is unavailable right now.', 'error');
  }
}

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

router();
