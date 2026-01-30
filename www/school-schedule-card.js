/**
 * School Schedule Card for Home Assistant
 * Displays children's school items in a visual grid layout
 */

class SchoolScheduleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Escape HTML to prevent XSS attacks
   */
  _escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Escape attribute value
   */
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
    this._updateContent();
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this._config = {
      entity: config.entity,
      title: config.title || 'School Schedule',
      show_header: config.show_header !== false,
      show_date: config.show_date !== false,
      show_item_names: config.show_item_names !== false,
      columns: config.columns || 'auto',
      image_size: config.image_size || 80,
      children: config.children || [],
      ...config
    };
    this._updateContent();
  }

  _updateContent() {
    if (!this._hass || !this._config) return;

    const entityId = this._config.entity;
    const state = this._hass.states[entityId];

    if (!state) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div class="error">Entity not found: ${this._escapeHtml(entityId)}</div>
        </ha-card>
      `;
      return;
    }

    const attrs = state.attributes;
    const children = attrs.children || {};
    const displayDate = attrs.display_date;
    const isTomorrow = attrs.is_tomorrow;

    // Filter children if specified
    let childrenToShow = Object.entries(children);
    if (this._config.children && this._config.children.length > 0) {
      childrenToShow = childrenToShow.filter(([name]) =>
        this._config.children.includes(name)
      );
    }

    const numColumns = this._config.columns === 'auto'
      ? Math.max(1, childrenToShow.length)
      : this._config.columns;

    const imageSize = parseInt(this._config.image_size) || 80;
    const mobileImageSize = Math.min(imageSize, 60);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --card-padding: 16px;
          --image-size: ${imageSize}px;
          --column-gap: 16px;
          --item-gap: 12px;
        }
        ha-card {
          padding: var(--card-padding);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .title {
          font-size: 1.2em;
          font-weight: 500;
        }
        .date-badge {
          background: var(--primary-color);
          color: var(--text-primary-color);
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85em;
          font-weight: 500;
        }
        .date-badge.tomorrow {
          background: var(--accent-color, #ff9800);
        }
        .children-grid {
          display: grid;
          grid-template-columns: repeat(${numColumns}, 1fr);
          gap: var(--column-gap);
        }
        .child-column {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .child-name {
          font-weight: 500;
          font-size: 1.1em;
          margin-bottom: 12px;
          text-align: center;
          color: var(--primary-text-color);
        }
        .items-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--item-gap);
          width: 100%;
        }
        .item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .item-image {
          width: var(--image-size);
          height: var(--image-size);
          object-fit: contain;
          border-radius: 8px;
          background: var(--card-background-color, #fff);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .item-image-placeholder {
          width: var(--image-size);
          height: var(--image-size);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--secondary-background-color);
          border-radius: 8px;
          color: var(--secondary-text-color);
        }
        .item-name {
          margin-top: 4px;
          font-size: 0.85em;
          color: var(--secondary-text-color);
          max-width: var(--image-size);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .no-items {
          color: var(--secondary-text-color);
          font-style: italic;
          text-align: center;
          padding: 20px;
        }
        .error {
          color: var(--error-color, red);
          padding: 16px;
        }

        @media (max-width: 600px) {
          :host {
            --image-size: ${mobileImageSize}px;
            --column-gap: 8px;
            --item-gap: 8px;
          }
          .child-name {
            font-size: 0.95em;
          }
          .item-name {
            font-size: 0.75em;
          }
        }
      </style>

      <ha-card>
        ${this._config.show_header ? `
          <div class="header">
            <span class="title">${this._escapeHtml(this._config.title)}</span>
            ${this._config.show_date && displayDate ? `
              <span class="date-badge ${isTomorrow ? 'tomorrow' : ''}">
                ${isTomorrow ? 'Tomorrow' : 'Today'} - ${this._escapeHtml(this._formatDate(displayDate))}
              </span>
            ` : ''}
          </div>
        ` : ''}

        ${childrenToShow.length === 0 ? `
          <div class="no-items">No children configured</div>
        ` : `
          <div class="children-grid">
            ${childrenToShow.map(([name, data]) => this._renderChild(name, data)).join('')}
          </div>
        `}
      </ha-card>
    `;

    // Add error handlers for images after DOM is built
    this.shadowRoot.querySelectorAll('.item-image').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        const placeholder = img.nextElementSibling;
        if (placeholder) placeholder.style.display = 'flex';
      });
    });
  }

  _renderChild(name, data) {
    const items = data.items_today || [];

    return `
      <div class="child-column">
        <div class="child-name">${this._escapeHtml(name)}</div>
        <div class="items-container">
          ${items.length === 0 ? `
            <div class="no-items">No items today</div>
          ` : items.map(item => this._renderItem(item)).join('')}
        </div>
      </div>
    `;
  }

  _renderItem(item) {
    const imageSrc = item.image;
    const hasImage = imageSrc && imageSrc.trim() !== '';
    const itemName = this._escapeHtml(item.name);
    const safeImageSrc = this._escapeAttr(imageSrc);

    return `
      <div class="item">
        ${hasImage ? `
          <img class="item-image" src="${safeImageSrc}" alt="${itemName}">
          <div class="item-image-placeholder" style="display:none;">
            <ha-icon icon="mdi:image-off"></ha-icon>
          </div>
        ` : `
          <div class="item-image-placeholder">
            <ha-icon icon="mdi:image-off"></ha-icon>
          </div>
        `}
        ${this._config.show_item_names ? `
          <span class="item-name" title="${itemName}">${itemName}</span>
        ` : ''}
      </div>
    `;
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement('school-schedule-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'sensor.school_schedule',
      title: 'School Schedule',
      show_header: true,
      show_date: true,
      show_item_names: true,
      columns: 'auto',
      image_size: 80
    };
  }
}

/**
 * Card Editor for visual configuration
 */
class SchoolScheduleCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
  }

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
    }
  }

  setConfig(config) {
    this._config = config;
    if (this._initialized) {
      this._render();
    }
  }

  _render() {
    if (!this._hass || !this._config) return;

    this.shadowRoot.innerHTML = `
      <style>
        .form-row {
          margin-bottom: 16px;
        }
        .form-row label {
          display: block;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .form-row input, .form-row select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          box-sizing: border-box;
        }
        .form-row input[type="checkbox"] {
          width: auto;
          margin-right: 8px;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
        }
      </style>

      <div class="form-row">
        <label for="entity">Entity</label>
        <select id="entity">
          ${this._getEntityOptions()}
        </select>
      </div>

      <div class="form-row">
        <label for="title">Title</label>
        <input type="text" id="title" value="${this._escapeAttr(this._config.title || 'School Schedule')}">
      </div>

      <div class="form-row">
        <label for="image_size">Image Size (px)</label>
        <input type="number" id="image_size" value="${parseInt(this._config.image_size) || 80}" min="40" max="200">
      </div>

      <div class="form-row">
        <label for="columns">Columns</label>
        <select id="columns">
          <option value="auto" ${this._config.columns === 'auto' ? 'selected' : ''}>Auto</option>
          <option value="1" ${this._config.columns === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${this._config.columns === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${this._config.columns === 3 ? 'selected' : ''}>3</option>
          <option value="4" ${this._config.columns === 4 ? 'selected' : ''}>4</option>
        </select>
      </div>

      <div class="form-row checkbox-row">
        <input type="checkbox" id="show_header" ${this._config.show_header !== false ? 'checked' : ''}>
        <label for="show_header">Show Header</label>
      </div>

      <div class="form-row checkbox-row">
        <input type="checkbox" id="show_date" ${this._config.show_date !== false ? 'checked' : ''}>
        <label for="show_date">Show Date Badge</label>
      </div>

      <div class="form-row checkbox-row">
        <input type="checkbox" id="show_item_names" ${this._config.show_item_names !== false ? 'checked' : ''}>
        <label for="show_item_names">Show Item Names</label>
      </div>
    `;

    // Add event listeners
    ['entity', 'title', 'image_size', 'columns', 'show_header', 'show_date', 'show_item_names'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this._valueChanged());
      }
    });
  }

  _getEntityOptions() {
    if (!this._hass) return '';

    const entities = Object.keys(this._hass.states)
      .filter(e => e.startsWith('sensor.') &&
        this._hass.states[e].attributes.children !== undefined)
      .sort();

    const allSensors = Object.keys(this._hass.states)
      .filter(e => e.startsWith('sensor.'))
      .sort();

    const options = [...new Set([...entities, ...allSensors])];

    return options.map(e =>
      `<option value="${this._escapeAttr(e)}" ${e === this._config.entity ? 'selected' : ''}>${this._escapeHtml(e)}</option>`
    ).join('');
  }

  _valueChanged() {
    const config = {
      ...this._config,
      entity: this.shadowRoot.getElementById('entity').value,
      title: this.shadowRoot.getElementById('title').value,
      image_size: parseInt(this.shadowRoot.getElementById('image_size').value) || 80,
      columns: this.shadowRoot.getElementById('columns').value === 'auto'
        ? 'auto'
        : parseInt(this.shadowRoot.getElementById('columns').value),
      show_header: this.shadowRoot.getElementById('show_header').checked,
      show_date: this.shadowRoot.getElementById('show_date').checked,
      show_item_names: this.shadowRoot.getElementById('show_item_names').checked,
    };

    const event = new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

customElements.define('school-schedule-card', SchoolScheduleCard);
customElements.define('school-schedule-card-editor', SchoolScheduleCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'school-schedule-card',
  name: 'School Schedule Card',
  description: 'Display school items needed for each child',
  preview: true,
  documentationURL: 'https://github.com/your-repo/ha-school-schedule',
});

console.info(
  '%c SCHOOL-SCHEDULE-CARD %c 1.0.0 ',
  'color: white; background: #3498db; font-weight: 700;',
  'color: #3498db; background: white; font-weight: 700;'
);
