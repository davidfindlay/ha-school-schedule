/**
 * School Schedule Management Panel
 * Provides a full UI for managing children, items, and schedules
 * Version: 1.0.13 - Defer DOM updates during user interaction
 */

class SchoolSchedulePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._activeTab = 'children';
    this._selectedChild = null;
    this._selectedDay = 'monday';
    this._selectedExceptionDate = null;
    this._exceptionItemIds = null; // null = not editing, array = editing
    this._initialized = false;
    this._boundHandlers = new Map();
    this._userInteracting = false;
    this._pendingUpdate = false;
    this._interactionTimeout = null;
    this._filePickerOpen = false;
  }

  // XSS prevention helpers
  _escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  _escapeAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._render();
    } else {
      this._updateData();
    }
  }

  setConfig(config) {
    this._config = {
      entity: config.entity || 'sensor.school_schedule',
      ...config
    };
  }

  _getData() {
    if (!this._hass || !this._config) return null;
    const state = this._hass.states[this._config.entity];
    return state?.attributes || null;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --panel-primary-color: #03a9f4;
          --panel-accent-color: #ff9800;
          --panel-danger-color: #f44336;
        }
        ha-card { padding: 0; overflow: hidden; }
        .panel-header {
          background: #03a9f4;
          color: white;
          padding: 16px 20px;
        }
        .panel-header h2 { margin: 0; font-size: 1.4em; font-weight: 500; }
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, white);
        }
        .tab {
          flex: 1; padding: 12px 16px; text-align: center;
          cursor: pointer; border: none; background: none;
          font-size: 0.95em; color: var(--primary-text-color);
          border-bottom: 3px solid transparent; transition: all 0.2s;
        }
        .tab:hover { background: var(--secondary-background-color, #f5f5f5); }
        .tab.active {
          color: #03a9f4;
          border-bottom-color: #03a9f4;
          font-weight: 500;
        }
        .content { padding: 20px; min-height: 400px; }
        .form-group { margin-bottom: 16px; }
        .form-group label {
          display: block; margin-bottom: 6px;
          font-weight: 500; color: var(--primary-text-color);
        }
        .form-group input, .form-group select {
          width: 100%; padding: 10px 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px; font-size: 1em;
          background: var(--card-background-color, #ffffff);
          color: var(--primary-text-color, #212121); box-sizing: border-box;
        }
        .form-group input:focus, .form-group select:focus {
          outline: none; border-color: #03a9f4;
        }
        button.btn {
          display: inline-block !important;
          visibility: visible !important;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.95em;
          transition: opacity 0.2s;
          font-family: inherit;
          min-width: 100px;
          background-color: #cccccc;
        }
        button.btn:hover { opacity: 0.85; }
        button.btn:disabled { opacity: 0.5; cursor: not-allowed; }
        button.btn.btn-primary {
          background-color: #03a9f4 !important;
          color: #ffffff !important;
        }
        button.btn.btn-danger {
          background-color: #f44336 !important;
          color: #ffffff !important;
        }
        .btn-sm { padding: 6px 12px; font-size: 0.85em; }
        button.btn.btn-secondary {
          background-color: #757575 !important;
          color: #ffffff !important;
        }
        .image-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .image-input-row input {
          flex: 1;
        }
        .image-input-row .btn {
          flex-shrink: 0;
          min-width: auto;
          padding: 10px 16px;
        }
        .upload-status {
          margin-top: 8px;
          font-size: 0.9em;
        }
        .upload-status.uploading { color: #ff9800; }
        .upload-status.success { color: #4caf50; }
        .upload-status.error { color: #f44336; }
        .image-preview {
          margin-top: 8px;
        }
        .image-preview img {
          max-width: 100px;
          max-height: 100px;
          border-radius: 4px;
          border: 1px solid var(--divider-color, #e0e0e0);
        }
        .item-list { list-style: none; padding: 0; margin: 0; }
        .item-list li {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px; border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .item-list li:last-child { border-bottom: none; }
        .item-list .item-info { display: flex; align-items: center; gap: 12px; }
        .item-list .item-image {
          width: 48px; height: 48px; object-fit: contain;
          border-radius: 4px; background: var(--secondary-background-color);
        }
        .item-list .item-details { display: flex; flex-direction: column; }
        .item-list .item-name { font-weight: 500; }
        .item-list .item-id { font-size: 0.8em; color: var(--secondary-text-color); }
        .item-actions { display: flex; gap: 8px; }
        .section { margin-bottom: 24px; }
        .section-header {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 12px;
        }
        .section-title { font-size: 1.1em; font-weight: 500; color: var(--primary-text-color); }
        .schedule-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 8px; margin-bottom: 16px;
        }
        .day-btn {
          padding: 10px; text-align: center;
          border: 1px solid var(--divider-color); border-radius: 4px;
          cursor: pointer; background: var(--card-background-color);
          color: var(--primary-text-color); transition: all 0.2s;
        }
        .day-btn:hover { background: var(--secondary-background-color); }
        .day-btn.active {
          background: #03a9f4; color: white;
          border-color: #03a9f4;
        }
        .checkbox-list { list-style: none; padding: 0; margin: 0; }
        .checkbox-list li {
          display: flex; align-items: center;
          padding: 10px 12px; border-bottom: 1px solid var(--divider-color);
        }
        .checkbox-list li:last-child { border-bottom: none; }
        .checkbox-list input[type="checkbox"] { margin-right: 12px; width: 18px; height: 18px; }
        .checkbox-list .item-thumb {
          width: 32px; height: 32px; object-fit: contain;
          margin-right: 10px; border-radius: 4px;
        }
        .child-selector { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .child-chip {
          padding: 8px 16px; border-radius: 20px;
          border: 1px solid var(--divider-color); cursor: pointer;
          background: var(--card-background-color);
          color: var(--primary-text-color); transition: all 0.2s;
        }
        .child-chip:hover { background: var(--secondary-background-color); }
        .child-chip.active {
          background: #03a9f4; color: white;
          border-color: #03a9f4;
        }
        .child-chip.shared-chip {
          border-style: dashed;
          font-style: italic;
        }
        .child-chip.shared-chip.active {
          background: #9c27b0; color: white;
          border-color: #9c27b0;
          border-style: solid;
        }
        .exception-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px; background: var(--secondary-background-color);
          border-radius: 4px; margin-bottom: 8px;
        }
        .exception-date { font-weight: 500; }
        .exception-items { font-size: 0.9em; color: var(--secondary-text-color); }
        .empty-state {
          text-align: center; padding: 40px 20px;
          color: var(--secondary-text-color);
        }
        .empty-state ha-icon { --mdc-icon-size: 48px; margin-bottom: 12px; opacity: 0.5; }
        .message { padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; }
        .message.success { background: #e8f5e9; color: #2e7d32; }
        .message.error { background: #ffebee; color: #c62828; }
        .loading { opacity: 0.6; pointer-events: none; }

        /* Confirmation Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s, visibility 0.2s;
        }
        .modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }
        .modal-dialog {
          background: var(--card-background-color, white);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
          overflow: hidden;
          transform: scale(0.9);
          transition: transform 0.2s;
        }
        .modal-overlay.visible .modal-dialog {
          transform: scale(1);
        }
        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.2em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .modal-content {
          padding: 20px;
          color: var(--primary-text-color);
        }
        .modal-content p {
          margin: 0;
          line-height: 1.5;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
      </style>

      <ha-card>
        <div class="panel-header">
          <h2>School Schedule Manager</h2>
        </div>
        <div class="tabs">
          <button class="tab ${this._activeTab === 'children' ? 'active' : ''}" data-tab="children">Children</button>
          <button class="tab ${this._activeTab === 'items' ? 'active' : ''}" data-tab="items">Items</button>
          <button class="tab ${this._activeTab === 'schedule' ? 'active' : ''}" data-tab="schedule">Schedule</button>
          <button class="tab ${this._activeTab === 'exceptions' ? 'active' : ''}" data-tab="exceptions">Exceptions</button>
        </div>
        <div class="content" id="content">
          ${this._renderTabContent()}
        </div>
      </ha-card>

      <div class="modal-overlay" id="confirm-modal">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 id="modal-title">Confirm</h3>
          </div>
          <div class="modal-content">
            <p id="modal-message"></p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
            <button class="btn btn-danger" id="modal-confirm">Remove</button>
          </div>
        </div>
      </div>
    `;

    this._attachEventListeners();
    this._attachInteractionListeners();
  }

  _markUserInteracting() {
    this._userInteracting = true;
    clearTimeout(this._interactionTimeout);
    this._interactionTimeout = setTimeout(() => {
      this._userInteracting = false;
      if (this._pendingUpdate) {
        this._pendingUpdate = false;
        this._updateData();
      }
    }, 2000);
  }

  _attachInteractionListeners() {
    const root = this.shadowRoot;
    root.addEventListener('focusin', () => this._markUserInteracting());
    root.addEventListener('keydown', () => this._markUserInteracting());
    root.addEventListener('mousedown', () => this._markUserInteracting());
    // Detect file picker cancel (window regains focus without change event)
    window.addEventListener('focus', () => {
      if (this._filePickerOpen) {
        setTimeout(() => { this._filePickerOpen = false; }, 300);
      }
    });
  }

  _showConfirmModal(title, message, onConfirm) {
    const modal = this.shadowRoot.getElementById('confirm-modal');
    const titleEl = this.shadowRoot.getElementById('modal-title');
    const messageEl = this.shadowRoot.getElementById('modal-message');
    const confirmBtn = this.shadowRoot.getElementById('modal-confirm');
    const cancelBtn = this.shadowRoot.getElementById('modal-cancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.add('visible');

    // Store the callback
    this._confirmCallback = onConfirm;

    // Clean up old listeners and add new ones
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newConfirmBtn.addEventListener('click', () => {
      modal.classList.remove('visible');
      if (this._confirmCallback) {
        this._confirmCallback();
        this._confirmCallback = null;
      }
    });

    newCancelBtn.addEventListener('click', () => {
      modal.classList.remove('visible');
      this._confirmCallback = null;
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('visible');
        this._confirmCallback = null;
      }
    }, { once: true });
  }

  _renderTabContent() {
    switch (this._activeTab) {
      case 'children': return this._renderChildrenTab();
      case 'items': return this._renderItemsTab();
      case 'schedule': return this._renderScheduleTab();
      case 'exceptions': return this._renderExceptionsTab();
      default: return '';
    }
  }

  _renderChildrenTab() {
    const data = this._getData();

    // Check if entity exists
    if (!data) {
      return `
        <div class="empty-state">
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          <p>Entity not found: ${this._escapeHtml(this._config.entity)}</p>
          <p style="font-size: 0.9em; margin-top: 8px;">Make sure the School Schedule integration is installed.</p>
        </div>
      `;
    }

    const children = data?.children || {};
    const childNames = Object.keys(children);

    return `
      <div class="section">
        <div class="section-header">
          <span class="section-title">Your Children</span>
        </div>
        ${childNames.length === 0 ? `
          <div class="empty-state">
            <ha-icon icon="mdi:account-child"></ha-icon>
            <p>No children added yet</p>
          </div>
        ` : `
          <ul class="item-list">
            ${childNames.map(name => `
              <li>
                <div class="item-info">
                  <ha-icon icon="mdi:account-child"></ha-icon>
                  <span class="item-name">${this._escapeHtml(name)}</span>
                </div>
                <div class="item-actions">
                  <button class="btn btn-danger btn-sm" data-action="remove-child" data-name="${this._escapeAttr(name)}">Remove</button>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Add New Child</span>
        </div>
        <div class="form-group">
          <label for="child-name">Child's Name</label>
          <input type="text" id="child-name" placeholder="e.g., Emma">
        </div>
        <button class="btn btn-primary" id="add-child-btn">Add Child</button>
      </div>
    `;
  }

  _renderItemsTab() {
    const data = this._getData();
    if (!data) {
      return `
        <div class="empty-state">
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          <p>Entity not found: ${this._escapeHtml(this._config.entity)}</p>
        </div>
      `;
    }

    const children = data.children || {};
    const childNames = Object.keys(children);
    const library = data.item_library || [];

    // Include "Shared" as a special option
    const allOptions = ['Shared', ...childNames];

    // Default to Shared if nothing selected, or validate selection
    if (!this._selectedChild || (this._selectedChild !== 'Shared' && !childNames.includes(this._selectedChild))) {
      this._selectedChild = 'Shared';
    }

    const isShared = this._selectedChild === 'Shared';
    const items = isShared ? library : (children[this._selectedChild]?.all_items || []);
    const sectionTitle = isShared ? 'Shared Items' : `${this._escapeHtml(this._selectedChild)}'s Items`;
    const emptyMessage = isShared
      ? 'No shared items yet. Add items here to assign to multiple children.'
      : 'No items added yet';

    return `
      <div class="section">
        <div class="section-header"><span class="section-title">Select</span></div>
        <div class="child-selector">
          ${allOptions.map(name => `
            <div class="child-chip ${name === this._selectedChild ? 'active' : ''} ${name === 'Shared' ? 'shared-chip' : ''}" data-child="${this._escapeAttr(name)}">${this._escapeHtml(name)}</div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">${sectionTitle}</span>
        </div>
        ${items.length === 0 ? `
          <div class="empty-state"><ha-icon icon="mdi:${isShared ? 'package-variant' : 'bag-personal'}"></ha-icon><p>${emptyMessage}</p></div>
        ` : `
          <ul class="item-list">
            ${items.map(item => `
              <li>
                <div class="item-info">
                  ${item.image ? `<img class="item-image" src="${this._escapeAttr(item.image)}" alt="${this._escapeAttr(item.name)}">` : `<ha-icon icon="mdi:image"></ha-icon>`}
                  <div class="item-details">
                    <span class="item-name">${this._escapeHtml(item.name)}</span>
                    <span class="item-id">ID: ${this._escapeHtml(item.id)}</span>
                  </div>
                </div>
                <div class="item-actions">
                  <button class="btn btn-danger btn-sm" data-action="${isShared ? 'remove-library-item' : 'remove-item'}" data-id="${this._escapeAttr(item.id)}">Remove</button>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="section">
        <div class="section-header"><span class="section-title">Add New Item</span></div>
        <div class="form-group">
          <label for="item-name">Item Name</label>
          <input type="text" id="item-name" placeholder="e.g., Formal Uniform">
        </div>
        <div class="form-group">
          <label for="item-image">Image</label>
          <div class="image-input-row">
            <input type="text" id="item-image" placeholder="e.g., /local/school/formal.png" readonly>
            <button class="btn btn-secondary" id="upload-image-btn" type="button">Upload Image</button>
          </div>
          <input type="file" id="image-file-input" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" style="display: none;">
          <div id="upload-status" class="upload-status"></div>
          <div id="image-preview" class="image-preview"></div>
        </div>
        <button class="btn btn-primary" id="add-item-btn">Add Item</button>
      </div>
    `;
  }

  _renderScheduleTab() {
    const data = this._getData();
    const children = data?.children || {};
    const childNames = Object.keys(children);
    const library = data?.item_library || [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    if (childNames.length === 0) {
      return `<div class="empty-state"><ha-icon icon="mdi:account-child"></ha-icon><p>Please add a child first</p></div>`;
    }

    if (!this._selectedChild || !childNames.includes(this._selectedChild)) {
      this._selectedChild = childNames[0];
    }

    const childData = children[this._selectedChild] || {};
    const childItems = childData.all_items || [];
    // Combine child's own items with shared library items
    const allItems = [...childItems, ...library];
    const weeklySchedule = childData.weekly_schedule || {};
    const scheduledItemIds = weeklySchedule[this._selectedDay] || [];

    // Split items into scheduled and available
    const scheduledItems = scheduledItemIds
      .map(id => allItems.find(item => item.id === id))
      .filter(item => item); // Filter out undefined (items that no longer exist)
    const availableItems = allItems.filter(item => !scheduledItemIds.includes(item.id));

    const dayTitle = this._selectedDay.charAt(0).toUpperCase() + this._selectedDay.slice(1);

    return `
      <div class="section">
        <div class="section-header"><span class="section-title">Select Child</span></div>
        <div class="child-selector">
          ${childNames.map(name => `
            <div class="child-chip ${name === this._selectedChild ? 'active' : ''}" data-child="${this._escapeAttr(name)}">${this._escapeHtml(name)}</div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><span class="section-title">Day of Week</span></div>
        <div class="schedule-grid">
          ${days.map(day => `
            <div class="day-btn ${day === this._selectedDay ? 'active' : ''}" data-day="${day}">
              ${day.charAt(0).toUpperCase() + day.slice(1, 3)}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Items Scheduled for ${dayTitle}</span>
        </div>
        ${scheduledItems.length === 0 ? `
          <div class="empty-state" style="padding: 20px;"><ha-icon icon="mdi:calendar-blank"></ha-icon><p>No items scheduled for ${dayTitle}</p></div>
        ` : `
          <ul class="item-list">
            ${scheduledItems.map(item => `
              <li>
                <div class="item-info">
                  ${item.image ? `<img class="item-image" src="${this._escapeAttr(item.image)}" alt="${this._escapeAttr(item.name)}">` : `<ha-icon icon="mdi:image"></ha-icon>`}
                  <div class="item-details">
                    <span class="item-name">${this._escapeHtml(item.name)}</span>
                    <span class="item-id">ID: ${this._escapeHtml(item.id)}</span>
                  </div>
                </div>
                <div class="item-actions">
                  <button class="btn btn-danger btn-sm" data-action="unschedule-item" data-id="${this._escapeAttr(item.id)}">Remove</button>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title">Items Available</span>
        </div>
        ${allItems.length === 0 ? `
          <div class="empty-state" style="padding: 20px;"><ha-icon icon="mdi:bag-personal"></ha-icon><p>No items defined. Add items first in the Items tab.</p></div>
        ` : availableItems.length === 0 ? `
          <div class="empty-state" style="padding: 20px;"><ha-icon icon="mdi:check-all"></ha-icon><p>All items are scheduled</p></div>
        ` : `
          <ul class="item-list">
            ${availableItems.map(item => `
              <li>
                <div class="item-info">
                  ${item.image ? `<img class="item-image" src="${this._escapeAttr(item.image)}" alt="${this._escapeAttr(item.name)}">` : `<ha-icon icon="mdi:image"></ha-icon>`}
                  <div class="item-details">
                    <span class="item-name">${this._escapeHtml(item.name)}</span>
                    <span class="item-id">ID: ${this._escapeHtml(item.id)}</span>
                  </div>
                </div>
                <div class="item-actions">
                  <button class="btn btn-primary btn-sm" data-action="schedule-item" data-id="${this._escapeAttr(item.id)}">Add</button>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>
    `;
  }

  _renderExceptionsTab() {
    const data = this._getData();
    const children = data?.children || {};
    const childNames = Object.keys(children);
    const library = data?.item_library || [];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    if (childNames.length === 0) {
      return `<div class="empty-state"><ha-icon icon="mdi:account-child"></ha-icon><p>Please add a child first</p></div>`;
    }

    if (!this._selectedChild || !childNames.includes(this._selectedChild)) {
      this._selectedChild = childNames[0];
    }

    const childData = children[this._selectedChild] || {};
    const childItems = childData.all_items || [];
    const allItems = [...childItems, ...library];
    const exceptions = childData.exceptions || {};
    const weeklySchedule = childData.weekly_schedule || {};

    // Filter out past dates (keep today and future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const futureExceptionDates = Object.keys(exceptions)
      .filter(date => date >= todayStr)
      .sort();

    // Build the "add new exception" section
    // If a date is selected and we have exception items being edited, show the two-table UI
    const isEditing = this._selectedExceptionDate && this._exceptionItemIds !== null;
    let editSection = '';

    if (isEditing) {
      const exItemIds = this._exceptionItemIds;
      const exScheduledItems = exItemIds
        .map(id => allItems.find(item => item.id === id))
        .filter(item => item);
      const exAvailableItems = allItems.filter(item => !exItemIds.includes(item.id));

      editSection = `
        <div class="section">
          <div class="section-header"><span class="section-title">Exception Date</span></div>
          <div class="form-group">
            <input type="date" id="exception-date" value="${this._escapeAttr(this._selectedExceptionDate)}" min="${todayStr}">
          </div>
          <p style="color: var(--secondary-text-color); font-size: 0.9em; margin: 0 0 16px;">
            Items selected below will replace the normal schedule for this date.
          </p>
        </div>

        <div class="section">
          <div class="section-header">
            <span class="section-title">Items for ${this._escapeHtml(this._formatDate(this._selectedExceptionDate))}</span>
          </div>
          ${exScheduledItems.length === 0 ? `
            <div class="empty-state" style="padding: 20px;"><ha-icon icon="mdi:calendar-remove"></ha-icon><p>No items (day off)</p></div>
          ` : `
            <ul class="item-list">
              ${exScheduledItems.map(item => `
                <li>
                  <div class="item-info">
                    ${item.image ? `<img class="item-image" src="${this._escapeAttr(item.image)}" alt="${this._escapeAttr(item.name)}">` : `<ha-icon icon="mdi:image"></ha-icon>`}
                    <div class="item-details">
                      <span class="item-name">${this._escapeHtml(item.name)}</span>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button class="btn btn-danger btn-sm" data-action="exception-remove-item" data-id="${this._escapeAttr(item.id)}">Remove</button>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>

        <div class="section">
          <div class="section-header">
            <span class="section-title">Items Available</span>
          </div>
          ${allItems.length === 0 ? `
            <div class="empty-state" style="padding: 20px;"><ha-icon icon="mdi:bag-personal"></ha-icon><p>No items defined. Add items first in the Items tab.</p></div>
          ` : exAvailableItems.length === 0 ? `
            <div class="empty-state" style="padding: 20px;"><ha-icon icon="mdi:check-all"></ha-icon><p>All items are included</p></div>
          ` : `
            <ul class="item-list">
              ${exAvailableItems.map(item => `
                <li>
                  <div class="item-info">
                    ${item.image ? `<img class="item-image" src="${this._escapeAttr(item.image)}" alt="${this._escapeAttr(item.name)}">` : `<ha-icon icon="mdi:image"></ha-icon>`}
                    <div class="item-details">
                      <span class="item-name">${this._escapeHtml(item.name)}</span>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button class="btn btn-primary btn-sm" data-action="exception-add-item" data-id="${this._escapeAttr(item.id)}">Add</button>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>

        <div class="section" style="display: flex; gap: 12px;">
          <button class="btn btn-primary" id="save-exception-btn">Save Exception</button>
          <button class="btn btn-secondary" id="cancel-exception-btn">Cancel</button>
        </div>
      `;
    } else {
      editSection = `
        <div class="section">
          <div class="section-header"><span class="section-title">Add Exception</span></div>
          <p style="color: var(--secondary-text-color); font-size: 0.9em; margin: 0 0 12px;">
            Override the normal weekly schedule for a specific date.
          </p>
          <div class="form-group">
            <label for="exception-date">Date</label>
            <input type="date" id="exception-date" min="${todayStr}">
          </div>
          <button class="btn btn-primary" id="add-exception-btn">Set Up Exception</button>
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section-header"><span class="section-title">Select Child</span></div>
        <div class="child-selector">
          ${childNames.map(name => `
            <div class="child-chip ${name === this._selectedChild ? 'active' : ''}" data-child="${this._escapeAttr(name)}">${this._escapeHtml(name)}</div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><span class="section-title">Upcoming Exceptions</span></div>
        ${futureExceptionDates.length === 0 ? `
          <div class="empty-state"><ha-icon icon="mdi:calendar-alert"></ha-icon><p>No upcoming exceptions</p></div>
        ` : `
          ${futureExceptionDates.map(date => {
            const itemIds = exceptions[date] || [];
            const itemNames = itemIds.map(id => {
              const item = allItems.find(i => i.id === id);
              return item ? item.name : id;
            }).join(', ');
            return `
              <div class="exception-item">
                <div>
                  <div class="exception-date">${this._escapeHtml(this._formatDate(date))}</div>
                  <div class="exception-items">${this._escapeHtml(itemNames || 'No items (day off)')}</div>
                </div>
                <div class="item-actions">
                  <button class="btn btn-primary btn-sm" data-action="edit-exception" data-date="${this._escapeAttr(date)}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-action="remove-exception" data-date="${this._escapeAttr(date)}">Remove</button>
                </div>
              </div>
            `;
          }).join('')}
        `}
      </div>

      ${editSection}
    `;
  }

  _formatDate(dateStr) {
    if (!dateStr) return dateStr;
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  _attachEventListeners() {
    // Clear old handlers to prevent memory leaks
    this._boundHandlers.clear();

    // Tab switching
    this.shadowRoot.querySelectorAll('.tab').forEach(tab => {
      const handler = () => {
        this._activeTab = tab.dataset.tab;
        this._render();
      };
      tab.addEventListener('click', handler);
      this._boundHandlers.set(tab, handler);
    });

    // Child selector
    this.shadowRoot.querySelectorAll('.child-chip').forEach(chip => {
      const handler = () => {
        this._selectedChild = chip.dataset.child;
        this._render();
      };
      chip.addEventListener('click', handler);
      this._boundHandlers.set(chip, handler);
    });

    // Day selector
    this.shadowRoot.querySelectorAll('.day-btn').forEach(btn => {
      const handler = () => {
        this._selectedDay = btn.dataset.day;
        this._render();
      };
      btn.addEventListener('click', handler);
      this._boundHandlers.set(btn, handler);
    });

    // Add child button
    const addChildBtn = this.shadowRoot.getElementById('add-child-btn');
    if (addChildBtn) {
      addChildBtn.addEventListener('click', () => this._addChild());
    }

    // Remove child buttons
    this.shadowRoot.querySelectorAll('[data-action="remove-child"]').forEach(btn => {
      btn.addEventListener('click', () => this._removeChild(btn.dataset.name));
    });

    // Add item button
    const addItemBtn = this.shadowRoot.getElementById('add-item-btn');
    if (addItemBtn) {
      addItemBtn.addEventListener('click', () => this._addItem());
    }

    // Upload image button
    const uploadBtn = this.shadowRoot.getElementById('upload-image-btn');
    const fileInput = this.shadowRoot.getElementById('image-file-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        this._filePickerOpen = true;
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        this._filePickerOpen = false;
        this._handleImageUpload(e);
      });
    }

    // Remove item buttons
    this.shadowRoot.querySelectorAll('[data-action="remove-item"]').forEach(btn => {
      btn.addEventListener('click', () => this._removeItem(btn.dataset.id));
    });

    // Remove library item buttons (for Shared items)
    this.shadowRoot.querySelectorAll('[data-action="remove-library-item"]').forEach(btn => {
      btn.addEventListener('click', () => this._removeLibraryItem(btn.dataset.id));
    });

    // Schedule item buttons (add item to schedule)
    this.shadowRoot.querySelectorAll('[data-action="schedule-item"]').forEach(btn => {
      btn.addEventListener('click', () => this._scheduleItem(btn.dataset.id));
    });

    // Unschedule item buttons (remove item from schedule)
    this.shadowRoot.querySelectorAll('[data-action="unschedule-item"]').forEach(btn => {
      btn.addEventListener('click', () => this._unscheduleItem(btn.dataset.id));
    });

    // Exception: "Set Up Exception" button (non-editing mode)
    const addExceptionBtn = this.shadowRoot.getElementById('add-exception-btn');
    if (addExceptionBtn) {
      addExceptionBtn.addEventListener('click', () => this._startException());
    }

    // Exception: Save and Cancel buttons (editing mode)
    const saveExceptionBtn = this.shadowRoot.getElementById('save-exception-btn');
    if (saveExceptionBtn) {
      saveExceptionBtn.addEventListener('click', () => this._saveException());
    }
    const cancelExceptionBtn = this.shadowRoot.getElementById('cancel-exception-btn');
    if (cancelExceptionBtn) {
      cancelExceptionBtn.addEventListener('click', () => this._cancelException());
    }

    // Exception: date input change (while editing)
    const exceptionDateInput = this.shadowRoot.getElementById('exception-date');
    if (exceptionDateInput && this._exceptionItemIds !== null) {
      exceptionDateInput.addEventListener('change', (e) => this._onExceptionDateChange(e.target.value));
    }

    // Exception: add/remove item buttons in editing mode
    this.shadowRoot.querySelectorAll('[data-action="exception-add-item"]').forEach(btn => {
      btn.addEventListener('click', () => this._addExceptionItem(btn.dataset.id));
    });
    this.shadowRoot.querySelectorAll('[data-action="exception-remove-item"]').forEach(btn => {
      btn.addEventListener('click', () => this._removeExceptionItem(btn.dataset.id));
    });

    // Exception: edit and remove buttons on existing exceptions
    this.shadowRoot.querySelectorAll('[data-action="edit-exception"]').forEach(btn => {
      btn.addEventListener('click', () => this._editException(btn.dataset.date));
    });
    this.shadowRoot.querySelectorAll('[data-action="remove-exception"]').forEach(btn => {
      btn.addEventListener('click', () => this._removeException(btn.dataset.date));
    });
  }

  async _callService(service, data) {
    try {
      await this._hass.callService('school_schedule', service, data);
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 300));
      this._render();
    } catch (error) {
      console.error('Service call failed:', error);
      // Show error in a non-blocking way
      const content = this.shadowRoot.getElementById('content');
      if (content) {
        const msg = document.createElement('div');
        msg.className = 'message error';
        msg.textContent = 'Error: ' + (error.message || 'Service call failed');
        content.prepend(msg);
        setTimeout(() => msg.remove(), 5000);
      }
    }
  }

  _addChild() {
    const nameInput = this.shadowRoot.getElementById('child-name');
    const name = nameInput?.value?.trim();
    if (!name) {
      this._showMessage('Please enter a name', 'error');
      return;
    }
    this._callService('add_child', { name });
  }

  _removeChild(name) {
    this._showConfirmModal(
      'Remove Child',
      `Are you sure you want to remove ${name}? This will also remove all their items and schedules.`,
      () => this._callService('remove_child', { name })
    );
  }

  _generateItemId(name, existingIds) {
    // Convert name to lowercase, replace spaces with underscores, remove invalid chars
    let baseId = name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    // Ensure it starts with a letter
    if (!/^[a-z]/.test(baseId)) {
      baseId = 'item_' + baseId;
    }

    // If no conflict, use the base ID
    if (!existingIds.includes(baseId)) {
      return baseId;
    }

    // Otherwise, add a number suffix
    let counter = 2;
    while (existingIds.includes(`${baseId}_${counter}`)) {
      counter++;
    }
    return `${baseId}_${counter}`;
  }

  _addItem() {
    const itemName = this.shadowRoot.getElementById('item-name')?.value?.trim();
    const image = this.shadowRoot.getElementById('item-image')?.value?.trim();

    if (!itemName) {
      this._showMessage('Please enter an item name', 'error');
      return;
    }

    // Get existing item IDs to check for duplicates
    const data = this._getData();
    const isShared = this._selectedChild === 'Shared';
    let existingIds = [];

    if (isShared) {
      existingIds = (data?.item_library || []).map(item => item.id);
    } else {
      const childData = data?.children?.[this._selectedChild];
      existingIds = (childData?.all_items || []).map(item => item.id);
    }

    // Auto-generate the item ID
    const itemId = this._generateItemId(itemName, existingIds);

    // If "Shared" is selected, add to library; otherwise add to child
    if (isShared) {
      this._callService('add_library_item', {
        item_id: itemId,
        item_name: itemName,
        image: image || ''
      });
    } else {
      this._callService('add_item', {
        child_name: this._selectedChild,
        item_id: itemId,
        item_name: itemName,
        image: image || ''
      });
    }
  }

  _removeItem(itemId) {
    // Find the item name for the message
    const data = this._getData();
    const childData = data?.children?.[this._selectedChild];
    const item = (childData?.all_items || []).find(i => i.id === itemId);
    const itemName = item?.name || itemId;

    this._showConfirmModal(
      'Remove Item',
      `Are you sure you want to remove "${itemName}"? It will also be removed from any schedules.`,
      () => this._callService('remove_item', {
        child_name: this._selectedChild,
        item_id: itemId
      })
    );
  }

  async _handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const statusEl = this.shadowRoot.getElementById('upload-status');
    const previewEl = this.shadowRoot.getElementById('image-preview');
    const imageInput = this.shadowRoot.getElementById('item-image');

    // Show uploading status
    if (statusEl) {
      statusEl.textContent = 'Uploading...';
      statusEl.className = 'upload-status uploading';
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/school_schedule/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._hass.auth.data.access_token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Set the image path in the input
        if (imageInput) {
          imageInput.value = result.path;
        }

        // Show preview
        if (previewEl) {
          previewEl.innerHTML = `<img src="${this._escapeAttr(result.path)}" alt="Preview">`;
        }

        // Show success status
        if (statusEl) {
          statusEl.textContent = `Uploaded: ${result.filename}`;
          statusEl.className = 'upload-status success';
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (statusEl) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'upload-status error';
      }
    }

    // Clear the file input so the same file can be selected again
    event.target.value = '';
  }

  // Shared library item methods
  _removeLibraryItem(itemId) {
    // Find the item name for the message
    const data = this._getData();
    const item = (data?.item_library || []).find(i => i.id === itemId);
    const itemName = item?.name || itemId;

    this._showConfirmModal(
      'Remove Shared Item',
      `Are you sure you want to remove "${itemName}" from the shared library?`,
      () => this._callService('remove_library_item', { item_id: itemId })
    );
  }

  _scheduleItem(itemId) {
    // Get current scheduled items and add the new one
    const data = this._getData();
    const childData = data?.children?.[this._selectedChild] || {};
    const weeklySchedule = childData.weekly_schedule || {};
    const currentItems = [...(weeklySchedule[this._selectedDay] || [])];

    if (!currentItems.includes(itemId)) {
      currentItems.push(itemId);
    }

    this._callService('set_weekly_schedule', {
      child_name: this._selectedChild,
      day: this._selectedDay,
      item_ids: currentItems
    });
  }

  _unscheduleItem(itemId) {
    // Get current scheduled items and remove the item
    const data = this._getData();
    const childData = data?.children?.[this._selectedChild] || {};
    const weeklySchedule = childData.weekly_schedule || {};
    const currentItems = (weeklySchedule[this._selectedDay] || []).filter(id => id !== itemId);

    this._callService('set_weekly_schedule', {
      child_name: this._selectedChild,
      day: this._selectedDay,
      item_ids: currentItems
    });
  }

  _startException() {
    const dateInput = this.shadowRoot.getElementById('exception-date');
    const date = dateInput?.value;

    if (!date) {
      this._showMessage('Please select a date', 'error');
      return;
    }

    // Get the day-of-week default items from the weekly schedule
    const data = this._getData();
    const childData = data?.children?.[this._selectedChild] || {};
    const weeklySchedule = childData.weekly_schedule || {};
    const dayOfWeek = new Date(date + 'T00:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek.getDay()];
    const defaultItems = weeklySchedule[dayName] || [];

    this._selectedExceptionDate = date;
    this._exceptionItemIds = [...defaultItems];
    this._render();
  }

  _editException(date) {
    const data = this._getData();
    const childData = data?.children?.[this._selectedChild] || {};
    const exceptions = childData.exceptions || {};
    const existingItems = exceptions[date] || [];

    this._selectedExceptionDate = date;
    this._exceptionItemIds = [...existingItems];
    this._render();
  }

  _addExceptionItem(itemId) {
    if (!this._exceptionItemIds.includes(itemId)) {
      this._exceptionItemIds.push(itemId);
    }
    this._render();
  }

  _removeExceptionItem(itemId) {
    this._exceptionItemIds = this._exceptionItemIds.filter(id => id !== itemId);
    this._render();
  }

  _onExceptionDateChange(newDate) {
    if (!newDate) return;

    // When date changes, reload default items from the weekly schedule for the new day
    const data = this._getData();
    const childData = data?.children?.[this._selectedChild] || {};
    const weeklySchedule = childData.weekly_schedule || {};
    const exceptions = childData.exceptions || {};

    // If the new date already has an exception, load those items
    if (exceptions[newDate]) {
      this._selectedExceptionDate = newDate;
      this._exceptionItemIds = [...exceptions[newDate]];
    } else {
      // Otherwise load the default weekly schedule items for that day
      const dayOfWeek = new Date(newDate + 'T00:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek.getDay()];
      this._selectedExceptionDate = newDate;
      this._exceptionItemIds = [...(weeklySchedule[dayName] || [])];
    }
    this._render();
  }

  _saveException() {
    if (!this._selectedExceptionDate) return;

    this._callService('add_exception', {
      child_name: this._selectedChild,
      date: this._selectedExceptionDate,
      item_ids: this._exceptionItemIds || []
    });

    // Clear editing state
    this._selectedExceptionDate = null;
    this._exceptionItemIds = null;
  }

  _cancelException() {
    this._selectedExceptionDate = null;
    this._exceptionItemIds = null;
    this._render();
  }

  _removeException(date) {
    const formattedDate = this._formatDate(date);
    this._showConfirmModal(
      'Remove Exception',
      `Are you sure you want to remove the exception for ${formattedDate}?`,
      () => this._callService('remove_exception', {
        child_name: this._selectedChild,
        date: date
      })
    );
  }

  _showMessage(text, type = 'success') {
    const content = this.shadowRoot.getElementById('content');
    if (content) {
      const msg = document.createElement('div');
      msg.className = `message ${type}`;
      msg.textContent = text;
      content.prepend(msg);
      setTimeout(() => msg.remove(), 4000);
    }
  }

  _updateData() {
    // Defer DOM rebuild while user is interacting or file picker is open
    // to prevent losing focus, clearing inputs, and disrupting selections
    if (this._userInteracting || this._filePickerOpen) {
      this._pendingUpdate = true;
      return;
    }
    const contentEl = this.shadowRoot.getElementById('content');
    if (contentEl) {
      contentEl.innerHTML = this._renderTabContent();
      this._attachEventListeners();
    }
  }

  getCardSize() {
    return 6;
  }

  static getConfigElement() {
    return document.createElement('school-schedule-panel-editor');
  }

  static getStubConfig() {
    return { entity: 'sensor.school_schedule' };
  }
}

class SchoolSchedulePanelEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  _escapeAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = config;
    this.shadowRoot.innerHTML = `
      <style>
        .form-row { margin-bottom: 16px; }
        .form-row label { display: block; margin-bottom: 4px; }
        .form-row input {
          width: 100%; padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px; box-sizing: border-box;
        }
      </style>
      <div class="form-row">
        <label>Entity</label>
        <input type="text" id="entity" value="${this._escapeAttr(config.entity || 'sensor.school_schedule')}">
      </div>
    `;

    this.shadowRoot.getElementById('entity').addEventListener('change', (e) => {
      this._config = { ...this._config, entity: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true
      }));
    });
  }
}

customElements.define('school-schedule-panel', SchoolSchedulePanel);
customElements.define('school-schedule-panel-editor', SchoolSchedulePanelEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'school-schedule-panel',
  name: 'School Schedule Manager',
  description: 'Full management panel for school schedule configuration',
  preview: false,
  documentationURL: 'https://github.com/your-repo/ha-school-schedule',
});
