# Feedback System Setup

## Overview
A complete feedback system that allows users to submit feedback, bug reports, feature requests, and improvement suggestions.

## Components Created

### 1. Feedback Dialog Component
**Location:** `components/app/feedback-dialog.tsx`

Features:
- Clean form with feedback type selector
- Textarea for user messages
- Toast notifications for success/error states
- Automatic user ID tracking
- Form validation

### 2. Database Schema
**Location:** `supabase-feedback-setup.sql`

To set up the database table:
```bash
# Run this SQL file in your Supabase SQL Editor
psql -h your-db-host -U postgres -d postgres < supabase-feedback-setup.sql
```

Or copy and paste the SQL into your Supabase dashboard SQL editor.

**Table Structure:**
- `id` - UUID primary key
- `user_id` - References auth.users (nullable for anonymous feedback)
- `feedback_type` - enum: 'general', 'bug', 'feature', 'improvement'
- `message` - The feedback text
- `status` - enum: 'pending', 'reviewed', 'in_progress', 'resolved', 'closed'
- `admin_notes` - For internal team notes
- `created_at` - Timestamp
- `updated_at` - Timestamp (auto-updated)

**Security:**
- Row Level Security (RLS) enabled
- Users can insert their own feedback
- Users can view only their own feedback
- Admin policies commented out (customize based on your admin system)

### 3. Header Integration
**Location:** `components/app/header.tsx`

Added:
- "Send Feedback" button in user profile dropdown
- Dialog state management
- Feedback dialog component integration

## Usage

### For Users
1. Click the user menu icon in the header
2. Select "Send Feedback"
3. Choose feedback type
4. Enter message
5. Submit

### For Admins (Future)
To view and manage feedback, you can:
1. Query the `feedback` table in Supabase
2. Build an admin dashboard to view/filter feedback by status
3. Update feedback status and add admin notes

Example query to view all feedback:
```sql
SELECT 
  f.*,
  p.email as user_email
FROM feedback f
LEFT JOIN profiles p ON f.user_id = p.id
ORDER BY f.created_at DESC;
```

## Customization

### Adding New Feedback Types
Update both:
1. `feedback-dialog.tsx` - Add new SelectItem
2. `supabase-feedback-setup.sql` - Add to CHECK constraint

### Admin Access
Uncomment and customize the admin policies in `supabase-feedback-setup.sql` based on your admin role system.

### Styling
All components use your existing shadcn/ui design system and will automatically match your theme.
