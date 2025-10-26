/**
 * Virtual Touch Keyboard for BoatOS
 * Modern on-screen keyboard for kiosk mode
 */

class VirtualKeyboard {
    constructor() {
        this.isKioskMode = window.location.hostname === 'localhost' ||
                          window.location.hostname === '192.168.2.217';

        if (!this.isKioskMode) return;

        this.activeInput = null;
        this.isVisible = false;
        this.capsLock = false;

        this.createKeyboard();
        this.attachEventListeners();
    }

    createKeyboard() {
        const keyboard = document.createElement('div');
        keyboard.id = 'virtual-keyboard';
        keyboard.className = 'virtual-keyboard';
        keyboard.innerHTML = `
            <div class="keyboard-row">
                <button class="key" data-key="q">Q</button>
                <button class="key" data-key="w">W</button>
                <button class="key" data-key="e">E</button>
                <button class="key" data-key="r">R</button>
                <button class="key" data-key="t">T</button>
                <button class="key" data-key="z">Z</button>
                <button class="key" data-key="u">U</button>
                <button class="key" data-key="i">I</button>
                <button class="key" data-key="o">O</button>
                <button class="key" data-key="p">P</button>
            </div>
            <div class="keyboard-row">
                <button class="key" data-key="a">A</button>
                <button class="key" data-key="s">S</button>
                <button class="key" data-key="d">D</button>
                <button class="key" data-key="f">F</button>
                <button class="key" data-key="g">G</button>
                <button class="key" data-key="h">H</button>
                <button class="key" data-key="j">J</button>
                <button class="key" data-key="k">K</button>
                <button class="key" data-key="l">L</button>
            </div>
            <div class="keyboard-row">
                <button class="key key-special key-caps" data-action="caps">⬆</button>
                <button class="key" data-key="y">Y</button>
                <button class="key" data-key="x">X</button>
                <button class="key" data-key="c">C</button>
                <button class="key" data-key="v">V</button>
                <button class="key" data-key="b">B</button>
                <button class="key" data-key="n">N</button>
                <button class="key" data-key="m">M</button>
                <button class="key key-special" data-action="backspace">⌫</button>
            </div>
            <div class="keyboard-row">
                <button class="key key-special" data-action="123">123</button>
                <button class="key" data-key=",">.</button>
                <button class="key key-space" data-key=" ">Leertaste</button>
                <button class="key" data-key="-">-</button>
                <button class="key key-special key-enter" data-action="enter">↵</button>
            </div>
        `;

        document.body.appendChild(keyboard);
        this.keyboardElement = keyboard;
    }

    attachEventListeners() {
        // Listen for focus on search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('focus', () => {
                this.activeInput = searchInput;
                this.cursorPosition = searchInput.selectionStart;
                this.show();
            });

            // Track cursor position on click/selection
            searchInput.addEventListener('click', () => {
                this.cursorPosition = searchInput.selectionStart;
            });

            searchInput.addEventListener('keyup', () => {
                this.cursorPosition = searchInput.selectionStart;
            });

            // Don't hide on blur - let user explicitly close or tap elsewhere
        }

        // Handle key clicks
        this.keyboardElement.addEventListener('mousedown', (e) => {
            const key = e.target.closest('.key');
            if (!key) return;

            e.preventDefault();
            e.stopPropagation();

            const keyValue = key.dataset.key;
            const action = key.dataset.action;

            if (action) {
                this.handleAction(action);
            } else if (keyValue && this.activeInput) {
                this.insertText(keyValue);
            }

            // Keep focus on input after key press
            if (this.activeInput) {
                setTimeout(() => this.activeInput.focus(), 0);
            }
        });

        // Close keyboard when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isVisible &&
                !this.keyboardElement.contains(e.target) &&
                e.target.id !== 'search-input') {
                this.hide();
            }
        });
    }

    handleAction(action) {
        switch (action) {
            case 'backspace':
                if (this.activeInput) {
                    const start = this.activeInput.selectionStart;
                    const end = this.activeInput.selectionEnd;
                    const value = this.activeInput.value;

                    if (start === end && start > 0) {
                        this.activeInput.value = value.slice(0, start - 1) + value.slice(end);
                        this.activeInput.selectionStart = this.activeInput.selectionEnd = start - 1;
                    } else if (start !== end) {
                        this.activeInput.value = value.slice(0, start) + value.slice(end);
                        this.activeInput.selectionStart = this.activeInput.selectionEnd = start;
                    }

                    this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                break;

            case 'enter':
                if (this.activeInput) {
                    this.activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' }));
                    this.hide();
                }
                break;

            case 'caps':
                this.capsLock = !this.capsLock;
                this.updateCapsLock();
                break;

            case '123':
                // Toggle to numbers - future enhancement
                break;
        }
    }

    insertText(text) {
        if (!this.activeInput) return;

        // Store cursor position (might be lost during click)
        let start = this.cursorPosition !== undefined ? this.cursorPosition : this.activeInput.selectionStart;
        let end = this.cursorPosition !== undefined ? this.cursorPosition : this.activeInput.selectionEnd;
        const value = this.activeInput.value;

        const textToInsert = this.capsLock ? text.toUpperCase() : text.toLowerCase();

        // Insert text at cursor position
        this.activeInput.value = value.slice(0, start) + textToInsert + value.slice(end);

        // Set cursor after inserted text
        const newPos = start + textToInsert.length;
        this.activeInput.selectionStart = this.activeInput.selectionEnd = newPos;
        this.cursorPosition = newPos;

        this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    updateCapsLock() {
        const capsButton = this.keyboardElement.querySelector('[data-action="caps"]');
        if (this.capsLock) {
            capsButton.classList.add('active');
        } else {
            capsButton.classList.remove('active');
        }
    }

    show() {
        if (!this.isKioskMode) return;
        this.keyboardElement.classList.add('visible');
        this.isVisible = true;
    }

    hide() {
        this.keyboardElement.classList.remove('visible');
        this.isVisible = false;
        this.activeInput = null;
    }
}

// Initialize keyboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.virtualKeyboard = new VirtualKeyboard();
    });
} else {
    window.virtualKeyboard = new VirtualKeyboard();
}
