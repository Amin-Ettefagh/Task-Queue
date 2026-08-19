(() => {
  "use strict";

  const USERS = {
    amin: { password: "123456", role: "admin", label: "Amin" },
    viewer: { password: "123456", role: "viewer", label: "Viewer" },
    task: { password: "123456", role: "task", label: "Task" }
  };

  const STORAGE_KEY = "amin_workspace_v1";

  const seedState = {
    tasks: [
      {
        id: "task_demo_1",
        title: "Build private task workspace",
        description: "Prepare the first production version of the internal task management page.",
        priority: 1,
        status: "progress",
        labels: ["workspace", "frontend"],
        startDate: "",
        endDate: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: []
      },
      {
        id: "task_demo_2",
        title: "Connect the dashboard to a backend API",
        description: "Replace local-only persistence with server-side auth and shared database storage.",
        priority: 2,
        status: "queue",
        labels: ["backend"],
        startDate: "",
        endDate: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: []
      }
    ],
    requests: []
  };

  let state = loadState();

  // Notes are direct actions now, not approval requests.
  state.requests = state.requests.filter(
    (request) => !["note_add", "note_edit", "note_delete"].includes(request.type)
  );
  saveState();

  let currentUser = null;
  let activeDetailTaskId = null;
  let confirmCallback = null;
  let taskSearchQuery = "";
  let taskFilterMode = "all";
  let taskSortMode = "priority";

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

    toast: $("#toast")
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneSafe(seedState);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.requests)) {
        return structuredCloneSafe(seedState);
      }
      return parsed;
    } catch {
      return structuredCloneSafe(seedState);
    }
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

    if (typeof jalaali === "undefined" || !jalaali.isValidJalaaliDate(jy, jm, jd)) {
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
          jalaali.toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd).gy,
          jalaali.toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd).gm - 1,
          jalaali.toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd).gd
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

  function login(username, password) {
    const key = username.trim().toLowerCase();
    const normalizedPassword = String(password).trim().toLowerCase();
    const user = USERS[key];

    if (!user || String(user.password).trim().toLowerCase() !== normalizedPassword) return false;

    currentUser = {
      username: key,
      role: user.role,
      label: user.label
    };

    els.loginForm.reset();
    els.loginError.classList.add("hidden");
    els.loginView.classList.add("hidden");
    els.appView.classList.remove("hidden");

    configureRoleUI();
    render();
    return true;
  }

  function logout() {
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
          "endDate"
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
        _changedFields: ["title", "description", "priority", "status", "labels", "startDate", "endDate"],
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
            const g = jalaali.toGregorian(jalaliValue.jy, jalaliValue.jm, jalaliValue.jd);
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

    if (currentUser.role === "admin") renderRequests();

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
      <article class="task-card status-${task.status} ${task._pending ? "task-card-pending" : ""} ${task._pendingDelete ? "task-card-delete-pending" : ""}">
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
      status: els.taskStatus.value
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

  function submitTaskForm(event) {
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

      saveState();
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
    saveState();
    closeModal(els.taskModal);
    toast(existing ? "Edit request sent to Amin." : "Create request sent to Amin.");
    render();
  }

  function requestDelete(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;

    if (currentUser.role === "admin") {
      askConfirm(
        "Delete task",
        `Delete “${task.title}”? This cannot be undone.`,
        () => {
          state.tasks = state.tasks.filter((item) => item.id !== taskId);
          state.requests = state.requests.filter((request) => request.taskId !== taskId);
          saveState();
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

      saveState();
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

  function approveRequest(requestId) {
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
    saveState();
    toast("Request approved and applied.");
    render();
  }

  function rejectRequest(requestId) {
    state.requests = state.requests.filter((item) => item.id !== requestId);
    saveState();
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

  function submitNoteForm(event) {
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

    saveState();
    closeModal(els.noteModal);
    renderTaskDetails(taskId);
    render();
  }

  function deleteNote(taskId, noteId) {
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
      () => {
        task.notes = task.notes.filter((item) => item.id !== noteId);
        task.updatedAt = new Date().toISOString();

        saveState();
        renderTaskDetails(taskId);
        render();
        toast("Note deleted.");
      }
    );
  }

  function askConfirm(title, message, callback) {
    confirmCallback = callback;
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    openModal(els.confirmModal);
  }

  els.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!login(els.username.value, els.password.value)) {
      els.loginError.textContent = "Invalid username or password.";
      els.loginError.classList.remove("hidden");
      els.password.select();
    }
  });

  els.logoutButton.addEventListener("click", logout);
  els.newTaskButton.addEventListener("click", () => openTaskForm());
  els.taskForm.addEventListener("submit", submitTaskForm);
  els.noteForm.addEventListener("submit", submitNoteForm);

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

  els.confirmActionButton.addEventListener("click", () => {
    const callback = confirmCallback;
    confirmCallback = null;
    closeModal(els.confirmModal);
    if (typeof callback === "function") callback();
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

  // Security/UX requirement: every fresh page load starts at login.
  // Authentication is intentionally not persisted in localStorage/sessionStorage.
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
})();
