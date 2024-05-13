import React, { Component } from 'react';
import './employees-add-form.css';

class EmployeesAddForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      salary: ''
    };
  }

  onValueChange = (e) => {
    this.setState({
      [e.target.name]: e.target.value
    });
  }

  onSubmitForm = (e) => {
    e.preventDefault();
    const { name, salary } = this.state;
    // Check if both name and salary are provided
    if (name.trim() && salary.trim()) {
      this.props.onAdd(name, salary);
      // Clear the input fields after adding the employee
      this.setState({ name: '', salary: '' });
    }
  }

  render() {
    const { name, salary } = this.state;

    return (
      <div className="app-add-form">
        <h3>Add new employees</h3>
        <form className="add-form d-flex" onSubmit={this.onSubmitForm}>
          <input
            type="text"
            className="form-control new-post-label"
            placeholder="What is his name?"
            name='name'
            value={name}
            onChange={this.onValueChange}
          />
          <input
            type="number"
            className="form-control new-post-label"
            placeholder="Salary in $?"
            name='salary'
            value={salary}
            onChange={this.onValueChange}
          />
          <button type="submit" className="btn btn-outline-light">Add</button>
        </form>
      </div>
    );
  }
}

export default EmployeesAddForm;
