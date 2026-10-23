"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { tagChoices } from "@/lib/tag-picker";

export function TagPicker({
  name,
  label,
  options,
  selected,
  placeholder = "Search or add",
  labels,
  onChange,
}: {
  name: string;
  label: string;
  options: readonly string[];
  selected: string[];
  placeholder?: string;
  labels?: Record<string, string>;
  onChange?: (picked: string[]) => void;
}) {
  const listId = useId();
  const [picked, setPicked] = useState(selected);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const choices = useMemo(() => tagChoices(options, picked, query), [options, picked, query]);
  const current = choices[Math.min(active, Math.max(choices.length - 1, 0))];
  const labelFor = (value: string) => labels?.[value] ?? value;

  useEffect(() => {
    onChange?.(picked);
  }, [picked, onChange]);

  function add(value: string) {
    setPicked((items) => (items.some((item) => item.toLowerCase() === value.toLowerCase()) ? items : [...items, value]));
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  function remove(value: string) {
    setPicked((items) => items.filter((item) => item !== value));
  }

  return (
    <div className="tag-picker">
      <span id={`${listId}-label`}>{label}</span>
      <div className="tag-chips">
        {picked.map((tag) => (
          <span key={tag} className="tag-chip">
            {labelFor(tag)}
            <button type="button" aria-label={`Remove ${labelFor(tag)}`} onClick={() => remove(tag)}>×</button>
            <input type="hidden" name={name} value={tag} />
          </span>
        ))}
      </div>
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        aria-labelledby={`${listId}-label`}
        aria-activedescendant={open && current ? `${listId}-${active}` : undefined}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, choices.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && current) {
            event.preventDefault();
            add(current.value);
          } else if (event.key === "Escape") {
            setOpen(false);
          } else if (event.key === "Backspace" && query === "" && picked.length) {
            remove(picked[picked.length - 1]);
          }
        }}
      />
      {open && choices.length > 0 ? (
        <ul id={listId} role="listbox" aria-label={label}>
          {choices.map((choice, index) => (
            <li key={`${choice.add ? "add" : "opt"}-${choice.value}`}>
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? "on" : ""}
                onMouseEnter={() => setActive(index)}
                onClick={() => add(choice.value)}
              >
                {choice.add ? `Add "${choice.value}"` : labelFor(choice.value)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
