(function () {
  const state = {
    paymentConfig: null,
    pendingOwner: null,
    nextPath: 'dashboard-student.html',
  };

  const storageKey = 'sf_pending_owner_request';

  const query = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);

  const readPendingOwner = () => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const writePendingOwner = (value) => {
    state.pendingOwner = value;
    try {
      if (value) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(value));
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch (error) {
      // ignore storage failures
    }
  };

  const showMessage = (id, message, type) => {
    const node = byId(id);
    if (!node) {
      return;
    }

    node.textContent = message;
    node.className = `sf-message ${type || 'info'} show`;
  };

  const clearMessage = (id) => {
    const node = byId(id);
    if (!node) {
      return;
    }

    node.textContent = '';
    node.className = 'sf-message';
  };

  const setLoading = (buttonId, loading, idleLabel, loadingLabel) => {
    const button = byId(buttonId);
    if (!button) {
      return;
    }

    button.disabled = loading;
    button.textContent = loading ? loadingLabel : idleLabel;
  };

  const openModal = (id) => {
    const modal = byId(id);
    if (!modal) {
      return;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (id) => {
    const modal = byId(id);
    if (!modal) {
      return;
    }

    modal.classList.remove('open');
    if (!document.querySelector('.sf-modal.open')) {
      document.body.style.overflow = '';
    }
  };

  const updateLoggedInState = () => {
    const user = SmartFeedAPI.getUser();
    document.querySelectorAll('[data-dashboard-link]').forEach((node) => {
      node.setAttribute('href', user ? SmartFeedAPI.getDashboardPath(user) : 'index.html');
    });

    const navCta = query('.nav-cta');
    if (!navCta) {
      return;
    }

    if (user) {
      navCta.textContent = 'Open Dashboard';
      navCta.href = SmartFeedAPI.getDashboardPath(user);
    }
  };

  const renderPaymentStep = async () => {
    const pendingOwner = state.pendingOwner || readPendingOwner();
    if (!pendingOwner) {
      return;
    }

    if (!state.paymentConfig) {
      const response = await SmartFeedAPI.payment.getOwnerConfig();
      state.paymentConfig = response.data;
    }

    const config = state.paymentConfig;
    const qrImage = byId('ownerQrImage');
    const amount = byId('ownerPaymentAmount');
    const upiId = byId('ownerPaymentUpi');
    const note = byId('ownerPaymentNote');
    const ownerMeta = byId('ownerPaymentMeta');

    if (qrImage) {
      qrImage.src = config.qrImageUrl || '';
      qrImage.alt = 'SmartFeed payment QR';
    }
    if (amount) {
      amount.textContent = `${config.currency} ${(config.amount / 100).toFixed(2)}`;
    }
    if (upiId) {
      upiId.textContent = config.upiId || 'Configure OWNER_UPI_ID in backend .env';
    }
    if (note) {
      note.textContent = config.note || 'SmartFeed owner registration';
    }
    if (ownerMeta) {
      ownerMeta.textContent = `Payment confirmation will be linked to ${pendingOwner.businessName || pendingOwner.name}.`;
    }

    byId('ownerSignupStep')?.classList.remove('active');
    byId('ownerPaymentStep')?.classList.add('active');
  };

  const setLoginCopy = (nextPath) => {
    const title = byId('loginModalTitle');
    const text = byId('loginModalText');
    const isOwner = nextPath === 'dashboard-owner.html';

    if (title) {
      title.textContent = isOwner ? 'Owner Login' : 'Student Login';
    }
    if (text) {
      text.textContent = isOwner
        ? 'Open your SmartFeed owner dashboard to manage students, menus, and reminders.'
        : "Open SmartFeed and mark attendance for today's meals.";
    }
  };

  const openLoginModal = (nextPath) => {
    state.nextPath = nextPath || 'dashboard-student.html';
    setLoginCopy(state.nextPath);
    clearMessage('loginMessage');
    openModal('loginModal');
  };

  const openOwnerModal = async () => {
    clearMessage('ownerSignupMessage');
    clearMessage('ownerPaymentMessage');
    byId('ownerSignupStep')?.classList.add('active');
    byId('ownerPaymentStep')?.classList.remove('active');
    openModal('ownerModal');

    if (readPendingOwner()) {
      await renderPaymentStep();
    }
  };

  window.openStudentLogin = function (nextPath) {
    openLoginModal(nextPath || 'dashboard-student.html');
  };

  window.openOwnerOnboarding = function () {
    openOwnerModal().catch((error) => {
      showMessage('ownerSignupMessage', error.message, 'error');
    });
  };

  window.closeSmartFeedModal = function (id) {
    closeModal(id);
  };

  window.doSmartFeedLogin = async function () {
    const email = byId('loginEmail').value.trim();
    const password = byId('loginPassword').value;

    if (!email || !password) {
      showMessage('loginMessage', 'Email and password are required.', 'error');
      return;
    }

    clearMessage('loginMessage');
    setLoading('loginSubmitBtn', true, 'Login', 'Logging in...');

    try {
      const response = await SmartFeedAPI.auth.login(email, password);
      window.location.href = state.nextPath || SmartFeedAPI.getDashboardPath(response.user);
    } catch (error) {
      showMessage('loginMessage', error.message, 'error');
    } finally {
      setLoading('loginSubmitBtn', false, 'Login', 'Logging in...');
    }
  };

  window.doOwnerSignup = async function () {
    const payload = {
      role: 'mess_owner',
      businessName: byId('ownerBusinessName').value.trim(),
      hostelName: byId('ownerHostelName').value.trim(),
      name: byId('ownerContactName').value.trim(),
      email: byId('ownerEmail').value.trim(),
      phone: byId('ownerPhone').value.trim(),
      password: byId('ownerPassword').value,
      address: byId('ownerAddress').value.trim(),
    };

    if (!payload.businessName || !payload.name || !payload.email || !payload.phone || !payload.password) {
      showMessage('ownerSignupMessage', 'Business name, owner name, email, phone, and password are required.', 'error');
      return;
    }

    if (payload.password.length < 6) {
      showMessage('ownerSignupMessage', 'Password must be at least 6 characters.', 'error');
      return;
    }

    clearMessage('ownerSignupMessage');
    setLoading('ownerSignupBtn', true, 'Create Owner Account', 'Creating account...');

    try {
      const response = await SmartFeedAPI.auth.signup(payload);
      writePendingOwner({
        uid: response.user.uid,
        email: payload.email,
        name: payload.name,
        businessName: payload.businessName,
      });
      showMessage('ownerSignupMessage', 'Account created. Complete the QR payment confirmation below.', 'success');
      await renderPaymentStep();
    } catch (error) {
      showMessage('ownerSignupMessage', error.message, 'error');
    } finally {
      setLoading('ownerSignupBtn', false, 'Create Owner Account', 'Creating account...');
    }
  };

  window.submitOwnerPaymentConfirmation = async function () {
    const pendingOwner = state.pendingOwner || readPendingOwner();
    if (!pendingOwner) {
      showMessage('ownerPaymentMessage', 'Create the owner account first, then submit the payment confirmation.', 'error');
      return;
    }

    const transactionId = byId('ownerTransactionId').value.trim();
    const notes = byId('ownerPaymentNotes').value.trim();
    if (!transactionId) {
      showMessage('ownerPaymentMessage', 'Enter the UPI transaction or reference ID after payment.', 'error');
      return;
    }

    clearMessage('ownerPaymentMessage');
    setLoading('ownerPaymentBtn', true, 'Send Confirmation for Approval', 'Sending confirmation...');

    try {
      await SmartFeedAPI.payment.confirmOwnerRegistration({
        userId: pendingOwner.uid,
        userEmail: pendingOwner.email,
        transactionId,
        notes,
      });

      showMessage(
        'ownerPaymentMessage',
        'Payment confirmation sent. A manual approval email has been delivered to the SmartFeed admin inbox.',
        'success'
      );
      writePendingOwner(null);
      byId('ownerTransactionId').value = '';
      byId('ownerPaymentNotes').value = '';
    } catch (error) {
      showMessage('ownerPaymentMessage', error.message, 'error');
    } finally {
      setLoading('ownerPaymentBtn', false, 'Send Confirmation for Approval', 'Sending confirmation...');
    }
  };

  document.querySelectorAll('[data-open-login]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      openLoginModal(node.getAttribute('data-next') || 'dashboard-student.html');
    });
  });

  document.querySelectorAll('[data-open-owner]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      openOwnerModal().catch((error) => {
        showMessage('ownerSignupMessage', error.message, 'error');
      });
    });
  });

  document.querySelectorAll('.sf-modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.sf-modal.open').forEach((modal) => closeModal(modal.id));
    }

    if (event.key === 'Enter' && document.activeElement && document.activeElement.closest('#loginModal')) {
      window.doSmartFeedLogin();
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'student') {
    openLoginModal(params.get('next') || 'dashboard-student.html');
  }
  if (params.get('login') === 'owner') {
    openLoginModal(params.get('next') || 'dashboard-owner.html');
  }

  updateLoggedInState();
})();
