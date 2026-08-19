(() => {
  "use strict";

  const API_BASE = "/api";
  const TOKEN_KEY = "amin_workspace_token";

  let state = { tasks: [], requests: [], dailyLogs: {} };
  let currentUser = null;
  let activeDetailTaskId = null;
  let confirmCallback = null;
  let taskSearchQuery = "";
  let taskFilterMode = "all";
  let taskSortMode = "priority";
  let selectedJalaliMonth = null;
  let selectedJalaliYear = null;
  let selectedCalendarDay = null;

  const $ = (selector) => document.querySelector(selector);

  const els = {
    loginView: $("#loginView"),
    appView: $("#appView"),
    loginForm: $("#loginForm"),
    username: $("#username"),
    password: $("#password"),
    loginError: $("#loginError"),
    roleSubtitle: $("#roleSubtitle"),
    logoutButton: $("#logoutButton"),
    newTaskButton: $("#newTaskButton"),
    taskSearch: $("#taskSearch"),
    taskFilter: $("#taskFilter"),
    taskSort: $("#taskSort"),

    progressList: $("#progressList"),
    queueList: $("#queueList"),
    doneList: $("#doneList"),
    progressCount: $("#progressCount"),
    queueCount: $("#queueCount"),
    doneCount: $("#doneCount"),

    statProgress: $("#statProgress"),
    statQueue: $("#statQueue"),
    statDone: $("#statDone"),
    statRequests: $("#statRequests"),
    requestStatCard: $("#requestStatCard"),
    requestPanel: $("#requestPanel"),
    requestList: $("#requestList"),
    requestCountBadge: $("#requestCountBadge"),

    taskModal: $("#taskModal"),
    taskForm: $("#taskForm"),
    taskModalEyebrow: $("#taskModalEyebrow"),
    taskModalTitle: $("#taskModalTitle"),
    taskSubmitButton: $("#taskSubmitButton"),
    taskId: $("#taskId"),
    taskTitle: $("#taskTitle"),
    taskDescription: $("#taskDescription"),
    taskPriority: $("#taskPriority"),
    taskStatus: $("#taskStatus"),
    taskColor: $("#taskColor"),
    taskColorPresets: $("#taskColorPresets"),
    extendedTaskFields: $("#extendedTaskFields"),
    taskLabels: $("#taskLabels"),
    taskStartDate: $("#taskStartDate"),
    taskEndDate: $("#taskEndDate"),

    detailModal: $("#detailModal"),
    detailTitle: $("#detailTitle"),
    detailContent: $("#detailContent"),

    noteModal: $("#noteModal"),
    noteForm: $("#noteForm"),
    noteModalTitle: $("#noteModalTitle"),
    noteTaskId: $("#noteTaskId"),
    noteId: $("#noteId"),
    noteText: $("#noteText"),
    noteTags: $("#noteTags"),
    noteSubmitButton: $("#noteSubmitButton"),

    confirmModal: $("#confirmModal"),
    confirmTitle: $("#confirmTitle"),
    confirmMessage: $("#confirmMessage"),
    confirmActionButton: $("#confirmActionButton"),

    toast: $("#toast"),
    todayPanel: $("#todayPanel"),
    todayDate: $("#todayDate"),
    todayDuration: $("#todayDuration"),
    todayMoodBadge: $("#todayMoodBadge"),
    loggedDaysCount: $("#loggedDaysCount"),
    jalaliMonthSelect: $("#jalaliMonthSelect"),
    jalaliYearSelect: $("#jalaliYearSelect"),
    prevMonthButton: $("#prevMonthButton"),
    nextMonthButton: $("#nextMonthButton"),
    activityGrid: $("#activityGrid"),
    calendarTooltip: $("#calendarTooltip"),
    dayEditor: $("#dayEditor"),
    dayEditorContent: $("#dayEditorContent"),
    selectedDayTitle: $("#selectedDayTitle"),
    selectedDayWeekday: $("#selectedDayWeekday"),
    selectedDayStatus: $("#selectedDayStatus"),
    selectedMoodPicker: $("#selectedMoodPicker"),
    selectedWorkStart: $("#selectedWorkStart"),
    selectedWorkEnd: $("#selectedWorkEnd"),
    selectedDuration: $("#selectedDuration"),
    saveSelectedDay: $("#saveSelectedDay"),
    readonlySelectedDay: $("#readonlySelectedDay")
  };

  function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ""; }

  function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function loadServerState() {
    const data = await api("/state");
    state = {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      requests: Array.isArray(data.requests) ? data.requests : [],
      dailyLogs: data.dailyLogs && typeof data.dailyLogs === "object" ? data.dailyLogs : {}
    };
  }

  async function saveState() {
    const data = await api("/state", { method: "PUT", body: JSON.stringify(state) });
    state = data.state;
    return state;
  }

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function div(a,b){return ~~(a/b)}
  function mod(a,b){return a-~~(a/b)*b}
  function jalCal(jy){const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];let bl=breaks.length,gy=jy+621,leapJ=-14,jp=breaks[0],jm,jump=0;if(jy<jp||jy>=breaks[bl-1])throw new Error("Invalid Jalali year");for(let i=1;i<bl;i++){jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}let n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ+=1;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150,march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;let leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}}
  function g2d(gy,gm,gd){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
  function d2g(jdn){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308,gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1,gy=div(j,1461)-100100+div(8-gm,6);return{gy,gm,gd}}
  function j2d(jy,jm,jd){const r=jalCal(jy);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1}
  function toGregorian(jy,jm,jd){return d2g(j2d(jy,jm,jd))}
  function isValidJalaliDate(jy,jm,jd){if(jy<-61||jy>3177||jm<1||jm>12||jd<1)return false;const ml=jm<=6?31:jm<=11?30:(jalCal(jy).leap===0?30:29);return jd<=ml}

  function normalizePersianDigits(value = "") {
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    return String(value)
      .replace(/[۰-۹]/g, (digit) => persian.indexOf(digit))
      .replace(/[٠-٩]/g, (digit) => arabic.indexOf(digit));
  }

  function parseJalaliDate(value) {
    if (!value) return null;

    const clean = normalizePersianDigits(value)
      .trim()
      .replaceAll("-", "/")
      .replace(/\s+/g, "");

    const match = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;

    const jy = Number(match[1]);
    const jm = Number(match[2]);
    const jd = Number(match[3]);

    if (!isValidJalaliDate(jy, jm, jd)) {
      return null;
    }

    return { jy, jm, jd };
  }

  function formatJalaliInput(value) {
    const parsed = parseJalaliDate(value);
    if (!parsed) return value || "";
    return `${parsed.jy}/${String(parsed.jm).padStart(2, "0")}/${String(parsed.jd).padStart(2, "0")}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    // New records are stored as Jalali YYYY/MM/DD.
    const jalaliValue = parseJalaliDate(value);
    if (jalaliValue) {
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(
        new Date(
          toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd).gy,
          toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd).gm - 1,
          toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd).gd
        )
      );
    }

    // Backward compatibility for previously saved Gregorian YYYY-MM-DD values.
    const gregorianMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (gregorianMatch) {
      const date = new Date(
        Number(gregorianMatch[1]),
        Number(gregorianMatch[2]) - 1,
        Number(gregorianMatch[3])
      );

      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(date);
    }

    return value;
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");

    const anyOpen = [els.taskModal, els.detailModal, els.noteModal, els.confirmModal]
      .some((item) => !item.classList.contains("hidden"));

    if (!anyOpen) document.body.style.overflow = "";
  }

  async function login(username, password) {
    const result = await api("/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password: String(password).trim() })
    });
    setToken(result.token);
    currentUser = result.user;
    await loadServerState();
    els.loginForm.reset();
    els.loginError.classList.add("hidden");
    els.loginView.classList.add("hidden");
    els.appView.classList.remove("hidden");
    configureRoleUI();
    render();
    renderTodayPanel();
    return true;
  }

  function logout() {
    setToken("");
    currentUser = null;
    activeDetailTaskId = null;
    closeModal(els.taskModal);
    closeModal(els.detailModal);
    closeModal(els.noteModal);
    closeModal(els.confirmModal);
    els.appView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    els.username.focus();
  }

  function configureRoleUI() {
    const roleText = {
      admin: "Admin · full control and approvals",
      viewer: "Viewer · read-only access",
      task: "Task editor · every change requires Amin approval"
    };

    els.roleSubtitle.textContent = `${currentUser.label} — ${roleText[currentUser.role]}`;
    els.newTaskButton.classList.toggle("hidden", currentUser.role === "viewer");
    els.requestPanel.classList.toggle("hidden", currentUser.role !== "admin");
    els.requestStatCard.classList.toggle("hidden", currentUser.role !== "admin");
  }

  function getPendingRequestsForTask(taskId) {
    return state.requests
      .filter((request) =>
        request.taskId === taskId &&
        ["edit", "delete"].includes(request.type)
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function getTaskDisplayModel(task) {
    // Viewer only sees approved/live data.
    if (!currentUser || currentUser.role === "viewer") {
      return {
        ...task,
        _pending: false,
        _pendingDelete: false,
        _pendingTypes: [],
        _changedFields: []
      };
    }

    const requests = getPendingRequestsForTask(task.id);
    if (!requests.length) {
      return {
        ...task,
        _pending: false,
        _pendingDelete: false,
        _pendingTypes: [],
        _changedFields: []
      };
    }

    let preview = JSON.parse(JSON.stringify(task));
    const changedFields = new Set();
    let pendingDelete = false;
    const pendingTypes = [];

    for (const request of requests) {
      pendingTypes.push(request.type);

      if (request.type === "edit" && request.payload) {
        const fields = [
          "title",
          "description",
          "priority",
          "status",
          "labels",
          "startDate",
          "endDate",
          "color"
        ];

        for (const field of fields) {
          const before = JSON.stringify(preview[field] ?? null);
          const after = JSON.stringify(request.payload[field] ?? null);
          if (before !== after) changedFields.add(field);
        }

        preview = {
          ...preview,
          ...request.payload
        };
      }

      if (request.type === "delete") {
        pendingDelete = true;
      }
    }

    return {
      ...preview,
      _pending: true,
      _pendingDelete: pendingDelete,
      _pendingTypes: pendingTypes,
      _changedFields: [...changedFields],
      _sourceTask: task
    };
  }

  function getPendingCreateModels() {
    if (!currentUser || currentUser.role === "viewer") return [];

    return state.requests
      .filter((request) => request.type === "create" && request.payload)
      .map((request) => ({
        id: `pending_${request.id}`,
        ...request.payload,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
        notes: [],
        _pending: true,
        _pendingCreate: true,
        _pendingDelete: false,
        _pendingTypes: ["create"],
        _changedFields: ["title", "description", "priority", "status", "labels", "startDate", "endDate", "color"],
        _requestId: request.id
      }));
  }

  function matchesTaskSearch(task) {
    if (!taskSearchQuery) return true;

    const haystack = [
      task.title,
      task.description,
      ...(task.labels || []),
      ...(task.notes || []).flatMap((note) => [
        note.text,
        ...(note.tags || [])
      ])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(taskSearchQuery);
  }

  function matchesTaskFilter(task) {
    if (taskFilterMode === "pending") return Boolean(task._pending);
    if (taskFilterMode === "dated") return Boolean(task.startDate || task.endDate);
    if (taskFilterMode === "notes") return Boolean(task.notes?.length);
    return true;
  }

  function sortTasks(tasks, status) {
    return [...tasks].sort((a, b) => {
      if (taskSortMode === "updated") {
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      }

      if (taskSortMode === "date") {
        const toTimestamp = (value) => {
          if (!value) return Number.MAX_SAFE_INTEGER;

          const jalaliValue = parseJalaliDate(value);
          if (jalaliValue) {
            const g = toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd);
            return new Date(g.gy, g.gm - 1, g.gd).getTime();
          }

          const date = new Date(`${value}T00:00:00`);
          return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
        };

        return toTimestamp(a.endDate) - toTimestamp(b.endDate) || a.priority - b.priority;
      }

      if (status === "done") {
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }

      return a.priority - b.priority;
    });
  }

  function render() {
    if (!currentUser) return;

    const displayTasks = state.tasks.map(getTaskDisplayModel);
    const pendingCreates = getPendingCreateModels();
    const allDisplayTasks = [...displayTasks, ...pendingCreates];

    const visibleTasks = allDisplayTasks
      .filter(matchesTaskSearch)
      .filter(matchesTaskFilter);

    const progress = sortTasks(
      visibleTasks.filter((task) => task.status === "progress"),
      "progress"
    );

    const queue = sortTasks(
      visibleTasks.filter((task) => task.status === "queue"),
      "queue"
    );

    const done = sortTasks(
      visibleTasks.filter((task) => task.status === "done"),
      "done"
    );

    renderTaskList(els.progressList, progress);
    renderTaskList(els.queueList, queue);
    renderTaskList(els.doneList, done);

    els.progressCount.textContent = progress.length;
    els.queueCount.textContent = queue.length;
    els.doneCount.textContent = done.length;

    els.statProgress.textContent = progress.length;
    els.statQueue.textContent = queue.length;
    els.statDone.textContent = done.length;

    if (currentUser.role === "admin") { renderRequests(); renderTodayPanel(); }

    if (activeDetailTaskId && !els.detailModal.classList.contains("hidden")) {
      const stillExists = state.tasks.some((task) => task.id === activeDetailTaskId);
      if (stillExists) renderTaskDetails(activeDetailTaskId);
      else closeModal(els.detailModal);
    }
  }

  function renderTaskList(container, tasks) {
    if (!tasks.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✓</div>
          <div>
            <strong>${taskSearchQuery || taskFilterMode !== "all" ? "Nothing matches" : "Nothing here yet"}</strong>
            <p>${taskSearchQuery || taskFilterMode !== "all" ? "Try another search or filter." : "Tasks will appear here when available."}</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(taskCard).join("");
  }

  function taskCard(task) {
    const changed = new Set(task._changedFields || []);

    const labels = (task.labels || [])
      .map((label) => `<span class="label-chip ${changed.has("labels") ? "pending-field" : ""}" dir="auto">${escapeHtml(label)}</span>`)
      .join("");

    const dateBits = [];
    if (task.startDate) {
      dateBits.push({
        text: `Start ${formatDate(task.startDate)}`,
        changed: changed.has("startDate")
      });
    }
    if (task.endDate) {
      dateBits.push({
        text: `End ${formatDate(task.endDate)}`,
        changed: changed.has("endDate")
      });
    }

    const notesVisible = currentUser.role !== "viewer";
    const noteCount = Array.isArray(task.notes) ? task.notes.length : 0;

    const realTaskId = task._pendingCreate ? null : task.id;
    const pendingRequests = realTaskId ? getPendingRequestsForTask(realTaskId) : [];
    const pendingCount = task._pendingCreate ? 1 : pendingRequests.length;

    const actions = [];

    if (!task._pendingCreate) {
      actions.push(`<button class="card-action card-action-primary" data-action="details" data-id="${task.id}">
        <span>Open task</span>
        <span aria-hidden="true">→</span>
      </button>`);
    }

    if ((currentUser.role === "admin" || currentUser.role === "task") && !task._pendingCreate && !task._pendingDelete) {
      actions.push(`<button class="card-action" data-action="edit" data-id="${task.id}">Edit</button>`);
      actions.push(`<button class="card-action danger" data-action="delete" data-id="${task.id}">Delete</button>`);
    }

    const pendingLabel = task._pendingCreate
      ? "Pending creation"
      : task._pendingDelete
        ? "Pending deletion"
        : task._pending
          ? "Pending approval"
          : "";

    const pendingTypeLabel = task._pendingTypes?.length
      ? [...new Set(task._pendingTypes)].map((type) => ({
          edit: "edit",
          delete: "delete",
          note_add: "note",
          note_edit: "note edit",
          create: "create"
        }[type] || type)).join(" · ")
      : "";

    const dueText = task.endDate ? formatDate(task.endDate) : "";
    const labelPreview = (task.labels || []).slice(0, 3);
    const extraLabelCount = Math.max(0, (task.labels || []).length - labelPreview.length);

    return `
      <article class="task-card status-${task.status} ${task._pending ? "task-card-pending" : ""} ${task._pendingDelete ? "task-card-delete-pending" : ""}" style="--task-color:${escapeHtml(task.color || "#3b82f6")}">
        <div class="task-card-topline">
          <div class="task-status-group">
            <span class="task-status-dot"></span>
            <span class="task-status-name">${task.status === "progress" ? "In progress" : task.status === "queue" ? "Queue" : "Completed"}</span>
          </div>
          <span class="priority-pill ${changed.has("priority") ? "pending-field" : ""}">P${escapeHtml(task.priority)}</span>
        </div>

        ${task._pending ? `
          <div class="pending-banner">
            <span class="pending-dot"></span>
            <span>${escapeHtml(pendingLabel)}</span>
            ${pendingTypeLabel ? `<span class="pending-kind">${escapeHtml(pendingTypeLabel)}</span>` : ""}
          </div>
        ` : ""}

        <div class="task-main">
          <h3 class="task-title break-words ${task._pendingDelete ? "pending-delete-title" : ""} ${changed.has("title") ? "pending-text-change" : ""}" dir="auto">${escapeHtml(task.title)}</h3>
          ${task.description ? `<p class="task-description break-words ${changed.has("description") ? "pending-text-change" : ""}" dir="auto">${escapeHtml(task.description)}</p>` : ""}
        </div>

        ${(labelPreview.length || dueText || notesVisible) ? `
          <div class="task-meta-row">
            ${labelPreview.map((label) => `<span class="label-chip ${changed.has("labels") ? "pending-field" : ""}" dir="auto">${escapeHtml(label)}</span>`).join("")}
            ${extraLabelCount ? `<span class="meta-chip">+${extraLabelCount}</span>` : ""}
            ${dueText ? `
              <span class="meta-chip ${changed.has("endDate") ? "pending-field" : ""}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${escapeHtml(dueText)}
              </span>
            ` : ""}
            ${notesVisible ? `
              <span class="meta-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4v8z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${noteCount}
              </span>
            ` : ""}
          </div>
        ` : ""}

        ${pendingCount ? `<div class="pending-summary">${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting for approval</div>` : ""}

        ${task._pendingDelete ? `
          <div class="delete-warning">
            <span>Marked for deletion</span>
            <small>Visible until Amin decides.</small>
          </div>
        ` : ""}

        ${task._pendingCreate ? `
          <div class="pending-summary">Preview only — waiting for Amin approval</div>
        ` : ""}

        <div class="task-actions">
          ${actions.join("")}
        </div>
      </article>
    `;
  }

  function openTaskForm(taskId = null) {
    const editing = Boolean(taskId);
    const task = editing ? state.tasks.find((item) => item.id === taskId) : null;

    els.taskForm.reset();
    els.taskId.value = task?.id || "";
    els.taskPriority.value = task?.priority ?? 1;
    els.taskStatus.value = task?.status || "queue";
    els.taskColor.value = task?.color || "#3b82f6";
    els.taskTitle.value = task?.title || "";
    els.taskDescription.value = task?.description || "";

    const canEditExtendedFields = currentUser.role === "admin" || currentUser.role === "task";
    els.extendedTaskFields.classList.toggle("hidden", !canEditExtendedFields);

    if (canEditExtendedFields) {
      els.taskLabels.value = (task?.labels || []).join(", ");
      els.taskStartDate.value = task?.startDate || "";
      els.taskEndDate.value = task?.endDate || "";
    }

    els.taskModalEyebrow.textContent = currentUser.role === "task" ? "Approval request" : "Task";
    els.taskModalTitle.textContent = editing ? "Edit task" : "New task";
    els.taskSubmitButton.textContent =
      currentUser.role === "task"
        ? (editing ? "Send edit request" : "Send create request")
        : (editing ? "Save changes" : "Create task");

    openModal(els.taskModal);
    setTimeout(() => els.taskTitle.focus(), 0);
  }

  function collectTaskFormData(existing = null) {
    const base = {
      title: els.taskTitle.value.trim(),
      description: els.taskDescription.value.trim(),
      priority: Math.max(1, Number.parseInt(els.taskPriority.value, 10) || 1),
      status: els.taskStatus.value,
      color: els.taskColor.value || "#3b82f6"
    };

    if (currentUser.role === "admin" || currentUser.role === "task") {
      return {
        ...base,
        labels: els.taskLabels.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        startDate: els.taskStartDate.value.trim() ? formatJalaliInput(els.taskStartDate.value.trim()) : "",
        endDate: els.taskEndDate.value.trim() ? formatJalaliInput(els.taskEndDate.value.trim()) : ""
      };
    }

    return {
      ...base,
      labels: existing?.labels || [],
      startDate: existing?.startDate || "",
      endDate: existing?.endDate || ""
    };
  }

  async function submitTaskForm(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role === "viewer") return;

    const id = els.taskId.value;
    const existing = id ? state.tasks.find((task) => task.id === id) : null;

    if (currentUser.role === "admin" || currentUser.role === "task") {
      const startRaw = els.taskStartDate.value.trim();
      const endRaw = els.taskEndDate.value.trim();

      if (startRaw && !parseJalaliDate(startRaw)) {
        toast("Start date must be a valid Jalali date, for example 1405/01/01.");
        els.taskStartDate.focus();
        return;
      }

      if (endRaw && !parseJalaliDate(endRaw)) {
        toast("End date must be a valid Jalali date, for example 1405/01/01.");
        els.taskEndDate.focus();
        return;
      }
    }

    const payload = collectTaskFormData(existing);

    if (!payload.title) return;

    if (currentUser.role === "admin") {
      if (existing) {
        Object.assign(existing, payload, { updatedAt: new Date().toISOString() });
        toast("Task updated.");
      } else {
        state.tasks.push({
          id: uid("task"),
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: []
        });
        toast("Task created.");
      }

      await saveState();
      closeModal(els.taskModal);
      render();
      return;
    }

    const request = {
      id: uid("request"),
      type: existing ? "edit" : "create",
      taskId: existing?.id || null,
      taskTitle: existing?.title || payload.title,
      payload,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.username
    };

    if (existing) {
      const pendingEditIndex = state.requests.findIndex(
        (item) => item.type === "edit" && item.taskId === existing.id && item.createdBy === currentUser.username
      );

      if (pendingEditIndex !== -1) {
        state.requests[pendingEditIndex] = {
          ...request,
          id: state.requests[pendingEditIndex].id
        };
      } else {
        state.requests.push(request);
      }
    } else {
      state.requests.push(request);
    }
    await saveState();
    closeModal(els.taskModal);
    toast(existing ? "Edit request sent to Amin." : "Create request sent to Amin.");
    render();
  }

  async function requestDelete(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;

    if (currentUser.role === "admin") {
      askConfirm(
        "Delete task",
        `Delete “${task.title}”? This cannot be undone.`,
        async () => {
          state.tasks = state.tasks.filter((item) => item.id !== taskId);
          state.requests = state.requests.filter((request) => request.taskId !== taskId);
          await saveState();
          toast("Task deleted.");
          render();
        }
      );
      return;
    }

    if (currentUser.role === "task") {
      const duplicate = state.requests.some(
        (request) => request.type === "delete" && request.taskId === taskId
      );

      if (duplicate) {
        toast("Deletion is already waiting for Amin approval.");
        return;
      }

      state.requests.push({
        id: uid("request"),
        type: "delete",
        taskId,
        taskTitle: task.title,
        payload: null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.username
      });

      await saveState();
      toast("Delete request sent to Amin.");
      render();
    }
  }

  function renderRequests() {
    const requests = [...state.requests].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    els.statRequests.textContent = requests.length;
    els.requestCountBadge.textContent = requests.length;

    if (!requests.length) {
      els.requestList.innerHTML = `<div class="empty-state">No pending requests.</div>`;
      return;
    }

    els.requestList.innerHTML = requests.map((request) => {
      const summary = requestSummary(request);
      return `
        <article class="request-card">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="request-type">${escapeHtml(request.type)}</span>
                <span class="text-[11px] text-zinc-600">${escapeHtml(formatDateTime(request.createdAt))}</span>
              </div>
              <h3 class="break-words text-sm font-semibold text-zinc-200" dir="auto">${escapeHtml(request.taskTitle || "New task")}</h3>
              <p class="request-copy mt-1 break-words text-xs leading-5 text-zinc-600" dir="auto">${escapeHtml(summary)}</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button class="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:text-white"
                      data-request-action="reject" data-id="${request.id}">Reject</button>
              <button class="btn-primary rounded-xl px-3 py-2 text-xs font-semibold"
                      data-request-action="approve" data-id="${request.id}">Approve</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function requestSummary(request) {
    if (request.type === "delete") return "Request to delete this task.";
    if (!request.payload) return "Task change request.";

    const p = request.payload;
    const statusLabel = {
      queue: "Queue",
      progress: "In progress",
      done: "Completed"
    }[p.status] || p.status;

    const details = [
      `Priority ${p.priority}`,
      statusLabel,
      p.labels?.length ? `Labels: ${p.labels.join(", ")}` : "No labels",
      p.startDate ? `Start: ${p.startDate}` : "",
      p.endDate ? `End: ${p.endDate}` : "",
      p.description || ""
    ].filter(Boolean);

    return details.join(" · ");
  }

  async function approveRequest(requestId) {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) return;

    if (request.type === "create") {
      state.tasks.push({
        id: uid("task"),
        ...request.payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: []
      });
    }

    if (request.type === "edit") {
      const task = state.tasks.find((item) => item.id === request.taskId);
      if (task) {
        Object.assign(task, request.payload, { updatedAt: new Date().toISOString() });
      }
    }

    if (request.type === "delete") {
      state.tasks = state.tasks.filter((item) => item.id !== request.taskId);
      state.requests = state.requests.filter((item) => item.taskId !== request.taskId || item.id === requestId);
    }


    state.requests = state.requests.filter((item) => item.id !== requestId);
    await saveState();
    toast("Request approved and applied.");
    render();
  }

  async function rejectRequest(requestId) {
    state.requests = state.requests.filter((item) => item.id !== requestId);
    await saveState();
    toast("Request rejected. Original task restored.");
    render();
  }

  function renderTaskDetails(taskId) {
    const sourceTask = state.tasks.find((item) => item.id === taskId);
    if (!sourceTask) return;

    const task = getTaskDisplayModel(sourceTask);
    activeDetailTaskId = taskId;
    els.detailTitle.textContent = task.title;

    const statusLabel = {
      progress: "In progress",
      queue: "Queue",
      done: "Completed"
    }[task.status] || task.status;

    const labels = (task.labels || []).length
      ? task.labels.map((label) => `<span class="label-chip" dir="auto">${escapeHtml(label)}</span>`).join("")
      : `<span class="text-xs text-zinc-700">No labels</span>`;

    const notesSection = currentUser.role === "viewer"
      ? ""
      : buildNotesSection(task);

    els.detailContent.innerHTML = `
      ${task._pending ? `
        <div class="detail-pending-box ${task._pendingDelete ? "delete" : ""}">
          <div>
            <strong>${task._pendingDelete ? "Deletion waiting for Amin" : "Pending changes preview"}</strong>
            <p>${task._pendingDelete
              ? "The task is still preserved. Rejecting the request restores the normal view; approving it removes the task."
              : "Highlighted values are proposed by Task and are not permanent until Amin approves them."}</p>
          </div>
        </div>
      ` : ""}

      ${task.description ? `
        <div class="mb-5">
          <p class="detail-box-label">Description</p>
          <p class="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-400" dir="auto">${escapeHtml(task.description)}</p>
        </div>
      ` : ""}

      <div class="detail-grid">
        <div class="detail-box">
          <p class="detail-box-label">Priority</p>
          <p class="detail-box-value">P${escapeHtml(task.priority)}</p>
        </div>
        <div class="detail-box">
          <p class="detail-box-label">Status</p>
          <p class="detail-box-value">${escapeHtml(statusLabel)}</p>
        </div>
        <div class="detail-box">
          <p class="detail-box-label">Start date</p>
          <p class="detail-box-value">${escapeHtml(formatDate(task.startDate))}</p>
        </div>
        <div class="detail-box">
          <p class="detail-box-label">End date</p>
          <p class="detail-box-value">${escapeHtml(formatDate(task.endDate))}</p>
        </div>
      </div>

      <div class="mt-4">
        <p class="detail-box-label mb-2">Labels</p>
        <div class="flex flex-wrap gap-1.5">${labels}</div>
      </div>

      ${notesSection}
    `;
  }

  function buildNotesSection(task) {
    const notes = Array.isArray(task.notes) ? [...task.notes] : [];
    notes.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    const notesHtml = notes.length
      ? notes.map((note) => {
          const isOwner = currentUser.username === note.author;
          const canEdit = isOwner;
          const canDelete = isOwner || currentUser.role === "admin";

          const tags = Array.isArray(note.tags) && note.tags.length
            ? `<div class="mt-2 flex flex-wrap gap-1.5">
                ${note.tags.map((tag) => `<span class="note-tag" dir="auto">${escapeHtml(tag)}</span>`).join("")}
              </div>`
            : "";

          return `
            <article class="note-card">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="note-text break-words" dir="auto">${escapeHtml(note.text)}</p>
                  ${tags}
                </div>

                ${(canEdit || canDelete) ? `
                  <div class="flex shrink-0 gap-1.5">
                    ${canEdit ? `<button class="card-action" data-note-action="edit" data-note-id="${note.id}" data-task-id="${task.id}">Edit</button>` : ""}
                    ${canDelete ? `<button class="card-action danger" data-note-action="delete" data-note-id="${note.id}" data-task-id="${task.id}">Delete</button>` : ""}
                  </div>
                ` : ""}
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-2">
                <p class="note-meta">${escapeHtml(note.author)} · ${escapeHtml(formatDateTime(note.updatedAt || note.createdAt))}</p>
                ${note.updatedAt && note.createdAt && note.updatedAt !== note.createdAt ? `<span class="note-edited">edited</span>` : ""}
              </div>
            </article>
          `;
        }).join("")
      : `<div class="empty-state">No private notes yet.</div>`;

    return `
      <div class="mt-6 border-t border-white/5 pt-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <p class="detail-box-label">Private notes</p>
            <p class="mt-1 text-xs text-zinc-700">Visible only to Amin and Task. You can edit only your own notes.</p>
          </div>
          <button class="btn-primary rounded-xl px-3 py-2 text-xs font-semibold" data-note-action="add" data-task-id="${task.id}">+ Add note</button>
        </div>
        <div class="space-y-2">${notesHtml}</div>
      </div>
    `;
  }

  function openNoteForm(taskId, noteId = null) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;

    const note = noteId
      ? task.notes?.find((item) => item.id === noteId)
      : null;

    if (note && currentUser.username !== note.author) {
      toast("You can only edit your own notes.");
      return;
    }

    els.noteForm.reset();
    els.noteTaskId.value = taskId;
    els.noteId.value = note?.id || "";
    els.noteText.value = note?.text || "";
    els.noteTags.value = Array.isArray(note?.tags) ? note.tags.join(", ") : "";
    els.noteModalTitle.textContent = note ? "Edit note" : "Add note";
    els.noteSubmitButton.textContent = note ? "Save changes" : "Add note";

    openModal(els.noteModal);
    setTimeout(() => els.noteText.focus(), 0);
  }

  function collectNoteTags() {
    return [...new Set(
      els.noteTags.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )];
  }

  async function submitNoteForm(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role === "viewer") return;

    const taskId = els.noteTaskId.value;
    const noteId = els.noteId.value;
    const text = els.noteText.value.trim();
    const tags = collectNoteTags();

    if (!text) return;

    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;

    if (!Array.isArray(task.notes)) task.notes = [];

    if (noteId) {
      const note = task.notes.find((item) => item.id === noteId);
      if (!note) return;

      if (note.author !== currentUser.username) {
        toast("You can only edit your own notes.");
        return;
      }

      note.text = text;
      note.tags = tags;
      note.updatedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();

      toast("Note updated.");
    } else {
      const now = new Date().toISOString();

      task.notes.push({
        id: uid("note"),
        text,
        tags,
        author: currentUser.username,
        createdAt: now,
        updatedAt: now
      });

      task.updatedAt = now;
      toast("Note added.");
    }

    await saveState();
    closeModal(els.noteModal);
    renderTaskDetails(taskId);
    render();
  }

  async function deleteNote(taskId, noteId) {
    const task = state.tasks.find((item) => item.id === taskId);
    const note = task?.notes?.find((item) => item.id === noteId);
    if (!task || !note) return;

    const isOwner = note.author === currentUser.username;
    const canDelete = isOwner || currentUser.role === "admin";

    if (!canDelete) {
      toast("You cannot delete this note.");
      return;
    }

    askConfirm(
      "Delete note",
      currentUser.role === "admin" && !isOwner
        ? `Delete ${note.author}'s note?`
        : "Delete this note?",
      async () => {
        task.notes = task.notes.filter((item) => item.id !== noteId);
        task.updatedAt = new Date().toISOString();

        await saveState();
        renderTaskDetails(taskId);
        render();
        toast("Note deleted.");
      }
    );
  }

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function minutesBetween(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return 0;

    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  function formatDuration(minutes) {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!hours) return `${mins}m`;
    if (!mins) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function toJalali(gy, gm, gd) {
    const gDaysInMonth = [31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd;
    for (let i = 0; i < gm - 1; ++i) days += gDaysInMonth[i];

    let jy = -1595 + 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;

    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    if (days < 186) {
      return { jy, jm: 1 + Math.floor(days / 31), jd: 1 + (days % 31) };
    }

    return { jy, jm: 7 + Math.floor((days - 186) / 30), jd: 1 + ((days - 186) % 30) };
  }

  function jalaliDateFromGregorian(date) {
    return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function jalaliMonthName(month) {
    return [
      "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
      "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ][month - 1] || "";
  }

  function persianWeekday(date) {
    return new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(date);
  }

  function persianDigits(value) {
    return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  }

  function getSharedLogs() {
    if (!state.dailyLogs || typeof state.dailyLogs !== "object") state.dailyLogs = {};
    if (!state.dailyLogs.amin) state.dailyLogs.amin = {};
    return state.dailyLogs.amin;
  }

  function moodMeta(value) {
    const map = {
      1: { emoji: "😵", label: "Rough" },
      2: { emoji: "😕", label: "Low" },
      3: { emoji: "😐", label: "Okay" },
      4: { emoji: "🙂", label: "Good" },
      5: { emoji: "🔥", label: "Great" }
    };
    return map[Number(value)] || { emoji: "—", label: "No mood" };
  }

  function renderTodayPanel() {
    if (!currentUser) return;
    els.todayPanel.classList.remove("hidden");
    const today = new Date();
    const j = jalaliDateFromGregorian(today);
    const logs = getSharedLogs();
    const log = logs[localDateKey(today)] || {};
    const mood = moodMeta(log.mood);

    els.todayDate.textContent = `${persianDigits(j.jd)} ${jalaliMonthName(j.jm)} ${persianDigits(j.jy)}`;
    els.todayMoodBadge.textContent = log.mood ? `${mood.emoji} ${mood.label}` : "No mood yet";
    const durationValue = els.todayDuration?.querySelector(".today-duration-value");
    if (durationValue) durationValue.textContent = formatDuration(minutesBetween(log.start, log.end));

    renderActivityGrid();
    if (selectedCalendarDay) renderSelectedDayEditor(selectedCalendarDay);
  }

  function renderSelectedDayEditor(day) {
    selectedCalendarDay = day;
    const log = getSharedLogs()[day.key] || {};
    const isAdmin = currentUser?.role === "admin";
    els.dayEditor.querySelector(".day-editor-empty")?.classList.add("hidden");
    els.dayEditorContent.classList.remove("hidden");
    els.selectedDayTitle.textContent = `${persianDigits(day.jd)} ${jalaliMonthName(day.jm)} ${persianDigits(day.jy)}`;
    els.selectedDayWeekday.textContent = persianWeekday(day.date);

    const hasLog = Object.keys(log).length > 0;
    els.selectedDayStatus.textContent = hasLog ? "Logged" : "No log";
    els.selectedDayStatus.classList.toggle("logged", hasLog);
    els.selectedWorkStart.value = log.start || "";
    els.selectedWorkEnd.value = log.end || "";
    els.selectedDuration.textContent = formatDuration(minutesBetween(log.start, log.end));

    els.selectedMoodPicker.querySelectorAll("[data-selected-mood]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.selectedMood) === Number(log.mood));
      button.disabled = !isAdmin;
    });
    els.selectedWorkStart.disabled = !isAdmin;
    els.selectedWorkEnd.disabled = !isAdmin;
    els.saveSelectedDay.classList.toggle("hidden", !isAdmin);
    els.readonlySelectedDay.classList.toggle("hidden", isAdmin);
  }

  async function saveSelectedDayLog() {
    if (!currentUser || currentUser.role !== "admin") return toast("Only Amin can change the daily log.");
    if (!selectedCalendarDay) return toast("Select a day first.");

    const selectedMood = els.selectedMoodPicker.querySelector(".mood-option.active");
    const mood = selectedMood ? Number(selectedMood.dataset.selectedMood) : null;
    const start = els.selectedWorkStart.value;
    const end = els.selectedWorkEnd.value;

    getSharedLogs()[selectedCalendarDay.key] = {
      date: selectedCalendarDay.key,
      mood,
      start,
      end,
      minutes: minutesBetween(start, end),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveState();
      renderTodayPanel();
      toast("Day saved.");
    } catch (error) {
      toast(error.message || "Could not save this day.");
    }
  }

  function activityLevel(log) {
    if (!log) return 0;
    const minutes = Number(log.minutes || minutesBetween(log.start, log.end) || 0);
    if (minutes >= 480) return 4;
    if (minutes >= 300) return 3;
    if (minutes >= 120) return 2;
    return 1;
  }

  function jalaliMonthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isValidJalaliDate(jy, 12, 30) ? 30 : 29;
  }

  function buildJalaliMonthDays(jy, jm) {
    const days = [];
    const length = jalaliMonthLength(jy, jm);

    for (let jd = 1; jd <= length; jd += 1) {
      const g = toGregorian(jy, jm, jd);
      const date = new Date(g.gy, g.gm - 1, g.gd);
      days.push({
        jy,
        jm,
        jd,
        date,
        key: localDateKey(date)
      });
    }

    return days;
  }

  function monthStartOffset(date) {
    // CSS grid is RTL, visually Saturday -> Friday.
    // JS: Sunday=0 ... Saturday=6. Saturday should be first cell (0).
    return (date.getDay() + 1) % 7;
  }

  function renderActivityGrid() {
    const logs = getSharedLogs();
    const now = new Date();
    const current = jalaliDateFromGregorian(now);

    if (!selectedJalaliYear) selectedJalaliYear = current.jy;
    if (!selectedJalaliMonth) selectedJalaliMonth = current.jm;

    selectedJalaliYear = Math.max(1400, Math.min(1410, selectedJalaliYear));
    els.jalaliMonthSelect.value = String(selectedJalaliMonth);
    els.jalaliYearSelect.value = String(selectedJalaliYear);

    const days = buildJalaliMonthDays(selectedJalaliYear, selectedJalaliMonth);
    const cells = Array(monthStartOffset(days[0].date)).fill(null).concat(days);
    while (cells.length % 7 !== 0) cells.push(null);

    els.activityGrid.innerHTML = cells.map((day) => {
      if (!day) return `<span class="month-day month-day-empty"></span>`;
      const log = logs[day.key];
      const mood = moodMeta(log?.mood);
      const duration = log ? formatDuration(log.minutes || minutesBetween(log.start, log.end)) : "—";
      const tooltipData = {
        date: `${persianWeekday(day.date)} ${persianDigits(day.jd)} ${jalaliMonthName(day.jm)} ${persianDigits(day.jy)}`,
        mood: log?.mood ? `${mood.emoji} ${mood.label}` : "—",
        start: log?.start || "—",
        end: log?.end || "—",
        duration
      };
      return `<button type="button"
        class="month-day ${day.key === localDateKey(now) ? "today" : ""} ${selectedCalendarDay?.key === day.key ? "selected" : ""}"
        data-level="${activityLevel(log)}" data-calendar-day="1"
        data-key="${escapeHtml(day.key)}" data-jy="${day.jy}" data-jm="${day.jm}" data-jd="${day.jd}"
        data-date="${escapeHtml(day.date.toISOString())}" data-tooltip='${escapeHtml(JSON.stringify(tooltipData))}'>
        <span class="month-day-number">${persianDigits(day.jd)}</span>${log ? '<span class="month-day-dot"></span>' : ''}
      </button>`;
    }).join("");

    els.loggedDaysCount.textContent = days.filter((day) => logs[day.key]).length;
    els.prevMonthButton.disabled = selectedJalaliYear === 1400 && selectedJalaliMonth === 1;
    els.nextMonthButton.disabled = selectedJalaliYear === 1410 && selectedJalaliMonth === 12;
  }

  function changeSelectedMonth(delta) {
    let y = selectedJalaliYear;
    let m = selectedJalaliMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (y < 1400 || y > 1410) return;
    selectedJalaliYear = y;
    selectedJalaliMonth = m;
    selectedCalendarDay = null;
    els.dayEditorContent.classList.add("hidden");
    els.dayEditor.querySelector(".day-editor-empty")?.classList.remove("hidden");
    renderActivityGrid();
  }

  function showCalendarTooltip(target, event = null) {
    if (!target?.dataset.tooltip) return;

    let data;
    try {
      data = JSON.parse(target.dataset.tooltip);
    } catch {
      return;
    }

    els.calendarTooltip.innerHTML = `
      <div class="tooltip-date" dir="rtl">${escapeHtml(data.date)}</div>
      <div class="tooltip-row"><span>Mood</span><strong>${escapeHtml(data.mood)}</strong></div>
      <div class="tooltip-row"><span>Worked</span><strong>${escapeHtml(data.start)} → ${escapeHtml(data.end)}</strong></div>
      <div class="tooltip-row"><span>Duration</span><strong>${escapeHtml(data.duration)}</strong></div>
    `;

    els.calendarTooltip.classList.remove("hidden");

    const rect = target.getBoundingClientRect();
    const tooltipRect = els.calendarTooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 10;

    left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

    if (top < 10) {
      top = rect.bottom + 10;
    }

    els.calendarTooltip.style.left = `${left}px`;
    els.calendarTooltip.style.top = `${top}px`;
  }

  function hideCalendarTooltip() {
    els.calendarTooltip.classList.add("hidden");
  }

  function askConfirm(title, message, callback) {
    confirmCallback = callback;
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    openModal(els.confirmModal);
  }

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.classList.add("hidden");
    try { await login(els.username.value, els.password.value); }
    catch (error) { els.loginError.textContent=error.message||"Invalid username or password.";els.loginError.classList.remove("hidden");els.password.select(); }
  });

  els.logoutButton.addEventListener("click", logout);
  els.newTaskButton.addEventListener("click", () => openTaskForm());
  els.taskForm.addEventListener("submit", submitTaskForm);
  els.noteForm.addEventListener("submit", submitNoteForm);
  els.taskColorPresets.addEventListener("click", (event) => { const p=event.target.closest("[data-color]"); if(p) els.taskColor.value=p.dataset.color; });
  els.jalaliMonthSelect.addEventListener("change", (event) => {
    selectedJalaliMonth = Number(event.target.value);
    selectedCalendarDay = null;
    els.dayEditorContent.classList.add("hidden");
    els.dayEditor.querySelector(".day-editor-empty")?.classList.remove("hidden");
    renderActivityGrid();
  });

  els.jalaliYearSelect.addEventListener("change", (event) => {
    selectedJalaliYear = Number(event.target.value);
    selectedCalendarDay = null;
    els.dayEditorContent.classList.add("hidden");
    els.dayEditor.querySelector(".day-editor-empty")?.classList.remove("hidden");
    renderActivityGrid();
  });

  els.prevMonthButton.addEventListener("click", () => changeSelectedMonth(-1));
  els.nextMonthButton.addEventListener("click", () => changeSelectedMonth(1));

  els.selectedMoodPicker.addEventListener("click", (event) => {
    if (currentUser?.role !== "admin") return;
    const option = event.target.closest("[data-selected-mood]");
    if (!option) return;
    els.selectedMoodPicker.querySelectorAll("[data-selected-mood]").forEach((button) => {
      button.classList.toggle("active", button === option);
    });
  });

  const updateSelectedDurationPreview = () => {
    els.selectedDuration.textContent = formatDuration(minutesBetween(els.selectedWorkStart.value, els.selectedWorkEnd.value));
  };
  els.selectedWorkStart.addEventListener("input", updateSelectedDurationPreview);
  els.selectedWorkEnd.addEventListener("input", updateSelectedDurationPreview);
  els.saveSelectedDay.addEventListener("click", saveSelectedDayLog);

  els.activityGrid.addEventListener("mouseover", (event) => {
    const day = event.target.closest("[data-calendar-day]");
    if (day) showCalendarTooltip(day);
  });

  els.activityGrid.addEventListener("mouseout", (event) => {
    const day = event.target.closest("[data-calendar-day]");
    if (day && (!event.relatedTarget || !day.contains(event.relatedTarget))) hideCalendarTooltip();
  });

  els.activityGrid.addEventListener("click", (event) => {
    const el = event.target.closest("[data-calendar-day]");
    if (!el) return;
    selectedCalendarDay = {
      key: el.dataset.key,
      jy: Number(el.dataset.jy),
      jm: Number(el.dataset.jm),
      jd: Number(el.dataset.jd),
      date: new Date(el.dataset.date)
    };
    renderSelectedDayEditor(selectedCalendarDay);
    renderActivityGrid();
  });

  window.addEventListener("scroll", hideCalendarTooltip, { passive: true });
  window.addEventListener("resize", hideCalendarTooltip);

  els.taskSearch.addEventListener("input", (event) => {
    taskSearchQuery = event.target.value.trim().toLowerCase();
    render();
  });

  els.taskFilter.addEventListener("change", (event) => {
    taskFilterMode = event.target.value;
    render();
  });

  els.taskSort.addEventListener("change", (event) => {
    taskSortMode = event.target.value;
    render();
  });

  document.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest("[data-close-modal]");
    if (closeTrigger) {
      const modal = document.getElementById(closeTrigger.dataset.closeModal);
      if (modal) closeModal(modal);
      return;
    }

    const taskAction = event.target.closest("[data-action]");
    if (taskAction) {
      const { action, id } = taskAction.dataset;
      if (action === "details") {
        renderTaskDetails(id);
        openModal(els.detailModal);
      }
      if (action === "edit" && currentUser.role !== "viewer") openTaskForm(id);
      if (action === "delete" && currentUser.role !== "viewer") requestDelete(id);
      return;
    }

    const requestAction = event.target.closest("[data-request-action]");
    if (requestAction && currentUser.role === "admin") {
      const { requestAction: action, id } = requestAction.dataset;
      if (action === "approve") approveRequest(id);
      if (action === "reject") rejectRequest(id);
      return;
    }

    const noteAction = event.target.closest("[data-note-action]");
    if (noteAction && currentUser.role !== "viewer") {
      const action = noteAction.dataset.noteAction;
      const taskId = noteAction.dataset.taskId;
      const noteId = noteAction.dataset.noteId;

      if (action === "add") openNoteForm(taskId);
      if (action === "edit") openNoteForm(taskId, noteId);
      if (action === "delete") deleteNote(taskId, noteId);
    }
  });

  els.confirmActionButton.addEventListener("click", async () => {
    const callback=confirmCallback;confirmCallback=null;closeModal(els.confirmModal);
    if(typeof callback==="function"){try{await callback()}catch(error){toast(error.message||"Could not save the change.")}}
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      currentUser &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    ) {
      event.preventDefault();
      els.taskSearch.focus();
      return;
    }

    if (event.key !== "Escape") return;

    [els.confirmModal, els.noteModal, els.detailModal, els.taskModal].forEach((modal) => {
      if (!modal.classList.contains("hidden")) closeModal(modal);
    });
  });

  async function restoreSession(){
    if(!getToken()){els.loginView.classList.remove("hidden");els.appView.classList.add("hidden");return}
    try{const r=await api("/me");currentUser=r.user;await loadServerState();els.loginView.classList.add("hidden");els.appView.classList.remove("hidden");configureRoleUI();render();renderTodayPanel()}
    catch{setToken("");els.loginView.classList.remove("hidden");els.appView.classList.add("hidden")}
  }
  restoreSession();
})();
