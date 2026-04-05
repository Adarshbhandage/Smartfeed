(function (global) {
  const STORAGE_KEYS = {
    token: 'sf_token',
    user: 'sf_user',
    apiBase: 'sf_api_base',
  };

  const normalizeBaseUrl = (value) => {
    if (!value || typeof value !== 'string') {
      return 'http://localhost:5000/api';
    }

    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed || trimmed === '__SMARTFEED_BACKEND_URL__') {
      return 'http://localhost:5000/api';
    }

    return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
  };

  const readStorage = (key) => {
    try {
      return global.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const writeStorage = (key, value) => {
    try {
      global.localStorage.setItem(key, value);
    } catch (error) {
      return null;
    }

    return value;
  };

  const removeStorage = (key) => {
    try {
      global.localStorage.removeItem(key);
    } catch (error) {
      return null;
    }

    return null;
  };

  const resolveBaseUrl = () => {
    if (global.SMARTFEED_API_BASE) {
      return normalizeBaseUrl(global.SMARTFEED_API_BASE);
    }

    if (global.SMARTFEED_CONFIG && global.SMARTFEED_CONFIG.apiBase) {
      return normalizeBaseUrl(global.SMARTFEED_CONFIG.apiBase);
    }

    const persisted = readStorage(STORAGE_KEYS.apiBase);
    if (persisted) {
      return normalizeBaseUrl(persisted);
    }

    if (
      global.location &&
      (global.location.protocol === 'http:' || global.location.protocol === 'https:')
    ) {
      return normalizeBaseUrl(global.location.origin + '/api');
    }

    return 'http://localhost:5000/api';
  };

  let baseUrl = resolveBaseUrl();

  const getToken = () => readStorage(STORAGE_KEYS.token);

  const setToken = (token) => writeStorage(STORAGE_KEYS.token, token);

  const getUser = () => {
    const raw = readStorage(STORAGE_KEYS.user);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      removeStorage(STORAGE_KEYS.user);
      return null;
    }
  };

  const setUser = (user) => writeStorage(STORAGE_KEYS.user, JSON.stringify(user));

  const clearSession = () => {
    removeStorage(STORAGE_KEYS.token);
    removeStorage(STORAGE_KEYS.user);
  };

  const setBaseUrl = (nextBaseUrl) => {
    baseUrl = normalizeBaseUrl(nextBaseUrl);
    writeStorage(STORAGE_KEYS.apiBase, baseUrl);
    return baseUrl;
  };

  const getDashboardPath = (user) => {
    const activeUser = user || getUser();
    if (!activeUser) {
      return 'index.html';
    }

    return activeUser.role === 'admin' || activeUser.role === 'mess_owner'
      ? 'dashboard-owner.html'
      : 'dashboard-student.html';
  };

  const parseResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    return text ? { success: response.ok, message: text } : { success: response.ok };
  };

  const request = async (method, path, options) => {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {});

    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (opts.auth !== false) {
      const token = getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (error) {
      const networkError = new Error(
        'Unable to reach the SmartFeed backend. Check that the backend is running and smartfeed-config.js has the correct backend URL.'
      );
      networkError.cause = error;
      throw networkError;
    }

    const payload = await parseResponse(response);

    if (!response.ok || !payload.success) {
      if (opts.auth !== false && (response.status === 401 || response.status === 403)) {
        clearSession();
      }

      const error = new Error(payload.message || `Request failed with status ${response.status}.`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };

  const auth = {
    async signup(payload) {
      const response = await request('POST', '/auth/signup', {
        auth: false,
        body: payload,
      });

      return response.data;
    },

    async login(email, password) {
      const response = await request('POST', '/auth/login', {
        auth: false,
        body: { email, password },
      });

      setToken(response.data.token);
      setUser(response.data.user);
      return response.data;
    },

    async getMe() {
      return request('GET', '/auth/me');
    },

    logout(redirectPath) {
      clearSession();
      global.location.href = redirectPath || 'index.html';
    },

    isLoggedIn() {
      return Boolean(getToken() && getUser());
    },

    requireSession(allowedRoles) {
      const user = getUser();
      const token = getToken();

      if (!token || !user) {
        clearSession();
        global.location.href = 'index.html';
        return null;
      }

      if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(user.role)) {
        global.location.href = getDashboardPath(user);
        return null;
      }

      return user;
    },
  };

  const payment = {
    createOrder() {
      return request('POST', '/payment/create-order', { auth: false });
    },

    verify(data) {
      return request('POST', '/payment/verify', { auth: false, body: data });
    },

    initiateOwnerRegistration(details, onSuccess, onFailure) {
      this.createOrder()
        .then((response) => {
          const order = response.data;
          const razorpay = new global.Razorpay({
            key: order.key,
            amount: order.amount,
            currency: order.currency,
            name: 'SmartFeed AI',
            description: 'Mess Owner Registration - Rs 1',
            order_id: order.orderId,
            prefill: {
              name: details.name,
              email: details.email,
              contact: details.phone || '',
            },
            theme: { color: '#4ade80' },
            handler: async (result) => {
              try {
                const verification = await this.verify({
                  razorpay_payment_id: result.razorpay_payment_id,
                  razorpay_order_id: result.razorpay_order_id,
                  razorpay_signature: result.razorpay_signature,
                  userName: details.name,
                  userEmail: details.email,
                  userPhone: details.phone || '',
                });

                if (typeof onSuccess === 'function') {
                  onSuccess(verification.data);
                }
              } catch (error) {
                if (typeof onFailure === 'function') {
                  onFailure(error);
                }
              }
            },
            modal: {
              ondismiss() {
                if (typeof onFailure === 'function') {
                  onFailure(new Error('Payment was cancelled. Please try again.'));
                }
              },
            },
          });

          razorpay.open();
        })
        .catch((error) => {
          if (typeof onFailure === 'function') {
            onFailure(error);
          }
        });
    },
  };

  const meals = {
    selectMeal(payload) {
      return request('POST', '/meals/select-meal', { body: payload });
    },

    updateMeal(payload) {
      return request('PUT', '/meals/update-meal', { body: payload });
    },

    getMyMeals() {
      return request('GET', '/meals/my-meals');
    },

    async saveTodaySelection(payload) {
      try {
        return await this.selectMeal(payload);
      } catch (error) {
        if (error.status === 409) {
          return this.updateMeal(payload);
        }

        throw error;
      }
    },
  };

  const students = {
    add(data) {
      return request('POST', '/students', { body: data });
    },

    getAll() {
      return request('GET', '/students');
    },

    getById(studentId) {
      return request('GET', `/students/${studentId}`);
    },

    update(studentId, data) {
      return request('PUT', `/students/${studentId}`, { body: data });
    },

    delete(studentId) {
      return request('DELETE', `/students/${studentId}`);
    },

    getMeals(studentId) {
      return request('GET', `/students/${studentId}/meals`);
    },
  };

  const menu = {
    getToday() {
      return request('GET', '/menu/today');
    },

    getByDate(date) {
      return request('GET', `/menu/${date}`);
    },

    getRange(from, to) {
      const query = new URLSearchParams();
      if (from) {
        query.set('from', from);
      }
      if (to) {
        query.set('to', to);
      }

      const suffix = query.toString() ? `?${query.toString()}` : '';
      return request('GET', `/menu${suffix}`);
    },

    set(data) {
      return request('POST', '/menu', { body: data });
    },

    delete(date) {
      return request('DELETE', `/menu/${date}`);
    },
  };

  const owner = {
    getStats() {
      return request('GET', '/admin/stats');
    },

    getUsers() {
      return request('GET', '/admin/users');
    },

    getDailyReport() {
      return request('GET', '/admin/daily-report');
    },

    getPrediction() {
      return request('GET', '/admin/prediction');
    },

    addWaste(data) {
      return request('POST', '/admin/add-waste', { body: data });
    },

    getWaste(from, to) {
      const query = new URLSearchParams();
      if (from) {
        query.set('from', from);
      }
      if (to) {
        query.set('to', to);
      }

      const suffix = query.toString() ? `?${query.toString()}` : '';
      return request('GET', `/admin/waste${suffix}`);
    },

    getPendingPayments() {
      return request('GET', '/payment/pending');
    },

    approvePayment(paymentId) {
      return request('POST', `/approval/approve/${paymentId}`);
    },

    rejectPayment(paymentId) {
      return request('POST', `/approval/reject/${paymentId}`);
    },

    getPendingApprovals() {
      return request('GET', '/approval/pending-users');
    },

    approveUser(userId) {
      return request('POST', `/approval/approve-user/${userId}`);
    },

    rejectUser(userId) {
      return request('POST', `/approval/reject-user/${userId}`);
    },
  };

  const api = {
    get BASE_URL() {
      return baseUrl;
    },
    setBaseUrl,
    request,
    auth,
    payment,
    meals,
    students,
    menu,
    owner,
    admin: owner,
    getToken,
    getUser,
    setToken,
    setUser,
    clearSession,
    getDashboardPath,
  };

  global.SmartFeedAPI = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
