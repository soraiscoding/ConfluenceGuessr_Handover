import React, { useState } from 'react';
import { ButtonThemes } from '../components/componentThemes.js';
import './SpacePageSelect.css';

function SpacePageSelect({ pages = [], onBack, onConfirm }) {
  const [selected, setSelected] = useState(new Set());

  const accessiblePages = pages.filter((p) => !p.restricted);

  const bySpace = pages.reduce((acc, page) => {
    (acc[page.space] = acc[page.space] || []).push(page);
    return acc;
  }, {});

  function togglePage(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === accessiblePages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accessiblePages.map((p) => p.id)));
    }
  }

  function toggleSpace(spacePages) {
    const accessibleInSpace = spacePages.filter((p) => !p.restricted);
    const allSelected = accessibleInSpace.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        accessibleInSpace.forEach((p) => next.delete(p.id));
      } else {
        accessibleInSpace.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }

  function spaceCheckState(spacePages) {
    const accessibleInSpace = spacePages.filter((p) => !p.restricted);
    if (accessibleInSpace.length === 0) return 'none';
    const numSelected = accessibleInSpace.filter((p) => selected.has(p.id)).length;
    if (numSelected === 0) return 'none';
    if (numSelected === accessibleInSpace.length) return 'all';
    return 'some';
  }

  return (
    <div className="sps-container">
      <div className="sps-header">
        <h2 className="sps-title">Choose spaces / pages</h2>
        <p className="sps-subtitle">
          Select the pages you want to include in the game.
        </p>
      </div>

      <div className="sps-select-all-row">
        <label className="sps-checkbox-label">
          <input
            type="checkbox"
            checked={selected.size === accessiblePages.length && accessiblePages.length > 0}
            onChange={toggleAll}
          />
          Select all accessible ({accessiblePages.length} pages)
        </label>
      </div>

      <div className="sps-spaces">
        {Object.entries(bySpace).map(([space, spacePages]) => {
          const state = spaceCheckState(spacePages);
          const accessibleInSpace = spacePages.filter((p) => !p.restricted);
          return (
            <div key={space} className="sps-space-group">
              <div className="sps-space-header">
                <label className="sps-checkbox-label">
                  <input
                    type="checkbox"
                    checked={state === 'all'}
                    ref={(el) => { if (el) el.indeterminate = state === 'some'; }}
                    onChange={() => toggleSpace(spacePages)}
                    disabled={accessibleInSpace.length === 0}
                  />
                  <h3 className="sps-space-name">{space}</h3>
                </label>
              </div>
              <ul className="sps-page-list">
                {spacePages.map((page) => (
                  <li key={page.id} className={`sps-page-item ${page.restricted ? 'sps-page-item--restricted' : ''}`}>
                    <label className={`sps-checkbox-label ${page.restricted ? 'sps-checkbox-label--restricted' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(page.id)}
                        onChange={() => togglePage(page.id)}
                        disabled={page.restricted}
                      />
                      <span className="sps-page-title">{page.title}</span>
                      {page.restricted && (
                        <span className="sps-restricted-badge">🔒 No access</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="sps-actions">
        <button className={ButtonThemes.default_primary} onClick={onBack}>
          Back
        </button>
        <button
          className={ButtonThemes.default_primary}
          onClick={() => onConfirm(selected)}
          disabled={selected.size === 0}
        >
          Confirm ({selected.size} selected)
        </button>
      </div>
    </div>
  );
}

export default SpacePageSelect;