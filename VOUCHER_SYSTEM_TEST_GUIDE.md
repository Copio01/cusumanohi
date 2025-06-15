# Voucher System Test Guide

## Overview
The Construction 21 voucher system allows administrators to generate chip vouchers that players can redeem in both single-player and multiplayer games.

## System Components

### 1. Admin Panel (admin.html)
- **Location**: http://localhost:8000/admin.html
- **Features**:
  - Generate unique voucher codes (format: CHI-XXX-XXXXXX)
  - Set custom chip amounts (1-10000)
  - Set expiration dates
  - View all generated vouchers with status
  - Real-time voucher list updates

### 2. Single-Player Game (construction21.html)
- **Location**: http://localhost:8000/construction21.html
- **Features**:
  - Voucher redemption interface
  - Integration with single-player chip system (collection: 'construction21_users')
  - Real-time chip balance updates

### 3. Multiplayer Game (Multiplayer21.html)
- **Location**: http://localhost:8000/Multiplayer21.html
- **Features**:
  - Voucher redemption interface
  - Integration with multiplayer chip system (collection: 'users')
  - Real-time chip balance updates and broadcasting

## Testing Workflow

### Phase 1: Admin Voucher Generation
1. Open admin panel: http://localhost:8000/admin.html
2. Navigate to "Voucher Management" section
3. Enter chip amount (e.g., 100)
4. Set expiration date (future date)
5. Click "Generate Voucher"
6. Verify unique code is generated (format: CHI-XXX-XXXXXX)
7. Verify voucher appears in the voucher list with "Active" status

### Phase 2: Single-Player Voucher Redemption
1. Open single-player game: http://localhost:8000/construction21.html
2. Log in with a test account
3. Note current chip balance
4. Scroll to "🎫 Redeem Voucher" section
5. Enter the voucher code from admin panel
6. Click "Redeem" button
7. Verify success message appears
8. Verify chip balance increases by voucher amount
9. Try to redeem the same voucher again (should fail - "already redeemed")

### Phase 3: Multiplayer Voucher Redemption
1. Open multiplayer game: http://localhost:8000/Multiplayer21.html
2. Log in with a different test account
3. Note current chip balance
4. Scroll to "🎫 Redeem Voucher" section
5. Generate a new voucher in admin panel
6. Enter the new voucher code
7. Click "Redeem" button
8. Verify success message appears
9. Verify chip balance increases by voucher amount

### Phase 4: Validation Testing
1. **Invalid Code Test**:
   - Enter random code (e.g., "INVALID")
   - Verify error: "Invalid voucher code"

2. **Expired Voucher Test**:
   - Generate voucher with past expiration date
   - Try to redeem
   - Verify error: "This voucher has expired"

3. **Double Redemption Test**:
   - Use already redeemed voucher
   - Verify error: "This voucher has already been redeemed"

4. **Cross-Platform Test**:
   - Generate voucher in admin
   - Redeem in single-player game
   - Verify voucher status updates in admin panel
   - Try to redeem same voucher in multiplayer (should fail)

## Expected Behaviors

### Voucher Code Format
- Pattern: CHI-XXX-XXXXXX
- Auto-formatting as user types
- Case insensitive input (converts to uppercase)

### Security Features
- Atomic transactions prevent double redemption
- One-time use codes
- Expiration date validation
- User authentication required

### UI Feedback
- Loading spinner during redemption
- Success messages with celebration emoji
- Clear error messages for failed redemptions
- Auto-hide success messages after 5 seconds

### Database Updates
- Voucher marked as redeemed with timestamp and user ID
- User chip balance updated atomically
- Real-time UI updates in all connected clients

## Troubleshooting

### Common Issues
1. **Firebase Connection**: Ensure Firebase config is properly set up
2. **User Authentication**: Must be logged in to redeem vouchers
3. **Network Issues**: Check browser console for Firebase errors
4. **Expired Vouchers**: Check expiration dates in admin panel

### Browser Console Debugging
- Check for JavaScript errors
- Monitor Firebase transaction logs
- Verify network requests to Firestore

## File Locations
- Admin Panel: `admin.html`
- Single-Player Game: `construction21.html`
- Multiplayer Game: `Multiplayer21.html`
- Test Server: `python -m http.server 8000`

## Database Collections
- Vouchers: `chipVouchers`
- Single-Player Users: `construction21_users`
- Multiplayer Users: `users`
