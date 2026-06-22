# FlekxiTask Flutter Android App

A Flutter Android application for the FlekxiTask Job Marketplace, mirroring all features of the web frontend.

## Features

| Feature | Screen |
|---|---|
| Email & Google Sign-In | `LoginScreen` |
| Registration | `RegisterScreen` |
| Forgot / Reset Password | `ForgotPasswordScreen` |
| Browse Tasks with Filters | `HomeScreen` + `FilterBottomSheet` |
| Task Detail + One-Tap Apply | `TaskDetailScreen` |
| Task Tracking (250ms timer, pause, checkout with photo) | `TaskTrackingScreen` |
| My Applications (check-in from accepted) | `MyApplicationsScreen` |
| Messages & Conversations | `MessagesScreen` + `ConversationScreen` |
| Wallet (balance, transactions, withdrawals) | `WalletScreen` |
| Bank Account Management | bottom sheet inside `WalletScreen` |
| Profile Edit + Photo Upload | `ProfileScreen` |
| Session History | `HistoryScreen` |

## Project Structure

```
lib/
├── main.dart                     # Entry point, providers setup
├── config/
│   ├── app_config.dart           # API base URL
│   ├── theme.dart                # Material 3 theme
│   └── router.dart               # GoRouter (auth guards)
├── core/
│   ├── api_client.dart           # Dio + token refresh interceptor
│   └── secure_storage.dart       # flutter_secure_storage wrapper
├── models/                       # Plain Dart models (fromJson)
├── services/                     # API calls (auth, task, wallet, message)
├── providers/                    # ChangeNotifier providers (state)
├── screens/
│   ├── auth/                     # login, register, forgot password
│   ├── home/                     # home screen
│   ├── tasks/                    # task detail, task tracking
│   ├── applications/             # my applications
│   ├── messages/                 # conversations + chat
│   ├── wallet/                   # wallet overview + sheets
│   ├── profile/                  # profile editor
│   ├── history/                  # session history
│   └── main_shell.dart           # Bottom navigation shell
└── widgets/                      # Shared widgets (TaskCard, FilterBottomSheet)
```

## Setup

### 1. Firebase / Google Sign-In

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an Android app with package `com.flekxitask.app`
3. Download `google-services.json` and replace `android/app/google-services.json`
4. Enable **Google Sign-In** and **Email/Password** in Firebase Auth

### 2. API URL

Edit `lib/config/app_config.dart`:

```dart
// For emulator (localhost):
const String kApiBaseUrl = 'http://10.0.2.2:8000/api/v1';

// For production:
const String kApiBaseUrl = 'https://api.yourdomain.com/api/v1';
```

### 3. Install & Run

```bash
cd frontend/flutter
flutter pub get
flutter run
```

### 4. Build Release APK

```bash
flutter build apk --release
```

## Dependencies

- `dio` — HTTP client with interceptors
- `provider` — State management
- `go_router` — Declarative navigation with auth guards
- `flutter_secure_storage` — Encrypted token storage
- `google_sign_in` + `firebase_auth` — Google OAuth
- `image_picker` — Camera/gallery for proof photos
- `cached_network_image` — Efficient image loading

## Notes

- Timer logic in `TaskTrackingScreen` mirrors the web 250ms polling approach
- Token refresh is handled automatically in `ApiClient` (same as web axios interceptor)
- All Malaysian banks are supported for withdrawal bank account setup
