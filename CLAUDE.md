# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pharmacy management SaaS application called "Daway" with two main versions:
- `daway-mvp`: A simpler Node.js/Express backend with SQLite database
- `daway-prod`: A React/Vite frontend with role-based dashboards

The application implements Role-Based Access Control (RBAC) with five user roles:
1. **Admin** - System-wide management
2. **Pharmacy Owner** - Pharmacy-specific management including staff
3. **Pharmacy Staff** - Limited pharmacy operations
4. **Supplier** - Medicine supply management
5. **Customer** - Medicine purchasing

## Development Setup

### Common Commands

**For daway-mvp (backend):**
```bash
# Install dependencies
npm install

# Start the server
npm start
# or
node server.js

# Server runs on http://localhost:5000
```

**For daway-prod (frontend):**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

**daway-mvp:**
Create `.env` file with:
```
PORT=5000
JWT_SECRET=your_secret_key_here
```

**daway-prod:**
Create `.env` file with:
```
VITE_API_BASE=  # Leave empty for localStorage mock mode, or set to backend URL for real API
```

## Code Architecture

### Backend Structure (daway-mvp)
- `server.js` - Main Express server with all API endpoints
- Database: SQLite (`daway.db`) with automatic table creation
- Automatic backups: Daily backups stored in `/backups` directory
- Authentication: JWT-based with middleware in `authenticateToken` function
- Key tables: `users`, `pharmacies`, `medicines`

### Frontend Structure (daway-prod)
- `src/main.jsx` - Application entry point
- `src/App.jsx` - Main App component handling authentication routing
- `src/api.js` - Unified API service with mock/localStorage fallback
- `src/components/` - Role-specific dashboards and shared components
- `src/hooks/` - Custom React hooks (if any)
- `src/utils/` - Utility functions like `formatCurrency.js`, `medicineHelpers.js`

### Role-Based Access Control
RBAC is implemented in:
- Frontend: `src/Dashboard.jsx` routes users to role-specific dashboards based on `user.role`
- Backend: API endpoints are protected by checking user roles and ownership (via `user_id`)
- Each dashboard (`AdminDashboard.jsx`, `PharmacyOwnerDashboard.jsx`, etc.) implements role-specific functionality

### Key Features by Role

**Admin:**
- Manage all medicines across all pharmacies
- Approve/reject pharmacy registration requests
- Manage all users
- View system-wide sales and analytics

**Pharmacy Owner:**
- Manage pharmacy's medicines
- Manage pharmacy staff
- View pharmacy-specific sales and reports
- Set up supplier relationships

**Pharmacy Staff:**
- View and manage assigned pharmacy's medicines
- Process sales
- View limited reports

**Supplier:**
- Manage their medicine catalog
- View purchase orders

**Customer:**
- Browse available medicines from pharmacies
- Add to cart and checkout
- View order history

## Development Guidelines

### Making Changes
1. **Backend Changes**: Modify `daway-mvp/server.js` for API changes
2. **Frontend Changes**: Modify files in `daway-prod/src/` 
3. **API Contract**: Ensure frontend `api.js` matches backend endpoints
4. **Role Permissions**: When adding new features, consider which roles should have access
5. **Data Consistency**: Remember that medicines are scoped to `user_id` for isolation

### Testing
- Manual testing: Start both servers and test end-to-end flows
- Backend: Test API endpoints directly with tools like curl or Postman
- Frontend: Test UI interactions and role-based access
- Mock API: The frontend uses localStorage mock by default; set `VITE_API_BASE` to test against real backend

### File Organization
- Keep component files small and focused
- Place shared utilities in appropriate utility files
- Follow existing code style and patterns
- For new pages/components, follow the established dashboard patterns

### Database Schema
Key tables in SQLite:
- `users`: id, pharmacy_name, email, password_hash, role, owner_id, created_at
- `pharmacies`: id, name, email
- `medicines`: id, user_id, name, quantity, batch_number, expire_date, price

## Common Tasks

### Adding a New API Endpoint
1. Add route in `daway-mvp/server.js` with appropriate authentication
2. Implement database queries with proper `user_id` scoping for data isolation
3. Test with curl/Postman
4. Update frontend `api.js` mock implementation if needed
5. Use the endpoint in relevant dashboard component

### Adding a New Role
1. Add role to user registration/login logic
2. Create new dashboard component in `src/components/`
3. Add route in `src/App.jsx` or `src/Dashboard.jsx`
4. Implement appropriate API endpoint protections
5. Add any role-specific utility functions

### UI/UX Guidelines
- All text is in Arabic (RTL layout)
- Use Tailwind CSS classes for styling (already configured)
- Follow existing component patterns for forms, modals, tables
- Use existing utility functions like `formatCurrency.js` for consistency
- Modals follow pattern: props for data, onSave callback, onClose callback

### Error Handling
- Backend: Return appropriate HTTP status codes with error messages
- Frontend: Use try/catch with apiFetch and handle errors gracefully
- Token errors: Use onTokenError callback to redirect to login
- Validation: Validate inputs both frontend and backend

## Important Notes

- The application uses localStorage mock mode by default for frontend development
- To test against real backend, set `VITE_API_BASE` environment variable in daway-prod
- Database backups run automatically every 24 hours in the MVP version
- Role separation is strict: users can only access their own data unless they're admin
- Medicine ownership is enforced via `user_id` foreign key in medicines table