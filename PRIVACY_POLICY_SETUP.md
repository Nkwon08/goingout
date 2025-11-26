# Privacy Policy URL Setup Guide

## Quick Options for Hosting Your Privacy Policy

### Option 1: GitHub Pages (Free & Easy) ⭐ Recommended

1. **Create a GitHub repository:**
   - Go to [github.com](https://github.com) and create a new repository
   - Name it something like `roll-privacy-policy` or `roll-website`
   - Make it public

2. **Upload the privacy-policy.html file:**
   - Upload the `privacy-policy.html` file to the repository
   - Rename it to `index.html` (optional, but cleaner URL)

3. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Select main branch as source
   - Your URL will be: `https://yourusername.github.io/roll-privacy-policy/`

4. **Your Privacy Policy URL:**
   ```
   https://yourusername.github.io/roll-privacy-policy/
   ```
   or if you named it index.html:
   ```
   https://yourusername.github.io/roll-privacy-policy/index.html
   ```

### Option 2: Firebase Hosting (Free)

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Firebase:**
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to current directory or create a `public` folder
   - Copy `privacy-policy.html` to the public directory

3. **Deploy:**
   ```bash
   firebase deploy --only hosting
   ```

4. **Your Privacy Policy URL:**
   ```
   https://your-project-id.web.app/privacy-policy.html
   ```
   or
   ```
   https://your-project-id.firebaseapp.com/privacy-policy.html
   ```

### Option 3: Netlify (Free)

1. Go to [netlify.com](https://netlify.com)
2. Sign up/login
3. Drag and drop the `privacy-policy.html` file
4. Your URL will be: `https://random-name.netlify.app/privacy-policy.html`
5. You can customize the domain name in settings

### Option 4: Use Your Own Domain

If you have a website domain:
- Upload `privacy-policy.html` to your web server
- Your URL: `https://yourdomain.com/privacy-policy.html`

## For App Store Connect

Once you have your URL, enter it in:
- **App Store Connect → Your App → App Information → Privacy Policy URL**

## Quick Start (GitHub Pages - Easiest)

1. Create GitHub account (if you don't have one)
2. Create new repository: `roll-privacy-policy`
3. Upload `privacy-policy.html` file
4. Go to Settings → Pages → Enable GitHub Pages
5. Your URL: `https://yourusername.github.io/roll-privacy-policy/privacy-policy.html`

## Important Notes

- ✅ The URL must be publicly accessible (no login required)
- ✅ It must be HTTPS (secure connection)
- ✅ The page must load properly on mobile devices
- ✅ Apple will verify the URL during review

## Testing Your URL

Before submitting to App Store:
1. Open the URL in a browser
2. Make sure it loads correctly
3. Check it works on mobile devices
4. Verify all links work

