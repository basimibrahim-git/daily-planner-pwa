import { auth } from './api.js';
import { icon } from './data.js';
import { escapeHtml } from './utils.js';

export async function renderAuth(root, { onAuthed, showToast }) {
  let setupRequired = false;
  let offline = false;

  try {
    const status = await auth.status();
    setupRequired = status.setupRequired;
    if (status.authed) {
      onAuthed();
      return;
    }
  } catch (e) {
    offline = true;
  }

  draw();

  function draw() {
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          ${icon('moon', 'icon brand-icon')}
          <h1>Daily Planner</h1>
          <p class="sub">${setupRequired ? 'Create a password to set up your planner.' : 'Enter your password to continue.'}</p>
          ${offline ? '<p class="error-text">Could not reach the server. Check your connection and reload.</p>' : ''}
          <form id="auth-form">
            <div class="field">
              <label for="pw">Password</label>
              <input id="pw" type="password" autocomplete="${setupRequired ? 'new-password' : 'current-password'}" required minlength="4" />
            </div>
            ${setupRequired ? `
              <div class="field">
                <label for="pw2">Confirm password</label>
                <input id="pw2" type="password" autocomplete="new-password" required minlength="4" />
              </div>
            ` : ''}
            <p class="error-text hidden" id="auth-error"></p>
            <button type="submit" class="btn btn-primary" id="auth-submit">${setupRequired ? 'Create & Start' : 'Unlock'}</button>
          </form>
        </div>
      </div>
    `;

    const form = root.querySelector('#auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = root.querySelector('#auth-error');
      errorEl.classList.add('hidden');
      const password = root.querySelector('#pw').value;

      if (setupRequired) {
        const password2 = root.querySelector('#pw2').value;
        if (password !== password2) {
          errorEl.textContent = 'Passwords do not match.';
          errorEl.classList.remove('hidden');
          return;
        }
      }

      const submitBtn = root.querySelector('#auth-submit');
      submitBtn.disabled = true;
      try {
        if (setupRequired) {
          await auth.setup(password);
        } else {
          await auth.login(password);
        }
        onAuthed();
      } catch (err) {
        errorEl.textContent = escapeHtml(err.message || 'Something went wrong.');
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
      }
    });
  }
}
