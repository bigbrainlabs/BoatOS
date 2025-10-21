# Contributing to BoatOS

First off, thanks for taking the time to contribute! 🎉

BoatOS is built by sailors, for sailors. We welcome contributions from everyone, whether you're fixing a typo or adding a major feature.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Good First Issues](#good-first-issues)
- [Community](#community)

---

## Code of Conduct

This project adheres to a simple code of conduct:
- **Be respectful** - We're all here to learn and help
- **Be patient** - Not everyone has the same experience level
- **Be constructive** - Criticism should be helpful, not hurtful
- **Stay on topic** - Keep discussions relevant to the project

We want BoatOS to be welcoming to contributors from all backgrounds.

---

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating a bug report, please check existing [Issues](https://github.com/bigbrainlabs/BoatOS/issues) to avoid duplicates.

**Good bug reports include:**
- **Clear title** - "GPS tracking stops after 2 hours"
- **Steps to reproduce** - What did you do?
- **Expected behavior** - What should happen?
- **Actual behavior** - What actually happened?
- **Environment** - Raspberry Pi model, OS version, BoatOS version
- **Logs** - Check `journalctl -u boatos` for errors
- **Screenshots** - If applicable

**Example:**
```markdown
**Title:** GPS tracking stops after 2 hours of operation

**Steps to reproduce:**
1. Start BoatOS
2. Enable GPS tracking
3. Wait 2+ hours

**Expected:** GPS should continue tracking indefinitely

**Actual:** GPS stops updating after ~2 hours, shows "No Fix"

**Environment:**
- Raspberry Pi 4 (4GB)
- Debian 12 Bookworm
- BoatOS commit: abc123
- GPS: U-blox USB receiver

**Logs:**
```
Oct 21 15:30:45 boatos python[1234]: ERROR: GPS timeout
```

### 💡 Suggesting Features

We love new ideas! Before suggesting a feature:
1. Check [existing issues](https://github.com/bigbrainlabs/BoatOS/issues) and [TODO.md](TODO.md) (if you have local access)
2. Consider if it fits BoatOS's mission (marine navigation for sailors)
3. Think about implementation complexity

**Good feature requests include:**
- **Use case** - Why do you need this?
- **Proposed solution** - How would it work?
- **Alternatives** - Did you consider other approaches?
- **Mockups** - Screenshots or sketches (optional but helpful!)

### 📝 Improving Documentation

Documentation improvements are always welcome!
- Fix typos or unclear instructions
- Add missing setup steps
- Translate to other languages
- Create tutorials or video guides
- Improve code comments

### 🎨 Design Contributions

- UI/UX improvements
- Icon design
- Logo variations
- Color scheme suggestions
- Touch-screen usability improvements

---

## Development Setup

### Prerequisites

- **Raspberry Pi 4/5** (or x86 Linux for development)
- **Python 3.9+**
- **Git**
- **Basic knowledge of:** Python (FastAPI), JavaScript, HTML/CSS

### 1. Fork & Clone

```bash
# Fork the repository on GitHub (click "Fork" button)

# Clone your fork
git clone https://github.com/YOUR-USERNAME/BoatOS.git
cd BoatOS
```

### 2. Install Dependencies

```bash
# System packages
sudo apt update
sudo apt install -y python3-venv python3-pip nginx git

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend (no build step required - vanilla JS)
cd ../frontend
# Just serve with nginx or http-server
```

### 3. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys (optional for development)
nano .env
```

### 4. Run Development Server

**Backend:**
```bash
cd backend
source venv/bin/activate
python app/main.py
# Runs on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
# Simple HTTP server (Python)
python3 -m http.server 3000
# Or use nginx config from install.sh
```

**Access:** http://localhost:3000 (or 8000 for API only)

### 5. Run with SignalK (GPS testing)

```bash
# Install SignalK (for GPS/NMEA integration)
npm install -g signalk-server
signalk-server
```

---

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/my-awesome-feature
# or
git checkout -b fix/bug-description
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code improvements
- `test/` - Adding tests

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Backend tests (when available)
pytest backend/tests/

# Manual testing checklist:
# - Does the UI still work?
# - Did you test on Raspberry Pi (if hardware-related)?
# - Are there any console errors?
# - Does it work on both desktop and mobile?
```

### 4. Commit

```bash
git add .
git commit -m "feat: Add tide predictions to weather panel

- Fetch tide data from NOAA API
- Display high/low tide times
- Update weather panel UI
- Add tests for tide data parsing

Closes #123"
```

**Commit message format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting, missing semicolons
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 5. Push & Create PR

```bash
git push origin feature/my-awesome-feature
```

Then go to GitHub and click "Create Pull Request".

**PR Description Template:**
```markdown
## Description
Brief description of what this PR does.

## Changes
- Added X feature
- Fixed Y bug
- Refactored Z component

## Testing
- [ ] Tested on Raspberry Pi 4
- [ ] Tested on desktop browser
- [ ] Tested on mobile
- [ ] No console errors
- [ ] All features still work

## Screenshots (if applicable)
![Screenshot](url)

## Related Issues
Closes #123
Related to #456
```

### 6. Code Review

- Be patient - reviews may take a few days
- Address feedback constructively
- Push changes to the same branch (PR updates automatically)
- Don't force-push after review has started

### 7. Merge

Once approved, a maintainer will merge your PR. Congrats! 🎉

You'll be listed as a contributor on the repository.

---

## Code Style Guidelines

### Python (Backend)

**Style:** Follow [PEP 8](https://pep8.org/)

```python
# Good
def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in nautical miles.

    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate

    Returns:
        float: Distance in nautical miles
    """
    # Implementation
    pass

# Bad
def calc_dist(l1,l2,l3,l4):
    # no docstring
    pass
```

**Formatting:**
- 4 spaces for indentation
- Max line length: 120 characters
- Use type hints when possible
- Docstrings for all functions

### JavaScript (Frontend)

**Style:** Modern ES6+

```javascript
// Good
async function fetchGPSData() {
    try {
        const response = await fetch('/api/gps');
        const data = await response.json();
        updateMap(data);
    } catch (error) {
        console.error('GPS fetch failed:', error);
        showError('Could not fetch GPS data');
    }
}

// Bad
function fetchGPSData() {
    fetch('/api/gps').then(function(response) {
        return response.json();
    }).then(function(data) {
        updateMap(data);
    }).catch(function(error) {
        console.log(error); // Don't just log, handle it!
    });
}
```

**Guidelines:**
- Use `const` and `let`, not `var`
- Use async/await over Promises
- Handle errors properly
- Add comments for complex UI logic
- Keep functions small and focused

### HTML/CSS

```html
<!-- Good -->
<button class="btn btn-primary" id="start-tracking" aria-label="Start GPS tracking">
    Start Tracking
</button>

<!-- Bad -->
<button onclick="start()" style="background:blue;color:white">Start</button>
```

**Guidelines:**
- Semantic HTML (`<nav>`, `<main>`, `<article>`)
- Accessibility (ARIA labels, alt text)
- Responsive design (mobile-first)
- Use CSS classes, not inline styles
- BEM naming convention for CSS

---

## Testing

### Manual Testing Checklist

Before submitting a PR, test:

**Basic functionality:**
- [ ] Dashboard loads without errors
- [ ] GPS panel shows data (if GPS available)
- [ ] Map renders correctly
- [ ] Settings can be saved
- [ ] WebSocket connection works

**Responsive design:**
- [ ] Works on desktop (1920x1080)
- [ ] Works on tablet (768x1024)
- [ ] Works on mobile (375x667)
- [ ] Touch interactions work on Raspberry Pi touchscreen

**Browser compatibility:**
- [ ] Chrome/Chromium (Raspberry Pi default)
- [ ] Firefox
- [ ] Safari (if possible)

**Performance:**
- [ ] No memory leaks (check DevTools)
- [ ] UI remains responsive
- [ ] No excessive API calls

### Automated Tests (Future)

We're working on adding automated tests. If you want to help:
- Backend: pytest
- Frontend: Jest or similar
- E2E: Playwright or Cypress

---

## Good First Issues

Looking for a place to start? Check issues labeled:
- `good first issue` - Easy for beginners
- `help wanted` - We'd love help with this
- `documentation` - Improve docs
- `translation` - Add language support

### Suggested Contributions for Beginners:

**Easy:**
- Fix typos in documentation
- Add missing translations (German, French, Spanish)
- Improve error messages
- Add tooltips to UI elements

**Medium:**
- Add new sensor types (temperature, humidity)
- Implement wind rose animation
- Add keyboard shortcuts
- Improve mobile UI

**Advanced:**
- Tide predictions integration
- AIS target filtering/alerts
- Route optimization algorithms
- Offline chart caching

---

## Community

### Get Help

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - Questions, ideas, show & tell
- **Discord** (coming soon) - Real-time chat

### Stay Updated

- **Watch** the repository for notifications
- **Star** the repo to show support
- **Follow** [@YourTwitter] for updates (if you have one)

### Recognition

Contributors are listed on:
- GitHub Contributors page
- README.md (for significant contributions)
- Release notes

---

## Questions?

Don't hesitate to ask! There are no stupid questions.

**Contact:**
- Open an issue with the `question` label
- Start a GitHub Discussion
- Email: [your-email@example.com] (optional)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

## Thank You! 🙏

Every contribution, no matter how small, makes BoatOS better for everyone.

**Happy sailing!** ⛵️
