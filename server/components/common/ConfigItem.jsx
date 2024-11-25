import React from 'react';

export const ConfigToggle = ({ label, checked, onChange }) => (
    <div className="form-control">
        <label className="label cursor-pointer">
            <span className="label-text">{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="toggle toggle-primary"
            />
        </label>
    </div>
);

export const ConfigInput = ({ label, value, onChange, type = "text", placeholder = "" }) => (
    <div className="form-control">
        <label className="label">
            <span className="label-text">{label}</span>
        </label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(type === "number" ? parseInt(e.target.value) : e.target.value)}
            placeholder={placeholder}
            className="input input-bordered"
        />
    </div>
);

export const ConfigSelect = ({ label, value, onChange, options }) => (
    <div className="form-control">
        <label className="label">
            <span className="label-text">{label}</span>
        </label>
        <select
            className="select select-bordered"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
        >
            {options.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
            ))}
        </select>
    </div>
); 