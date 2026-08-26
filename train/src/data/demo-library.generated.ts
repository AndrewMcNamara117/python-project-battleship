// GENERATED FILE — do not edit.
// Regenerate with: node --experimental-strip-types scripts/generate-demo-library.mjs
//
// The demo adapter's copy of the shipped library, dumped from the migration
// that seeds the real database. Demo mode has no Postgres, and a second
// hand-written copy of these sessions would drift; this one cannot.

import type {
  ProgramTemplateItem,
  StrengthExercise,
  StrengthTemplate,
  WorkoutTemplate,
} from '@/lib/domain/library';

export const DEMO_WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    "id": "00000000-0000-4000-8000-000000000011",
    "name": "Bike — Endurance",
    "type": "bike",
    "basis": "time",
    "intensity": "easy",
    "durationMinutes": 90,
    "hrZone": 2,
    "rpeTarget": 4,
    "mainSet": "Steady aerobic riding. Smooth cadence, 85–95rpm.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "cross_training",
    "tags": [
      "easy",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000010",
    "name": "Brick Session",
    "type": "brick",
    "basis": "time",
    "intensity": "steady",
    "durationMinutes": 90,
    "rpeTarget": 6,
    "mainSet": "60 min bike at steady effort, straight into 25 min run off the bike.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "race_specific",
    "purpose": "The first 10 minutes off the bike always feel wrong. Run through it.",
    "tags": [
      "steady",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000013",
    "name": "Cross Training",
    "type": "cross_training",
    "basis": "time",
    "intensity": "easy",
    "durationMinutes": 45,
    "hrZone": 2,
    "rpeTarget": 4,
    "mainSet": "Low-impact aerobic work — bike, row, elliptical or pool.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "cross_training",
    "purpose": "Aerobic stimulus without the pounding.",
    "tags": [
      "easy",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Easy Run",
    "type": "easy_run",
    "basis": "distance",
    "intensity": "easy",
    "distanceKm": 8,
    "durationMinutes": 50,
    "hrZone": 2,
    "rpeTarget": 3,
    "mainSet": "Continuous easy running. Conversational the whole way.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "easy",
    "purpose": "If you cannot speak in full sentences, you are going too hard.",
    "tags": [
      "easy",
      "distance"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000008",
    "name": "Hill Repeats",
    "type": "hills",
    "basis": "time",
    "intensity": "hard",
    "distanceKm": 11,
    "durationMinutes": 55,
    "rpeTarget": 8,
    "warmUp": "15 min easy to the hill.",
    "mainSet": "8 x 60s uphill at hard effort. Jog down as recovery.",
    "coolDown": "12 min easy.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "hills",
    "purpose": "Strength in disguise. Tall posture, quick feet.",
    "tags": [
      "hard",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000003",
    "name": "Long Run",
    "type": "long_run",
    "basis": "distance",
    "intensity": "easy",
    "distanceKm": 22,
    "durationMinutes": 135,
    "hrZone": 2,
    "rpeTarget": 4,
    "warmUp": "First 15 minutes deliberately slower than target.",
    "mainSet": "Steady, controlled effort. Practise race-day fuelling.",
    "coolDown": "10 minutes easy walking.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "long_run",
    "purpose": "Fuel early. Start controlled. Finish stronger than you started.",
    "tags": [
      "easy",
      "distance"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000014",
    "name": "Mobility",
    "type": "mobility",
    "basis": "time",
    "intensity": "recovery",
    "durationMinutes": 20,
    "rpeTarget": 1,
    "mainSet": "Hips, ankles, thoracic spine. Slow and unhurried.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "mobility",
    "tags": [
      "recovery",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000004",
    "name": "Progression Run",
    "type": "progression_run",
    "basis": "distance",
    "intensity": "steady",
    "distanceKm": 14,
    "durationMinutes": 75,
    "rpeTarget": 6,
    "mainSet": "Three equal thirds: easy, steady, then marathon effort.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "progression",
    "purpose": "Negative split or it does not count.",
    "tags": [
      "steady",
      "distance"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000016",
    "name": "Race Day",
    "type": "race",
    "basis": "distance",
    "intensity": "max",
    "rpeTarget": 10,
    "mainSet": "Execute the plan. Nothing new on race day.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "race",
    "purpose": "The work is done. Trust it.",
    "tags": [
      "max",
      "distance"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000009",
    "name": "Race Pace",
    "type": "race_pace",
    "basis": "pace",
    "intensity": "steady",
    "distanceKm": 16,
    "durationMinutes": 85,
    "rpeTarget": 6,
    "warmUp": "15 min easy.",
    "mainSet": "3 x 15 min at goal race pace, 3 min float between.",
    "coolDown": "10 min easy.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "race_specific",
    "purpose": "Rehearsal, not a test.",
    "tags": [
      "steady",
      "pace"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "Recovery Run",
    "type": "recovery_run",
    "basis": "time",
    "intensity": "recovery",
    "distanceKm": 6,
    "durationMinutes": 35,
    "hrZone": 1,
    "rpeTarget": 2,
    "mainSet": "Very easy. Flat route. Shorter than it feels like it should be.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "recovery",
    "purpose": "The point is blood flow, not fitness.",
    "tags": [
      "recovery",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000015",
    "name": "Rest",
    "type": "rest",
    "basis": "time",
    "intensity": "rest",
    "mainSet": "Complete rest. This is a session — treat it like one.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "rest",
    "purpose": "Adaptation happens here, not in the session you skipped it for.",
    "tags": [
      "rest",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000012",
    "name": "Swim — Technique + Endurance",
    "type": "swim",
    "basis": "time",
    "intensity": "steady",
    "durationMinutes": 45,
    "rpeTarget": 5,
    "warmUp": "400m mixed.",
    "mainSet": "8 x 100m steady, 20s rest. Focus on catch.",
    "coolDown": "200m easy.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "cross_training",
    "tags": [
      "steady",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000005",
    "name": "Tempo",
    "type": "tempo",
    "basis": "time",
    "intensity": "hard",
    "distanceKm": 12,
    "durationMinutes": 60,
    "hrZone": 4,
    "rpeTarget": 7,
    "warmUp": "15 min easy + 4 x 20s strides.",
    "mainSet": "25 minutes continuous at comfortably hard. You could hold it for an hour on race day.",
    "coolDown": "12 min easy.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "tempo",
    "tags": [
      "hard",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000006",
    "name": "Threshold Intervals",
    "type": "threshold",
    "basis": "time",
    "intensity": "hard",
    "distanceKm": 13,
    "durationMinutes": 65,
    "hrZone": 4,
    "rpeTarget": 8,
    "warmUp": "15 min easy + drills + 4 x 20s strides.",
    "mainSet": "6 x 5 min at threshold, 90s easy jog between.",
    "coolDown": "12 min easy.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "threshold",
    "purpose": "Controlled discomfort, not a race. Same pace on the last rep as the first.",
    "tags": [
      "hard",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  },
  {
    "id": "00000000-0000-4000-8000-000000000007",
    "name": "VO2 Intervals",
    "type": "intervals",
    "basis": "time",
    "intensity": "max",
    "distanceKm": 12,
    "durationMinutes": 60,
    "hrZone": 5,
    "rpeTarget": 9,
    "warmUp": "15 min easy + drills + 4 x 100m strides.",
    "mainSet": "5 x 3 min hard, 3 min easy jog recovery.",
    "coolDown": "12 min easy.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "category": "intervals",
    "tags": [
      "max",
      "time"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": []
  }
] as unknown as WorkoutTemplate[];

export const DEMO_STRENGTH_EXERCISES: StrengthExercise[] = [
  {
    "id": "00000000-0000-4000-8001-000000000010",
    "name": "Barbell Hip Thrust",
    "category": "hinge",
    "muscleGroups": [
      "Glutes",
      "Hamstrings"
    ],
    "cues": [
      "Chin tucked, ribs down",
      "Finish with the glutes, not the lower back",
      "Pause at the top"
    ],
    "regressions": [
      "Bodyweight glute bridge",
      "Single-leg bridge"
    ],
    "progressions": [
      "Add load",
      "Pause reps"
    ],
    "equipment": [
      "Barbell",
      "Bench"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": false,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000005",
    "name": "Bent-Knee Calf Raise",
    "category": "push",
    "muscleGroups": [
      "Soleus",
      "Achilles"
    ],
    "cues": [
      "Knee bent to about 30 degrees",
      "Slow and honest",
      "This is the one runners skip"
    ],
    "regressions": [
      "Seated, bodyweight"
    ],
    "progressions": [
      "Seated with load across the knee"
    ],
    "equipment": [
      "Step",
      "Dumbbell"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "push",
    "isUnilateral": false,
    "tags": [
      "push"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000012",
    "name": "Box Jump (step down)",
    "category": "plyometric",
    "muscleGroups": [
      "Glutes",
      "Quads",
      "Calves"
    ],
    "cues": [
      "Land soft and tall",
      "Always step down, never jump down",
      "Quality over height"
    ],
    "regressions": [
      "Low box",
      "Squat jump to the floor"
    ],
    "progressions": [
      "Higher box",
      "Single-leg landings"
    ],
    "equipment": [
      "Box"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "plyometric",
    "isUnilateral": false,
    "tags": [
      "plyometric"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000006",
    "name": "Copenhagen Plank",
    "category": "core",
    "muscleGroups": [
      "Adductors",
      "Obliques"
    ],
    "cues": [
      "Top leg drives down into the bench",
      "Body in one line",
      "Stop before it shakes"
    ],
    "regressions": [
      "Short lever — knee on the bench"
    ],
    "progressions": [
      "Full length",
      "Add reps of top-leg raises"
    ],
    "equipment": [
      "Bench"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "core",
    "isUnilateral": true,
    "tags": [
      "core"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000008",
    "name": "Dead Bug",
    "category": "core",
    "muscleGroups": [
      "Deep core",
      "Hip flexors"
    ],
    "cues": [
      "Lower back stays flat to the floor",
      "Exhale as the limbs extend",
      "Slow beats far"
    ],
    "regressions": [
      "Arms only",
      "Legs only"
    ],
    "progressions": [
      "Add a band",
      "Extend the tempo"
    ],
    "equipment": [],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "core",
    "isUnilateral": false,
    "tags": [
      "core"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000016",
    "name": "Farmer Carry",
    "category": "carry",
    "muscleGroups": [
      "Grip",
      "Core",
      "Traps"
    ],
    "cues": [
      "Tall posture, shoulders down",
      "Walk normally",
      "Do not lean away from the load"
    ],
    "regressions": [
      "Lighter load, shorter distance"
    ],
    "progressions": [
      "Suitcase carry (one side)",
      "Longer carries"
    ],
    "equipment": [
      "Dumbbells",
      "Kettlebells"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "carry",
    "isUnilateral": false,
    "tags": [
      "carry"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000020",
    "name": "Goblet Squat",
    "category": "squat",
    "muscleGroups": [
      "Quads",
      "Glutes",
      "Core"
    ],
    "cues": [
      "Elbows inside the knees",
      "Sit between the hips",
      "Heels stay down"
    ],
    "regressions": [
      "Box squat",
      "Bodyweight"
    ],
    "progressions": [
      "Front squat",
      "Tempo",
      "Add load"
    ],
    "equipment": [
      "Kettlebell",
      "Dumbbell"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "squat",
    "isUnilateral": false,
    "tags": [
      "squat"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000018",
    "name": "Half-Kneeling Ankle Rocks",
    "category": "mobility",
    "muscleGroups": [
      "Ankle",
      "Calf"
    ],
    "cues": [
      "Heel stays down",
      "Knee travels over the second toe",
      "Small, repeated, painless"
    ],
    "regressions": [
      "Reduce the range"
    ],
    "progressions": [
      "Elevate the toes"
    ],
    "equipment": [],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "mobility",
    "isUnilateral": false,
    "tags": [
      "mobility"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000017",
    "name": "Hip Airplane",
    "category": "mobility",
    "muscleGroups": [
      "Glutes",
      "Hip rotators"
    ],
    "cues": [
      "Rotate from the hip, not the spine",
      "Slow through the whole range",
      "Balance is the point"
    ],
    "regressions": [
      "Hold a wall"
    ],
    "progressions": [
      "No support",
      "Pause at end range"
    ],
    "equipment": [],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "mobility",
    "isUnilateral": true,
    "tags": [
      "mobility"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000009",
    "name": "Loaded Step-Up",
    "category": "lunge",
    "muscleGroups": [
      "Glutes",
      "Quads"
    ],
    "cues": [
      "No push off the trailing foot",
      "Control the way down",
      "Knee tracks over the second toe"
    ],
    "regressions": [
      "Lower box",
      "Bodyweight"
    ],
    "progressions": [
      "Higher box",
      "Dumbbells",
      "Slow eccentric"
    ],
    "equipment": [
      "Box",
      "Dumbbells"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "lunge",
    "isUnilateral": true,
    "tags": [
      "lunge"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000019",
    "name": "Nordic Hamstring Curl (eccentric)",
    "category": "hinge",
    "muscleGroups": [
      "Hamstrings"
    ],
    "cues": [
      "Hips stay extended — no piking",
      "Resist as long as you can",
      "Push back up with the hands"
    ],
    "regressions": [
      "Band assisted",
      "Short range"
    ],
    "progressions": [
      "Full range",
      "Slow the descent further"
    ],
    "equipment": [
      "Partner or anchor"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": false,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000011",
    "name": "Pogo Hops",
    "category": "plyometric",
    "muscleGroups": [
      "Calves",
      "Achilles",
      "Foot"
    ],
    "cues": [
      "Stiff ankle, quiet landing",
      "Minimal knee bend",
      "Off the ground fast"
    ],
    "regressions": [
      "Two feet, low amplitude"
    ],
    "progressions": [
      "Single leg",
      "Lateral pogos"
    ],
    "equipment": [],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "plyometric",
    "isUnilateral": false,
    "tags": [
      "plyometric"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000013",
    "name": "Pull-Up",
    "category": "pull",
    "muscleGroups": [
      "Lats",
      "Biceps",
      "Mid-back"
    ],
    "cues": [
      "Start from a dead hang",
      "Chest to the bar",
      "No kipping"
    ],
    "regressions": [
      "Band assisted",
      "Inverted row"
    ],
    "progressions": [
      "Weighted",
      "Slow eccentric"
    ],
    "equipment": [
      "Pull-up bar"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "pull",
    "isUnilateral": false,
    "tags": [
      "pull"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000015",
    "name": "Push-Up",
    "category": "push",
    "muscleGroups": [
      "Chest",
      "Triceps",
      "Core"
    ],
    "cues": [
      "Body in one line",
      "Elbows at 45 degrees",
      "Full lockout"
    ],
    "regressions": [
      "Hands elevated"
    ],
    "progressions": [
      "Feet elevated",
      "Weighted",
      "Tempo"
    ],
    "equipment": [],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "push",
    "isUnilateral": false,
    "tags": [
      "push"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000001",
    "name": "Rear-Foot Elevated Split Squat",
    "category": "lunge",
    "muscleGroups": [
      "Quads",
      "Glutes",
      "Adductors"
    ],
    "cues": [
      "Front shin vertical at the bottom",
      "Ribs down, do not arch",
      "Drive through the whole front foot"
    ],
    "regressions": [
      "Split squat, both feet on the floor",
      "Hold a rail for balance"
    ],
    "progressions": [
      "Add dumbbells",
      "Slow 3-second lower",
      "Deficit front foot"
    ],
    "equipment": [
      "Bench",
      "Dumbbells"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "lunge",
    "isUnilateral": true,
    "tags": [
      "lunge"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000007",
    "name": "Side Plank with Top-Leg Raise",
    "category": "core",
    "muscleGroups": [
      "Glute medius",
      "Obliques"
    ],
    "cues": [
      "Stack the hips",
      "Lift from the glute, not the hip flexor"
    ],
    "regressions": [
      "Knees bent",
      "No leg raise"
    ],
    "progressions": [
      "Add a hold at the top",
      "Feet elevated"
    ],
    "equipment": [],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "core",
    "isUnilateral": true,
    "tags": [
      "core"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000014",
    "name": "Single-Arm Dumbbell Row",
    "category": "pull",
    "muscleGroups": [
      "Lats",
      "Rhomboids"
    ],
    "cues": [
      "Pull to the hip, not the armpit",
      "Torso stays still",
      "Full stretch at the bottom"
    ],
    "regressions": [
      "Chest-supported row"
    ],
    "progressions": [
      "Add load",
      "Pause at the top"
    ],
    "equipment": [
      "Dumbbell",
      "Bench"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "pull",
    "isUnilateral": false,
    "tags": [
      "pull"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000002",
    "name": "Single-Leg Romanian Deadlift",
    "category": "hinge",
    "muscleGroups": [
      "Hamstrings",
      "Glutes",
      "Spinal erectors"
    ],
    "cues": [
      "Hinge from the hip, not the spine",
      "Hips stay square to the floor",
      "Stop when the hamstring tightens"
    ],
    "regressions": [
      "Hold a wall",
      "Kickstand stance"
    ],
    "progressions": [
      "Single dumbbell contralateral",
      "Add a pause at the bottom"
    ],
    "equipment": [
      "Dumbbell"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": true,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000004",
    "name": "Straight-Leg Calf Raise",
    "category": "push",
    "muscleGroups": [
      "Gastrocnemius",
      "Achilles"
    ],
    "cues": [
      "Full range — heel below the step",
      "Two seconds down",
      "No bouncing out of the bottom"
    ],
    "regressions": [
      "Both legs",
      "Floor instead of a step"
    ],
    "progressions": [
      "Single leg",
      "Add a dumbbell",
      "Add a 3s isometric at the top"
    ],
    "equipment": [
      "Step"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "push",
    "isUnilateral": false,
    "tags": [
      "push"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000003",
    "name": "Trap-Bar Deadlift",
    "category": "hinge",
    "muscleGroups": [
      "Glutes",
      "Hamstrings",
      "Quads",
      "Back"
    ],
    "cues": [
      "Push the floor away",
      "Lats tight, chest proud",
      "Same bar path down as up"
    ],
    "regressions": [
      "Elevated blocks",
      "Kettlebell deadlift"
    ],
    "progressions": [
      "Add load",
      "Tempo eccentric"
    ],
    "equipment": [
      "Trap bar",
      "Plates"
    ],
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": false,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  }
] as unknown as StrengthExercise[];

export const DEMO_STRENGTH_TEMPLATES: StrengthTemplate[] = [
  {
    "id": "00000000-0000-4000-8002-000000000001",
    "name": "Foundation A",
    "category": "foundation",
    "description": "Bilateral strength and posterior chain. The base everything else is built on. Leave two reps in reserve on every set.",
    "estimatedMinutes": 45,
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [
      "foundation"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": [
      {
        "position": 0,
        "kind": "exercise",
        "label": "Half-Kneeling Ankle Rocks",
        "notes": "Warm-up",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000018",
        "sets": 2,
        "reps": "10 each",
        "restSeconds": 30
      },
      {
        "position": 1,
        "kind": "exercise",
        "label": "Trap-Bar Deadlift",
        "notes": "Leave two in the tank.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000003",
        "sets": 4,
        "reps": "6",
        "tempo": "2-0-1",
        "restSeconds": 150
      },
      {
        "position": 2,
        "kind": "exercise",
        "label": "Goblet Squat",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000020",
        "sets": 3,
        "reps": "8",
        "tempo": "3-1-1",
        "restSeconds": 120
      },
      {
        "position": 3,
        "kind": "exercise",
        "label": "Straight-Leg Calf Raise",
        "notes": "Full range below the step.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000004",
        "sets": 3,
        "reps": "12 each",
        "tempo": "2-1-2",
        "restSeconds": 75
      },
      {
        "position": 4,
        "kind": "exercise",
        "label": "Single-Arm Dumbbell Row",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000014",
        "sets": 3,
        "reps": "10 each",
        "restSeconds": 75
      },
      {
        "position": 5,
        "kind": "exercise",
        "label": "Dead Bug",
        "notes": "Lower back flat throughout.",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000008",
        "sets": 3,
        "reps": "8 each",
        "tempo": "slow",
        "restSeconds": 45
      }
    ]
  },
  {
    "id": "00000000-0000-4000-8002-000000000002",
    "name": "Foundation B",
    "category": "foundation",
    "description": "Single-leg strength and lateral control. This is the session that keeps you on the road.",
    "estimatedMinutes": 45,
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [
      "foundation"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": [
      {
        "position": 0,
        "kind": "exercise",
        "label": "Hip Airplane",
        "notes": "Warm-up",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000017",
        "sets": 2,
        "reps": "6 each",
        "restSeconds": 30
      },
      {
        "position": 1,
        "kind": "exercise",
        "label": "Rear-Foot Elevated Split Squat",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000001",
        "sets": 3,
        "reps": "8 each",
        "tempo": "3-0-1",
        "restSeconds": 120
      },
      {
        "position": 2,
        "kind": "exercise",
        "label": "Single-Leg Romanian Deadlift",
        "notes": "Hips square. Stop where control stops.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000002",
        "sets": 3,
        "reps": "8 each",
        "tempo": "3-1-1",
        "restSeconds": 90
      },
      {
        "position": 3,
        "kind": "exercise",
        "label": "Copenhagen Plank",
        "notes": "Short lever if the long one shakes.",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000006",
        "sets": 3,
        "reps": "20s each",
        "restSeconds": 60
      },
      {
        "position": 4,
        "kind": "exercise",
        "label": "Bent-Knee Calf Raise",
        "notes": "Soleus. Do not skip this.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000005",
        "sets": 3,
        "reps": "15 each",
        "tempo": "2-0-2",
        "restSeconds": 60
      },
      {
        "position": 5,
        "kind": "exercise",
        "label": "Side Plank with Top-Leg Raise",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000007",
        "sets": 2,
        "reps": "8 each",
        "restSeconds": 45
      }
    ]
  },
  {
    "id": "00000000-0000-4000-8002-000000000004",
    "name": "Maintenance",
    "category": "maintenance",
    "description": "Race week and heavy running weeks. Enough to hold what you built, light enough to leave no trace.",
    "estimatedMinutes": 25,
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [
      "maintenance"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": [
      {
        "position": 0,
        "kind": "exercise",
        "label": "Goblet Squat",
        "notes": "Light.",
        "rpeTarget": 5,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000020",
        "sets": 2,
        "reps": "8",
        "restSeconds": 60
      },
      {
        "position": 1,
        "kind": "exercise",
        "label": "Single-Leg Romanian Deadlift",
        "rpeTarget": 5,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000002",
        "sets": 2,
        "reps": "8 each",
        "restSeconds": 60
      },
      {
        "position": 2,
        "kind": "exercise",
        "label": "Straight-Leg Calf Raise",
        "rpeTarget": 5,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000004",
        "sets": 2,
        "reps": "12 each",
        "restSeconds": 60
      },
      {
        "position": 3,
        "kind": "exercise",
        "label": "Dead Bug",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000008",
        "sets": 2,
        "reps": "8 each",
        "restSeconds": 45
      }
    ]
  },
  {
    "id": "00000000-0000-4000-8002-000000000003",
    "name": "Performance A",
    "category": "performance",
    "description": "Heavier, faster, lower volume. Run this in a build block when the legs can take it.",
    "estimatedMinutes": 55,
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [
      "performance"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": [
      {
        "position": 0,
        "kind": "exercise",
        "label": "Pogo Hops",
        "notes": "Quiet and stiff.",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000011",
        "sets": 3,
        "reps": "20",
        "restSeconds": 60
      },
      {
        "position": 1,
        "kind": "exercise",
        "label": "Trap-Bar Deadlift",
        "notes": "Intent on the way up.",
        "rpeTarget": 8,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000003",
        "sets": 5,
        "reps": "3",
        "tempo": "2-0-X",
        "restSeconds": 180
      },
      {
        "position": 2,
        "kind": "exercise",
        "label": "Box Jump (step down)",
        "notes": "Step down every rep.",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000012",
        "sets": 4,
        "reps": "4",
        "restSeconds": 120
      },
      {
        "position": 3,
        "kind": "exercise",
        "label": "Barbell Hip Thrust",
        "rpeTarget": 8,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000010",
        "sets": 3,
        "reps": "8",
        "tempo": "2-1-1",
        "restSeconds": 120
      },
      {
        "position": 4,
        "kind": "exercise",
        "label": "Nordic Hamstring Curl (eccentric)",
        "notes": "Expect soreness the first few weeks.",
        "rpeTarget": 8,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000019",
        "sets": 3,
        "reps": "5",
        "tempo": "slow eccentric",
        "restSeconds": 120
      },
      {
        "position": 5,
        "kind": "exercise",
        "label": "Farmer Carry",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000016",
        "sets": 3,
        "reps": "40m",
        "restSeconds": 90
      }
    ]
  },
  {
    "id": "00000000-0000-4000-8002-000000000006",
    "name": "Triathlon Support",
    "category": "triathlon_support",
    "description": "Upper-body pulling for the swim, hip strength for the bike, and enough legs to run off it.",
    "estimatedMinutes": 45,
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [
      "triathlon_support"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": [
      {
        "position": 0,
        "kind": "exercise",
        "label": "Pull-Up",
        "notes": "Band assist if needed.",
        "rpeTarget": 8,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000013",
        "sets": 4,
        "reps": "5",
        "tempo": "2-1-1",
        "restSeconds": 120
      },
      {
        "position": 1,
        "kind": "exercise",
        "label": "Single-Arm Dumbbell Row",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000014",
        "sets": 3,
        "reps": "10 each",
        "restSeconds": 75
      },
      {
        "position": 2,
        "kind": "exercise",
        "label": "Barbell Hip Thrust",
        "notes": "Bike power.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000010",
        "sets": 3,
        "reps": "10",
        "tempo": "2-1-1",
        "restSeconds": 90
      },
      {
        "position": 3,
        "kind": "exercise",
        "label": "Push-Up",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000015",
        "sets": 3,
        "reps": "12",
        "restSeconds": 60
      },
      {
        "position": 4,
        "kind": "exercise",
        "label": "Rear-Foot Elevated Split Squat",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000001",
        "sets": 3,
        "reps": "8 each",
        "restSeconds": 90
      },
      {
        "position": 5,
        "kind": "exercise",
        "label": "Dead Bug",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000008",
        "sets": 2,
        "reps": "10 each",
        "restSeconds": 45
      }
    ]
  },
  {
    "id": "00000000-0000-4000-8002-000000000005",
    "name": "Ultra Prep",
    "category": "ultra_prep",
    "description": "Durability for long time on feet — carries, calves and hip stability at volume. Built for the back half of an ultra.",
    "estimatedMinutes": 50,
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [
      "ultra_prep"
    ],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null,
    "components": [
      {
        "position": 0,
        "kind": "exercise",
        "label": "Loaded Step-Up",
        "notes": "Downhill legs.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000009",
        "sets": 4,
        "reps": "10 each",
        "tempo": "2-0-2",
        "restSeconds": 90
      },
      {
        "position": 1,
        "kind": "exercise",
        "label": "Single-Leg Romanian Deadlift",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000002",
        "sets": 3,
        "reps": "10 each",
        "tempo": "3-0-1",
        "restSeconds": 90
      },
      {
        "position": 2,
        "kind": "exercise",
        "label": "Bent-Knee Calf Raise",
        "notes": "Volume matters more than load here.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000005",
        "sets": 4,
        "reps": "20 each",
        "tempo": "2-0-2",
        "restSeconds": 75
      },
      {
        "position": 3,
        "kind": "exercise",
        "label": "Farmer Carry",
        "notes": "Posture under fatigue.",
        "rpeTarget": 7,
        "strengthExerciseId": "00000000-0000-4000-8001-000000000016",
        "sets": 4,
        "reps": "60m",
        "restSeconds": 90
      },
      {
        "position": 4,
        "kind": "exercise",
        "label": "Copenhagen Plank",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000006",
        "sets": 3,
        "reps": "25s each",
        "restSeconds": 60
      },
      {
        "position": 5,
        "kind": "exercise",
        "label": "Side Plank with Top-Leg Raise",
        "strengthExerciseId": "00000000-0000-4000-8001-000000000007",
        "sets": 3,
        "reps": "10 each",
        "restSeconds": 45
      }
    ]
  }
] as unknown as StrengthTemplate[];

export const DEMO_PROGRAM_TEMPLATES: ProgramTemplateItem[] = [
  {
    "id": "00000000-0000-4000-8001-000000000001",
    "name": "5K — Sharpen",
    "goalType": "5k",
    "weeks": 8,
    "description": "Eight weeks around one hard session and one sharpening session per week. Built for someone who already runs three or four times a week.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000002",
    "name": "10K — Build",
    "goalType": "10k",
    "weeks": 10,
    "description": "Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000007",
    "name": "General Endurance",
    "goalType": "general_endurance",
    "weeks": 12,
    "description": "No start line yet. Aerobic base, consistent strength, and the habit of showing up. The best place to begin.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000003",
    "name": "Half Marathon — Foundation to Start Line",
    "goalType": "half_marathon",
    "weeks": 14,
    "description": "Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000004",
    "name": "Marathon — The Long Way",
    "goalType": "marathon",
    "weeks": 18,
    "description": "Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run, where it belongs.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000006",
    "name": "70.3 — Three Disciplines",
    "goalType": "triathlon_70_3",
    "weeks": 20,
    "description": "Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000005",
    "name": "Ultra — Time on Feet",
    "goalType": "ultra",
    "weeks": 24,
    "description": "Twenty-four weeks built around back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.",
    "createdAt": "2026-08-26T12:17:18.283Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T12:17:18.283Z",
    "ownerId": null,
    "archivedAt": null
  }
] as unknown as ProgramTemplateItem[];
