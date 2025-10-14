/**
 * Crew Management Module
 * Handles crew member management, trip assignments, and statistics
 */

// Use shared API_URL from app.js or define if not available
const CREW_API_URL = window.API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');

let crewMembers = [];
let crewModalOpen = false;

// ==================== API Functions ====================

async function loadCrewMembers() {
    try {
        const response = await fetch(`${CREW_API_URL}/api/crew`);
        crewMembers = await response.json();
        updateCrewUI();
        return crewMembers;
    } catch (error) {
        console.error('Error loading crew members:', error);
        return [];
    }
}

async function addCrewMember(name, role, email, phone) {
    try {
        const response = await fetch(`${CREW_API_URL}/api/crew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, role, email, phone })
        });
        const newMember = await response.json();

        if (!newMember.error) {
            crewMembers.push(newMember);
            updateCrewUI();
            return newMember;
        }
        return null;
    } catch (error) {
        console.error('Error adding crew member:', error);
        return null;
    }
}

async function updateCrewMember(id, updates) {
    try {
        const response = await fetch(`${CREW_API_URL}/api/crew/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const updated = await response.json();

        if (!updated.error) {
            const index = crewMembers.findIndex(m => m.id === id);
            if (index !== -1) {
                crewMembers[index] = updated;
            }
            updateCrewUI();
            return updated;
        }
        return null;
    } catch (error) {
        console.error('Error updating crew member:', error);
        return null;
    }
}

async function deleteCrewMember(id) {
    try {
        const response = await fetch(`${CREW_API_URL}/api/crew/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.status === 'deleted') {
            crewMembers = crewMembers.filter(m => m.id !== id);
            updateCrewUI();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting crew member:', error);
        return false;
    }
}

async function getCrewStats() {
    try {
        const response = await fetch(`${CREW_API_URL}/api/crew/stats`);
        return await response.json();
    } catch (error) {
        console.error('Error loading crew stats:', error);
        return null;
    }
}

// ==================== UI Functions ====================

function updateCrewUI() {
    const crewList = document.getElementById('crew-list');
    if (!crewList) return;

    if (crewMembers.length === 0) {
        crewList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">Keine Crew-Mitglieder</div>
                <div class="empty-subtext">Füge dein erstes Crew-Mitglied hinzu</div>
            </div>
        `;
        return;
    }

    crewList.innerHTML = crewMembers.map(member => `
        <div class="crew-card" data-id="${member.id}">
            <div class="crew-card-header">
                <div class="crew-info">
                    <div class="crew-name">${member.name}</div>
                    <div class="crew-role crew-role-${member.role.toLowerCase()}">${member.role}</div>
                </div>
                <div class="crew-actions">
                    <button class="crew-action-btn" onclick="editCrewMember(${member.id})" title="Bearbeiten">✏️</button>
                    <button class="crew-action-btn" onclick="deleteCrewMemberConfirm(${member.id})" title="Löschen">🗑️</button>
                </div>
            </div>
            <div class="crew-card-body">
                <div class="crew-detail">
                    <span class="crew-detail-icon">📧</span>
                    <span class="crew-detail-text">${member.email || 'Keine E-Mail'}</span>
                </div>
                <div class="crew-detail">
                    <span class="crew-detail-icon">📱</span>
                    <span class="crew-detail-text">${member.phone || 'Keine Telefonnummer'}</span>
                </div>
                <div class="crew-detail">
                    <span class="crew-detail-icon">🚤</span>
                    <span class="crew-detail-text">${member.trips} Fahrten</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showCrewModal(member = null) {
    const modal = document.getElementById('crew-modal');
    const form = document.getElementById('crew-form');
    const title = document.getElementById('crew-modal-title');

    if (member) {
        title.textContent = 'Crew-Mitglied bearbeiten';
        document.getElementById('crew-name').value = member.name;
        document.getElementById('crew-role').value = member.role;
        document.getElementById('crew-email').value = member.email || '';
        document.getElementById('crew-phone').value = member.phone || '';
        form.dataset.editId = member.id;
    } else {
        title.textContent = 'Neues Crew-Mitglied';
        form.reset();
        delete form.dataset.editId;
    }

    modal.style.display = 'flex';
    crewModalOpen = true;
}

function hideCrewModal() {
    document.getElementById('crew-modal').style.display = 'none';
    crewModalOpen = false;
}

function editCrewMember(id) {
    const member = crewMembers.find(m => m.id === id);
    if (member) {
        showCrewModal(member);
    }
}

async function deleteCrewMemberConfirm(id) {
    const member = crewMembers.find(m => m.id === id);
    if (!member) return;

    if (confirm(`Crew-Mitglied "${member.name}" wirklich löschen?`)) {
        const success = await deleteCrewMember(id);
        if (success) {
            console.log('✅ Crew member deleted');
        }
    }
}

async function handleCrewFormSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const name = document.getElementById('crew-name').value.trim();
    const role = document.getElementById('crew-role').value;
    const email = document.getElementById('crew-email').value.trim();
    const phone = document.getElementById('crew-phone').value.trim();

    if (!name) {
        alert('Bitte Namen eingeben');
        return;
    }

    const editId = form.dataset.editId;

    if (editId) {
        // Update existing member
        const updated = await updateCrewMember(parseInt(editId), { name, role, email, phone });
        if (updated) {
            console.log('✅ Crew member updated');
            hideCrewModal();
        }
    } else {
        // Add new member
        const newMember = await addCrewMember(name, role, email, phone);
        if (newMember) {
            console.log('✅ Crew member added');
            hideCrewModal();
        }
    }
}

// ==================== Panel Functions ====================

function showCrewPanel() {
    hideAllPanels();
    const panel = document.getElementById('crew-panel');
    if (panel) {
        panel.style.display = 'block';
        loadCrewMembers();
    }
}

function hideCrewPanel() {
    const panel = document.getElementById('crew-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

// ==================== Initialization ====================

// Make functions globally available
window.showCrewModal = showCrewModal;
window.hideCrewModal = hideCrewModal;
window.showCrewPanel = showCrewPanel;
window.hideCrewPanel = hideCrewPanel;
window.editCrewMember = editCrewMember;
window.deleteCrewMemberConfirm = deleteCrewMemberConfirm;

document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    const crewForm = document.getElementById('crew-form');
    if (crewForm) {
        crewForm.addEventListener('submit', handleCrewFormSubmit);
    }

    // Close modal when clicking outside
    const crewModal = document.getElementById('crew-modal');
    if (crewModal) {
        crewModal.addEventListener('click', (e) => {
            if (e.target === crewModal) {
                hideCrewModal();
            }
        });
    }
});
