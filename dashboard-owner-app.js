(function () {
  const user = SmartFeedAPI.auth.requireSession(['admin', 'mess_owner']);
  if (!user) {
    return;
  }

  const state = {
    students: [],
    report: [],
    waste: [],
    prediction: null,
    menuRange: [],
  };

  const query = (selector) => document.querySelector(selector);

  const setOwnerMeta = () => {
    const ownerName = query('.sb-owner-name');
    if (ownerName) {
      ownerName.textContent = user.businessName || user.name || user.email;
    }

    const welcome = query('#section-dashboard .page-header p');
    if (welcome) {
      welcome.textContent = `Welcome back, ${user.businessName || user.name || 'Mess Owner'}. Here is your live SmartFeed operating snapshot for today.`;
    }
  };

  const showInlineMessage = (elementId, message, isError) => {
    const node = document.getElementById(elementId);
    if (!node) {
      return;
    }

    node.style.display = 'block';
    node.textContent = message;
    node.style.color = isError ? '#ff9d9d' : '#b7f8cb';
    node.style.background = isError ? 'rgba(255,82,82,0.12)' : 'rgba(74,222,128,0.12)';
    node.style.borderColor = isError ? 'rgba(255,82,82,0.3)' : 'rgba(74,222,128,0.3)';
  };

  const updateStats = async () => {
    const response = await SmartFeedAPI.owner.getStats();
    const stats = response.data;
    const total = Math.max(stats.totalStudents || 0, 1);
    const values = {
      b: stats.totalBreakfast || 0,
      l: stats.totalLunch || 0,
      d: stats.totalDinner || 0,
    };

    Object.keys(values).forEach((key) => {
      const amount = values[key];
      const percent = Math.round((amount / total) * 100);
      const num = document.getElementById(`${key}Num`);
      const fill = document.getElementById(`${key}Fill`);
      const label = document.getElementById(`${key}Lbl`);
      if (num) num.textContent = String(amount);
      if (fill) fill.style.width = `${percent}%`;
      if (label) label.textContent = `${percent}% of active students confirmed`;
    });

    const impact = document.getElementById('impactNum');
    if (impact) {
      impact.textContent = `${values.b + values.l + values.d} meals`;
    }
  };

  const renderDashboardTable = (students) => {
    const tableBody = document.getElementById('tBody');
    if (!tableBody) {
      return;
    }

    if (!students.length) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.45);padding:28px;">No students added yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = students
      .slice(0, 8)
      .map(
        (student) => `
          <tr>
            <td>${student.name}</td>
            <td><span class="badge ${student.responseStatus === 'responded' ? 'badge-present' : 'badge-due'}">${student.responseStatus === 'responded' ? 'Responded' : 'Pending'}</span></td>
            <td>${student.responseSummary}</td>
            <td>${student.email}</td>
            <td>
              <button class="more-btn" onclick="deleteStudent('${student.id}','${student.name}')">
                <span class="material-icons" style="font-size:1.1rem;color:rgba(255,82,82,0.75)">person_remove</span>
              </button>
            </td>
          </tr>
        `
      )
      .join('');
  };

  const renderStudentsSection = (students) => {
    const tableBody = query('#section-students tbody');
    if (!tableBody) {
      return;
    }

    if (!students.length) {
      tableBody.innerHTML = '<tr><td colspan="5" style="padding:28px;text-align:center;color:rgba(255,255,255,0.45)">No students added yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = students
      .map(
        (student) => `
          <tr>
            <td>${student.name}</td>
            <td><span style="color:${student.responseStatus === 'responded' ? 'var(--lime)' : '#ffd166'};font-weight:bold;">${student.responseStatus === 'responded' ? 'Responded today' : 'Awaiting response'}</span></td>
            <td>${student.lastReminderAt ? new Date(student.lastReminderAt).toLocaleString('en-IN') : 'No reminder sent'}</td>
            <td>${student.email}</td>
            <td>
              <button class="more-btn" onclick="deleteStudent('${student.id}','${student.name}')">
                <span class="material-icons" style="font-size:1.1rem;color:rgba(255,82,82,0.75)">delete</span>
              </button>
            </td>
          </tr>
        `
      )
      .join('');
  };

  const renderFeed = (students, waste) => {
    const feed = document.getElementById('feedList');
    if (!feed) {
      return;
    }

    const reminderItem = {
      initials: 'RM',
      title: `${students.filter((student) => student.responseStatus === 'responded').length}/${students.length} students responded`,
      subtitle: 'Daily attendance visibility in one place',
      badge: 'TODAY',
    };

    const studentItems = students.slice(0, 3).map((student) => ({
      initials: student.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      title: student.name,
      subtitle: student.responseSummary,
      badge: student.responseStatus === 'responded' ? 'LIVE' : 'PENDING',
    }));

    const wasteItems = waste.slice(0, 2).map((entry) => ({
      initials: entry.mealType.slice(0, 1).toUpperCase(),
      title: `${entry.mealType} waste`,
      subtitle: `${entry.quantity} ${entry.unit || 'kg'} on ${entry.date}`,
      badge: 'WASTE',
    }));

    const items = [reminderItem].concat(studentItems, wasteItems);
    feed.innerHTML = items
      .map(
        (item) => `
          <div class="feed-item">
            <div class="f-avatar">${item.initials}</div>
            <div class="f-info">
              <div class="f-name">${item.title}</div>
              <div class="f-sub">${item.subtitle}</div>
            </div>
            <div class="f-meal">${item.badge}</div>
          </div>
        `
      )
      .join('');
  };

  const renderChart = (report) => {
    const chartArea = document.getElementById('chartArea');
    if (!chartArea) {
      return;
    }

    const lastSeven = report.slice(0, 7).reverse();
    chartArea.innerHTML = '';
    if (!lastSeven.length) {
      chartArea.innerHTML = '<div style="color:rgba(255,255,255,0.45);font-size:0.82rem;">No attendance history yet.</div>';
      return;
    }

    const max = Math.max(
      1,
      ...lastSeven.map((entry) => Math.max(entry.totalBreakfast || 0, entry.totalLunch || 0, entry.totalDinner || 0))
    );

    lastSeven.forEach((entry) => {
      const breakfastHeight = Math.round(((entry.totalBreakfast || 0) / max) * 100);
      const lunchHeight = Math.round(((entry.totalLunch || 0) / max) * 100);
      const label = entry.date.slice(5);
      const node = document.createElement('div');
      node.className = 'chart-col';
      node.innerHTML = `
        <div class="bar-grp">
          <div class="bar bk" style="height:${breakfastHeight}%"></div>
          <div class="bar ln" style="height:${lunchHeight}%"></div>
        </div>
        <div class="bar-day-lbl">${label}</div>
      `;
      chartArea.appendChild(node);
    });
  };

  const renderInventory = (menuRange) => {
    const inventoryCard = query('#section-inventory .table-card');
    if (!inventoryCard) {
      return;
    }

    const upcoming = menuRange.slice(0, 5);
    inventoryCard.innerHTML = `
      <div class="table-header">
        <div>
          <div class="card-title">Menu Planner</div>
          <div class="card-sub" style="margin-bottom:0">Create or update menus directly from your owner dashboard.</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:16px;">
        <form id="menuForm" class="glass-panel" style="padding:22px;margin:0;">
          <div style="display:grid;gap:12px;">
            <label style="font-size:0.78rem;color:var(--white-70);">Menu Date
              <input id="menu-date" type="date" style="width:100%;margin-top:6px;padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;" />
            </label>
            <label style="font-size:0.78rem;color:var(--white-70);">Breakfast
              <textarea id="menu-breakfast" rows="3" placeholder="Idli, Sambar" style="width:100%;margin-top:6px;padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;"></textarea>
            </label>
            <label style="font-size:0.78rem;color:var(--white-70);">Lunch
              <textarea id="menu-lunch" rows="3" placeholder="Rice, Dal" style="width:100%;margin-top:6px;padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;"></textarea>
            </label>
            <label style="font-size:0.78rem;color:var(--white-70);">Dinner
              <textarea id="menu-dinner" rows="3" placeholder="Chapati, Paneer Curry" style="width:100%;margin-top:6px;padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;"></textarea>
            </label>
            <button type="submit" class="impact-btn" style="justify-content:center;border:none;background:#4ade80;color:#0d1f12;">
              <span class="material-icons">save</span>Save Menu
            </button>
            <div id="menuMessage" style="display:none;padding:10px 12px;border-radius:12px;"></div>
          </div>
        </form>
        <div class="glass-panel" style="padding:22px;margin:0;">
          <div class="card-title">Upcoming Menus</div>
          <div class="card-sub">Latest saved dates</div>
          <div id="menuList" style="display:grid;gap:10px;">
            ${
              upcoming.length
                ? upcoming
                    .map(
                      (menu) => `
                        <div style="padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
                          <div style="font-weight:700;margin-bottom:6px;">${menu.date}</div>
                          <div style="font-size:0.8rem;color:var(--white-70);line-height:1.6;">
                            Breakfast: ${(menu.breakfast || []).join(', ') || '-'}<br/>
                            Lunch: ${(menu.lunch || []).join(', ') || '-'}<br/>
                            Dinner: ${(menu.dinner || []).join(', ') || '-'}
                          </div>
                        </div>
                      `
                    )
                    .join('')
                : '<div style="color:rgba(255,255,255,0.45);font-size:0.82rem;">No menu saved yet.</div>'
            }
          </div>
        </div>
      </div>
    `;

    const dateInput = document.getElementById('menu-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    const menuForm = document.getElementById('menuForm');
    if (menuForm) {
      menuForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const parseItems = (value) =>
          value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        try {
          await SmartFeedAPI.menu.set({
            date: document.getElementById('menu-date').value,
            breakfast: parseItems(document.getElementById('menu-breakfast').value),
            lunch: parseItems(document.getElementById('menu-lunch').value),
            dinner: parseItems(document.getElementById('menu-dinner').value),
          });

          showInlineMessage('menuMessage', 'Menu saved successfully.', false);
          await refreshOwnerData();
        } catch (error) {
          showInlineMessage('menuMessage', error.message, true);
        }
      });
    }
  };

  const renderAnalytics = (prediction, waste) => {
    const analyticsSection = query('#section-analytics');
    if (!analyticsSection) {
      return;
    }

    const breakfastPrediction = prediction?.meals?.breakfast?.predicted || 0;
    const lunchPrediction = prediction?.meals?.lunch?.predicted || 0;
    const dinnerPrediction = prediction?.meals?.dinner?.predicted || 0;
    const totalWaste = waste.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    analyticsSection.innerHTML = `
      <div class="page-header glass-panel">
        <h1>Detailed Analytics</h1>
        <p>Predicted demand and waste logging powered by your own SmartFeed data.</p>
      </div>
      <div class="top-stats">
        <div class="s-card"><div class="s-card-label"><span class="material-icons">wb_twilight</span> Predicted Breakfast</div><div class="s-num">${breakfastPrediction}</div><div class="s-denom">plates to prepare</div></div>
        <div class="s-card"><div class="s-card-label"><span class="material-icons">sunny</span> Predicted Lunch</div><div class="s-num">${lunchPrediction}</div><div class="s-denom">plates to prepare</div></div>
        <div class="s-card"><div class="s-card-label"><span class="material-icons">dark_mode</span> Predicted Dinner</div><div class="s-num">${dinnerPrediction}</div><div class="s-denom">plates to prepare</div></div>
      </div>
      <div style="display:grid;grid-template-columns:0.95fr 1.05fr;gap:16px;">
        <div class="table-card" style="margin-bottom:0;">
          <div class="card-title">Log Food Waste</div>
          <div class="card-sub">Use this to improve tomorrow's planning.</div>
          <form id="wasteForm" style="display:grid;gap:12px;">
            <select id="waste-mealType" style="padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
            <input id="waste-quantity" type="number" min="0" step="0.1" placeholder="Quantity" style="padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;" />
            <input id="waste-unit" type="text" value="kg" placeholder="Unit" style="padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;" />
            <textarea id="waste-notes" rows="3" placeholder="Notes" style="padding:11px 12px;border-radius:12px;border:1px solid var(--white-20);background:rgba(255,255,255,0.06);color:#fff;"></textarea>
            <button type="submit" class="impact-btn" style="justify-content:center;border:none;background:#4ade80;color:#0d1f12;">
              <span class="material-icons">add</span>Add Waste Record
            </button>
            <div id="wasteMessage" style="display:none;padding:10px 12px;border-radius:12px;"></div>
          </form>
        </div>
        <div class="table-card" style="margin-bottom:0;">
          <div class="card-title">Recent Waste Entries</div>
          <div class="card-sub">Total logged waste: ${totalWaste.toFixed(1)} units</div>
          <div style="display:grid;gap:10px;">
            ${
              waste.length
                ? waste
                    .slice(0, 6)
                    .map(
                      (item) => `
                        <div style="padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
                          <div style="font-weight:700;text-transform:capitalize;">${item.mealType}</div>
                          <div style="font-size:0.8rem;color:var(--white-70);margin-top:4px;">${item.quantity} ${item.unit || 'kg'} on ${item.date}</div>
                          <div style="font-size:0.75rem;color:var(--white-40);margin-top:4px;">${item.notes || 'No notes added.'}</div>
                        </div>
                      `
                    )
                    .join('')
                : '<div style="color:rgba(255,255,255,0.45);font-size:0.82rem;">No waste records yet.</div>'
            }
          </div>
        </div>
      </div>
    `;

    const wasteForm = document.getElementById('wasteForm');
    if (wasteForm) {
      wasteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await SmartFeedAPI.owner.addWaste({
            mealType: document.getElementById('waste-mealType').value,
            quantity: Number(document.getElementById('waste-quantity').value),
            unit: document.getElementById('waste-unit').value.trim() || 'kg',
            notes: document.getElementById('waste-notes').value.trim(),
          });
          showInlineMessage('wasteMessage', 'Waste record saved.', false);
          wasteForm.reset();
          document.getElementById('waste-unit').value = 'kg';
          await refreshOwnerData();
        } catch (error) {
          showInlineMessage('wasteMessage', error.message, true);
        }
      });
    }
  };

  const renderNotifications = () => {
    const notificationsCard = query('#section-notifications .table-card');
    if (!notificationsCard) {
      return;
    }

    const nextMenu = state.menuRange[0];
    const pendingCount = state.students.filter((student) => student.responseStatus !== 'responded').length;
    const latestWaste = state.waste[0];

    notificationsCard.innerHTML = `
      <div style="padding:16px; border-bottom:1px solid rgba(255, 255, 255, 0.15);">
        <div style="color:var(--lime);font-weight:bold;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          <span class="material-icons" style="font-size:1rem">notifications_active</span> Daily reminders
        </div>
        <div style="color:var(--white-70);line-height:1.7;">
          ${pendingCount ? `${pendingCount} student response${pendingCount === 1 ? ' is' : 's are'} still pending today.` : 'Every active student has already responded today.'}
        </div>
      </div>
      <div style="padding:16px; border-bottom:1px solid rgba(255, 255, 255, 0.15);">
        <div style="color:var(--lime);font-weight:bold;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          <span class="material-icons" style="font-size:1rem">event_available</span> Latest menu snapshot
        </div>
        <div style="color:var(--white-70);line-height:1.7;">
          ${nextMenu ? `${nextMenu.date}: Breakfast ${(nextMenu.breakfast || []).join(', ') || '-'} | Lunch ${(nextMenu.lunch || []).join(', ') || '-'} | Dinner ${(nextMenu.dinner || []).join(', ') || '-'}` : 'No menu has been published yet.'}
        </div>
      </div>
      <div style="padding:16px;">
        <div style="color:var(--clay);font-weight:bold;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          <span class="material-icons" style="font-size:1rem">monitoring</span> Waste tracking
        </div>
        <div style="color:var(--white-70);line-height:1.7;">
          ${latestWaste ? `Most recent entry: ${latestWaste.quantity} ${latestWaste.unit || 'kg'} of ${latestWaste.mealType} waste logged on ${latestWaste.date}.` : 'No waste has been logged yet. Use Analytics to start tracking overproduction.'}
        </div>
      </div>
    `;
  };

  const patchStudentsSection = () => {
    const header = query('#section-students .page-header.glass-panel');
    if (header && !document.getElementById('openAddStudentBtn')) {
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;';
      actions.innerHTML = `
        <button id="openAddStudentBtn" style="display:inline-flex;align-items:center;gap:6px;background:#4ade80;color:#0d1f12;border:none;padding:10px 20px;border-radius:40px;font-weight:700;font-size:0.88rem;cursor:pointer;">
          <span class="material-icons" style="font-size:1rem;">person_add</span>Add Student
        </button>
        <button id="sendReminderBtn" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.18);padding:10px 20px;border-radius:40px;font-weight:700;font-size:0.88rem;cursor:pointer;">
          <span class="material-icons" style="font-size:1rem;">mail</span>Send Daily Reminders
        </button>
      `;
      header.appendChild(actions);
      document.getElementById('openAddStudentBtn').onclick = window.openAddModal;
      document.getElementById('sendReminderBtn').onclick = window.sendDailyReminders;
    }

    const dashboardHead = query('#section-dashboard .table-card table thead tr');
    if (dashboardHead) {
      dashboardHead.innerHTML = '<th>Student Name</th><th>Status</th><th>Meals</th><th>Email</th><th></th>';
    }

    const studentHead = query('#section-students table thead tr');
    if (studentHead) {
      studentHead.innerHTML = '<th>Name</th><th>Status</th><th>Last reminder</th><th>Email</th><th></th>';
    }
  };

  async function refreshOwnerData() {
    const [studentsResponse, reportResponse, wasteResponse, predictionResponse] = await Promise.all([
      SmartFeedAPI.students.getAll(),
      SmartFeedAPI.owner.getDailyReport(),
      SmartFeedAPI.owner.getWaste(),
      SmartFeedAPI.owner.getPrediction(),
    ]);

    let menuResponse;
    try {
      menuResponse = await SmartFeedAPI.menu.getRange();
    } catch (error) {
      menuResponse = { data: [] };
    }

    state.students = studentsResponse.data || [];
    state.report = reportResponse.data || [];
    state.waste = wasteResponse.data || [];
    state.prediction = predictionResponse.data || null;
    state.menuRange = menuResponse.data || [];

    await updateStats();
    renderDashboardTable(state.students);
    renderStudentsSection(state.students);
    renderFeed(state.students, state.waste);
    renderChart(state.report);
    renderInventory(state.menuRange);
    renderAnalytics(state.prediction, state.waste);
    renderNotifications();
  }

  window.openAddModal = function () {
    const modal = document.getElementById('addStudentModal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeAddModal = function () {
    const modal = document.getElementById('addStudentModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
    const errNode = document.getElementById('addStudentErr');
    const okNode = document.getElementById('addStudentOk');
    if (errNode) errNode.style.display = 'none';
    if (okNode) okNode.style.display = 'none';
  };

  window.doAddStudent = async function () {
    const name = document.getElementById('s-name').value.trim();
    const usn = document.getElementById('s-usn').value.trim();
    const email = document.getElementById('s-email').value.trim();
    if (!name || !usn || !email) {
      showInlineMessage('addStudentErr', 'Name, USN, and email are required.', true);
      return;
    }

    const button = document.getElementById('addStudentBtn');
    const label = button.querySelector('span');
    button.disabled = true;
    label.textContent = 'Adding...';

    try {
      await SmartFeedAPI.students.add({ name, usn, email });
      showInlineMessage('addStudentOk', `Student added successfully for ${email}.`, false);
      ['s-name', 's-usn', 's-email'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      await refreshOwnerData();
    } catch (error) {
      showInlineMessage('addStudentErr', error.message, true);
    } finally {
      button.disabled = false;
      label.textContent = 'Add Student & Send Welcome Email';
    }
  };

  window.deleteStudent = async function (studentId, studentName) {
    if (!window.confirm(`Remove ${studentName} from SmartFeed?`)) {
      return;
    }

    try {
      await SmartFeedAPI.students.delete(studentId);
      await refreshOwnerData();
    } catch (error) {
      window.alert(error.message);
    }
  };

  window.sendDailyReminders = async function () {
    const button = document.getElementById('sendReminderBtn');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="material-icons" style="font-size:1rem;">hourglass_top</span>Sending...';
    }

    try {
      const response = await SmartFeedAPI.students.sendDailyReminders();
      window.alert(response.message || 'Daily reminders sent.');
      await refreshOwnerData();
    } catch (error) {
      window.alert(error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = '<span class="material-icons" style="font-size:1rem;">mail</span>Send Daily Reminders';
      }
    }
  };

  window.doLogout = function () {
    SmartFeedAPI.auth.logout('index.html');
  };

  window.switchSection = function (sectionId) {
    document.querySelectorAll('.sb-item, .tab-item').forEach((node) => {
      if (node.dataset.sec) {
        node.classList.remove('active');
      }
    });

    document
      .querySelectorAll(`.sb-item[data-sec="${sectionId}"], .tab-item[data-sec="${sectionId}"]`)
      .forEach((node) => node.classList.add('active'));

    document.querySelectorAll('.app-section').forEach((node) => node.classList.remove('active'));
    const target = document.getElementById(`section-${sectionId}`);
    if (target) {
      target.classList.add('active');
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    setOwnerMeta();
    patchStudentsSection();

    const nav = query('.sb-nav');
    if (nav && !document.getElementById('logoutNavItem')) {
      const logoutLink = document.createElement('a');
      logoutLink.id = 'logoutNavItem';
      logoutLink.href = '#';
      logoutLink.className = 'sb-item';
      logoutLink.innerHTML = '<span class="material-icons">logout</span>Log Out';
      logoutLink.onclick = function (event) {
        event.preventDefault();
        window.doLogout();
      };
      nav.appendChild(logoutLink);
    }

    try {
      await refreshOwnerData();
    } catch (error) {
      window.alert(error.message);
    }
  });
})();
