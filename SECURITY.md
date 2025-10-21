# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in BoatOS, please report it by emailing **security@yourproject.com** (or create a private security advisory on GitHub).

**Do not** create public GitHub issues for security vulnerabilities.

## Security Best Practices

### 1. API Keys and Credentials

**Never commit API keys or credentials to Git!**

- All API keys must be stored in `.env` file (already in `.gitignore`)
- Use environment variables for all sensitive configuration
- Rotate compromised keys immediately
- Example: OpenWeather API key must be in `.env`, not hardcoded in code

### 2. Environment Configuration

The `.env` file contains sensitive data:
- API keys (OpenWeather, etc.)
- Database credentials (if any)
- Secret keys and tokens

**This file is excluded from Git via `.gitignore`**

### 3. What to do if you accidentally commit credentials

1. **Rotate the compromised credentials immediately** at the service provider
2. Remove the credentials from your code and use environment variables
3. Consider rewriting Git history (use with caution):
   ```bash
   # Remove file from all Git history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all

   # Force push (dangerous!)
   git push origin --force --all
   ```
4. **Better approach:** Accept that the credentials are compromised, rotate them, and move on

### 4. Files excluded from Git

These patterns are in `.gitignore` to prevent credential leaks:

```
# Environment variables
.env
.env.local

# SSL certificates
*.key
*.crt
*.pem

# Backup files (may contain old credentials)
*.backup
*.backup_*
*.before-*
*.old
```

### 5. Running BoatOS Securely

- Use HTTPS (SSL certificate) for all web access
- Keep system packages updated: `sudo apt update && sudo apt upgrade`
- Use firewall to restrict access: `sudo ufw enable`
- Change default passwords for SignalK and other services
- Regularly check for BoatOS updates: `git pull && ./scripts/update.sh`

### 6. Network Security

BoatOS is designed for use on a **private boat network**, not exposed to the internet.

If you need internet access:
- Use VPN (WireGuard, OpenVPN)
- Enable firewall with strict rules
- Use strong authentication
- Consider using Cloudflare Tunnel or similar

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | ✅ Yes (latest)    |
| < 1.0   | ❌ No (development)|

## Security Updates

We will announce security updates via:
- GitHub Security Advisories
- README.md changelog
- Git commit messages with `[SECURITY]` tag

## Dependencies

BoatOS uses third-party dependencies. Security vulnerabilities in dependencies are monitored via:
- GitHub Dependabot alerts
- Manual review of `requirements.txt` and `package.json`

To check for outdated packages:
```bash
# Python
pip list --outdated

# Node.js (if applicable)
npm audit
```

## Questions?

If you have questions about security in BoatOS, please open a GitHub Discussion (not an Issue).
