// db.js - minimalni IndexedDB wrapper za Gym Tracker
const DB_NAME = "gymTrackerDB";
const DB_VERSION = 2;

const GYMS_DEFAULT = [
  "Five Star Fitness Varaždin",
  "Gibi Gym Varaždin",
  "Aquila Čakovec",
  "Ostalo"
];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains("workouts")) {
        const s = db.createObjectStore("workouts", { keyPath: "id", autoIncrement: true });
        s.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("bodyweight")) {
        db.createObjectStore("bodyweight", { keyPath: "date" }); // date = "YYYY-MM-DD"
      }
      if (!db.objectStoreNames.contains("machines")) {
        const s = db.createObjectStore("machines", { keyPath: "id", autoIncrement: true });
        s.createIndex("gym", "gym", { unique: false });
      }
      if (!db.objectStoreNames.contains("exerciseNames")) {
        db.createObjectStore("exerciseNames", { keyPath: "name" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("cardio")) {
        const s = db.createObjectStore("cardio", { keyPath: "id", autoIncrement: true });
        s.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("templates")) {
        db.createObjectStore("templates", { keyPath: "id", autoIncrement: true });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = "readonly") {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  // ---------- WORKOUTS ----------
  async addWorkout(workout) {
    const store = await tx("workouts", "readwrite");
    return promisifyRequest(store.add(workout));
  },
  async updateWorkout(workout) {
    const store = await tx("workouts", "readwrite");
    return promisifyRequest(store.put(workout));
  },
  async deleteWorkout(id) {
    const store = await tx("workouts", "readwrite");
    return promisifyRequest(store.delete(id));
  },
  async getAllWorkouts() {
    const store = await tx("workouts");
    const all = await promisifyRequest(store.getAll());
    return all.sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  async getWorkoutsByDate(dateStr) {
    const all = await DB.getAllWorkouts();
    return all.filter((w) => w.date === dateStr);
  },

  // ---------- BODYWEIGHT ----------
  async setBodyweight(entry) {
    const store = await tx("bodyweight", "readwrite");
    return promisifyRequest(store.put(entry)); // { date, weight }
  },
  async getAllBodyweight() {
    const store = await tx("bodyweight");
    const all = await promisifyRequest(store.getAll());
    return all.sort((a, b) => (a.date > b.date ? 1 : -1));
  },
  async deleteBodyweight(date) {
    const store = await tx("bodyweight", "readwrite");
    return promisifyRequest(store.delete(date));
  },

  // ---------- MACHINES ----------
  async addMachine(machine) {
    const store = await tx("machines", "readwrite");
    return promisifyRequest(store.add(machine)); // { gym, name, photo, notes }
  },
  async updateMachine(machine) {
    const store = await tx("machines", "readwrite");
    return promisifyRequest(store.put(machine));
  },
  async deleteMachine(id) {
    const store = await tx("machines", "readwrite");
    return promisifyRequest(store.delete(id));
  },
  async getAllMachines() {
    const store = await tx("machines");
    return promisifyRequest(store.getAll());
  },
  async getMachinesByGym(gym) {
    const all = await DB.getAllMachines();
    return all.filter((m) => m.gym === gym);
  },

  // ---------- CARDIO ----------
  async addCardio(entry) {
    const store = await tx("cardio", "readwrite");
    return promisifyRequest(store.add(entry)); // { date, type, duration, distance, notes }
  },
  async updateCardio(entry) {
    const store = await tx("cardio", "readwrite");
    return promisifyRequest(store.put(entry));
  },
  async deleteCardio(id) {
    const store = await tx("cardio", "readwrite");
    return promisifyRequest(store.delete(id));
  },
  async getAllCardio() {
    const store = await tx("cardio");
    const all = await promisifyRequest(store.getAll());
    return all.sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  // ---------- TEMPLATES ----------
  async addTemplate(template) {
    const store = await tx("templates", "readwrite");
    return promisifyRequest(store.add(template)); // { name, exercises }
  },
  async deleteTemplate(id) {
    const store = await tx("templates", "readwrite");
    return promisifyRequest(store.delete(id));
  },
  async getAllTemplates() {
    const store = await tx("templates");
    return promisifyRequest(store.getAll());
  },

  // ---------- EXERCISE NAMES (autocomplete) ----------
  async addExerciseName(name) {
    const store = await tx("exerciseNames", "readwrite");
    return promisifyRequest(store.put({ name }));
  },
  async getAllExerciseNames() {
    const store = await tx("exerciseNames");
    const all = await promisifyRequest(store.getAll());
    return all.map((x) => x.name).sort();
  },

  // ---------- META (gamification state, custom gyms) ----------
  async getMeta(key, fallback) {
    const store = await tx("meta");
    const res = await promisifyRequest(store.get(key));
    return res ? res.value : fallback;
  },
  async setMeta(key, value) {
    const store = await tx("meta", "readwrite");
    return promisifyRequest(store.put({ key, value }));
  },

  async getGyms() {
    const custom = await DB.getMeta("customGyms", []);
    const base = GYMS_DEFAULT.filter((g) => g !== "Ostalo");
    return [...base, ...custom, "Ostalo"];
  },
  async addCustomGym(name) {
    const custom = await DB.getMeta("customGyms", []);
    if (!custom.includes(name)) {
      custom.push(name);
      await DB.setMeta("customGyms", custom);
    }
  },

  // ---------- BACKUP / RESET ----------
  async exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      version: DB_VERSION,
      workouts: await DB.getAllWorkouts(),
      bodyweight: await DB.getAllBodyweight(),
      machines: await DB.getAllMachines(),
      cardio: await DB.getAllCardio(),
      templates: await DB.getAllTemplates(),
      exerciseNames: await DB.getAllExerciseNames(),
      meta: {
        xp: await DB.getMeta("xp", 0),
        unlockedBadges: await DB.getMeta("unlockedBadges", []),
        prCount: await DB.getMeta("prCount", 0),
        exerciseMaxWeights: await DB.getMeta("exerciseMaxWeights", {}),
        customGyms: await DB.getMeta("customGyms", [])
      }
    };
  },

  async importAll(data) {
    await DB.clearStore("workouts");
    await DB.clearStore("bodyweight");
    await DB.clearStore("machines");
    await DB.clearStore("cardio");
    await DB.clearStore("templates");
    await DB.clearStore("exerciseNames");
    await DB.clearStore("meta");

    for (const w of data.workouts || []) {
      const store = await tx("workouts", "readwrite");
      await promisifyRequest(store.put(w));
    }
    for (const b of data.bodyweight || []) await DB.setBodyweight(b);
    for (const m of data.machines || []) {
      const store = await tx("machines", "readwrite");
      await promisifyRequest(store.put(m));
    }
    for (const c of data.cardio || []) {
      const store = await tx("cardio", "readwrite");
      await promisifyRequest(store.put(c));
    }
    for (const t of data.templates || []) {
      const store = await tx("templates", "readwrite");
      await promisifyRequest(store.put(t));
    }
    for (const n of data.exerciseNames || []) await DB.addExerciseName(n);
    if (data.meta) {
      await DB.setMeta("xp", data.meta.xp || 0);
      await DB.setMeta("unlockedBadges", data.meta.unlockedBadges || []);
      await DB.setMeta("prCount", data.meta.prCount || 0);
      await DB.setMeta("exerciseMaxWeights", data.meta.exerciseMaxWeights || {});
      await DB.setMeta("customGyms", data.meta.customGyms || []);
    }
  },

  async clearStore(storeName) {
    const store = await tx(storeName, "readwrite");
    return promisifyRequest(store.clear());
  },

  async resetAll() {
    await DB.clearStore("workouts");
    await DB.clearStore("bodyweight");
    await DB.clearStore("machines");
    await DB.clearStore("cardio");
    await DB.clearStore("templates");
    await DB.clearStore("exerciseNames");
    await DB.clearStore("meta");
  }
};

window.DB = DB;
window.GYMS_DEFAULT = GYMS_DEFAULT;
