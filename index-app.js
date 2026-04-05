(function () {
  const authOverlay = document.getElementById('authOverlay');
  const loginError = document.getElementById('login-err');
  const registerError = document.getElementById('reg-err');
  const registerSuccess = document.getElementById('reg-success');

  const setLoading = (buttonId, loading) => {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }

    button.disabled = loading;
    button.classList.toggle('loading', loading);
  };

  const showMessage = (element, message) => {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.classList.add('show');
  };

  const hideMessage = (element) => {
    if (!element) {
      return;
    }

    element.classList.remove('show');
    element.textContent = '';
  };

  const resetMessages = () => {
    hideMessage(loginError);
    hideMessage(registerError);
    hideMessage(registerSuccess);
  };

  window.openAuth = function (tab) {
    if (!authOverlay) {
      return;
    }

    authOverlay.classList.add('open');
    window.switchAuthTab(tab || 'login');
    document.body.style.overflow = 'hidden';
  };

  window.closeAuth = function () {
    if (!authOverlay) {
      return;
    }

    authOverlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  window.switchAuthTab = function (tab) {
    document.querySelectorAll('.auth-tab').forEach((node) => node.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach((node) => node.classList.remove('active'));

    const tabButton = document.getElementById(`tab-${tab}`);
    const form = document.getElementById(`form-${tab}`);

    if (tabButton) {
      tabButton.classList.add('active');
    }

    if (form) {
      form.classList.add('active');
    }

    resetMessages();
  };

  const updateLoggedInNav = () => {
    const user = SmartFeedAPI.getUser();
    const navActions = document.querySelector('.nav > div');
    if (!user || !navActions) {
      return;
    }

    navActions.innerHTML = `
      <span style="color:rgba(255,255,255,0.68);font-size:0.85rem;">${user.name || user.email}</span>
      <a href="${SmartFeedAPI.getDashboardPath(user)}"
         style="background:#4ade80;color:#0d1f12;padding:9px 18px;border-radius:40px;font-weight:700;font-size:0.88rem;text-decoration:none;">
         Open Dashboard
      </a>
      <button onclick="doLogout()"
         style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:9px 18px;border-radius:40px;font-weight:600;font-size:0.88rem;cursor:pointer;font-family:'Google Sans',sans-serif;">
         Log Out
      </button>
    `;
  };

  window.doLogin = async function () {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;

    if (!email || !password) {
      showMessage(loginError, 'Please fill in both email and password.');
      return;
    }

    resetMessages();
    setLoading('loginBtn', true);

    try {
      const result = await SmartFeedAPI.auth.login(email, password);
      window.location.href = SmartFeedAPI.getDashboardPath(result.user);
    } catch (error) {
      showMessage(loginError, error.message);
    } finally {
      setLoading('loginBtn', false);
    }
  };

  window.doRegister = function () {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) {
      showMessage(registerError, 'Mess name, email, and password are required.');
      return;
    }

    if (password.length < 6) {
      showMessage(registerError, 'Password must be at least 6 characters.');
      return;
    }

    resetMessages();
    setLoading('registerBtn', true);

    SmartFeedAPI.auth
      .signup({
        name,
        email,
        phone,
        password,
        role: 'mess_owner',
      })
      .then(() => {
        setLoading('registerBtn', false);
        showMessage(
          registerSuccess,
          'Registration submitted. Your mess account will be activated after admin approval.'
        );

        ['reg-name', 'reg-email', 'reg-phone', 'reg-password'].forEach((id) => {
          const field = document.getElementById(id);
          if (field) {
            field.value = '';
          }
        });
      })
      .catch((error) => {
        setLoading('registerBtn', false);
        showMessage(registerError, error.message);
      });
  };

  window.doLogout = function () {
    SmartFeedAPI.auth.logout('index.html');
  };

  if (authOverlay) {
    authOverlay.addEventListener('click', function (event) {
      if (event.target === authOverlay) {
        window.closeAuth();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.closeAuth();
    }
  });

  const loginPassword = document.getElementById('login-pass');
  if (loginPassword) {
    loginPassword.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.doLogin();
      }
    });
  }

  updateLoggedInNav();
})();
