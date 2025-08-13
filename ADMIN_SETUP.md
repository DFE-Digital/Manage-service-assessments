# Admin System Setup and Usage

This document explains how to set up and use the new organisation and assessor management system.

## Database Structure

The system now includes the following new tables:

- **organisations**: Stores organisation information (e.g., Department for Education)
- **organisation_domains**: Maps email domains to organisations
- **roles**: Defines user roles (SuperAdmin, OrganisationAdmin, User)
- **super_admins**: Identifies super admin users
- **organisation_admins**: Maps users to organisation admin roles
- **user_roles**: Links users to their roles
- **assessors**: Links users to organisations with assessor status
- **assessor_roles**: Defines specific assessor roles (Lead, Design, Accessibility, etc.)

## Initial Setup

### 1. Database Initialization

The database tables are automatically created when the application starts. The system will:

- Create all necessary tables
- Insert default roles (SuperAdmin, OrganisationAdmin, User)
- Create a default organisation (Department for Education)
- Add the default domain (education.gov.uk)

### 2. Setting Up the First Super Admin

After creating your first user account, run the setup script:

```bash
node scripts/setup-super-admin.js
```

This will make the first user in the system a super admin.

## User Roles and Permissions

### Super Admin
- Can manage all organisations
- Can add/edit organisations and their domains
- Can manage organisation admins
- Can view all cross-government assessors
- Access via `/admin/organisations`

### Organisation Admin
- Can manage assessors within their own organisation
- Can add/edit assessors and their roles
- Can set cross-government assessor status
- Access via `/admin/organisation/assessors`

### User
- Automatically assigned to organisation based on email domain
- Can access basic functionality

## Automatic Organisation Assignment

Users are automatically assigned to organisations based on their email domain:

1. When a user registers or signs in, the system extracts their email domain
2. If the domain matches an organisation's allowed domains, the user is assigned to that organisation
3. If no match is found, the user remains unassigned

## Adding New Organisations

1. Sign in as a super admin
2. Go to `/admin/organisations`
3. Click "Add new organisation"
4. Enter the organisation name and allowed domains
5. Domains should be comma-separated (e.g., "gov.uk, example.gov.uk")

## Managing Organisation Admins

1. Go to `/admin/organisations`
2. Click "Manage admins" for the desired organisation
3. Click "Add admin" and enter the user's email address
4. The user must already exist in the system

## Managing Assessors

### Adding Assessors
1. Sign in as an organisation admin
2. Go to `/admin/organisation/assessors`
3. Click "Add assessor"
4. Enter the email address (existing user) or create a new user
5. Set cross-government assessor status if needed
6. Select assessor roles

### Assessor Roles
Available roles include:
- Lead
- Design
- Accessibility
- Content design
- Service design
- Interaction design
- Product
- Delivery
- Tech

## Email Domain Management

Organisations can have multiple allowed domains. For example:
- Department for Education: education.gov.uk, dfe.gov.uk
- Cabinet Office: cabinetoffice.gov.uk, gov.uk

## Security Notes

- Only super admins can manage organisations
- Organisation admins can only manage their own organisation
- Users are automatically assigned to organisations based on email domain
- All admin actions require appropriate authentication and authorization

## Troubleshooting

### User Not Assigned to Organisation
- Check if the user's email domain is in the organisation_domains table
- Verify the domain spelling and format
- Check the database logs for any errors

### Admin Access Issues
- Ensure the user has the correct role assigned
- Check if the user is in the super_admins or organisation_admins table
- Verify the user has an organisation assignment

### Database Errors
- Check the application logs for detailed error messages
- Ensure all tables were created correctly
- Verify foreign key relationships are intact
