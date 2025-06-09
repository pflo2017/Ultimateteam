# Ultimate Team

A React Native mobile application for managing sports teams, built with Expo and Supabase.

## Features

- Multi-user authentication system (Administrators, Coaches, Parents)
- Club management system
- Profile management with image upload capabilities
- Modern UI with smooth animations
- TypeScript support for better development experience

## Tech Stack

- React Native
- Expo
- Supabase (Authentication & Database)
- TypeScript
- React Navigation
- React Native Paper
- React Native Reanimated

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pflo2017/Ultimateteam.git
cd Ultimateteam
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory and add your Supabase configuration:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npx expo start
```

### Important: App Entry Point

This application uses a custom entry point configuration. The main entry point is `AppEntry.js` in the root directory, not the default `index.js`. This is configured in both `app.json` and `app.config.js`. If you encounter startup issues, please check that these files are properly configured.

For more details, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).

### Quick Recovery Scripts

The project includes two utility scripts to help you recover from common issues:

1. **Restore Working App State**:
   If you encounter persistent issues, you can restore the app to a known working state:
   ```bash
   # Make the script executable if needed
   chmod +x restore_working_app.sh
   
   # Run the restoration script
   ./restore_working_app.sh
   ```
   This script will:
   - Restore all application files from a verified working backup
   - Preserve your current state as a backup
   - Reinstall all dependencies
   - Set up the correct configuration

2. **Reinstall Dependencies**:
   If you're experiencing dependency-related issues:
   ```bash
   # Make the script executable if needed
   chmod +x reinstall_dependencies.sh
   
   # Run the reinstallation script
   ./reinstall_dependencies.sh
   ```
   This script will:
   - Remove node_modules directory
   - Clear package lock files
   - Clean npm cache
   - Reinstall all dependencies

## Troubleshooting

If you encounter any issues running the application, please refer to the [Troubleshooting Guide](./TROUBLESHOOTING.md) which covers common problems and their solutions, including:

- App entry point configuration issues
- Supabase connection errors
- Node.js polyfill problems with Supabase
- TypeScript JSX errors
- Crypto-related errors in the Hermes engine
- Instructions for reinstalling dependencies

## Development Status

The project is currently in active development. Completed features include:
- Administrator registration and login
- Club logo upload functionality
- Basic navigation setup
- UI components and styling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Payment Status System

The application uses a centralized payment status system to ensure consistency across all views.

### Payment Status Types

- `paid`: Player has paid for the current period
- `unpaid`: Player has not paid for the current period
- `pending`: Payment is pending
- `on_trial`: Player is on trial period
- `trial_ended`: Player's trial period has ended
- `select_status`: Default status for new players

### Implementation Details

- Central source of truth in `player_payment_status` table
- Historical records in `player_payment_status_history` table
- Automatic synchronization with legacy tables (`players` and `monthly_payments`)
- Real-time updates across all app views

### Usage

Use the `paymentStatusService.ts` functions to interact with payment statuses:

```typescript
import { 
  getPlayerPaymentStatus, 
  updatePlayerPaymentStatus,
  getPaymentStatusText,
  getPaymentStatusColor
} from '../services/paymentStatusService';

// Get a player's status
const status = await getPlayerPaymentStatus(playerId);

// Update a player's status
await updatePlayerPaymentStatus(playerId, 'paid', 'admin');

// Format status for display
const displayText = getPaymentStatusText(status);
```

This ensures all payment status changes are properly tracked and synchronized across the application. 