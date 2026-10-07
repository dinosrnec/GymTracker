// gamification.js - čisto računanje XP/levela/streaka/bedževa (bez DB pristupa)

// Datum u LOKALNOJ vremenskoj zoni kao "YYYY-MM-DD" (toISOString bi vratio UTC i pomaknuo dan)
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
window.ymd = ymd;

const GAMI = {
  // XP za jedan zabilježeni trening
  xpForWorkout(workout) {
    const numExercises = (workout.exercises || []).length;
    const numSets = (workout.exercises || []).reduce((acc, ex) => acc + (ex.sets || []).length, 0);
    return 10 + numExercises * 3 + numSets * 1;
  },

  xpForBodyweightLog() {
    return 3;
  },

  xpForMachinePhoto() {
    return 5;
  },

  xpForPR() {
    return 15;
  },

  xpForCardio() {
    return 8;
  },

  // Kvadratni rast: razina n treba 50*n^2 ukupnog XP-a
  levelFromXp(xp) {
    let level = 0;
    while (GAMI.xpForLevel(level + 1) <= xp) level++;
    return level;
  },
  xpForLevel(level) {
    return 50 * level * level;
  },
  levelProgress(xp) {
    const level = GAMI.levelFromXp(xp);
    const currentFloor = GAMI.xpForLevel(level);
    const nextCeil = GAMI.xpForLevel(level + 1);
    const span = nextCeil - currentFloor;
    const into = xp - currentFloor;
    return {
      level,
      xp,
      currentFloor,
      nextCeil,
      pct: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100
    };
  },

  // Ponedjeljak tjedna u kojem je zadani datum ("YYYY-MM-DD")
  weekStart(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = (dt.getDay() + 6) % 7; // pon = 0
    dt.setDate(dt.getDate() - dow);
    return ymd(dt);
  },

  // Tjedni streak: broj uzastopnih tjedana u kojima je odrađeno barem `goal` aktivnosti
  // (treninzi + cardio). Tjedan koji je u tijeku ne prekida streak dok se cilj ne ispuni.
  computeWeeklyStreak(activityDates, goal) {
    const counts = {};
    for (const d of activityDates || []) {
      const w = GAMI.weekStart(d);
      counts[w] = (counts[w] || 0) + 1;
    }
    const todayWeek = GAMI.weekStart(ymd(new Date()));
    const thisWeekCount = counts[todayWeek] || 0;

    const [y, m, d] = todayWeek.split("-").map(Number);
    const cursor = new Date(y, m - 1, d);
    if (thisWeekCount < goal) cursor.setDate(cursor.getDate() - 7);

    let streak = 0;
    while ((counts[ymd(cursor)] || 0) >= goal) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    }
    return { streak, thisWeekCount };
  },

  // Definicije bedževa: id, naziv, emoji, uvjet(stats) -> bool
  BADGES: [
    { id: "first_workout", name: "Prvi korak", emoji: "🏁", cond: (s) => s.totalWorkouts >= 1 },
    { id: "workouts_10", name: "10 treninga", emoji: "🔥", cond: (s) => s.totalWorkouts >= 10 },
    { id: "workouts_50", name: "50 treninga", emoji: "💪", cond: (s) => s.totalWorkouts >= 50 },
    { id: "workouts_100", name: "100 treninga", emoji: "🏆", cond: (s) => s.totalWorkouts >= 100 },
    { id: "week_2", name: "2 tjedna cilja zaredom", emoji: "⚡", cond: (s) => s.streak >= 2 },
    { id: "week_4", name: "4 tjedna cilja zaredom", emoji: "🌟", cond: (s) => s.streak >= 4 },
    { id: "week_12", name: "12 tjedana cilja zaredom", emoji: "👑", cond: (s) => s.streak >= 12 },
    { id: "first_bw", name: "Prvo vaganje", emoji: "⚖️", cond: (s) => s.bodyweightEntries >= 1 },
    { id: "bw_30", name: "30 vaganja", emoji: "📉", cond: (s) => s.bodyweightEntries >= 30 },
    { id: "first_machine", name: "Prva sprava fotkana", emoji: "📸", cond: (s) => s.machinePhotos >= 1 },
    { id: "machines_10", name: "10 sprava dokumentirano", emoji: "🗂️", cond: (s) => s.machinePhotos >= 10 },
    { id: "first_pr", name: "Prvi PR", emoji: "🚀", cond: (s) => s.prCount >= 1 },
    { id: "pr_10", name: "10 osobnih rekorda", emoji: "🥇", cond: (s) => s.prCount >= 10 },
    { id: "first_cardio", name: "Prvi cardio", emoji: "🏃", cond: (s) => s.cardioSessions >= 1 },
    { id: "cardio_10", name: "10 cardio sesija", emoji: "🚴", cond: (s) => s.cardioSessions >= 10 },
    { id: "cardio_30", name: "30 cardio sesija", emoji: "🫁", cond: (s) => s.cardioSessions >= 30 }
  ],

  checkNewBadges(stats, alreadyUnlockedIds) {
    const unlockedSet = new Set(alreadyUnlockedIds || []);
    const newly = [];
    for (const b of GAMI.BADGES) {
      if (!unlockedSet.has(b.id) && b.cond(stats)) newly.push(b.id);
    }
    return newly;
  }
};

window.GAMI = GAMI;
