const toastRoot = document.getElementById('toast-root');

export function showToast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`.trim();
  el.textContent = message;
  toastRoot.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

let modalBackdrop = null;

export function openModal(innerHtml, { onClose } = {}) {
  closeModal();
  modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  modalBackdrop.innerHTML = `<div class="modal-sheet">${innerHtml}</div>`;
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.body.appendChild(modalBackdrop);
  if (onClose) modalBackdrop._onClose = onClose;
  return modalBackdrop.querySelector('.modal-sheet');
}

export function closeModal() {
  if (modalBackdrop) {
    modalBackdrop._onClose?.();
    modalBackdrop.remove();
    modalBackdrop = null;
  }
}
