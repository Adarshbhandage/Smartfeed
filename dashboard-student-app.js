(function () {
  const user = SmartFeedAPI.auth.requireSession(['student']);
  if (!user) {
    return;
  }

  const now = new Date();
  const mealState = { b: null, l: null, d: null };
  let saveTimeout = null;
  let noticeTimeout = null;
  let mealHistory = [];

  const mealMap = {
    b: 'breakfast',
    l: 'lunch',
    d: 'dinner',
  };

  const showNotice = (message, type) => {
    let notice = document.getElementById('saveNotice');

    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'saveNotice';
      notice.style.cssText =
        'margin:0 0 18px;padding:12px 16px;border-radius:16px;border:1px solid rgba(255,255,255,0.15);font-size:0.84rem;';
      const target = document.querySelector('.meals-heading');
      if (target) {
        target.insertAdjacentElement('afterend', notice);
      }
    }

    notice.style.background =
      type === 'error' ? 'rgba(255,82,82,0.12)' : 'rgba(74,222,128,0.12)';
    notice.style.color = type === 'error' ? '#ff9d9d' : '#b7f8cb';
    notice.textContent = message;

    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      const activeNotice = document.getElementById('saveNotice');
      if (activeNotice) {
        activeNotice.remove();
      }
    }, 3200);
  };

  const setGreeting = () => {
    const greeting = document.querySelector('.greeting');
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    if (greeting) {
      greeting.textContent = `Good ${timeOfDay}, ${user.name || 'there'} - What's your plan for today?`;
    }

    const navCta = document.querySelector('.nav-cta');
    if (navCta) {
      navCta.textContent = 'Log Out';
      navCta.href = '#';
      navCta.onclick = function (event) {
        event.preventDefault();
        SmartFeedAPI.auth.logout('index.html');
      };
    }
  };

  const setDateStrip = () => {
    const dateTag = document.getElementById('dateTag');
    if (dateTag) {
      dateTag.textContent = now
        .toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        .toUpperCase();
    }

    const strip = document.getElementById('weekStrip');
    if (!strip) {
      return;
    }

    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    strip.innerHTML = '';

    for (let offset = -3; offset <= 3; offset += 1) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);

      const node = document.createElement('div');
      node.className = `week-day${offset === 0 ? ' today' : ''}`;
      node.innerHTML = `
        <span class="wd-name">${dayNames[date.getDay()]}</span>
        <span class="wd-num">${date.getDate()}</span>
        <div class="wd-dot"></div>
      `;
      strip.appendChild(node);
    }
  };

  const setCutoffLabels = () => {
    const labels = {
      b: 'Select before 8:00 AM IST',
      l: 'Select before 10:00 AM IST',
      d: 'Select before 5:00 PM IST',
    };

    Object.keys(labels).forEach((key) => {
      const tag = document.querySelector(`#card-${key} .cutoff-tag`);
      if (tag) {
        tag.innerHTML = `<span class="material-icons">schedule</span>${labels[key]}`;
      }
    });
  };

  const updateStreak = () => {
    const streakValue = document.querySelector('.streak-num');
    const progressBar = document.getElementById('sfBar');
    const hint = document.querySelector('.prog-hint');

    const dates = mealHistory
      .filter((entry) => entry.breakfast || entry.lunch || entry.dinner)
      .map((entry) => entry.date)
      .sort((left, right) => right.localeCompare(left));

    let streak = 0;
    if (dates.length) {
      let cursor = new Date(dates[0]);
      const seen = new Set(dates);

      while (seen.has(cursor.toISOString().split('T')[0])) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    if (streakValue) {
      streakValue.textContent = String(streak);
    }

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, streak * 10)}%`;
    }

    if (hint) {
      const remaining = Math.max(0, 10 - streak);
      hint.textContent =
        remaining === 0
          ? 'You have reached Platinum level.'
          : `${remaining} more day${remaining === 1 ? '' : 's'} to reach Platinum level`;
    }
  };

  const renderMealChoice = (id, choice) => {
    const card = document.getElementById(`card-${id}`);
    if (!card) {
      return;
    }

    const buttons = card.querySelectorAll('.mbtn');
    const yesButton = buttons[0];
    const noButton = buttons[1];

    yesButton.classList.toggle('chosen', choice === 'yes');
    noButton.classList.toggle('chosen', choice === 'no');
  };

  window.pick = function (id, choice, shouldSave) {
    mealState[id] = choice;
    renderMealChoice(id, choice);

    if (shouldSave === false) {
      return;
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveMeals, 600);
  };

  const getPayload = () => {
    const payload = {};

    Object.keys(mealState).forEach((key) => {
      if (mealState[key] === 'yes') {
        payload[mealMap[key]] = true;
      } else if (mealState[key] === 'no') {
        payload[mealMap[key]] = false;
      }
    });

    return payload;
  };

  async function saveMeals() {
    const payload = getPayload();
    if (!Object.keys(payload).length) {
      return;
    }

    try {
      await SmartFeedAPI.meals.saveTodaySelection(payload);
      showNotice('Meal selections saved for today.', 'success');
      await loadMyMeals();
    } catch (error) {
      showNotice(error.message, 'error');
    }
  }

  const setTodayMeals = (mealEntry) => {
    if (!mealEntry) {
      return;
    }

    ['breakfast', 'lunch', 'dinner'].forEach((mealType) => {
      const id = mealType.charAt(0);

      if (mealEntry[mealType] === true) {
        window.pick(id, 'yes', false);
      } else if (mealEntry[mealType] === false) {
        window.pick(id, 'no', false);
      }
    });
  };

  async function loadTodayMenu() {
    try {
      const response = await SmartFeedAPI.menu.getToday();
      const menu = response.data;
      const formatter = (items) => (Array.isArray(items) && items.length ? items.join(', ') : null);
      const times = { b: '7:30 AM', l: '1:00 PM', d: '8:00 PM' };

      [['b', menu.breakfast], ['l', menu.lunch], ['d', menu.dinner]].forEach(([id, items]) => {
        const text = formatter(items);
        if (!text) {
          return;
        }

        const label = document.querySelector(`#card-${id} .meal-time`);
        if (label) {
          label.textContent = `${times[id]} - ${text}`;
        }
      });
    } catch (error) {
      showNotice(error.message, 'error');
    }
  }

  async function loadMyMeals() {
    try {
      const response = await SmartFeedAPI.meals.getMyMeals();
      mealHistory = response.data || [];
      updateStreak();

      const today = now.toISOString().split('T')[0];
      const todayMeal = mealHistory.find((entry) => entry.date === today);

      Object.keys(mealState).forEach((key) => {
        mealState[key] = null;
        renderMealChoice(key, null);
      });

      setTodayMeals(todayMeal);
    } catch (error) {
      showNotice(error.message, 'error');
    }
  }

  setGreeting();
  setDateStrip();
  setCutoffLabels();
  loadTodayMenu();
  loadMyMeals();
})();
