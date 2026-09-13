// app.js - glavna logika aplikacije

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthNamesHr = ["Siječanj","Veljača","Ožujak","Travanj","Svibanj","Lipanj","Srpanj","Kolovoz","Rujan","Listopad","Studeni","Prosinac"];
const dowHr = ["Pon","Uto","Sri","Čet","Pet","Sub","Ned"];

let state = {
  currentMonth: new Date(),
  selectedGymForMachines: null,
  allWorkoutsCache: [],
  allMachinesCache: [],
  exerciseCounter: 0,
  editingWorkoutId: null
};

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", init);

async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  document.querySelectorAll("nav.bottom-nav button").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("workoutDate").value = todayStr();
  document.getElementById("bwDate").value = todayStr();

  document.getElementById("prevMonth").addEventListener("click", () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById("addExerciseBtn").addEventListener("click", () => addExerciseBlock());
  document.getElementById("saveWorkoutBtn").addEventListener("click", saveWorkout);
  document.getElementById("saveBwBtn").addEventListener("click", saveBodyweight);
  document.getElementById("addMachineBtn").addEventListener("click", () => document.getElementById("machinePhotoInput").click());
  document.getElementById("machinePhotoInput").addEventListener("change", onMachinePhotoChosen);
  document.getElementById("exerciseProgressSelect").addEventListener("change", renderExerciseChart);
  document.getElementById("cancelEditBtn").addEventListener("click", cancelWorkoutEdit);
  document.getElementById("exportDataBtn").addEventListener("click", exportData);
  document.getElementById("importDataBtn").addEventListener("click", () => document.getElementById("importDataInput").click());
  document.getElementById("importDataInput").addEventListener("change", importData);
  document.getElementById("resetAllBtn").addEventListener("click", resetAllData);
  document.getElementById("saveCardioBtn").addEventListener("click", saveCardio);
  document.getElementById("cardioDate").value = todayStr();
  document.getElementById("loadTemplateBtn").addEventListener("click", loadSelectedTemplate);
  document.getElementById("deleteTemplateBtn").addEventListener("click", deleteSelectedTemplate);
  document.getElementById("saveTemplateBtn").addEventListener("click", saveCurrentAsTemplate);
  document.querySelectorAll("[data-rest]").forEach((btn) => {
    btn.addEventListener("click", () => startRestTimer(Number(btn.dataset.rest)));
  });
  document.getElementById("stopRestBtn").addEventListener("click", stopRestTimer);

  await populateGymSelect();
  await populateTemplateSelect();
  addExerciseBlock(); // start with one empty exercise block

  await refreshTopBar();
  await renderCalendar();
  await renderTodayWorkouts();
  await renderVaganje();
  await renderSprave();
  await renderNapredak();
  await renderCardio();
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === viewId));
  document.querySelectorAll("nav.bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
  if (viewId === "view-vaganje") renderVaganje();
  if (viewId === "view-sprave") renderSprave();
  if (viewId === "view-napredak") renderNapredak();
  if (viewId === "view-cardio") renderCardio();
  if (viewId === "view-kalendar") { renderCalendar(); renderTodayWorkouts(); }
}

function showToast(msg, ms = 2600) {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------------- GAMIFICATION ----------------
async function getStats() {
  const workouts = await DB.getAllWorkouts();
  const bw = await DB.getAllBodyweight();
  const machines = await DB.getAllMachines();
  const cardio = await DB.getAllCardio();
  const prCount = await DB.getMeta("prCount", 0);
  const dates = workouts.map((w) => w.date);
  return {
    totalWorkouts: workouts.length,
    streak: GAMI.computeStreak(dates),
    bodyweightEntries: bw.length,
    machinePhotos: machines.filter((m) => !!m.photo).length,
    prCount,
    cardioSessions: cardio.length
  };
}

async function addXp(amount) {
  if (!amount) return;
  const xp = await DB.getMeta("xp", 0);
  await DB.setMeta("xp", xp + amount);
  await checkAndAwardBadges();
  await refreshTopBar();
}

async function checkAndAwardBadges() {
  const stats = await getStats();
  const unlocked = await DB.getMeta("unlockedBadges", []);
  const newly = GAMI.checkNewBadges(stats, unlocked);
  if (newly.length) {
    const updated = [...unlocked, ...newly];
    await DB.setMeta("unlockedBadges", updated);
    for (const id of newly) {
      const b = GAMI.BADGES.find((x) => x.id === id);
      if (b) showToast(`Novi bedž ${b.emoji} ${b.name}!`);
    }
  }
}

async function refreshTopBar() {
  const xp = await DB.getMeta("xp", 0);
  const progress = GAMI.levelProgress(xp);
  document.getElementById("levelBadge").textContent = `Lv ${progress.level}`;
  document.getElementById("xpBarFill").style.width = progress.pct + "%";
  document.getElementById("xpLabel").textContent = `${xp} / ${progress.nextCeil} XP`;

  const stats = await getStats();
  document.getElementById("streakLabel").textContent = `🔥 ${stats.streak} dana`;
}

// ---------------- KALENDAR ----------------
async function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const d = state.currentMonth;
  monthLabel.textContent = `${monthNamesHr[d.getMonth()]} ${d.getFullYear()}`;

  const workouts = await DB.getAllWorkouts();
  state.allWorkoutsCache = workouts;
  const workoutDates = new Set(workouts.map((w) => w.date));

  grid.innerHTML = "";
  dowHr.forEach((dn) => {
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = dn;
    grid.appendChild(el);
  });

  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  let startOffset = firstOfMonth.getDay() - 1; // Monday = 0
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement("div");
    el.className = "calendar-day empty";
    grid.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(d.getFullYear(), d.getMonth(), day);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const el = document.createElement("div");
    el.className = "calendar-day";
    if (workoutDates.has(dateStr)) el.classList.add("has-workout");
    if (dateStr === todayStr()) el.classList.add("today");
    el.textContent = day;
    el.addEventListener("click", () => openDayModal(dateStr));
    grid.appendChild(el);
  }
}

async function openDayModal(dateStr) {
  const workouts = await DB.getWorkoutsByDate(dateStr);
  let itemsHtml = workouts.map((w) => `
    <div class="list-item">
      <div>
        <div>${escapeHtml(w.gym)}</div>
        <div class="meta">${w.exercises.map((e) => escapeHtml(e.name)).join(", ")}</div>
      </div>
      <div class="row" style="flex:none;gap:6px;">
        <button class="ghost" data-edit="${w.id}">Uredi</button>
        <button class="danger" data-del="${w.id}">Obriši</button>
      </div>
    </div>
  `).join("") || `<div class="empty-state">Nema treninga ovog dana.</div>`;

  openModal(`
    <h3>${formatDateHr(dateStr)}</h3>
    <div id="dayWorkoutsList">${itemsHtml}</div>
    <button class="block primary" id="addForDayBtn" style="margin-top:12px;">+ Dodaj trening za ovaj dan</button>
  `);

  document.getElementById("addForDayBtn").addEventListener("click", () => {
    closeModal();
    document.getElementById("workoutDate").value = dateStr;
    switchView("view-trening");
  });

  document.querySelectorAll("#dayWorkoutsList [data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const workout = workouts.find((w) => w.id === Number(btn.dataset.edit));
      closeModal();
      switchView("view-trening");
      await loadWorkoutIntoForm(workout);
    });
  });

  document.querySelectorAll("#dayWorkoutsList [data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!(await showConfirm("Obrisati ovaj trening?"))) return;
      await DB.deleteWorkout(Number(btn.dataset.del));
      closeModal();
      await renderCalendar();
      await renderTodayWorkouts();
      await refreshTopBar();
    });
  });
}

async function renderTodayWorkouts() {
  const card = document.getElementById("recentWorkoutsCard");
  const workouts = await DB.getAllWorkouts();
  if (!workouts.length) {
    card.innerHTML = `<div class="empty-state">Još nema treninga. Dodaj prvi u tabu "Trening"!</div>`;
    return;
  }
  card.innerHTML = workouts.slice(0, 8).map((w) => `
    <div class="list-item">
      <div>
        <div>${formatDateHr(w.date)} · ${escapeHtml(w.gym)}</div>
        <div class="meta">${w.exercises.map((e) => escapeHtml(e.name)).join(", ")}</div>
      </div>
    </div>
  `).join("");

  const todayCard = document.getElementById("todayWorkoutsCard");
  const todays = workouts.filter((w) => w.date === document.getElementById("workoutDate").value);
  if (!todays.length) {
    todayCard.innerHTML = `<div class="empty-state">Nema unesenih treninga za ovaj dan.</div>`;
  } else {
    todayCard.innerHTML = todays.map((w) => `
      <div class="list-item">
        <div>
          <div>${escapeHtml(w.gym)}</div>
          <div class="meta">${w.exercises.map((e) => escapeHtml(e.name) + " (" + e.sets.length + " serija)").join(", ")}</div>
        </div>
        <div class="row" style="flex:none;gap:6px;">
          <button class="ghost" data-edit="${w.id}">Uredi</button>
          <button class="danger" data-del="${w.id}">Obriši</button>
        </div>
      </div>
    `).join("");
    todayCard.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const workout = todays.find((w) => w.id === Number(btn.dataset.edit));
        loadWorkoutIntoForm(workout);
      });
    });
    todayCard.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await showConfirm("Obrisati ovaj trening?"))) return;
        await DB.deleteWorkout(Number(btn.dataset.del));
        if (state.editingWorkoutId === Number(btn.dataset.del)) cancelWorkoutEdit();
        await renderTodayWorkouts();
        await renderCalendar();
        await refreshTopBar();
      });
    });
  }
}

// ---------------- TRENING FORM ----------------
async function populateGymSelect() {
  const gyms = await DB.getGyms();
  const select = document.getElementById("gymSelect");
  select.innerHTML = gyms.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  select.addEventListener("change", async () => {
    if (select.value === "Ostalo") {
      const name = await showPrompt("Naziv teretane:");
      if (name && name.trim()) {
        await DB.addCustomGym(name.trim());
        await populateGymSelect();
        select.value = name.trim();
      } else {
        select.value = gyms[0];
      }
    }
    refreshMachineSelectsInForm();
    renderSprave();
  });
}

async function addExerciseBlock(prefill) {
  const id = state.exerciseCounter++;
  const container = document.getElementById("exerciseList");
  const block = document.createElement("div");
  block.className = "exercise-block";
  block.dataset.blockId = id;

  const exerciseNames = await DB.getAllExerciseNames();
  const datalistId = `exNames`;
  if (!document.getElementById(datalistId)) {
    const dl = document.createElement("datalist");
    dl.id = datalistId;
    dl.innerHTML = exerciseNames.map((n) => `<option value="${escapeHtml(n)}">`).join("");
    document.body.appendChild(dl);
  }

  block.innerHTML = `
    <div class="row">
      <input type="text" placeholder="Naziv vježbe (npr. Bench press)" list="${datalistId}" class="ex-name" value="${prefill ? escapeHtml(prefill.name) : ""}" />
      <button class="remove-btn" data-remove-ex>✕</button>
    </div>
    <label>Sprava (opcionalno)</label>
    <select class="ex-machine"><option value="">— nije odabrano —</option></select>
    <div class="sets-container"></div>
    <button class="ghost" data-add-set style="width:100%;">+ Serija</button>
  `;
  container.appendChild(block);

  block.querySelector("[data-remove-ex]").addEventListener("click", () => block.remove());
  block.querySelector("[data-add-set]").addEventListener("click", () => addSetRow(block));

  if (prefill && prefill.sets && prefill.sets.length) {
    prefill.sets.forEach((s) => addSetRow(block, s));
  } else {
    addSetRow(block);
  }
  await refreshMachineSelectForBlock(block);
  if (prefill && prefill.machineId) block.querySelector(".ex-machine").value = String(prefill.machineId);
}

function addSetRow(block, prefillSet) {
  const setsContainer = block.querySelector(".sets-container");
  const idx = setsContainer.children.length + 1;
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = `
    <span class="set-num">${idx}.</span>
    <input type="number" step="0.5" placeholder="kg" class="set-weight" value="${prefillSet ? prefillSet.weight : ""}" />
    <input type="number" placeholder="ponav." class="set-reps" value="${prefillSet ? prefillSet.reps : ""}" />
    <button class="remove-btn" data-remove-set>✕</button>
  `;
  row.querySelector("[data-remove-set]").addEventListener("click", () => {
    row.remove();
    Array.from(setsContainer.children).forEach((r, i) => (r.querySelector(".set-num").textContent = `${i + 1}.`));
  });
  setsContainer.appendChild(row);
}

async function refreshMachineSelectForBlock(block) {
  const gym = document.getElementById("gymSelect").value;
  const machines = await DB.getMachinesByGym(gym);
  const select = block.querySelector(".ex-machine");
  const current = select.value;
  select.innerHTML = `<option value="">— nije odabrano —</option>` + machines.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
  select.value = current || "";
}

function refreshMachineSelectsInForm() {
  document.querySelectorAll("#exerciseList .exercise-block").forEach((block) => refreshMachineSelectForBlock(block));
}

async function saveWorkout() {
  const date = document.getElementById("workoutDate").value || todayStr();
  const gym = document.getElementById("gymSelect").value;
  const blocks = Array.from(document.querySelectorAll("#exerciseList .exercise-block"));

  const exercises = [];
  for (const block of blocks) {
    const name = block.querySelector(".ex-name").value.trim();
    if (!name) continue;
    const machineId = block.querySelector(".ex-machine").value || null;
    const sets = Array.from(block.querySelectorAll(".set-row")).map((row) => ({
      weight: parseFloat(row.querySelector(".set-weight").value) || 0,
      reps: parseInt(row.querySelector(".set-reps").value) || 0
    })).filter((s) => s.weight > 0 || s.reps > 0);
    if (!sets.length) continue;
    exercises.push({ name, machineId: machineId ? Number(machineId) : null, sets });
  }

  if (!exercises.length) {
    showToast("Unesi barem jednu vježbu sa serijom.");
    return;
  }

  // spremi nazive vježbi za autocomplete
  for (const ex of exercises) await DB.addExerciseName(ex.name);

  if (state.editingWorkoutId) {
    // uređivanje postojećeg treninga - bez ponovnog dodjeljivanja XP-a (izbjegava farmanje)
    const workout = { id: state.editingWorkoutId, date, gym, exercises };
    await DB.updateWorkout(workout);
    showToast("Trening ažuriran.");
    cancelWorkoutEdit();
    await renderCalendar();
    await renderTodayWorkouts();
    await renderNapredak();
    return;
  }

  const workout = { date, gym, exercises };
  await DB.addWorkout(workout);

  // provjera PR-a
  const maxes = await DB.getMeta("exerciseMaxWeights", {});
  let prBonus = 0;
  let prHit = false;
  for (const ex of exercises) {
    const maxWeightThisWorkout = Math.max(...ex.sets.map((s) => s.weight));
    const prevMax = maxes[ex.name] || 0;
    if (prevMax > 0 && maxWeightThisWorkout > prevMax) {
      prHit = true;
      prBonus += GAMI.xpForPR();
    }
    if (maxWeightThisWorkout > prevMax) maxes[ex.name] = maxWeightThisWorkout;
  }
  await DB.setMeta("exerciseMaxWeights", maxes);
  if (prHit) {
    const prCount = await DB.getMeta("prCount", 0);
    await DB.setMeta("prCount", prCount + 1);
    showToast("🚀 Novi osobni rekord!");
  }

  const xpGained = GAMI.xpForWorkout(workout) + prBonus;
  await addXp(xpGained);
  showToast(`Trening spremljen! +${xpGained} XP`);

  // reset forme
  document.getElementById("exerciseList").innerHTML = "";
  await addExerciseBlock();

  await renderCalendar();
  await renderTodayWorkouts();
  await renderNapredak();
}

async function loadWorkoutIntoForm(workout) {
  state.editingWorkoutId = workout.id;
  document.getElementById("workoutDate").value = workout.date;
  document.getElementById("gymSelect").value = workout.gym;
  document.getElementById("exerciseList").innerHTML = "";
  for (const ex of workout.exercises) await addExerciseBlock(ex);
  refreshMachineSelectsInForm();

  document.getElementById("saveWorkoutBtn").textContent = "💾 Spremi izmjene";
  document.getElementById("cancelEditBtn").style.display = "block";
  showToast("Uređuješ trening — spremi izmjene ili otkaži.");
}

function cancelWorkoutEdit() {
  state.editingWorkoutId = null;
  document.getElementById("saveWorkoutBtn").textContent = "💾 Spremi trening";
  document.getElementById("cancelEditBtn").style.display = "none";
  document.getElementById("workoutDate").value = todayStr();
  document.getElementById("exerciseList").innerHTML = "";
  addExerciseBlock();
}

// ---------------- VAGANJE ----------------
let weightChartInstance = null;

async function saveBodyweight() {
  const date = document.getElementById("bwDate").value || todayStr();
  const weight = parseFloat(document.getElementById("bwWeight").value);
  if (!weight || weight <= 0) {
    showToast("Unesi ispravnu kilažu.");
    return;
  }
  const existing = await DB.getAllBodyweight();
  const isNew = !existing.find((e) => e.date === date);
  await DB.setBodyweight({ date, weight });
  if (isNew) await addXp(GAMI.xpForBodyweightLog());
  showToast("Kilaža spremljena.");
  document.getElementById("bwWeight").value = "";
  await renderVaganje();
}

async function renderVaganje() {
  const all = await DB.getAllBodyweight();
  const historyCard = document.getElementById("bwHistoryCard");
  if (!all.length) {
    historyCard.innerHTML = `<div class="empty-state">Nema unosa još.</div>`;
  } else {
    historyCard.innerHTML = all.slice().reverse().slice(0, 20).map((e) => `
      <div class="list-item">
        <div>
          <div>${formatDateHr(e.date)}</div>
          <div class="meta">${e.weight} kg</div>
        </div>
        <div class="row" style="flex:none;gap:6px;">
          <button class="ghost" data-edit-bw="${e.date}" data-weight="${e.weight}">Uredi</button>
          <button class="danger" data-del-bw="${e.date}">Obriši</button>
        </div>
      </div>
    `).join("");

    historyCard.querySelectorAll("[data-edit-bw]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("bwDate").value = btn.dataset.editBw;
        document.getElementById("bwWeight").value = btn.dataset.weight;
        document.getElementById("bwWeight").focus();
      });
    });
    historyCard.querySelectorAll("[data-del-bw]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await showConfirm("Obrisati ovaj unos kilaže?"))) return;
        await DB.deleteBodyweight(btn.dataset.delBw);
        await renderVaganje();
      });
    });
  }

  const ctx = document.getElementById("weightChart");
  if (!chartLibAvailable(ctx)) return;
  const labels = all.map((e) => formatDateShort(e.date));
  const data = all.map((e) => e.weight);

  if (weightChartInstance) weightChartInstance.destroy();
  weightChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Kilaža (kg)",
        data,
        borderColor: "#39d98a",
        backgroundColor: "rgba(57,217,138,0.15)",
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa3b2", maxTicksLimit: 6 }, grid: { color: "#2a2f3d" } },
        y: { ticks: { color: "#9aa3b2" }, grid: { color: "#2a2f3d" } }
      }
    }
  });
}

// ---------------- SPRAVE ----------------
function resizeImageFile(file, maxW = 640, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onMachinePhotoChosen(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const dataUrl = await resizeImageFile(file);
  const gyms = await DB.getGyms();
  const currentGym = state.selectedGymForMachines || gyms[0];

  openModal(`
    <h3>Nova sprava</h3>
    <img src="${dataUrl}" style="width:100%;border-radius:10px;margin-bottom:10px;" />
    <label>Teretana</label>
    <select id="newMachineGym">${gyms.map((g) => `<option value="${escapeHtml(g)}" ${g === currentGym ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}</select>
    <label>Naziv sprave</label>
    <input type="text" id="newMachineName" placeholder="npr. Leg press" />
    <label>Bilješke (podešavanje, kut, opterećenje...)</label>
    <textarea id="newMachineNotes" rows="3" placeholder="npr. sjedalo na 4, naslon na 2"></textarea>
    <button class="block primary" id="saveMachineBtn">Spremi spravu</button>
  `);

  document.getElementById("saveMachineBtn").addEventListener("click", async () => {
    const gym = document.getElementById("newMachineGym").value;
    const name = document.getElementById("newMachineName").value.trim();
    const notes = document.getElementById("newMachineNotes").value.trim();
    if (!name) { showToast("Unesi naziv sprave."); return; }
    await DB.addMachine({ gym, name, photo: dataUrl, notes });
    await addXp(GAMI.xpForMachinePhoto());
    closeModal();
    showToast("Sprava spremljena!");
    state.selectedGymForMachines = gym;
    await renderSprave();
  });
}

async function renderSprave() {
  const gyms = await DB.getGyms();
  if (!state.selectedGymForMachines) state.selectedGymForMachines = document.getElementById("gymSelect").value || gyms[0];

  const chipsRow = document.getElementById("gymChips");
  chipsRow.innerHTML = gyms.map((g) => `<span class="chip ${g === state.selectedGymForMachines ? "active" : ""}" data-gym="${escapeHtml(g)}">${escapeHtml(g)}</span>`).join("");
  chipsRow.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.selectedGymForMachines = chip.dataset.gym;
      renderSprave();
    });
  });

  const machines = await DB.getMachinesByGym(state.selectedGymForMachines);
  state.allMachinesCache = machines;
  const grid = document.getElementById("machineGrid");
  if (!machines.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Još nema sprava za ovu teretanu. Klikni "Dodaj spravu" i fotkaj je.</div>`;
    return;
  }
  grid.innerHTML = machines.map((m) => `
    <div class="machine-card" data-id="${m.id}">
      <img src="${m.photo}" />
      <div class="info">
        <div class="name">${escapeHtml(m.name)}</div>
        ${m.notes ? `<div class="notes">${escapeHtml(m.notes)}</div>` : ""}
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".machine-card").forEach((card) => {
    card.addEventListener("click", () => openMachineDetail(Number(card.dataset.id)));
  });
}

async function openMachineDetail(id) {
  const machine = state.allMachinesCache.find((m) => m.id === id);
  if (!machine) return;
  openModal(`
    <h3>Uredi spravu</h3>
    <img src="${machine.photo}" style="width:100%;border-radius:10px;margin-bottom:10px;" />
    <label>Naziv sprave</label>
    <input type="text" id="editMachineName" value="${escapeHtml(machine.name)}" />
    <label>Bilješke</label>
    <textarea id="editMachineNotes" rows="3">${escapeHtml(machine.notes || "")}</textarea>
    <button class="block primary" id="saveMachineEditBtn" style="margin-bottom:8px;">Spremi izmjene</button>
    <button class="block danger" id="deleteMachineBtn">Obriši spravu</button>
  `);
  document.getElementById("saveMachineEditBtn").addEventListener("click", async () => {
    const name = document.getElementById("editMachineName").value.trim();
    const notes = document.getElementById("editMachineNotes").value.trim();
    if (!name) { showToast("Naziv ne smije biti prazan."); return; }
    await DB.updateMachine({ ...machine, name, notes });
    closeModal();
    showToast("Sprava ažurirana.");
    await renderSprave();
  });
  document.getElementById("deleteMachineBtn").addEventListener("click", async () => {
    if (!(await showConfirm("Obrisati ovu spravu?"))) return;
    await DB.deleteMachine(id);
    closeModal();
    await renderSprave();
  });
}

// ---------------- NAPREDAK ----------------
let exerciseChartInstance = null;

async function renderNapredak() {
  const xp = await DB.getMeta("xp", 0);
  const progress = GAMI.levelProgress(xp);
  document.getElementById("xpBarFill2").style.width = progress.pct + "%";
  document.getElementById("xpLabel2").textContent = `${xp} / ${progress.nextCeil} XP`;
  document.getElementById("levelLabel2").textContent = `Level ${progress.level}`;

  const stats = await getStats();
  document.getElementById("streakBig").textContent = `${stats.streak} dana zaredom`;
  document.getElementById("totalWorkoutsLabel").textContent = stats.totalWorkouts;

  const unlocked = new Set(await DB.getMeta("unlockedBadges", []));
  const grid = document.getElementById("badgeGrid");
  grid.innerHTML = GAMI.BADGES.map((b) => `
    <div class="badge ${unlocked.has(b.id) ? "unlocked" : ""}">
      <span class="emoji">${b.emoji}</span>${b.name}
    </div>
  `).join("");

  const exerciseNames = await DB.getAllExerciseNames();
  const select = document.getElementById("exerciseProgressSelect");
  const prevVal = select.value;
  select.innerHTML = exerciseNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (exerciseNames.includes(prevVal)) select.value = prevVal;
  await renderExerciseChart();
}

async function renderExerciseChart() {
  const select = document.getElementById("exerciseProgressSelect");
  const name = select.value;
  const ctx = document.getElementById("exerciseChart");
  if (!chartLibAvailable(ctx)) return;
  if (exerciseChartInstance) exerciseChartInstance.destroy();
  if (!name) return;

  const workouts = (await DB.getAllWorkouts()).slice().sort((a, b) => (a.date > b.date ? 1 : -1));
  const points = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.name === name) {
        const maxW = Math.max(...ex.sets.map((s) => s.weight));
        points.push({ date: w.date, weight: maxW });
      }
    }
  }

  exerciseChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map((p) => formatDateShort(p.date)),
      datasets: [{
        label: name,
        data: points.map((p) => p.weight),
        borderColor: "#39d98a",
        backgroundColor: "rgba(57,217,138,0.15)",
        tension: 0.3,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa3b2", maxTicksLimit: 6 }, grid: { color: "#2a2f3d" } },
        y: { ticks: { color: "#9aa3b2" }, grid: { color: "#2a2f3d" } }
      }
    }
  });
}

// ---------------- BACKUP / RESET ----------------
async function exportData() {
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gym-tracker-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Backup preuzet.");
}

async function importData(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!(await showConfirm("Uvoz backupa BRIŠE sve trenutne podatke i zamjenjuje ih onima iz datoteke. Nastaviti?"))) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await DB.importAll(data);
    showToast("Backup uvezen.");
    await refreshTopBar();
    await renderCalendar();
    await renderTodayWorkouts();
    await renderVaganje();
    await renderSprave();
    await renderNapredak();
    await renderCardio();
    await populateTemplateSelect();
  } catch (err) {
    showToast("Greška: datoteka nije valjani backup.");
  }
}

async function resetAllData() {
  if (!(await showConfirm("Ovo BRIŠE potpuno sve podatke (treninge, kilažu, sprave, cardio, napredak). Ova radnja se ne može poništiti. Nastaviti?"))) return;
  await DB.resetAll();
  showToast("Svi podaci resetirani.");
  cancelWorkoutEdit();
  await refreshTopBar();
  await renderCalendar();
  await renderTodayWorkouts();
  await renderVaganje();
  await renderSprave();
  await renderNapredak();
  await renderCardio();
  await populateTemplateSelect();
}

// ---------------- CARDIO ----------------
async function saveCardio() {
  const date = document.getElementById("cardioDate").value || todayStr();
  const type = document.getElementById("cardioType").value.trim() || "Cardio";
  const duration = parseInt(document.getElementById("cardioDuration").value) || 0;
  const distance = parseFloat(document.getElementById("cardioDistance").value) || null;
  const notes = document.getElementById("cardioNotes").value.trim();

  if (!duration) {
    showToast("Unesi trajanje u minutama.");
    return;
  }

  await DB.addCardio({ date, type, duration, distance, notes });
  await addXp(GAMI.xpForCardio());
  showToast(`Cardio spremljen! +${GAMI.xpForCardio()} XP`);

  document.getElementById("cardioType").value = "";
  document.getElementById("cardioDuration").value = "";
  document.getElementById("cardioDistance").value = "";
  document.getElementById("cardioNotes").value = "";

  await renderCardio();
}

async function renderCardio() {
  const all = await DB.getAllCardio();
  const now = new Date();
  const thisMonth = all.filter((c) => {
    const d = new Date(c.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  document.getElementById("cardioMonthCount").textContent = `${thisMonth.length} cardio ovaj mjesec`;
  const totalMin = thisMonth.reduce((acc, c) => acc + (c.duration || 0), 0);
  document.getElementById("cardioMonthMinutes").textContent = `${totalMin} min ukupno`;

  const historyCard = document.getElementById("cardioHistoryCard");
  if (!all.length) {
    historyCard.innerHTML = `<div class="empty-state">Nema unesenih cardio sesija.</div>`;
    return;
  }
  historyCard.innerHTML = all.slice(0, 20).map((c) => `
    <div class="list-item">
      <div>
        <div>${formatDateHr(c.date)} · ${escapeHtml(c.type)}</div>
        <div class="meta">${c.duration} min${c.distance ? " · " + c.distance + " km" : ""}${c.notes ? " · " + escapeHtml(c.notes) : ""}</div>
      </div>
      <button class="danger" data-del-cardio="${c.id}">Obriši</button>
    </div>
  `).join("");

  historyCard.querySelectorAll("[data-del-cardio]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!(await showConfirm("Obrisati ovu cardio sesiju?"))) return;
      await DB.deleteCardio(Number(btn.dataset.delCardio));
      await renderCardio();
    });
  });
}

// ---------------- PREDLOŠCI (TEMPLATES) ----------------
async function populateTemplateSelect() {
  const templates = await DB.getAllTemplates();
  const select = document.getElementById("templateSelect");
  select.innerHTML = `<option value="">— nema predloška —</option>` + templates.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
}

async function saveCurrentAsTemplate() {
  const blocks = Array.from(document.querySelectorAll("#exerciseList .exercise-block"));
  const exercises = [];
  for (const block of blocks) {
    const name = block.querySelector(".ex-name").value.trim();
    if (!name) continue;
    const machineId = block.querySelector(".ex-machine").value || null;
    const sets = Array.from(block.querySelectorAll(".set-row")).map((row) => ({
      weight: parseFloat(row.querySelector(".set-weight").value) || 0,
      reps: parseInt(row.querySelector(".set-reps").value) || 0
    }));
    exercises.push({ name, machineId: machineId ? Number(machineId) : null, sets });
  }
  if (!exercises.length) {
    showToast("Dodaj barem jednu vježbu prije spremanja predloška.");
    return;
  }
  const name = await showPrompt("Naziv predloška (npr. Push day):");
  if (!name) return;
  await DB.addTemplate({ name, exercises });
  await populateTemplateSelect();
  showToast("Predložak spremljen.");
}

async function loadSelectedTemplate() {
  const select = document.getElementById("templateSelect");
  const id = Number(select.value);
  if (!id) { showToast("Odaberi predložak."); return; }
  const templates = await DB.getAllTemplates();
  const template = templates.find((t) => t.id === id);
  if (!template) return;

  document.getElementById("exerciseList").innerHTML = "";
  for (const ex of template.exercises) await addExerciseBlock(ex);
  refreshMachineSelectsInForm();
  showToast(`Predložak "${template.name}" učitan.`);
}

async function deleteSelectedTemplate() {
  const select = document.getElementById("templateSelect");
  const id = Number(select.value);
  if (!id) { showToast("Odaberi predložak za brisanje."); return; }
  if (!(await showConfirm("Obrisati ovaj predložak?"))) return;
  await DB.deleteTemplate(id);
  await populateTemplateSelect();
  showToast("Predložak obrisan.");
}

// ---------------- REST TIMER ----------------
let restInterval = null;

function startRestTimer(seconds) {
  clearInterval(restInterval);
  let remaining = seconds;
  const display = document.getElementById("restTimerDisplay");
  const stopBtn = document.getElementById("stopRestBtn");
  display.style.display = "block";
  stopBtn.style.display = "block";
  display.textContent = formatSeconds(remaining);

  restInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(restInterval);
      display.textContent = "Gotovo! 💪";
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      playBeep();
      setTimeout(() => {
        display.style.display = "none";
        stopBtn.style.display = "none";
      }, 2500);
      return;
    }
    display.textContent = formatSeconds(remaining);
  }, 1000);
}

function stopRestTimer() {
  clearInterval(restInterval);
  document.getElementById("restTimerDisplay").style.display = "none";
  document.getElementById("stopRestBtn").style.display = "none";
}

function formatSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // tiho zanemari ako Web Audio nije dostupan
  }
}

// ---------------- CUSTOM CONFIRM / PROMPT (native dialozi ne rade pouzdano u svim okruženjima, npr. sandboxani preview) ----------------
function showConfirm(message) {
  return new Promise((resolve) => {
    const root = document.getElementById("modalRoot");
    const finish = (val) => { root.innerHTML = ""; resolve(val); };
    root.innerHTML = `
      <div class="modal-backdrop" id="confirmBackdrop">
        <div class="modal-sheet">
          <h3>Potvrda</h3>
          <p style="color:var(--text-dim);font-size:14px;">${escapeHtml(message)}</p>
          <div class="row" style="margin-top:14px;">
            <button class="ghost" id="confirmNoBtn">Odustani</button>
            <button class="danger" id="confirmYesBtn">Potvrdi</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("confirmYesBtn").addEventListener("click", () => finish(true));
    document.getElementById("confirmNoBtn").addEventListener("click", () => finish(false));
    document.getElementById("confirmBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "confirmBackdrop") finish(false);
    });
  });
}

function showPrompt(message, defaultValue = "") {
  return new Promise((resolve) => {
    const root = document.getElementById("modalRoot");
    const finish = (val) => { root.innerHTML = ""; resolve(val); };
    root.innerHTML = `
      <div class="modal-backdrop" id="promptBackdrop">
        <div class="modal-sheet">
          <h3>${escapeHtml(message)}</h3>
          <input type="text" id="promptInput" value="${escapeHtml(defaultValue)}" />
          <div class="row" style="margin-top:6px;">
            <button class="ghost" id="promptCancelBtn">Odustani</button>
            <button class="primary" id="promptOkBtn">Spremi</button>
          </div>
        </div>
      </div>
    `;
    const input = document.getElementById("promptInput");
    setTimeout(() => input.focus(), 50);
    document.getElementById("promptOkBtn").addEventListener("click", () => finish(input.value.trim() || null));
    document.getElementById("promptCancelBtn").addEventListener("click", () => finish(null));
    document.getElementById("promptBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "promptBackdrop") finish(null);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(input.value.trim() || null);
    });
  });
}

// ---------------- MODAL ----------------
function openModal(innerHtml) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-sheet" id="modalSheet">
        <div class="modal-close-row"><button class="ghost" id="modalCloseBtn">Zatvori ✕</button></div>
        ${innerHtml}
      </div>
    </div>
  `;
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
}
function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

// ---------------- HELPERS ----------------
function chartLibAvailable(canvasEl) {
  const msgId = canvasEl.id + "-offline-msg";
  let msgEl = document.getElementById(msgId);
  if (typeof Chart === "undefined") {
    canvasEl.style.display = "none";
    if (!msgEl) {
      msgEl = document.createElement("div");
      msgEl.id = msgId;
      msgEl.className = "empty-state";
      msgEl.textContent = "Graf trenutno nije dostupan (treba internet barem jednom da se učita biblioteka za grafove).";
      canvasEl.after(msgEl);
    }
    return false;
  }
  canvasEl.style.display = "";
  if (msgEl) msgEl.remove();
  return true;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateHr(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}.`;
}
function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.`;
}
