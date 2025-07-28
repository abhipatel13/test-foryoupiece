# 📧 Email Template Setup Guide for Foryoupiece

This guide explains how to configure branded email templates for password reset and other authentication emails in Supabase.

## 🎨 Branded Email Template

We've created a custom branded email template located at `src/templates/email/password-reset.html` that includes:

- ✅ Proper Foryoupiece branding (logo, colors)
- ✅ Black and white minimalistic design theme
- ✅ Professional company information
- ✅ Security notices and best practices
- ✅ Mobile-responsive design
- ✅ Consistent styling with the main application

## 🔧 Supabase Email Template Configuration

### Step 1: Access Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**

### Step 2: Configure Password Reset Email

1. Select **Reset Password** template
2. Replace the default template with our branded template
3. Use the HTML content from `src/templates/email/password-reset.html`

### Step 3: Template Variables

The template uses these Supabase variables:
- `{{ .ConfirmationURL }}` - The password reset link
- `{{ .Email }}` - The user's email address
- `{{ .SiteURL }}` - Your site URL (configured in Supabase settings)

### Step 4: Email Settings Configuration

In Supabase Dashboard → Authentication → Settings:

```
Site URL: https://your-domain.com (or http://localhost:3000 for development)
Redirect URLs: 
- https://your-domain.com/en/auth/reset-password
- http://localhost:3000/en/auth/reset-password (for development)
```

## 📝 Email Template Features

### Design Elements
- **Header**: Black background with white Foryoupiece logo
- **Content**: Clean white background with proper spacing
- **CTA Button**: Black button matching brand colors
- **Footer**: Light gray background with company information

### Security Features
- ✅ Clear security notice about link expiration
- ✅ Instructions for users who didn't request the reset
- ✅ Professional messaging to build trust

### Responsive Design
- ✅ Mobile-optimized layout
- ✅ Proper font sizing for all devices
- ✅ Touch-friendly button sizes

## 🚀 Production Deployment

### Before Going Live:

1. **Update URLs**: Replace all localhost URLs with your production domain
2. **Test Email Delivery**: Send test emails to verify formatting
3. **Check Spam Filters**: Ensure emails don't go to spam
4. **Verify Links**: Test that all links work correctly

### Email Template Checklist:

- [ ] Foryoupiece branding is consistent
- [ ] All links point to correct production URLs
- [ ] Email renders correctly in major email clients
- [ ] Mobile responsiveness is working
- [ ] Security notices are clear and professional
- [ ] Company information is accurate

## 🔍 Testing the Email Templates

### Development Testing:

1. Start your development server: `npm run dev`
2. Go to the forgot password page: `http://localhost:3000/en/auth/forgot-password`
3. Enter a test email address
4. Check your email inbox for the branded reset email
5. Click the reset link and verify it works correctly

### Email Client Testing:

Test the email template in these clients:
- Gmail (web and mobile)
- Outlook (web and desktop)
- Apple Mail
- Yahoo Mail
- Mobile email apps

## 📧 Additional Email Templates

You can create similar branded templates for:
- **Email Confirmation** (for new user registration)
- **Email Change Confirmation**
- **Magic Link** (if using passwordless login)

## 🛠️ Customization

To customize the email template:

1. Edit `src/templates/email/password-reset.html`
2. Update colors, fonts, or layout as needed
3. Test the changes in development
4. Update the template in Supabase dashboard
5. Deploy to production

## 📞 Support

If you need help with email template configuration:
- Check Supabase documentation: https://supabase.com/docs/guides/auth/auth-email-templates
- Contact support for template customization assistance

---

**Note**: Remember to keep the email template consistent with your main application's branding and user experience.
