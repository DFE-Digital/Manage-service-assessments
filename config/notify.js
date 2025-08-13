const { NotifyClient } = require('notifications-node-client');

let notifyClient = null;

if (process.env.GOVUK_NOTIFY_API_KEY) {
  try {
    notifyClient = new NotifyClient(process.env.GOVUK_NOTIFY_API_KEY);
  } catch (error) {
    console.warn('GOV.UK Notify client initialization failed:', error.message);
  }
}

const EMAIL_TEMPLATES = {
    VERIFY_EMAIL: process.env.GOVUK_NOTIFY_VERIFY_EMAIL_TEMPLATE_ID,
    RESET_PASSWORD: process.env.GOVUK_NOTIFY_RESET_PASSWORD_TEMPLATE_ID,
    EMAIL_CHANGED: process.env.GOVUK_NOTIFY_EMAIL_CHANGED_TEMPLATE_ID,
    NEW_USER_SETUP: process.env.GOVUK_NOTIFY_NEW_USER_SETUP_TEMPLATE_ID
};

const SMS_TEMPLATES = {
    TWO_FACTOR_CODE: process.env.GOVUK_NOTIFY_2FA_CODE_TEMPLATE_ID,
    MOBILE_CHANGED: process.env.GOVUK_NOTIFY_MOBILE_CHANGED_TEMPLATE_ID,
    VERIFY_MOBILE: process.env.GOVUK_NOTIFY_VERIFY_MOBILE_TEMPLATE_ID
};

// Check if all required template IDs are configured
const isNotifyConfigured = () => {
    console.log('=== NOTIFY CONFIGURATION CHECK ===');
    console.log('Notify client exists:', !!notifyClient);
    
    if (!notifyClient) {
        console.log('❌ Notify client is null/undefined');
        console.log('=== END CONFIG CHECK ===');
        return false;
    }
    
    const allTemplates = { ...EMAIL_TEMPLATES, ...SMS_TEMPLATES };
    console.log('All template IDs:', allTemplates);
    
    const missingTemplates = Object.entries(allTemplates)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
    
    if (missingTemplates.length > 0) {
        console.warn('❌ Missing GOV.UK Notify template IDs:', missingTemplates);
        console.log('=== END CONFIG CHECK ===');
        return false;
    }
    
    console.log('✅ All template IDs are configured');
    console.log('=== END CONFIG CHECK ===');
    return true;
};

// Send email verification
async function sendVerifyEmail(email, firstName, token, baseUrl) {
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping email send');
        console.log('Would send verification email to:', email);
        console.log('Verification link:', `${baseUrl}/auth/setup?token=${token}`);
        return null;
    }

    try {
        const verifyLink = `${baseUrl}/auth/setup?token=${token}`;

        const response = await notifyClient.sendEmail(EMAIL_TEMPLATES.VERIFY_EMAIL, email, {
            personalisation: {
                first_name: firstName,
                verify_link: verifyLink
            },
            reference: `verify-email-${Date.now()}`
        });

        return response;
    } catch (error) {
        console.error('Error sending verification email:', error);
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        throw error;
    }
}

// Send password reset email
async function sendPasswordResetEmail(email, firstName, token, baseUrl) {
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping email send');
        console.log('Would send password reset email to:', email);
        console.log('Reset link:', `${baseUrl}/auth/reset-password?token=${token}`);
        return null;
    }

    try {
        const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

        const response = await notifyClient.sendEmail(EMAIL_TEMPLATES.RESET_PASSWORD, email, {
            personalisation: {
                first_name: firstName,
                reset_link: resetLink
            },
            reference: `password-reset-${Date.now()}`
        });

        return response;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        throw error;
    }
}

// Send email changed notification
async function sendEmailChangedNotification(email, firstName, newEmail, baseUrl) {
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping email send');
        console.log('Would send email changed notification to:', email);
        return null;
    }

    try {
        const contactLink = `${baseUrl}/contact`;

        const response = await notifyClient.sendEmail(EMAIL_TEMPLATES.EMAIL_CHANGED, email, {
            personalisation: {
                first_name: firstName,
                new_email: newEmail,
                contact_link: contactLink
            },
            reference: `email-changed-${Date.now()}`
        });

        return response;
    } catch (error) {
        console.error('Error sending email changed notification:', error);
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        throw error;
    }
}

// Send 2FA verification code
async function send2FACode(phoneNumber, code) {
    console.log('=== 2FA SMS SENDING DEBUG ===');
    console.log('Phone number:', phoneNumber);
    console.log('Code:', code);
    console.log('Notify client exists:', !!notifyClient);
    console.log('SMS_TEMPLATES.TWO_FACTOR_CODE:', SMS_TEMPLATES.TWO_FACTOR_CODE);
    console.log('isNotifyConfigured():', isNotifyConfigured());
    
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping SMS send');
        console.log('Would send 2FA code to:', phoneNumber);
        console.log('Code:', code);
        console.log('=== END 2FA SMS DEBUG ===');
        return null;
    }

    try {
        console.log('Attempting to send 2FA SMS via GOV.UK Notify...');
        const response = await notifyClient.sendSms(SMS_TEMPLATES.TWO_FACTOR_CODE, phoneNumber, {
            personalisation: {
                code: code
            },
            reference: `2fa-code-${Date.now()}`
        });
        console.log('2FA SMS sent successfully! Response:', response);
        console.log('=== END 2FA SMS DEBUG ===');
        return response;
    } catch (error) {
        console.error('Error sending 2FA code:', error);
        console.error('Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        console.log('=== END 2FA SMS DEBUG ===');
        throw error;
    }
}

// Send mobile number changed notification
async function sendMobileChangedNotification(phoneNumber, contactNumber) {
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping SMS send');
        console.log('Would send mobile changed notification to:', phoneNumber);
        return null;
    }

    try {
        const response = await notifyClient.sendSms(SMS_TEMPLATES.MOBILE_CHANGED, phoneNumber, {
            personalisation: {
                contact_number: contactNumber
            },
            reference: `mobile-changed-${Date.now()}`
        });

        return response;
    } catch (error) {
        console.error('Error sending mobile changed notification:', error);
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        throw error;
    }
}

// Send mobile verification code
async function sendMobileVerificationCode(phoneNumber, code) {
    console.log('=== SMS SENDING DEBUG ===');
    console.log('Phone number:', phoneNumber);
    console.log('Code:', code);
    console.log('Notify client exists:', !!notifyClient);
    console.log('SMS_TEMPLATES.VERIFY_MOBILE:', SMS_TEMPLATES.VERIFY_MOBILE);
    console.log('isNotifyConfigured():', isNotifyConfigured());
    
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping SMS send');
        console.log('Would send mobile verification code to:', phoneNumber);
        console.log('Code:', code);
        console.log('=== END SMS DEBUG ===');
        return null;
    }

    try {
        console.log('Attempting to send SMS via GOV.UK Notify...');
        const response = await notifyClient.sendSms(SMS_TEMPLATES.VERIFY_MOBILE, phoneNumber, {
            personalisation: {
                code: code
            },
            reference: `verify-mobile-${Date.now()}`
        });
        console.log('SMS sent successfully! Response:', response);
        console.log('=== END SMS DEBUG ===');
        return response;
    } catch (error) {
        console.error('Error sending mobile verification code:', error);
        console.error('Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        console.log('=== END SMS DEBUG ===');
        throw error;
    }
}

// Send new user setup email
async function sendNewUserSetupEmail(email, setupUrl) {
    if (!isNotifyConfigured()) {
        console.warn('GOV.UK Notify not properly configured - skipping email send');
        console.log('Would send new user setup email to:', email);
        console.log('Setup link:', setupUrl);
        return null;
    }

    try {
        const response = await notifyClient.sendEmail(EMAIL_TEMPLATES.NEW_USER_SETUP, email, {
            personalisation: {
                setup_url: setupUrl
            },
            reference: `new-user-setup-${Date.now()}`
        });

        return response;
    } catch (error) {
        console.error('Error sending new user setup email:', error);
        if (error.response?.status === 403) {
            console.error('GOV.UK Notify 403 error - check API key and template ID permissions');
        }
        throw error;
    }
}

module.exports = {
    notifyClient,
    isNotifyConfigured,
    sendVerifyEmail,
    sendPasswordResetEmail,
    sendEmailChangedNotification,
    send2FACode,
    sendMobileChangedNotification,
    sendMobileVerificationCode,
    sendNewUserSetupEmail
};