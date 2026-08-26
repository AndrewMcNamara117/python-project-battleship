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
import type {
  ProgramTemplateBlock,
  ProgramTemplateSlot,
  ProgramTemplateWeek,
} from '@/lib/domain/programme-template';

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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "cross_training",
    "tags": [
      "easy",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "race_specific",
    "purpose": "The first 10 minutes off the bike always feel wrong. Run through it.",
    "tags": [
      "steady",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "cross_training",
    "purpose": "Aerobic stimulus without the pounding.",
    "tags": [
      "easy",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "easy",
    "purpose": "If you cannot speak in full sentences, you are going too hard.",
    "tags": [
      "easy",
      "distance"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "hills",
    "purpose": "Strength in disguise. Tall posture, quick feet.",
    "tags": [
      "hard",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "long_run",
    "purpose": "Fuel early. Start controlled. Finish stronger than you started.",
    "tags": [
      "easy",
      "distance"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "mobility",
    "tags": [
      "recovery",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "progression",
    "purpose": "Negative split or it does not count.",
    "tags": [
      "steady",
      "distance"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "race",
    "purpose": "The work is done. Trust it.",
    "tags": [
      "max",
      "distance"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "race_specific",
    "purpose": "Rehearsal, not a test.",
    "tags": [
      "steady",
      "pace"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "recovery",
    "purpose": "The point is blood flow, not fitness.",
    "tags": [
      "recovery",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "rest",
    "purpose": "Adaptation happens here, not in the session you skipped it for.",
    "tags": [
      "rest",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "cross_training",
    "tags": [
      "steady",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "tempo",
    "tags": [
      "hard",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "threshold",
    "purpose": "Controlled discomfort, not a race. Same pace on the last rep as the first.",
    "tags": [
      "hard",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "category": "intervals",
    "tags": [
      "max",
      "time"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": false,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "push",
    "isUnilateral": false,
    "tags": [
      "push"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "plyometric",
    "isUnilateral": false,
    "tags": [
      "plyometric"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "core",
    "isUnilateral": true,
    "tags": [
      "core"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "core",
    "isUnilateral": false,
    "tags": [
      "core"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "carry",
    "isUnilateral": false,
    "tags": [
      "carry"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "squat",
    "isUnilateral": false,
    "tags": [
      "squat"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "mobility",
    "isUnilateral": false,
    "tags": [
      "mobility"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "mobility",
    "isUnilateral": true,
    "tags": [
      "mobility"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "lunge",
    "isUnilateral": true,
    "tags": [
      "lunge"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": false,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "plyometric",
    "isUnilateral": false,
    "tags": [
      "plyometric"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "pull",
    "isUnilateral": false,
    "tags": [
      "pull"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "push",
    "isUnilateral": false,
    "tags": [
      "push"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "lunge",
    "isUnilateral": true,
    "tags": [
      "lunge"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "core",
    "isUnilateral": true,
    "tags": [
      "core"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "pull",
    "isUnilateral": false,
    "tags": [
      "pull"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": true,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "push",
    "isUnilateral": false,
    "tags": [
      "push"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "movementPattern": "hinge",
    "isUnilateral": false,
    "tags": [
      "hinge"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [
      "foundation"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [
      "foundation"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [
      "maintenance"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [
      "performance"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [
      "triathlon_support"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [
      "ultra_prep"
    ],
    "updatedAt": "2026-08-26T13:22:35.278Z",
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
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "running",
    "targetDistanceKm": 5,
    "experienceLevel": "developing",
    "minDaysPerWeek": 4,
    "maxDaysPerWeek": 5,
    "purpose": "Eight weeks around one hard session and one sharpening session per week.",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000002",
    "name": "10K — Build",
    "goalType": "10k",
    "weeks": 10,
    "description": "Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.",
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "running",
    "targetDistanceKm": 10,
    "experienceLevel": "developing",
    "minDaysPerWeek": 4,
    "maxDaysPerWeek": 5,
    "purpose": "Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000007",
    "name": "General Endurance",
    "goalType": "general_endurance",
    "weeks": 12,
    "description": "No start line yet. Aerobic base, consistent strength, and the habit of showing up. The best place to begin.",
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "running",
    "experienceLevel": "beginner",
    "minDaysPerWeek": 3,
    "maxDaysPerWeek": 4,
    "purpose": "No start line yet. Aerobic base, consistent strength, and the habit of showing up.",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000003",
    "name": "Half Marathon — Foundation to Start Line",
    "goalType": "half_marathon",
    "weeks": 14,
    "description": "Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.",
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "running",
    "targetDistanceKm": 21.1,
    "experienceLevel": "developing",
    "minDaysPerWeek": 4,
    "maxDaysPerWeek": 6,
    "purpose": "Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000004",
    "name": "Marathon — The Long Way",
    "goalType": "marathon",
    "weeks": 18,
    "description": "Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run, where it belongs.",
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "running",
    "targetDistanceKm": 42.2,
    "experienceLevel": "experienced",
    "minDaysPerWeek": 5,
    "maxDaysPerWeek": 6,
    "purpose": "Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run.",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000006",
    "name": "70.3 — Three Disciplines",
    "goalType": "triathlon_70_3",
    "weeks": 20,
    "description": "Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.",
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "triathlon",
    "targetDistanceKm": 113,
    "experienceLevel": "experienced",
    "minDaysPerWeek": 6,
    "maxDaysPerWeek": 6,
    "purpose": "Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.",
    "ownerId": null,
    "archivedAt": null
  },
  {
    "id": "00000000-0000-4000-8001-000000000005",
    "name": "Ultra — Time on Feet",
    "goalType": "ultra",
    "weeks": 24,
    "description": "Twenty-four weeks built around back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.",
    "createdAt": "2026-08-26T13:22:35.278Z",
    "visibility": "system",
    "tags": [],
    "updatedAt": "2026-08-26T13:22:35.278Z",
    "discipline": "trail",
    "targetDistanceKm": 50,
    "experienceLevel": "experienced",
    "minDaysPerWeek": 5,
    "maxDaysPerWeek": 6,
    "purpose": "Back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.",
    "ownerId": null,
    "archivedAt": null
  }
] as unknown as ProgramTemplateItem[];

export const DEMO_TEMPLATE_BLOCKS: ProgramTemplateBlock[] = [
  {
    "id": "00000000-0000-4000-8002-000200000003",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockIndex": 0,
    "name": "Base",
    "phase": "base",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000300000004",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockIndex": 1,
    "name": "Sharpen",
    "phase": "sharpen",
    "focus": "Race-pace speed on tired legs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000400000005",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockIndex": 2,
    "name": "Race Week",
    "phase": "taper",
    "focus": "Sharp, not tired.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000500000006",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockIndex": 0,
    "name": "Base",
    "phase": "base",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000600000007",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockIndex": 1,
    "name": "Build",
    "phase": "build",
    "focus": "Hold threshold pace for longer, week on week.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000700000008",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockIndex": 2,
    "name": "Taper",
    "phase": "taper",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000800000009",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockIndex": 0,
    "name": "Foundation",
    "phase": "base",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000900000010",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockIndex": 1,
    "name": "Build",
    "phase": "build",
    "focus": "Volume rises. Quality holds.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001000000011",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockIndex": 2,
    "name": "Race Specific",
    "phase": "specific",
    "focus": "Race pace inside the long run, where it belongs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001100000012",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockIndex": 3,
    "name": "Taper",
    "phase": "taper",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001200000013",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockIndex": 0,
    "name": "Base",
    "phase": "base",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001300000014",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockIndex": 1,
    "name": "Build",
    "phase": "build",
    "focus": "The long run grows. Everything else holds steady.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001400000015",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockIndex": 2,
    "name": "Race Specific",
    "phase": "specific",
    "focus": "Marathon pace on tired legs, inside the long run.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001500000016",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockIndex": 3,
    "name": "Taper",
    "phase": "taper",
    "focus": "Do less. Trust the work.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001600000017",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockIndex": 0,
    "name": "Base",
    "phase": "base",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001700000018",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockIndex": 1,
    "name": "Build",
    "phase": "build",
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001800000019",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockIndex": 2,
    "name": "Specific",
    "phase": "specific",
    "focus": "Terrain, night running, and the kit you will race in.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-001900000020",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockIndex": 3,
    "name": "Taper",
    "phase": "taper",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-002000000021",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockIndex": 0,
    "name": "Base",
    "phase": "base",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-002100000022",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockIndex": 1,
    "name": "Build",
    "phase": "build",
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-002200000023",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockIndex": 2,
    "name": "Race Specific",
    "phase": "specific",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-002300000024",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockIndex": 3,
    "name": "Taper",
    "phase": "taper",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000000000001",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockIndex": 0,
    "name": "Foundation",
    "phase": "base",
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8002-000100000002",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockIndex": 1,
    "name": "Steady Build",
    "phase": "build",
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  }
] as unknown as ProgramTemplateBlock[];

export const DEMO_TEMPLATE_WEEKS: ProgramTemplateWeek[] = [
  {
    "id": "00000000-0000-4000-8003-001200000013",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000200000003",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 40,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001300000014",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000200000003",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 42,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001400000015",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000200000003",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 44,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001500000016",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000300000004",
    "weekIndex": 0,
    "templateWeekNo": 4,
    "targetVolumeKm": 47,
    "isRecoveryWeek": false,
    "focus": "Race-pace speed on tired legs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001600000017",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000300000004",
    "weekIndex": 1,
    "templateWeekNo": 5,
    "targetVolumeKm": 50,
    "isRecoveryWeek": false,
    "focus": "Race-pace speed on tired legs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001700000018",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000300000004",
    "weekIndex": 2,
    "templateWeekNo": 6,
    "targetVolumeKm": 52,
    "isRecoveryWeek": false,
    "focus": "Race-pace speed on tired legs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001800000019",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000300000004",
    "weekIndex": 3,
    "templateWeekNo": 7,
    "targetVolumeKm": 54,
    "isRecoveryWeek": false,
    "focus": "Race-pace speed on tired legs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001900000020",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "blockId": "00000000-0000-4000-8002-000400000005",
    "weekIndex": 0,
    "templateWeekNo": 8,
    "targetVolumeKm": 17,
    "isRecoveryWeek": false,
    "focus": "Sharp, not tired.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002000000021",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000500000006",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 43,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002100000022",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000500000006",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 45,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002200000023",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000500000006",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 47,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002300000024",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000500000006",
    "weekIndex": 3,
    "templateWeekNo": 4,
    "targetVolumeKm": 31,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002400000025",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000600000007",
    "weekIndex": 0,
    "templateWeekNo": 5,
    "targetVolumeKm": 52,
    "isRecoveryWeek": false,
    "focus": "Hold threshold pace for longer, week on week.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002500000026",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000600000007",
    "weekIndex": 1,
    "templateWeekNo": 6,
    "targetVolumeKm": 55,
    "isRecoveryWeek": false,
    "focus": "Hold threshold pace for longer, week on week.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002600000027",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000600000007",
    "weekIndex": 2,
    "templateWeekNo": 7,
    "targetVolumeKm": 57,
    "isRecoveryWeek": false,
    "focus": "Hold threshold pace for longer, week on week.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002700000028",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000600000007",
    "weekIndex": 3,
    "templateWeekNo": 8,
    "targetVolumeKm": 38,
    "isRecoveryWeek": true,
    "focus": "Hold threshold pace for longer, week on week.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002800000029",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000700000008",
    "weekIndex": 0,
    "templateWeekNo": 9,
    "targetVolumeKm": 30,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-002900000030",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "blockId": "00000000-0000-4000-8002-000700000008",
    "weekIndex": 1,
    "templateWeekNo": 10,
    "targetVolumeKm": 32,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003000000031",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000800000009",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 41,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003100000032",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000800000009",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 43,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003200000033",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000800000009",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 45,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003300000034",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000800000009",
    "weekIndex": 3,
    "templateWeekNo": 4,
    "targetVolumeKm": 30,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003400000035",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000800000009",
    "weekIndex": 4,
    "templateWeekNo": 5,
    "targetVolumeKm": 49,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003500000036",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000900000010",
    "weekIndex": 0,
    "templateWeekNo": 6,
    "targetVolumeKm": 46,
    "isRecoveryWeek": false,
    "focus": "Volume rises. Quality holds.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003600000037",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000900000010",
    "weekIndex": 1,
    "templateWeekNo": 7,
    "targetVolumeKm": 48,
    "isRecoveryWeek": false,
    "focus": "Volume rises. Quality holds.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003700000038",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000900000010",
    "weekIndex": 2,
    "templateWeekNo": 8,
    "targetVolumeKm": 34,
    "isRecoveryWeek": true,
    "focus": "Volume rises. Quality holds.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003800000039",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000900000010",
    "weekIndex": 3,
    "templateWeekNo": 9,
    "targetVolumeKm": 53,
    "isRecoveryWeek": false,
    "focus": "Volume rises. Quality holds.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-003900000040",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-000900000010",
    "weekIndex": 4,
    "templateWeekNo": 10,
    "targetVolumeKm": 55,
    "isRecoveryWeek": false,
    "focus": "Volume rises. Quality holds.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004000000041",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-001000000011",
    "weekIndex": 0,
    "templateWeekNo": 11,
    "targetVolumeKm": 51,
    "isRecoveryWeek": false,
    "focus": "Race pace inside the long run, where it belongs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004100000042",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-001000000011",
    "weekIndex": 1,
    "templateWeekNo": 12,
    "targetVolumeKm": 37,
    "isRecoveryWeek": true,
    "focus": "Race pace inside the long run, where it belongs.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004200000043",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-001100000012",
    "weekIndex": 0,
    "templateWeekNo": 13,
    "targetVolumeKm": 23,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004300000044",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "blockId": "00000000-0000-4000-8002-001100000012",
    "weekIndex": 1,
    "templateWeekNo": 14,
    "targetVolumeKm": 24,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004400000045",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001200000013",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 49,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004500000046",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001200000013",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 51,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004600000047",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001200000013",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 54,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004700000048",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001200000013",
    "weekIndex": 3,
    "templateWeekNo": 4,
    "targetVolumeKm": 36,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004800000049",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001200000013",
    "weekIndex": 4,
    "templateWeekNo": 5,
    "targetVolumeKm": 58,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-004900000050",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001200000013",
    "weekIndex": 5,
    "templateWeekNo": 6,
    "targetVolumeKm": 61,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005000000051",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001300000014",
    "weekIndex": 0,
    "templateWeekNo": 7,
    "targetVolumeKm": 47,
    "isRecoveryWeek": false,
    "focus": "The long run grows. Everything else holds steady.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005100000052",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001300000014",
    "weekIndex": 1,
    "templateWeekNo": 8,
    "targetVolumeKm": 35,
    "isRecoveryWeek": true,
    "focus": "The long run grows. Everything else holds steady.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005200000053",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001300000014",
    "weekIndex": 2,
    "templateWeekNo": 9,
    "targetVolumeKm": 52,
    "isRecoveryWeek": false,
    "focus": "The long run grows. Everything else holds steady.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005300000054",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001300000014",
    "weekIndex": 3,
    "templateWeekNo": 10,
    "targetVolumeKm": 54,
    "isRecoveryWeek": false,
    "focus": "The long run grows. Everything else holds steady.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005400000055",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001300000014",
    "weekIndex": 4,
    "templateWeekNo": 11,
    "targetVolumeKm": 56,
    "isRecoveryWeek": false,
    "focus": "The long run grows. Everything else holds steady.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005500000056",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001400000015",
    "weekIndex": 0,
    "templateWeekNo": 12,
    "targetVolumeKm": 64,
    "isRecoveryWeek": false,
    "focus": "Marathon pace on tired legs, inside the long run.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005600000057",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001400000015",
    "weekIndex": 1,
    "templateWeekNo": 13,
    "targetVolumeKm": 67,
    "isRecoveryWeek": false,
    "focus": "Marathon pace on tired legs, inside the long run.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005700000058",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001400000015",
    "weekIndex": 2,
    "templateWeekNo": 14,
    "targetVolumeKm": 70,
    "isRecoveryWeek": false,
    "focus": "Marathon pace on tired legs, inside the long run.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005800000059",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001400000015",
    "weekIndex": 3,
    "templateWeekNo": 15,
    "targetVolumeKm": 73,
    "isRecoveryWeek": false,
    "focus": "Marathon pace on tired legs, inside the long run.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-005900000060",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001500000016",
    "weekIndex": 0,
    "templateWeekNo": 16,
    "targetVolumeKm": 29,
    "isRecoveryWeek": false,
    "focus": "Do less. Trust the work.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006000000061",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001500000016",
    "weekIndex": 1,
    "templateWeekNo": 17,
    "targetVolumeKm": 30,
    "isRecoveryWeek": false,
    "focus": "Do less. Trust the work.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006100000062",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "blockId": "00000000-0000-4000-8002-001500000016",
    "weekIndex": 2,
    "templateWeekNo": 18,
    "targetVolumeKm": 31,
    "isRecoveryWeek": false,
    "focus": "Do less. Trust the work.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006200000063",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 41,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006300000064",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 43,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006400000065",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 45,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006500000066",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 3,
    "templateWeekNo": 4,
    "targetVolumeKm": 30,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006600000067",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 4,
    "templateWeekNo": 5,
    "targetVolumeKm": 49,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006700000068",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 5,
    "templateWeekNo": 6,
    "targetVolumeKm": 52,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006800000069",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 6,
    "templateWeekNo": 7,
    "targetVolumeKm": 54,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-006900000070",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001600000017",
    "weekIndex": 7,
    "templateWeekNo": 8,
    "targetVolumeKm": 30,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007000000071",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 0,
    "templateWeekNo": 9,
    "targetVolumeKm": 61,
    "isRecoveryWeek": false,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007100000072",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 1,
    "templateWeekNo": 10,
    "targetVolumeKm": 64,
    "isRecoveryWeek": false,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007200000073",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 2,
    "templateWeekNo": 11,
    "targetVolumeKm": 67,
    "isRecoveryWeek": false,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007300000074",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 3,
    "templateWeekNo": 12,
    "targetVolumeKm": 44,
    "isRecoveryWeek": true,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007400000075",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 4,
    "templateWeekNo": 13,
    "targetVolumeKm": 72,
    "isRecoveryWeek": false,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007500000076",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 5,
    "templateWeekNo": 14,
    "targetVolumeKm": 76,
    "isRecoveryWeek": false,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007600000077",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 6,
    "templateWeekNo": 15,
    "targetVolumeKm": 79,
    "isRecoveryWeek": false,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007700000078",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001700000018",
    "weekIndex": 7,
    "templateWeekNo": 16,
    "targetVolumeKm": 44,
    "isRecoveryWeek": true,
    "focus": "Back-to-back weekends. Practise eating on the move.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007800000079",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001800000019",
    "weekIndex": 0,
    "templateWeekNo": 17,
    "targetVolumeKm": 61,
    "isRecoveryWeek": false,
    "focus": "Terrain, night running, and the kit you will race in.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-007900000080",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001800000019",
    "weekIndex": 1,
    "templateWeekNo": 18,
    "targetVolumeKm": 64,
    "isRecoveryWeek": false,
    "focus": "Terrain, night running, and the kit you will race in.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008000000081",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001800000019",
    "weekIndex": 2,
    "templateWeekNo": 19,
    "targetVolumeKm": 67,
    "isRecoveryWeek": false,
    "focus": "Terrain, night running, and the kit you will race in.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008100000082",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001800000019",
    "weekIndex": 3,
    "templateWeekNo": 20,
    "targetVolumeKm": 44,
    "isRecoveryWeek": true,
    "focus": "Terrain, night running, and the kit you will race in.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008200000083",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001800000019",
    "weekIndex": 4,
    "templateWeekNo": 21,
    "targetVolumeKm": 73,
    "isRecoveryWeek": false,
    "focus": "Terrain, night running, and the kit you will race in.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008300000084",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001900000020",
    "weekIndex": 0,
    "templateWeekNo": 22,
    "targetVolumeKm": 25,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008400000085",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001900000020",
    "weekIndex": 1,
    "templateWeekNo": 23,
    "targetVolumeKm": 27,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008500000086",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "blockId": "00000000-0000-4000-8002-001900000020",
    "weekIndex": 2,
    "templateWeekNo": 24,
    "targetVolumeKm": 18,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008600000087",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 20,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008700000088",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 21,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008800000089",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 23,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-008900000090",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 3,
    "templateWeekNo": 4,
    "targetVolumeKm": 15,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009000000091",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 4,
    "templateWeekNo": 5,
    "targetVolumeKm": 24,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009100000092",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 5,
    "templateWeekNo": 6,
    "targetVolumeKm": 25,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009200000093",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 6,
    "templateWeekNo": 7,
    "targetVolumeKm": 26,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009300000094",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002000000021",
    "weekIndex": 7,
    "templateWeekNo": 8,
    "targetVolumeKm": 15,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009400000095",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 0,
    "templateWeekNo": 9,
    "targetVolumeKm": 32,
    "isRecoveryWeek": false,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009500000096",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 1,
    "templateWeekNo": 10,
    "targetVolumeKm": 34,
    "isRecoveryWeek": false,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009600000097",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 2,
    "templateWeekNo": 11,
    "targetVolumeKm": 35,
    "isRecoveryWeek": false,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009700000098",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 3,
    "templateWeekNo": 12,
    "targetVolumeKm": 23,
    "isRecoveryWeek": true,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009800000099",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 4,
    "templateWeekNo": 13,
    "targetVolumeKm": 38,
    "isRecoveryWeek": false,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-009900000100",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 5,
    "templateWeekNo": 14,
    "targetVolumeKm": 40,
    "isRecoveryWeek": false,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-010000000101",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002100000022",
    "weekIndex": 6,
    "templateWeekNo": 15,
    "targetVolumeKm": 42,
    "isRecoveryWeek": false,
    "focus": "Brick work every week. Get used to running off the bike.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-010100000102",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002200000023",
    "weekIndex": 0,
    "templateWeekNo": 16,
    "targetVolumeKm": 29,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-010200000103",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002200000023",
    "weekIndex": 1,
    "templateWeekNo": 17,
    "targetVolumeKm": 31,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-010300000104",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002200000023",
    "weekIndex": 2,
    "templateWeekNo": 18,
    "targetVolumeKm": 32,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-010400000105",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002300000024",
    "weekIndex": 0,
    "templateWeekNo": 19,
    "targetVolumeKm": 12,
    "isRecoveryWeek": false,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-010500000106",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "blockId": "00000000-0000-4000-8002-002300000024",
    "weekIndex": 1,
    "templateWeekNo": 20,
    "targetVolumeKm": 9,
    "isRecoveryWeek": true,
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000000000001",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000000000001",
    "weekIndex": 0,
    "templateWeekNo": 1,
    "targetVolumeKm": 27,
    "isRecoveryWeek": false,
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000100000002",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000000000001",
    "weekIndex": 1,
    "templateWeekNo": 2,
    "targetVolumeKm": 29,
    "isRecoveryWeek": false,
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000200000003",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000000000001",
    "weekIndex": 2,
    "templateWeekNo": 3,
    "targetVolumeKm": 30,
    "isRecoveryWeek": false,
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000300000004",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000000000001",
    "weekIndex": 3,
    "templateWeekNo": 4,
    "targetVolumeKm": 20,
    "isRecoveryWeek": true,
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000400000005",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000000000001",
    "weekIndex": 4,
    "templateWeekNo": 5,
    "targetVolumeKm": 32,
    "isRecoveryWeek": false,
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000500000006",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000000000001",
    "weekIndex": 5,
    "templateWeekNo": 6,
    "targetVolumeKm": 34,
    "isRecoveryWeek": false,
    "focus": "Build the habit before building the volume.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000600000007",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000100000002",
    "weekIndex": 0,
    "templateWeekNo": 7,
    "targetVolumeKm": 32,
    "isRecoveryWeek": false,
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000700000008",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000100000002",
    "weekIndex": 1,
    "templateWeekNo": 8,
    "targetVolumeKm": 23,
    "isRecoveryWeek": true,
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000800000009",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000100000002",
    "weekIndex": 2,
    "templateWeekNo": 9,
    "targetVolumeKm": 35,
    "isRecoveryWeek": false,
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-000900000010",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000100000002",
    "weekIndex": 3,
    "templateWeekNo": 10,
    "targetVolumeKm": 36,
    "isRecoveryWeek": false,
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001000000011",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000100000002",
    "weekIndex": 4,
    "templateWeekNo": 11,
    "targetVolumeKm": 38,
    "isRecoveryWeek": false,
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  },
  {
    "id": "00000000-0000-4000-8003-001100000012",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "blockId": "00000000-0000-4000-8002-000100000002",
    "weekIndex": 5,
    "templateWeekNo": 12,
    "targetVolumeKm": 23,
    "isRecoveryWeek": true,
    "focus": "One session with some quality in it. Everything else stays easy.",
    "createdAt": "2026-08-26T13:22:35.362Z"
  }
] as unknown as ProgramTemplateWeek[];

export const DEMO_TEMPLATE_SLOTS: ProgramTemplateSlot[] = [
  {
    "id": "00000000-0000-4000-8004-000000000001",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000000000001",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-000100000002",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000000000001",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-000200000003",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000000000001",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-000300000004",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000000000001",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-000400000005",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000000000001",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-000500000006",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000000000001",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-000600000007",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000100000002",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-000700000008",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000100000002",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-000800000009",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000100000002",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-000900000010",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000100000002",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-001000000011",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000100000002",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-001100000012",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000100000002",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-001200000013",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000200000003",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-001300000014",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000200000003",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-001400000015",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000200000003",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-001500000016",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000200000003",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-001600000017",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000200000003",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-001700000018",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000200000003",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-001800000019",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000300000004",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-001900000020",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000300000004",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-002000000021",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000300000004",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-002100000022",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000300000004",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-002200000023",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000300000004",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-002300000024",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000300000004",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-002400000025",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000400000005",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-002500000026",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000400000005",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-002600000027",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000400000005",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-002700000028",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000400000005",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-002800000029",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000400000005",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-002900000030",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000400000005",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-003000000031",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000500000006",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-003100000032",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000500000006",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-003200000033",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000500000006",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-003300000034",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000500000006",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-003400000035",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000500000006",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-003500000036",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000500000006",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-003600000037",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000600000007",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-003700000038",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-000600000007",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-003800000039",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000600000007",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-003900000040",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000600000007",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-004000000041",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000600000007",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-004100000042",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000600000007",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-004200000043",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000700000008",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-004300000044",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-000700000008",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-004400000045",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000700000008",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-004500000046",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000700000008",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-004600000047",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000700000008",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-004700000048",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000700000008",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-004800000049",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000800000009",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-004900000050",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-000800000009",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-005000000051",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000800000009",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-005100000052",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000800000009",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-005200000053",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000800000009",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-005300000054",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000800000009",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-005400000055",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000900000010",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-005500000056",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-000900000010",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-005600000057",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000900000010",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-005700000058",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-000900000010",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-005800000059",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-000900000010",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-005900000060",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-000900000010",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16.5
  },
  {
    "id": "00000000-0000-4000-8004-006000000061",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-001000000011",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-006100000062",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-001000000011",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-006200000063",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001000000011",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-006300000064",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-001000000011",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-006400000065",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001000000011",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-006500000066",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001000000011",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-006600000067",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 1,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-001100000012",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-006700000068",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-001100000012",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-006800000069",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001100000012",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-006900000070",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-001100000012",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-007000000071",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001100000012",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-007100000072",
    "programTemplateId": "00000000-0000-4000-8001-000000000007",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001100000012",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-007200000073",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001200000013",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-007300000074",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-001200000013",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-007400000075",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001200000013",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-007500000076",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001200000013",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-007600000077",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001200000013",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-007700000078",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001300000014",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-007800000079",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-001300000014",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-007900000080",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001300000014",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-008000000081",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001300000014",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-008100000082",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001300000014",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-008200000083",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001400000015",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-008300000084",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-001400000015",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-008400000085",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001400000015",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-008500000086",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001400000015",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-008600000087",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001400000015",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-008700000088",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001500000016",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-008800000089",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000007",
    "templateWeekId": "00000000-0000-4000-8003-001500000016",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-008900000090",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-001500000016",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-009000000091",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-001500000016",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-009100000092",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-001500000016",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-009200000093",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001500000016",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-009300000094",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001600000017",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-009400000095",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000007",
    "templateWeekId": "00000000-0000-4000-8003-001600000017",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12.5
  },
  {
    "id": "00000000-0000-4000-8004-009500000096",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-001600000017",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-009600000097",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-001600000017",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-009700000098",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-001600000017",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-009800000099",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001600000017",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-009900000100",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001700000018",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-010000000101",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000007",
    "templateWeekId": "00000000-0000-4000-8003-001700000018",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-010100000102",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-001700000018",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-010200000103",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-001700000018",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-010300000104",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-001700000018",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-010400000105",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001700000018",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-010500000106",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001800000019",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-010600000107",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000007",
    "templateWeekId": "00000000-0000-4000-8003-001800000019",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-010700000108",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-001800000019",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-010800000109",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-001800000019",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-010900000110",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-001800000019",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-011000000111",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-001800000019",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15
  },
  {
    "id": "00000000-0000-4000-8004-011100000112",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-001900000020",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-011200000113",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-001900000020",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5
  },
  {
    "id": "00000000-0000-4000-8004-011300000114",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-001900000020",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-011400000115",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 6,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-001900000020",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-011500000116",
    "programTemplateId": "00000000-0000-4000-8001-000000000001",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-001900000020",
    "isRest": false,
    "isOptional": false,
    "label": "Race — 5K",
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-011600000117",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002000000021",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-011700000118",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002000000021",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-011800000119",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002000000021",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-011900000120",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002000000021",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-012000000121",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002000000021",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-012100000122",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002100000022",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-012200000123",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002100000022",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-012300000124",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002100000022",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-012400000125",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002100000022",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-012500000126",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002100000022",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-012600000127",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002200000023",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-012700000128",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002200000023",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-012800000129",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002200000023",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-012900000130",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002200000023",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-013000000131",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002200000023",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-013100000132",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002300000024",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-013200000133",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002300000024",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-013300000134",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002300000024",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-013400000135",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002300000024",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-013500000136",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002300000024",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-013600000137",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002400000025",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-013700000138",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002400000025",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-013800000139",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-002400000025",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-013900000140",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-002400000025",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-014000000141",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-002400000025",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-014100000142",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002400000025",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16.5
  },
  {
    "id": "00000000-0000-4000-8004-014200000143",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002500000026",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-014300000144",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002500000026",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13.5
  },
  {
    "id": "00000000-0000-4000-8004-014400000145",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-002500000026",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-014500000146",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-002500000026",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-014600000147",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-002500000026",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-014700000148",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002500000026",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17.5
  },
  {
    "id": "00000000-0000-4000-8004-014800000149",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002600000027",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-014900000150",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002600000027",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-015000000151",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-002600000027",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-015100000152",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-002600000027",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-015200000153",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-002600000027",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-015300000154",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002600000027",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 18
  },
  {
    "id": "00000000-0000-4000-8004-015400000155",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002700000028",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-015500000156",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-002700000028",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-015600000157",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-002700000028",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-015700000158",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-002700000028",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-015800000159",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-002700000028",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-015900000160",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002700000028",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-016000000161",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002800000029",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-016100000162",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-002800000029",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-016200000163",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-002800000029",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-016300000164",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-002800000029",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-016400000165",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002800000029",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-016500000166",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-002900000030",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-016600000167",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-002900000030",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-016700000168",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-002900000030",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-016800000169",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-002900000030",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-016900000170",
    "programTemplateId": "00000000-0000-4000-8001-000000000002",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-002900000030",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-017000000171",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003000000031",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-017100000172",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003000000031",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-017200000173",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003000000031",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-017300000174",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003000000031",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-017400000175",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003000000031",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-017500000176",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003100000032",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-017600000177",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003100000032",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-017700000178",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003100000032",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-017800000179",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003100000032",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-017900000180",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003100000032",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15
  },
  {
    "id": "00000000-0000-4000-8004-018000000181",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003200000033",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-018100000182",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003200000033",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-018200000183",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003200000033",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-018300000184",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003200000033",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-018400000185",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003200000033",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-018500000186",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003300000034",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-018600000187",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003300000034",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-018700000188",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003300000034",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7.5
  },
  {
    "id": "00000000-0000-4000-8004-018800000189",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003300000034",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-018900000190",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003300000034",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-019000000191",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003400000035",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-019100000192",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003400000035",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-019200000193",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003400000035",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12.5
  },
  {
    "id": "00000000-0000-4000-8004-019300000194",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003400000035",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-019400000195",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003400000035",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-019500000196",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003500000036",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-019600000197",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003500000036",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-019700000198",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003500000036",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-019800000199",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003500000036",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-019900000200",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003500000036",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-020000000201",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003500000036",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 18.5
  },
  {
    "id": "00000000-0000-4000-8004-020100000202",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003600000037",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-020200000203",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003600000037",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-020300000204",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003600000037",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13.5
  },
  {
    "id": "00000000-0000-4000-8004-020400000205",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003600000037",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-020500000206",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003600000037",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-020600000207",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003600000037",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 19.5
  },
  {
    "id": "00000000-0000-4000-8004-020700000208",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003700000038",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-020800000209",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003700000038",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-020900000210",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003700000038",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-021000000211",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003700000038",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-021100000212",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003700000038",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-021200000213",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003700000038",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13.5
  },
  {
    "id": "00000000-0000-4000-8004-021300000214",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003800000039",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-021400000215",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003800000039",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-021500000216",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003800000039",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15
  },
  {
    "id": "00000000-0000-4000-8004-021600000217",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003800000039",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-021700000218",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003800000039",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-021800000219",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003800000039",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 21.5
  },
  {
    "id": "00000000-0000-4000-8004-021900000220",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003900000040",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-022000000221",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-003900000040",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-022100000222",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-003900000040",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-022200000223",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003900000040",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-022300000224",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-003900000040",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-022400000225",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-003900000040",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 22.5
  },
  {
    "id": "00000000-0000-4000-8004-022500000226",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004000000041",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-022600000227",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-004000000041",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-022700000228",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-004000000041",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-022800000229",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004000000041",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-022900000230",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004000000041",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 21
  },
  {
    "id": "00000000-0000-4000-8004-023000000231",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004100000042",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-023100000232",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-004100000042",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-023200000233",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-004100000042",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-023300000234",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004100000042",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-023400000235",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004100000042",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15
  },
  {
    "id": "00000000-0000-4000-8004-023500000236",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004200000043",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-023600000237",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-004200000043",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-023700000238",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-004200000043",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-023800000239",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004200000043",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-023900000240",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004300000044",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-024000000241",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-004300000044",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-024100000242",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 6,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-004300000044",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-024200000243",
    "programTemplateId": "00000000-0000-4000-8001-000000000003",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004300000044",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-024300000244",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004400000045",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-024400000245",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004400000045",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-024500000246",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-004400000045",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-024600000247",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004400000045",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-024700000248",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004400000045",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-024800000249",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004400000045",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-024900000250",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004500000046",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-025000000251",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004500000046",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-025100000252",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-004500000046",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-025200000253",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004500000046",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-025300000254",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004500000046",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-025400000255",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004500000046",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-025500000256",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004600000047",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-025600000257",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004600000047",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-025700000258",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-004600000047",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-025800000259",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004600000047",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-025900000260",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004600000047",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-026000000261",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004600000047",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-026100000262",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004700000048",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-026200000263",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004700000048",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-026300000264",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-004700000048",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-026400000265",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004700000048",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-026500000266",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004700000048",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-026600000267",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004700000048",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-026700000268",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004800000049",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-026800000269",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004800000049",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-026900000270",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-004800000049",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13.5
  },
  {
    "id": "00000000-0000-4000-8004-027000000271",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004800000049",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-027100000272",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004800000049",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-027200000273",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004800000049",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 18.5
  },
  {
    "id": "00000000-0000-4000-8004-027300000274",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004900000050",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-027400000275",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004900000050",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-027500000276",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-004900000050",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-027600000277",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-004900000050",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7.5
  },
  {
    "id": "00000000-0000-4000-8004-027700000278",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-004900000050",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-027800000279",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-004900000050",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 19.5
  },
  {
    "id": "00000000-0000-4000-8004-027900000280",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005000000051",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-028000000281",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005000000051",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-028100000282",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-005000000051",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-028200000283",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005000000051",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-028300000284",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005000000051",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-028400000285",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005000000051",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 20
  },
  {
    "id": "00000000-0000-4000-8004-028500000286",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005100000052",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-028600000287",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005100000052",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-028700000288",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-005100000052",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-028800000289",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005100000052",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-028900000290",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005100000052",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-029000000291",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005100000052",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-029100000292",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005200000053",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-029200000293",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005200000053",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-029300000294",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-005200000053",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-029400000295",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005200000053",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-029500000296",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005200000053",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-029600000297",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005200000053",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 22
  },
  {
    "id": "00000000-0000-4000-8004-029700000298",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005300000054",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-029800000299",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005300000054",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-029900000300",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-005300000054",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15
  },
  {
    "id": "00000000-0000-4000-8004-030000000301",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005300000054",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-030100000302",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005300000054",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-030200000303",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005300000054",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 23
  },
  {
    "id": "00000000-0000-4000-8004-030300000304",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005400000055",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-030400000305",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005400000055",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-030500000306",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-005400000055",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-030600000307",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005400000055",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-030700000308",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005400000055",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-030800000309",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005400000055",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 24
  },
  {
    "id": "00000000-0000-4000-8004-030900000310",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005500000056",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-031000000311",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-005500000056",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-031100000312",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-005500000056",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-031200000313",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005500000056",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-031300000314",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005500000056",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-031400000315",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005500000056",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 25.5
  },
  {
    "id": "00000000-0000-4000-8004-031500000316",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005600000057",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-031600000317",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-005600000057",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-031700000318",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-005600000057",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-031800000319",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005600000057",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-031900000320",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005600000057",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-032000000321",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005600000057",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 26.5
  },
  {
    "id": "00000000-0000-4000-8004-032100000322",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005700000058",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-032200000323",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-005700000058",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-032300000324",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-005700000058",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17.5
  },
  {
    "id": "00000000-0000-4000-8004-032400000325",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005700000058",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-032500000326",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005700000058",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-032600000327",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005700000058",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 28
  },
  {
    "id": "00000000-0000-4000-8004-032700000328",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005800000059",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-032800000329",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-005800000059",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-032900000330",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-005800000059",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 18.5
  },
  {
    "id": "00000000-0000-4000-8004-033000000331",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005800000059",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-033100000332",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005800000059",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-033200000333",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005800000059",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 29
  },
  {
    "id": "00000000-0000-4000-8004-033300000334",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-005900000060",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-033400000335",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-005900000060",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-033500000336",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-005900000060",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-033600000337",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-005900000060",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-033700000338",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-005900000060",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-033800000339",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006000000061",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-033900000340",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-006000000061",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-034000000341",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-006000000061",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-034100000342",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-006000000061",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-034200000343",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006000000061",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-034300000344",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006100000062",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-034400000345",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-006100000062",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-034500000346",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-006100000062",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-034600000347",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-006100000062",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-034700000348",
    "programTemplateId": "00000000-0000-4000-8001-000000000004",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006100000062",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-034800000349",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006200000063",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-034900000350",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006200000063",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-035000000351",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006200000063",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-035100000352",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006200000063",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-035200000353",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006200000063",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-035300000354",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006300000064",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-035400000355",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006300000064",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-035500000356",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006300000064",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-035600000357",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006300000064",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-035700000358",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006300000064",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-035800000359",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006400000065",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-035900000360",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006400000065",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-036000000361",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006400000065",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-036100000362",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006400000065",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-036200000363",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006400000065",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-036300000364",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006500000066",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-036400000365",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006500000066",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-036500000366",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006500000066",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-036600000367",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006500000066",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-036700000368",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006500000066",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-036800000369",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006600000067",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-036900000370",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006600000067",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-037000000371",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006600000067",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-037100000372",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006600000067",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-037200000373",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006600000067",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-037300000374",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006700000068",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-037400000375",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006700000068",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-037500000376",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006700000068",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-037600000377",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006700000068",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16.5
  },
  {
    "id": "00000000-0000-4000-8004-037700000378",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006700000068",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-037800000379",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006800000069",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-037900000380",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006800000069",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-038000000381",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006800000069",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-038100000382",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006800000069",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-038200000383",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006800000069",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-038300000384",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-006900000070",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-038400000385",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-006900000070",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-038500000386",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-006900000070",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-038600000387",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006900000070",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-038700000388",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-006900000070",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-038800000389",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007000000071",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-038900000390",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007000000071",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-039000000391",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007000000071",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-039100000392",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007000000071",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-039200000393",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007000000071",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 20
  },
  {
    "id": "00000000-0000-4000-8004-039300000394",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007000000071",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-039400000395",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007100000072",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-039500000396",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007100000072",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-039600000397",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007100000072",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-039700000398",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007100000072",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-039800000399",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007100000072",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 21
  },
  {
    "id": "00000000-0000-4000-8004-039900000400",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007100000072",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-040000000401",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007200000073",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-040100000402",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007200000073",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-040200000403",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007200000073",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-040300000404",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007200000073",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-040400000405",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007200000073",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 22
  },
  {
    "id": "00000000-0000-4000-8004-040500000406",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007200000073",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-040600000407",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007300000074",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-040700000408",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007300000074",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-040800000409",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007300000074",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-040900000410",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007300000074",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-041000000411",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007300000074",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-041100000412",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007300000074",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-041200000413",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007400000075",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-041300000414",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007400000075",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-041400000415",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007400000075",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-041500000416",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007400000075",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-041600000417",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007400000075",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 24
  },
  {
    "id": "00000000-0000-4000-8004-041700000418",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007400000075",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 18.5
  },
  {
    "id": "00000000-0000-4000-8004-041800000419",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007500000076",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-041900000420",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007500000076",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-042000000421",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007500000076",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-042100000422",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007500000076",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7.5
  },
  {
    "id": "00000000-0000-4000-8004-042200000423",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007500000076",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 25
  },
  {
    "id": "00000000-0000-4000-8004-042300000424",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007500000076",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 19.5
  },
  {
    "id": "00000000-0000-4000-8004-042400000425",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007600000077",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-042500000426",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007600000077",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-042600000427",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007600000077",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-042700000428",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007600000077",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-042800000429",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007600000077",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 25.5
  },
  {
    "id": "00000000-0000-4000-8004-042900000430",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007600000077",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 20
  },
  {
    "id": "00000000-0000-4000-8004-043000000431",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007700000078",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-043100000432",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000005",
    "templateWeekId": "00000000-0000-4000-8003-007700000078",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-043200000433",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007700000078",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-043300000434",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-007700000078",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-043400000435",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007700000078",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-043500000436",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007700000078",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-043600000437",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007800000079",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-043700000438",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-007800000079",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-043800000439",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007800000079",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-043900000440",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007800000079",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 28.5
  },
  {
    "id": "00000000-0000-4000-8004-044000000441",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007800000079",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-044100000442",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-007900000080",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-044200000443",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-007900000080",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-044300000444",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-007900000080",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-044400000445",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007900000080",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 30
  },
  {
    "id": "00000000-0000-4000-8004-044500000446",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-007900000080",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 14
  },
  {
    "id": "00000000-0000-4000-8004-044600000447",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008000000081",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-044700000448",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-008000000081",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-044800000449",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-008000000081",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-044900000450",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008000000081",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 31.5
  },
  {
    "id": "00000000-0000-4000-8004-045000000451",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008000000081",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-045100000452",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008100000082",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-045200000453",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-008100000082",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-045300000454",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-008100000082",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-045400000455",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008100000082",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 20.5
  },
  {
    "id": "00000000-0000-4000-8004-045500000456",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008100000082",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-045600000457",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008200000083",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-045700000458",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-008200000083",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-045800000459",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-008200000083",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-045900000460",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008200000083",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 34.5
  },
  {
    "id": "00000000-0000-4000-8004-046000000461",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008200000083",
    "isRest": false,
    "isOptional": false,
    "label": "Back-to-Back Long Run",
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-046100000462",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008300000084",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-046200000463",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-008300000084",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-046300000464",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-008300000084",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-046400000465",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-008300000084",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-046500000466",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008300000084",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7.5
  },
  {
    "id": "00000000-0000-4000-8004-046600000467",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008400000085",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-046700000468",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-008400000085",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-046800000469",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-008400000085",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-046900000470",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-008400000085",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-047000000471",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008400000085",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-047100000472",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008500000086",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4
  },
  {
    "id": "00000000-0000-4000-8004-047200000473",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000008",
    "templateWeekId": "00000000-0000-4000-8003-008500000086",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4
  },
  {
    "id": "00000000-0000-4000-8004-047300000474",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-008500000086",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-047400000475",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-008500000086",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-047500000476",
    "programTemplateId": "00000000-0000-4000-8001-000000000005",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008500000086",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-047600000477",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-047700000478",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-047800000479",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-047900000480",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-048000000481",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-048100000482",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-048200000483",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008600000087",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-048300000484",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-048400000485",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-048500000486",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-048600000487",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-048700000488",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-048800000489",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-048900000490",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008700000088",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12.5
  },
  {
    "id": "00000000-0000-4000-8004-049000000491",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-049100000492",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-049200000493",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9
  },
  {
    "id": "00000000-0000-4000-8004-049300000494",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-049400000495",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-049500000496",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-049600000497",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008800000089",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13.5
  },
  {
    "id": "00000000-0000-4000-8004-049700000498",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-049800000499",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-049900000500",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-050000000501",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-050100000502",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-050200000503",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-050300000504",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-008900000090",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-050400000505",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-050500000506",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-050600000507",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 9.5
  },
  {
    "id": "00000000-0000-4000-8004-050700000508",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-050800000509",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-050900000510",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-051000000511",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009000000091",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 14.5
  },
  {
    "id": "00000000-0000-4000-8004-051100000512",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-051200000513",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-051300000514",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10
  },
  {
    "id": "00000000-0000-4000-8004-051400000515",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-051500000516",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-051600000517",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-051700000518",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009100000092",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15
  },
  {
    "id": "00000000-0000-4000-8004-051800000519",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-051900000520",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-052000000521",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-052100000522",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-052200000523",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-052300000524",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-052400000525",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009200000093",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-052500000526",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-052600000527",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-052700000528",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-052800000529",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-052900000530",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-053000000531",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false,
    "label": "Long Ride"
  },
  {
    "id": "00000000-0000-4000-8004-053100000532",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009300000094",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8.5
  },
  {
    "id": "00000000-0000-4000-8004-053200000533",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-053300000534",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 10.5
  },
  {
    "id": "00000000-0000-4000-8004-053400000535",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-053500000536",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-053600000537",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-053700000538",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-053800000539",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009400000095",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 15.5
  },
  {
    "id": "00000000-0000-4000-8004-053900000540",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-054000000541",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-054100000542",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-054200000543",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-054300000544",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-054400000545",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-054500000546",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009500000096",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 16
  },
  {
    "id": "00000000-0000-4000-8004-054600000547",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-054700000548",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11.5
  },
  {
    "id": "00000000-0000-4000-8004-054800000549",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-054900000550",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-055000000551",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6.5
  },
  {
    "id": "00000000-0000-4000-8004-055100000552",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-055200000553",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009600000097",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17
  },
  {
    "id": "00000000-0000-4000-8004-055300000554",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-055400000555",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7.5
  },
  {
    "id": "00000000-0000-4000-8004-055500000556",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-055600000557",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-055700000558",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  },
  {
    "id": "00000000-0000-4000-8004-055800000559",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-055900000560",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009700000098",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-056000000561",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-056100000562",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12.5
  },
  {
    "id": "00000000-0000-4000-8004-056200000563",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-056300000564",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-056400000565",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7
  },
  {
    "id": "00000000-0000-4000-8004-056500000566",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-056600000567",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009800000099",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 18.5
  },
  {
    "id": "00000000-0000-4000-8004-056700000568",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-056800000569",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13
  },
  {
    "id": "00000000-0000-4000-8004-056900000570",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-057000000571",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-057100000572",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 7.5
  },
  {
    "id": "00000000-0000-4000-8004-057200000573",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-057300000574",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-009900000100",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 19.5
  },
  {
    "id": "00000000-0000-4000-8004-057400000575",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-057500000576",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 13.5
  },
  {
    "id": "00000000-0000-4000-8004-057600000577",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000006",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-057700000578",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-057800000579",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 8
  },
  {
    "id": "00000000-0000-4000-8004-057900000580",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-058000000581",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-010000000101",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 20
  },
  {
    "id": "00000000-0000-4000-8004-058100000582",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010100000102",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-058200000583",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-010100000102",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 11
  },
  {
    "id": "00000000-0000-4000-8004-058300000584",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-010100000102",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-058400000585",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010100000102",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-058500000586",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-010100000102",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-058600000587",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-010100000102",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 17.5
  },
  {
    "id": "00000000-0000-4000-8004-058700000588",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010200000103",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-058800000589",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-010200000103",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12
  },
  {
    "id": "00000000-0000-4000-8004-058900000590",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-010200000103",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059000000591",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010200000103",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059100000592",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-010200000103",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059200000593",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-010200000103",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 18.5
  },
  {
    "id": "00000000-0000-4000-8004-059300000594",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010300000104",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059400000595",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000009",
    "templateWeekId": "00000000-0000-4000-8003-010300000104",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 12.5
  },
  {
    "id": "00000000-0000-4000-8004-059500000596",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 3,
    "slot": 1,
    "strengthTemplateId": "00000000-0000-4000-8002-000000000004",
    "templateWeekId": "00000000-0000-4000-8003-010300000104",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059600000597",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010300000104",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059700000598",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-010300000104",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-059800000599",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000003",
    "templateWeekId": "00000000-0000-4000-8003-010300000104",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 19.5
  },
  {
    "id": "00000000-0000-4000-8004-059900000600",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010400000105",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060000000601",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-010400000105",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 5.5
  },
  {
    "id": "00000000-0000-4000-8004-060100000602",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-010400000105",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060200000603",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-010400000105",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060300000604",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-010400000105",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060400000605",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-010400000105",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 6
  },
  {
    "id": "00000000-0000-4000-8004-060500000606",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 1,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000012",
    "templateWeekId": "00000000-0000-4000-8003-010500000106",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060600000607",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 2,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000001",
    "templateWeekId": "00000000-0000-4000-8003-010500000106",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4
  },
  {
    "id": "00000000-0000-4000-8004-060700000608",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 4,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000011",
    "templateWeekId": "00000000-0000-4000-8003-010500000106",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060800000609",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 5,
    "slot": 0,
    "templateWeekId": "00000000-0000-4000-8003-010500000106",
    "isRest": true,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-060900000610",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 6,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000010",
    "templateWeekId": "00000000-0000-4000-8003-010500000106",
    "isRest": false,
    "isOptional": false
  },
  {
    "id": "00000000-0000-4000-8004-061000000611",
    "programTemplateId": "00000000-0000-4000-8001-000000000006",
    "weekday": 7,
    "slot": 0,
    "workoutTemplateId": "00000000-0000-4000-8000-000000000002",
    "templateWeekId": "00000000-0000-4000-8003-010500000106",
    "isRest": false,
    "isOptional": false,
    "distanceKm": 4.5
  }
] as unknown as ProgramTemplateSlot[];
