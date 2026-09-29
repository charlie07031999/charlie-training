# Apple Health / HealthKit bridge

The current production client is a Next.js PWA. Safari/PWA code cannot directly access the iPhone HealthKit store, so the Health integration must live in a native iOS target.

## Prepared scope

`HealthKitManager.swift` requests permission for:

- Sleep analysis — read + write
- Body mass — read + write
- Heart rate — read
- Active energy — read + write
- Step count — read
- Workouts — read + write

The intended flow is:

1. Native iPhone app requests HealthKit permissions.
2. HealthKit data is normalized to the same model used by Supabase.
3. New HealthKit samples are sent to Supabase.
4. Charlie Training workout/sleep/weight records that originated in the app can be written back to HealthKit.
5. Each synchronized record should store its origin/source identifier to prevent sync loops.

## iOS target configuration

Enable the HealthKit capability in Xcode and add:

- `NSHealthShareUsageDescription`
- `NSHealthUpdateUsageDescription`

Suggested copy:

- Read: “Charlie utilise tes données Santé pour adapter sommeil, récupération et entraînement.”
- Write: “Charlie enregistre dans Santé les entraînements, le sommeil et le poids que tu ajoutes dans l’app.”

Do not upload HealthKit data unless the user has explicitly authorized the relevant data type.
