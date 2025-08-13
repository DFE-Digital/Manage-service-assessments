# GOV.UK Notify Setup Guide

## Overview
This application uses GOV.UK Notify to send emails and SMS messages for:
- Email verification
- Password reset
- Email change notifications
- 2FA codes
- Mobile number change notifications
- Mobile verification codes

## Setup Steps

### 1. Get GOV.UK Notify Account
- Go to [GOV.UK Notify](https://www.notifications.service.gov.uk/)
- Sign up for an account
- Verify your email address

### 2. Get API Key
- In your Notify dashboard, go to API keys
- Copy your live API key (starts with `live-` or `test-`)

### 3. Create Email Templates
Create these email templates in your Notify dashboard:

#### Verify Email Template
- **Template ID**: Copy this from the template URL
- **Subject**: Verify your email address
- **Content**:
```
Hello ((first_name)),

Please verify your email address by clicking this link:

((verify_link))

This link will expire in 24 hours.

If you didn't create an account, you can ignore this email.
```

#### Reset Password Template
- **Subject**: Reset your password
- **Content**:
```
Hello ((first_name)),

You requested a password reset. Click this link to reset your password:

((reset_link))

This link will expire in 1 hour.

If you didn't request this, you can ignore this email.
```

#### Email Changed Template
- **Subject**: Your email address has changed
- **Content**:
```
Hello ((first_name)),

Your email address has been changed to ((new_email)).

If you didn't make this change, contact us immediately:

((contact_link))
```

### 4. Create SMS Templates
Create these SMS templates in your Notify dashboard:

#### 2FA Code Template
- **Content**:
```
Your verification code is ((code))

This code will expire in 10 minutes.
```

#### Mobile Changed Template
- **Content**:
```
Your mobile number has been changed.

If you didn't make this change, contact us: ((contact_number))
```

#### Verify Mobile Template
- **Content**:
```
Your verification code is ((code))

This code will expire in 10 minutes.
```

### 5. Environment Variables
Copy `env.example` to `.env` and fill in your values:

```bash
# API Key
GOVUK_NOTIFY_API_KEY=live-your-actual-api-key-here

# Email Template IDs
GOVUK_NOTIFY_VERIFY_EMAIL_TEMPLATE_ID=12345678-1234-1234-1234-123456789012
GOVUK_NOTIFY_RESET_PASSWORD_TEMPLATE_ID=87654321-4321-4321-4321-210987654321
GOVUK_NOTIFY_EMAIL_CHANGED_TEMPLATE_ID=11111111-1111-1111-1111-111111111111

# SMS Template IDs
GOVUK_NOTIFY_2FA_CODE_TEMPLATE_ID=22222222-2222-2222-2222-222222222222
GOVUK_NOTIFY_MOBILE_CHANGED_TEMPLATE_ID=33333333-3333-3333-3333-333333333333
GOVUK_NOTIFY_VERIFY_MOBILE_TEMPLATE_ID=44444444-4444-4444-4444-444444444444
```

### 6. Test
- Restart your application
- Try registering a new account
- Check the console for any configuration warnings
- Verify emails/SMS are sent (or check console logs if not configured)

## Troubleshooting

### 403 Forbidden Error
- Check your API key is correct
- Ensure template IDs match exactly
- Verify your account has permission to use the templates
- Check if you're using test vs live API keys

### Missing Template IDs
- The app will log which template IDs are missing
- Create any missing templates in your Notify dashboard
- Copy the template IDs to your `.env` file

### Notifications Not Sending
- Check console logs for configuration warnings
- Verify all environment variables are set
- Ensure your Notify account is active
- Check if you've exceeded your sending limits

## Development vs Production
- Use test API keys and templates during development
- Switch to live keys and templates for production
- Test thoroughly with test keys before going live 