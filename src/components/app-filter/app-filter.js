import React from "react";
import "./app-filter.css";

const AppFilter = (props) => {
  const buttonsData = [
    { name: "all", label: "All employees" },
    { name: "promotion", label: "Up for promotion" },
    { name: "salary", label: "Salary more than $3300" },
  ];

  const buttons = buttonsData.map(({ name, label }) => {
    const active = props.filter === name;
    const clazz = active ? "btn-light" : "btn-outline-light";
    return (
      <button
        type="button"
        className={`btn ${clazz}`}
        key={name}
        onClick={() => props.onFilterSelect(name)}
      >
        {label}
      </button>
    )
  });

  return <div className="btn-group">{buttons}</div>;
};

export default AppFilter;
