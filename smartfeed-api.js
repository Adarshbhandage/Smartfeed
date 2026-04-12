/**
 * SmartFeed AI — Frontend API Integration Helper
 * 
 * Drop this file into your frontend project and use these functions
 * to connect all buttons and forms to the backend API.
 * 
 * Usage:
 *   <script src="smartfeed-api.js"></script>
 *   
 *   // Then call from your button handlers:
 *   SmartFeedAPI.payment.createOrder().then(...)
 *   SmartFeedAPI.auth.login(email, password).then(...)
 */

const SmartFeedAPI = (() => {

  // ────────────────────────────────────────────────────────────
  // CONFIG — Change BASE_URL to your deployed backend URL
  // ────────────────────────────────────────────────────────────
  const BASE_URL = 'http://localhost:5000/api';

  // ── Token helpers ────────────────────────────────────────────
  const getToken = () => localStorage.getItem('sf_token');
  const setToken = (t) => localStorage.setItem('sf_token', t);
  const getUser  = () => JSON.parse(localStorage.getItem('sf_user') || 'null');
  const setUser  = (u) => localStorage.setItem('sf_user', JSON.stringify(u));
  const clearSession = () => {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
  };

  // ── HTTP helper ──────────────────────────────────────────────
  const request = async (method, path, body = null, auth = true) => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  };

  // ════════════════════════════════════════════════════════════
  // 1. PAYMENT — Razorpay ₹1 Registration
  // ════════════════════════════════════════════════════════════
  const payment = {

    /**
     * Full Razorpay payment flow.
     * Call this on "Create Account" button click.
     * 
     * @param {Object} userData - { name, email, phone? }
     * @param {Function} onSuccess - called with { paymentId, status }
     * @param {Function} onFailure - called with error message
     */
    initiatePayment: async ({ name, email, phone }, onSuccess, onFailure) => {
      try {
        // Step 1: Create Razorpay order on backend
        const { data: order } = await request('POST', '/payment/create-order', null, false);

        // Step 2: Open Razorpay checkout
        const options = {
          key:         order.key,
          amount:      order.amount,
          currency:    order.currency,
          name:        'SmartFeed AI',
          description: 'Registration Fee – ₹1',
          order_id:    order.orderId,
          prefill: { name, email, contact: phone || '' },
          theme: { color: '#4ade80' },

          handler: async (response) => {
            // Step 3: Verify & register interest
            try {
              const result = await request('POST', '/payment/verify', {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_signature:  response.razorpay_signature,
                userName:  name,
                userEmail: email,
                userPhone: phone || '',
              }, false);
              onSuccess && onSuccess(result.data);
            } catch (err) {
              onFailure && onFailure(err.message);
            }
          },

          modal: {
            ondismiss: () => onFailure && onFailure('Payment cancelled by user.'),
          },
        };

        // Razorpay SDK must be loaded: <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        const rzp = new Razorpay(options);
        rzp.open();

      } catch (err) {
        onFailure && onFailure(err.message);
      }
    },
  };

  // ════════════════════════════════════════════════════════════
  // 2. AUTH
  // ════════════════════════════════════════════════════════════
  const auth = {
    login: async (email, password) => {
      const res = await request('POST', '/auth/login', { email, password }, false);
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data;
    },

    logout: () => {
      clearSession();
      window.location.href = '/'; // Redirect to landing page
    },

    getMe: () => request('GET', '/auth/me'),

    isLoggedIn: () => !!getToken(),
    getUser,
  };

  // ════════════════════════════════════════════════════════════
  // 3. MEALS (Student)
  // ════════════════════════════════════════════════════════════
  const meals = {
    selectMeal: (breakfast, lunch, dinner) =>
      request('POST', '/meals/select-meal', { breakfast, lunch, dinner }),

    getMyMeals: () => request('GET', '/meals/my-meals'),

    updateMeal: (updates) => request('PUT', '/meals/update-meal', updates),
  };

  // ════════════════════════════════════════════════════════════
  // 4. ADMIN Dashboard
  // ════════════════════════════════════════════════════════════
  const admin = {
    getStats:       () => request('GET', '/admin/stats'),
    getUsers:       () => request('GET', '/admin/users'),
    getDailyReport: () => request('GET', '/admin/daily-report'),
    getPrediction:  () => request('GET', '/admin/prediction'),
    addWaste:       (data) => request('POST', '/admin/add-waste', data),
    getWaste:       (from, to) => {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to)   q.set('to', to);
      return request('GET', `/admin/waste?${q}`);
    },

    // Pending payment approvals
    getPendingPayments: () => request('GET', '/payment/pending'),
    approve: (paymentId) => request('POST', `/approval/approve/${paymentId}`),
    reject:  (paymentId) => request('POST', `/approval/reject/${paymentId}`),
  };

  // ════════════════════════════════════════════════════════════
  // 5. STUDENTS (Mess Owner)
  // ════════════════════════════════════════════════════════════
  const students = {
    add:       (data)        => request('POST', '/students', data),
    getAll:    ()            => request('GET',  '/students'),
    getById:   (id)          => request('GET',  `/students/${id}`),
    update:    (id, data)    => request('PUT',  `/students/${id}`, data),
    delete:    (id)          => request('DELETE', `/students/${id}`),
    getMeals:  (id)          => request('GET',  `/students/${id}/meals`),
  };

  // ════════════════════════════════════════════════════════════
  // 6. MENU (Mess Owner)
  // ════════════════════════════════════════════════════════════
  const menu = {
    setMenu:      (data)       => request('POST',   '/menu', data),
    getToday:     ()           => request('GET',    '/menu/today'),
    getByDate:    (date)       => request('GET',    `/menu/${date}`),
    getRange:     (from, to)   => {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to)   q.set('to', to);
      return request('GET', `/menu?${q}`);
    },
    delete:       (date)       => request('DELETE', `/menu/${date}`),
  };

  // ════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════
  return { BASE_URL, payment, auth, meals, admin, students, menu, getToken, getUser };

})();

// Make available globally (or export for module environments)
if (typeof module !== 'undefined') module.exports = SmartFeedAPI;
