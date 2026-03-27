const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadFeedback = document.getElementById('upload-feedback');
const manualForm = document.getElementById('manual-form');
const formFeedback = document.getElementById('form-feedback');

function setFeedback(element, message, kind = 'info') {
  element.textContent = message;
  element.classList.remove('is-error', 'is-success');
  if (kind === 'error') element.classList.add('is-error');
  if (kind === 'success') element.classList.add('is-success');
}

function notifyParent(cards) {
  if (window.parent === window) return;
  try {
    window.parent.postMessage(
      {
        type: 'cards-created',
        count: Array.isArray(cards) ? cards.length : 0,
        cards: Array.isArray(cards) ? cards : [],
      },
      window.location.origin,
    );
  } catch (error) {
    console.warn('Unable to notify parent window:', error);
  }
}

function toggleParentPanel() {
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ type: 'toggle-add-card-panel' }, window.location.origin);
  } catch (error) {
    console.warn('Unable to toggle parent panel:', error);
  }
}

function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

uploadArea?.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea?.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea?.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadArea.classList.remove('dragover');
  const [file] = event.dataTransfer.files || [];
  if (file) handleFileUpload(file);
});

uploadArea?.addEventListener('click', () => fileInput?.click());
uploadArea?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput?.click();
  }
});

fileInput?.addEventListener('change', () => {
  const [file] = fileInput.files || [];
  if (file) handleFileUpload(file);
});

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (isTypingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'escape') {
    event.preventDefault();
    toggleParentPanel();
  }
});

function showThumbnail(file) {
  const url = URL.createObjectURL(file);
  let img = document.querySelector('.upload-thumbnail');
  if (!img) {
    img = document.createElement('img');
    img.className = 'upload-thumbnail';
    uploadArea.appendChild(img);
  }
  img.src = url;
  img.alt = file.name || 'uploaded image preview';
}

async function handleFileUpload(file) {
  if (!file.type.startsWith('image/')) {
    setFeedback(uploadFeedback, '请选择图片文件。', 'error');
    return;
  }

  setFeedback(uploadFeedback, '正在识别图片并生成卡片...');
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/upload_image', { method: 'POST', body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || '图片生成失败');
    }
    showThumbnail(file);
    setFeedback(uploadFeedback, `已生成 ${payload.count || 0} 张卡片。`, 'success');
    notifyParent(payload.cards);
  } catch (error) {
    setFeedback(uploadFeedback, error.message || '网络错误，上传失败。', 'error');
  }
}

manualForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const expression = document.getElementById('expression').value.trim();
  const context = document.getElementById('context').value.trim();

  if (!expression) {
    setFeedback(formFeedback, '请输入至少一个 expression。', 'error');
    return;
  }

  setFeedback(formFeedback, '正在生成卡片...');

  try {
    const response = await fetch('/create_from_text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, context }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || '添加失败');
    }
    setFeedback(formFeedback, `已生成 ${payload.count || 0} 张卡片。`, 'success');
    manualForm.reset();
    notifyParent(payload.cards);
  } catch (error) {
    setFeedback(formFeedback, error.message || '网络错误，添加失败。', 'error');
  }
});
