import React, { useState, useEffect } from "react";

const TagSelector = ({ options = [], initialTags = [], onChange }) => {
    const [selectedTags, setSelectedTags] = useState(initialTags);

    useEffect(() => {
        setSelectedTags(initialTags);
    }, [initialTags]);

    const addTag = (tag) => {
        if (!selectedTags.includes(tag)) {
            const updatedTags = [...selectedTags, tag];
            setSelectedTags(updatedTags);
            if (onChange) onChange(updatedTags);
        }
    };

    const removeTag = (tag) => {
        const updatedTags = selectedTags.filter((t) => t !== tag);
        setSelectedTags(updatedTags);
        if (onChange) onChange(updatedTags);
    };

    return (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="flex flex-wrap gap-2 mb-4 border p-2 rounded">
                {selectedTags.length > 0 ? (
                    selectedTags.map((tag, index) => (
                        <span
                            key={index}
                            className="badge badge-secondary gap-2 cursor-pointer"
                            onClick={() => removeTag(tag)}
                        >
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-gray-500">暂无标签，请选择一个选项。</span>
                )}
            </div>

            <select
                className="select select-bordered w-full"
                onChange={(e) => {
                    if (e.target.value) {
                        addTag(e.target.value);
                        e.target.value = "";
                    }
                }}
                value=""
            >
                <option value="" disabled>
                    选择一个选项
                </option>
                {options.filter(option => !selectedTags.includes(option)).map((option, index) => (
                    <option key={index} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default TagSelector;
