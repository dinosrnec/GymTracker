// gamification.js - čisto računanje XP/levela/streaka/bedževa (bez DB pristupa)

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

  // Streak: niz uzastopnih dana (do danas ili jučer) s barem jednim treningom
  computeStreak(workoutDates) {
    if (!workoutDates || workoutDates.length === 0) return 0;
    const uniqueDays = [...new Set(workoutDates)].sort();
    const daySet = new Set(uniqueDays);
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    let cursor = new Date(today);
    // ako danas nije odrađen trening, kreni provjeru od jučer (da danas ne "kvari" streak dok dan traje)
    if (!daySet.has(fmt(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (daySet.has(fmt(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  },

  // Definicije bedževa: id, naziv, emoji, uvjet(stats) -> bool
  BADGES: [
    { id: "first_workout", name: "Prvi korak", emoji: "🏁", cond: (s) => s.totalWorkouts >= 1 },
    { id: "workouts_10", name: "10 treninga", emoji: "🔥", cond: (s) => s.totalWorkouts >= 10 },
    { id: "workouts_50", name: "50 treninga", emoji: "💪", cond: (s) => s.totalWorkouts >= 50 },
    { id: "workouts_100", name: "100 treninga", emoji: "🏆", cond: (s) => s.totalWorkouts >= 100 },
    { id: "streak_3", name: "3 dana zaredom", emoji: "⚡", cond: (s) => s.streak >= 3 },
    { id: "streak_7", name: "Tjedan dana zaredom", emoji: "🌟", cond: (s) => s.streak >= 7 },
    { id: "streak_30", name: "Mjesec dana zaredom", emoji: "👑", cond: (s) => s.streak >= 30 },
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
