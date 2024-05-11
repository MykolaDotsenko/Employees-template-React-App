import AppInfo from "../app-info/app-info";
import SearchPanel from "../search-panel/search-panel";
import AppFilter from "../app-filter/app-filter";
import EmployeesList from "../employees-list/employees-list";
import EmployeesAddForm from "../employees-add-form/employees-add-form";

import "./app.css";

function App() {
  const data = [
    { name: "Mykola", salary: 3500, increase: false, id: 1 },
    { name: "Dennis", salary: 3300, increase: true, id: 2 },
    { name: "Juan", salary: 3350, increase: false, id: 3 },
    { name: "Ping", salary: 3200, increase: false, id: 4 },
  ];
  return (
    <div className="app">
      <AppInfo />

      <div className="search-panel">
        <SearchPanel />
        <AppFilter />
      </div>

      <EmployeesList data={data} />
      <EmployeesAddForm />
    </div>
  );
}

export default App;
