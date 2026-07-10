# Engagement Metrics Feature Guide

## Overview
The upload control panel now displays **real-time engagement metrics** for all content, including likes, comments, views, and shares. Admins can view detailed engagement information for each piece of content.

---

## Features

### 1. Engagement Metrics Display
Each content item in the vault/flash settings now shows:
- **Likes** (❤️ red icon) - Number of likes received
- **Comments** (💬 blue icon) - Number of comments
- **Views** (👁️ cyan icon) - Total content views
- **Shares** (🔗 yellow icon) - Times shared

**Location:** Below the media preview in each content card

### 2. Engagement Details Popup
Click any engagement metric (likes, comments, views, or shares) to open a detailed popup showing:
- **Color-coded metric cards** for each engagement type
- **Metric descriptions** (e.g., "from active viewers")
- **Content status** indicator
- **Sync status** information

#### Before Approval
- Metrics show `0` counts
- Status displays "Pending Approval"
- Metrics will activate after approval

#### After Approval
- Real engagement counts display
- Status shows "Active on Home Feed"
- Metrics sync in real-time from the home feed

---

## Implementation Details

### Component Changes
**File:** `UploadControlClient.tsx`

#### New State
```typescript
const [engagementDetailsId, setEngagementDetailsId] = useState<string | null>(null);
```

#### Engagement Metrics Box (Below Media Preview)
- Displays 4 metric buttons: likes, comments, views, shares
- Each button is clickable and opens the details popup
- Shows current count for each metric

#### Engagement Details Modal
- Shows all 4 metrics in colored cards
- Color scheme:
  - **Red** for Likes
  - **Blue** for Comments
  - **Cyan** for Views
  - **Yellow** for Shares
- Shows sync status and next steps
- Auto-closes when user clicks outside or "Close" button

### API Integration
The feature uses existing endpoints:
- `/api/admin/customization/upload-contents` - Fetch contents with engagement data
- `/googer-api/upload-content/{id}/likes` - Fetch like details
- `/googer-api/upload-content/{id}/comments` - Fetch comment details
- `/googer-api/upload-content/{id}/shares` - Fetch share details

Data flows automatically from `chat_presence`, likes, comments, and shares tables to the admin panel.

---

## Content Approval & Sync Flow

```
Upload → Pending Review → Admin Approves
                               ↓
                          updateUploadContentStatus()
                               ↓
                          Content goes live on home feed
                               ↓
                          Engagement metrics start tracking
                               ↓
                          Admin panel refreshes data
                               ↓
                          Real-time sync to both sides
```

### What Happens When Content is Approved:
1. Admin clicks "Approve" button
2. Content status changes to "Approved"
3. Content becomes visible on home feed
4. Engagement tracking begins (likes, comments, views, shares)
5. Metrics display updates in real-time
6. Both admin panel and home feed stay synchronized

---

## User Experience Flow

### Viewing Engagement Metrics:
1. Navigate to Admin → Vault & Flash Content → Upload Control
2. Find the content in the table
3. **See metrics** at the bottom of each content card (4 colored buttons)
4. **Click any metric button** to open detailed popup
5. **View breakdown** of likes, comments, views, and shares
6. **See status** indicating if content is active or pending
7. **Close popup** by clicking outside or the "Close" button

### Approving Content:
1. Find pending content
2. Click **"Approve"** button (green)
3. System confirms: "Upload content approved and live on home feed!"
4. Engagement metrics become active
5. Metrics update as users interact with content

---

## Technical Details

### Database Fields
Content table includes engagement metrics:
```
- likes_count: number (default 0)
- comments_count: number (default 0)
- views_count: number (default 0)
- shares_count: number (default 0)
```

### UI Component Structure
```
Content Card
├── Header (ID, Status, Visibility, Type)
├── Preview Section
│   ├── Media Preview
│   └── Engagement Metrics Box ✨ NEW
│       ├── Likes button → Opens popup
│       ├── Comments button → Opens popup
│       ├── Views button → Opens popup
│       └── Shares button → Opens popup
└── Review Note

Engagement Details Popup
├── Header (Title, Close button)
├── Status Card (Approved/Pending)
├── Metrics Grid (4 colored cards)
├── Sync Status (if approved)
└── Footer (Close button)
```

---

## Design Details

### Color Scheme
- **Likes:** Red gradient (`border-red-400/20 bg-red-500/10`)
- **Comments:** Blue gradient (`border-blue-400/20 bg-blue-500/10`)
- **Views:** Cyan gradient (`border-cyan-400/20 bg-cyan-500/10`)
- **Shares:** Yellow gradient (`border-yellow-400/20 bg-yellow-500/10`)
- **Approved Status:** Green gradient (`border-emerald-400/20 bg-emerald-500/10`)

### Responsive Design
- **Desktop:** Metrics display in 4-column grid in popup
- **Mobile:** Buttons stack responsibly in content card
- **Popup:** Full width on mobile, centered on desktop

---

## Future Enhancements

Potential additions:
1. **Engagement Trends** - Show growth over time
2. **User Breakdown** - See who engaged with content
3. **Engagement Alerts** - Notify when content hits milestones
4. **Export Metrics** - Download engagement reports
5. **Comparison** - Compare engagement across similar content

---

## Troubleshooting

### Metrics Show 0 Even After Approval
- Wait 10-15 seconds for sync from home feed
- Refresh the page
- Check if content is truly "Approved" status

### Popup Won't Open
- Ensure JavaScript is enabled
- Check browser console for errors
- Try a different browser

### Metrics Don't Match Home Feed
- This is normal during sync (up to 30 seconds)
- Refresh the page after approval
- Home feed updates occur in real-time

---

## Code Examples

### Using the Engagement Component
The engagement metrics are automatically displayed for all approved content. No additional setup required.

### Fetching Engagement Data
```typescript
// Already handled by adminService
const contents = await adminService.fetchAdminUploadContents();
// Returns array with: likes_count, comments_count, views_count, shares_count
```

### Opening Engagement Details
```typescript
// Click any metric button to trigger this
setEngagementDetailsId(contentId);
```

---

## Summary

✅ **Engagement metrics now visible in admin panel**
✅ **Detailed popup for viewing breakdown**
✅ **Auto-sync when content is approved**
✅ **Real-time updates on home feed**
✅ **Color-coded for easy identification**
✅ **Mobile responsive design**

The feature provides admins with full visibility into how content performs on the home feed, while maintaining synchronization between the admin panel and the live platform.
