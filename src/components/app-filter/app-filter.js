import "./app-filter.css";

const AppFilter = () => {
  return (
    <div className="btn-group">
      <button type="button" className="btn btn-light">
        All employees
      </button>
      <button type="button" className="btn btn-outline-light">
        Up for promotion
      </button>
      <button type="button" className="btn btn-outline-light">
      Salary more than $10000
      </button>
    </div>
  );
};

export default AppFilter;
